import logging
import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy.future import select
from app.services.orchestrator import DataOrchestrator
from app.services.indicator_service import IndicatorService, BASELINE_CANDLE_COUNT
from app.models.symbol import Symbol
from app.models.alert import Alert
from app.services.alert_engine import AlertEngine
from app.services.market_schedule import MarketSchedule
import pandas as pd
from app.services import indicators

logger = logging.getLogger(__name__)

class IncrementalUpdateWorker:
    def __init__(
        self, 
        orchestrator: DataOrchestrator,
        db_session_factory,
        alert_engine: AlertEngine = None,
        indicator_service: IndicatorService = None
    ):
        self.orchestrator = orchestrator
        self.db_session_factory = db_session_factory
        self.alert_engine = alert_engine
        self.indicator_service = indicator_service

    async def run_update(self, ticker: str, interval: str):
        """
        Fetch latest candles for a symbol and interval, save them,
        and trigger alert evaluation.
        """
        ticker = ticker.upper()
        interval = interval.lower()

        # Skip incremental updates when market is closed for intraday intervals
        is_intraday = interval in ('1m', '2m', '5m', '15m', '30m', '1h', '4h')
        if is_intraday:
            market_schedule = MarketSchedule()
            if not market_schedule.is_market_open():
                logger.debug(f"Skipping incremental update for {ticker} ({interval}): market closed")
                return

        async with self.db_session_factory() as db:
            # 1. Resolve symbol
            result = await db.execute(select(Symbol).where(Symbol.ticker == ticker))
            symbol_obj = result.scalars().first()
            if not symbol_obj:
                logger.error(f"Symbol {ticker} not found for incremental update.")
                return

            # 2. Define window (e.g. last 2 days to ensure we get the latest bars)
            end = datetime.now(timezone.utc)
            start = end - timedelta(days=2)
            
            try:
                # 3. Fetch and Save (idempotent)
                await self.orchestrator.fetch_and_save(
                    db=db,
                    symbol_id=symbol_obj.id,
                    ticker=ticker,
                    interval=interval,
                    start=start,
                    end=end
                )
                
                # 4. If alert engine is provided, evaluate alerts
                if self.alert_engine:
                    from app.models.candle import Candle
                    from app.core.intervals import get_interval_delta
                    
                    # Get active alerts for this symbol with indicator_name set
                    alerts_result = await db.execute(
                        select(Alert).filter(
                            Alert.symbol_id == symbol_obj.id,
                            Alert.interval == interval,
                            Alert.is_active == True,
                            Alert.indicator_name.isnot(None)
                        )
                    )
                    active_alerts = alerts_result.scalars().all()
                    
                    if not active_alerts:
                        logger.debug(f"No active alerts for {ticker} ({interval})")
                        return
                    
                    # Calculate required candles based on the alert with max period
                    # Load at least BASELINE_CANDLE_COUNT (500) plus the max indicator period
                    max_required_candles = BASELINE_CANDLE_COUNT
                    for alert in active_alerts:
                        if alert.indicator_params:
                            # Extract max period from params
                            for key, value in alert.indicator_params.items():
                                if key in ['length', 'period', 'lookback', 'window', 'fast', 'slow',
                                          'adxvma_period', 'domcycle', 'vibration', 'cyclicmemory']:
                                    if isinstance(value, (int, float)):
                                        max_required_candles = max(max_required_candles, int(value))
                    
                    # Fetch the required number of candles from the database
                    stmt = select(Candle).where(
                        Candle.symbol_id == symbol_obj.id,
                        Candle.interval == interval
                    ).order_by(Candle.timestamp.desc()).limit(max_required_candles)
                    
                    res = await db.execute(stmt)
                    candles = res.scalars().all()
                    if not candles:
                        logger.warning(f"No candles found for {ticker} ({interval})")
                        return
                    
                    # Reverse to chronological order
                    candles = list(reversed(candles))
                    
                    logger.debug(
                        f"Fetched {len(candles)} candles for alert evaluation "
                        f"(max indicator period: {max_required_candles - BASELINE_CANDLE_COUNT})"
                    )
                    
                    latest_close = candles[-1].close
                    bar_timestamp = candles[-1].timestamp
                    
                    # Calculate indicators for each alert using IndicatorService
                    indicator_data_map = {}
                    for alert in active_alerts:
                        try:
                            if self.indicator_service:
                                # Use IndicatorService for proper calculation with sufficient candles
                                indicator_data = await self.indicator_service.calculate_for_alert(
                                    db=db,
                                    alert=alert
                                )
                                if indicator_data:
                                    indicator_data_map[alert.id] = indicator_data
                                    # Add price field for alert engine
                                    indicator_data["price"] = latest_close
                                    logger.debug(
                                        f"Calculated {alert.indicator_name} for alert {alert.id}: "
                                        f"value={indicator_data.get('value')}, "
                                        f"prev_value={indicator_data.get('prev_value')}"
                                    )
                        except Exception as e:
                            logger.warning(
                                f"Failed to calculate indicator for alert {alert.id} "
                                f"({alert.indicator_name}): {e}"
                            )
                    
                    # Evaluate alerts with calculated indicator data
                    await self.alert_engine.evaluate_symbol_alerts(
                        symbol_obj.id,
                        latest_close,
                        indicator_data=None,  # Legacy per-symbol indicator data
                        indicator_data_map=indicator_data_map if indicator_data_map else None,
                        bar_timestamp=bar_timestamp
                    )
                    
                logger.info(f"Incremental update for {ticker} ({interval}) complete.")

            except Exception as e:
                logger.error(f"Incremental update failed for {ticker}: {e}")
