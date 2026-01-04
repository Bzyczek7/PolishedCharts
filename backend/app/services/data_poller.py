import asyncio
import logging
import json
import pandas as pd
from typing import List, Callable, Any, Dict, Optional
from datetime import datetime, timezone
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.symbol import Symbol
from app.services.providers import YFinanceProvider
from app.services.candles import CandleService
from app.services.alert_engine import AlertEngine
from app.services.indicator_service import IndicatorService
from app.services.market_hours import MarketHoursService

logger = logging.getLogger(__name__)


def is_crypto_ticker(ticker: str) -> bool:
    """
    Check if a ticker is a crypto asset (24/7, no market-hours gating).

    Crypto tickers typically use formats like BTC-USD or ETH/USD.

    Args:
        ticker: The ticker symbol to check

    Returns:
        True if this appears to be a crypto ticker
    """
    # yfinance crypto format: BTC-USD, ETH-USD, etc.
    if '-' in ticker and ticker.endswith('-USD'):
        return True
    # Alternative crypto format with slash separator
    if '/' in ticker and ticker.endswith('/USD'):
        return True
    return False


class DataPoller:
    def __init__(
        self,
        yf_provider: YFinanceProvider,
        symbols: List[str],
        interval: int = 3600,
        db_session_factory: Callable[[], Any] = None,
        alert_engine: AlertEngine = None,
        indicator_service: IndicatorService = None,
        rate_limit_sleep: int = 12,
        market_hours_service: Optional[MarketHoursService] = None
    ):
        self.yf_provider = yf_provider
        self.symbols = symbols
        self.interval = interval # Seconds
        self.is_running = False
        self.db_session_factory = db_session_factory
        self.alert_engine = alert_engine
        self.indicator_service = indicator_service
        self.indicator_cache: Dict[str, Dict[str, Any]] = {} # ticker -> indicator_data
        self.rate_limit_sleep = rate_limit_sleep
        self._stop_event = asyncio.Event()
        self.market_hours_service = market_hours_service or MarketHoursService()
        self.candle_service = CandleService()

    async def start(self):
        self.is_running = True
        self._stop_event.clear()
        logger.info("Starting DataPoller...")

        while self.is_running:
            # Re-read watchlist from database on each iteration
            if self.db_session_factory:
                try:
                    await self.load_watchlist_from_db()
                except Exception as e:
                    logger.warning(f"Failed to load watchlist from database (continuing with existing symbols): {e}")

            for ticker in self.symbols:
                if not self.is_running:
                    break

                # Market-hours gating for equities (not crypto)
                if not is_crypto_ticker(ticker):
                    skip, reason = self.market_hours_service.should_skip_equity_polling()
                    if skip:
                        logger.info(f"skipped_equity_polling: ticker={ticker}, reason={reason}")
                        continue  # Skip to next ticker

                try:
                    logger.info(f"Fetching data for {ticker}")
                    # Strategy: DB-first, then yfinance for missing data only
                    candles = await self._fetch_candles_db_first(ticker)

                    symbol_id = None
                    if self.db_session_factory and candles:
                        symbol_id = await self._save_candles_to_db(ticker, candles)

                    if self.alert_engine and candles and symbol_id:
                        # 1. Calculate custom indicators for active alerts
                        if self.indicator_service and len(candles) > 1:
                            async with self.db_session_factory() as session:
                                # Fetch active alerts for this symbol that have indicator_name set
                                from app.models.alert import Alert
                                result = await session.execute(
                                    select(Alert).filter(
                                        Alert.symbol_id == symbol_id,
                                        Alert.is_active == True,
                                        Alert.indicator_name.isnot(None)
                                    )
                                )
                                active_alerts = result.scalars().all()

                            # Calculate indicators for each alert using IndicatorService
                            indicator_data_map = {}  # alert_id -> indicator_data
                            for alert in active_alerts:
                                try:
                                    async with self.db_session_factory() as session:
                                        indicator_data = await self.indicator_service.calculate_for_alert(
                                            db=session,
                                            alert=alert,
                                        )

                                    if indicator_data:
                                        indicator_data_map[alert.id] = indicator_data
                                        # Add price field for alert engine
                                        indicator_data["price"] = candles[-1]["close"]
                                        logger.debug(
                                            f"Calculated {alert.indicator_name} for alert {alert.id}: "
                                            f"value={indicator_data.get('value')}, "
                                            f"prev_value={indicator_data.get('prev_value')}"
                                        )
                                except Exception as e:
                                    logger.warning(
                                        f"Failed to calculate indicator for alert {alert.id} ({alert.indicator_name}): {e}"
                                    )

                            # Cache indicator data for compatibility
                            if indicator_data_map:
                                # Use ticker as key, with dict of alert_id -> indicator_data
                                self.indicator_cache[ticker] = indicator_data_map

                        # 2. Evaluate Alerts with indicator_data_map
                        latest_close = candles[-1]["close"]
                        bar_timestamp = candles[-1].get("timestamp")  # Get bar timestamp for trigger mode tracking

                        # Pass indicator_data_map if available, otherwise evaluate without indicators
                        await self.alert_engine.evaluate_symbol_alerts(
                            symbol_id,
                            latest_close,
                            indicator_data=None,  # Legacy per-symbol indicator data
                            indicator_data_map=indicator_data_map if indicator_data_map else None,  # New per-alert indicator data
                            bar_timestamp=bar_timestamp
                        )

                except Exception as e:
                    logger.error(f"Error fetching data for {ticker}: {e}")
                    # Note: YFinanceProvider already handles retries with tenacity
                    # No additional retry logic needed here

                # Simple rate limit handling: wait a bit between symbols if needed
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=self.rate_limit_sleep)
                    break # Stop if event is set
                except asyncio.TimeoutError:
                    pass

            if not self.is_running:
                break

            # Wait for next interval
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval)
                break # Stop if event is set
            except asyncio.TimeoutError:
                pass

    async def load_watchlist_from_db(self) -> None:
        """
        Load watchlist entries from database and update self.symbols.

        This method queries the user_watchlists table which stores symbols as JSON,
        and updates the internal symbols list with all ticker symbols.
        """
        if not self.db_session_factory:
            logger.warning("No db_session_factory provided, cannot load watchlist from database")
            return

        try:
            async with self.db_session_factory() as session:
                # Query user_watchlists table (the actual user watchlist)
                result = await session.execute(
                    select(Symbol.ticker)
                )
                all_symbols = result.scalars().all()

                # Get the user's watchlist symbols from user_watchlists
                from app.models.watchlist import DefaultWatchlist, UserWatchlist
                uw_result = await session.execute(
                    select(UserWatchlist.symbols).order_by(UserWatchlist.updated_at.desc()).limit(1)
                )
                uw = uw_result.scalar()

                if uw:
                    # symbols is stored as JSON array in user_watchlists
                    if isinstance(uw, str):
                        watchlist_symbols = json.loads(uw)
                    else:
                        watchlist_symbols = uw

                    # Filter to only symbols that exist in our symbol table
                    new_symbols = [s for s in watchlist_symbols if s in all_symbols]
                else:
                    new_symbols = list(all_symbols)

                if new_symbols != self.symbols:
                    logger.info(
                        f"poller_loaded_watchlist: previous_count={len(self.symbols)}, "
                        f"new_count={len(new_symbols)}, "
                        f"added={set(new_symbols) - set(self.symbols)}, "
                        f"removed={set(self.symbols) - set(new_symbols)}"
                    )
                    self.symbols = new_symbols
                else:
                    logger.debug(f"poller_watchlist_unchanged: count={len(self.symbols)}")

        except Exception as e:
            logger.error(f"Error loading watchlist from database: {e}")

    def stop(self):
        self.is_running = False
        self._stop_event.set()
        logger.info("Stopping DataPoller...")

    async def _save_candles_to_db(self, ticker: str, candles_data: List[dict]) -> int:
        async with self.db_session_factory() as session:
            # Get symbol_id
            result = await session.execute(select(Symbol.id).where(Symbol.ticker == ticker))
            symbol_id = result.scalar_one_or_none()

            if symbol_id and candles_data:
                await self.candle_service.upsert_candles(session, symbol_id, "1d", candles_data)
                await session.commit()
                logger.info(f"Saved {len(candles_data)} candles for {ticker}")

            return symbol_id or 0

    async def _fetch_candles_db_first(self, ticker: str) -> List[dict]:
        """
        Fetch candles using DB-first strategy.

        1. Check DB for existing candles and get the latest timestamp
        2. Only fetch from yfinance the missing data (new candles since last DB entry)
        3. If no data in DB, fetch 550 days for historical backfill

        This avoids fetching 550 days from yfinance on every hourly poll.
        """
        from datetime import timedelta

        if not self.db_session_factory:
            # No DB available, fall back to full fetch
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=550)
            return await self.yf_provider.fetch_candles(ticker, "1d", start_date, end_date)

        try:
            async with self.db_session_factory() as session:
                # Get the latest candle for this ticker from DB
                result = await session.execute(
                    select(Symbol).filter(Symbol.ticker == ticker)
                )
                symbol = result.scalars().first()

                if not symbol:
                    # Symbol doesn't exist in DB yet, do full historical fetch
                    logger.info(f"_fetch_candles_db_first: new symbol {ticker}, fetching 550 days")
                    end_date = datetime.now(timezone.utc)
                    start_date = end_date - timedelta(days=550)
                    return await self.yf_provider.fetch_candles(ticker, "1d", start_date, end_date)

                # Get latest candle timestamp in DB
                latest_candle_result = await session.execute(
                    select(Candle).filter(Candle.symbol_id == symbol.id)
                    .order_by(Candle.timestamp.desc()).limit(1)
                )
                latest_candle = latest_candle_result.scalars().first()

                if not latest_candle:
                    # No candles yet, do full historical fetch
                    logger.info(f"_fetch_candles_db_first: no candles for {ticker}, fetching 550 days")
                    end_date = datetime.now(timezone.utc)
                    start_date = end_date - timedelta(days=550)
                    return await self.yf_provider.fetch_candles(ticker, "1d", start_date, end_date)

                # We have data in DB - only fetch NEW candles from yfinance
                # Fetch from just after the latest DB candle to now
                end_date = datetime.now(timezone.utc)
                start_date = latest_candle.timestamp + timedelta(days=1)

                if start_date >= end_date:
                    # Already have today's data (or data is up to date)
                    logger.debug(f"_fetch_candles_db_first: {ticker} up to date, latest={latest_candle.timestamp}")
                    # Return empty list - no new candles to process
                    return []

                logger.info(f"_fetch_candles_db_first: {ticker} fetching new data since {start_date}")
                return await self.yf_provider.fetch_candles(ticker, "1d", start_date, end_date)

        except Exception as e:
            logger.error(f"_fetch_candles_db_first: error for {ticker}: {e}")
            # Fall back to full fetch on error
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=550)
            return await self.yf_provider.fetch_candles(ticker, "1d", start_date, end_date)
