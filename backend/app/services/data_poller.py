import asyncio
import logging
import pandas as pd
from typing import List, Callable, Any, Dict, Optional
from datetime import datetime, timezone
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.models.watchlist import WatchlistEntry
from app.services.providers import YFinanceProvider
from app.services.alert_engine import AlertEngine
from app.services import indicators
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
    # Alternative format: BTC/USD, ETH/USD
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
        rate_limit_sleep: int = 12,
        market_hours_service: Optional[MarketHoursService] = None
    ):
        self.yf_provider = yf_provider
        self.symbols = symbols
        self.interval = interval # Seconds
        self.is_running = False
        self.db_session_factory = db_session_factory
        self.alert_engine = alert_engine
        self.indicator_cache: Dict[str, Dict[str, Any]] = {} # ticker -> indicator_data
        self.rate_limit_sleep = rate_limit_sleep
        self._stop_event = asyncio.Event()
        self.market_hours_service = market_hours_service or MarketHoursService()

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
                    # Use YFinanceProvider to fetch daily candles
                    from datetime import timedelta
                    end_date = datetime.now(timezone.utc)
                    start_date = end_date - timedelta(days=2)  # Get last 2 days to ensure we have latest data
                    candles = await self.yf_provider.fetch_candles(ticker, "1d", start_date, end_date)

                    symbol_id = None
                    if self.db_session_factory:
                        symbol_id = await self._save_candles_to_db(ticker, candles)

                    if self.alert_engine and candles and symbol_id:
                        # 1. Calculate Indicators
                        if len(candles) > 1:  # Need at least 2 candles for indicator calculation
                            df = pd.DataFrame(candles)
                            df_crsi = indicators.calculate_crsi(df)

                            latest_crsi = df_crsi.iloc[-1]
                            prev_crsi = df_crsi.iloc[-2] if len(df_crsi) > 1 else None

                            indicator_data = {
                                "crsi": latest_crsi["cRSI"],
                                "crsi_upper": latest_crsi["cRSI_UpperBand"],
                                "crsi_lower": latest_crsi["cRSI_LowerBand"],
                            }

                            if prev_crsi is not None:
                                indicator_data.update({
                                    "prev_crsi": prev_crsi["cRSI"],
                                    "prev_crsi_upper": prev_crsi["cRSI_UpperBand"],
                                    "prev_crsi_lower": prev_crsi["cRSI_LowerBand"],
                                })

                            print(f"DEBUG Indicator data for {ticker}: {indicator_data}")

                            # 2. Cache Indicators
                            self.indicator_cache[ticker] = indicator_data

                            # 3. Evaluate Alerts
                            latest_close = candles[-1]["close"]
                            bar_timestamp = candles[-1].get("timestamp")  # Get bar timestamp for trigger mode tracking
                            await self.alert_engine.evaluate_symbol_alerts(
                                symbol_id,
                                latest_close,
                                indicator_data=indicator_data,
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

        This method queries the watchlist table, joins with the symbol table,
        and updates the internal symbols list with all ticker symbols.
        """
        if not self.db_session_factory:
            logger.warning("No db_session_factory provided, cannot load watchlist from database")
            return

        try:
            async with self.db_session_factory() as session:
                # Query watchlist entries with their symbols
                result = await session.execute(
                    select(Symbol.ticker)
                    .join(WatchlistEntry, WatchlistEntry.symbol_id == Symbol.id)
                    .order_by(WatchlistEntry.added_at)
                )
                tickers = result.scalars().all()

                new_symbols = list(tickers)

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
        # Returns symbol_id
        async with self.db_session_factory() as session:
            # 1. Get or Create Symbol
            result = await session.execute(select(Symbol).filter(Symbol.ticker == ticker))
            symbol = result.scalars().first()
            if not symbol:
                symbol = Symbol(ticker=ticker)
                session.add(symbol)
                await session.commit()
                await session.refresh(symbol)

            symbol_id = symbol.id

            # 2. Save Candles
            latest_candle_result = await session.execute(
                select(Candle).filter(Candle.symbol_id == symbol.id).order_by(Candle.timestamp.desc()).limit(1)
            )
            latest_candle = latest_candle_result.scalars().first()
            latest_timestamp = latest_candle.timestamp if latest_candle else None

            new_candles = []
            for c_data in candles_data:
                # YFinanceProvider returns timestamps directly, not date strings
                c_timestamp = c_data["timestamp"]

                if latest_timestamp and c_timestamp <= latest_timestamp:
                     continue

                candle = Candle(
                    symbol_id=symbol.id,
                    timestamp=c_timestamp,
                    interval="1d", # DataPoller currently only fetches daily candles
                    open=c_data["open"],
                    high=c_data["high"],
                    low=c_data["low"],
                    close=c_data["close"],
                    volume=c_data["volume"]
                )
                session.add(candle)
                new_candles.append(candle)

            await session.commit()
            logger.info(f"Saved {len(new_candles)} new candles for {ticker}")
            return symbol_id
