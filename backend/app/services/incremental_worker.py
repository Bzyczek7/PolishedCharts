import logging
import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy.future import select
from app.services.orchestrator import DataOrchestrator
from app.models.symbol import Symbol
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
        alert_engine: AlertEngine = None
    ):
        self.orchestrator = orchestrator
        self.db_session_factory = db_session_factory
        self.alert_engine = alert_engine

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
                    # Fetch recent candles for indicator calculation (e.g. last 100)
                    from app.models.candle import Candle
                    stmt = select(Candle).where(
                        Candle.symbol_id == symbol_obj.id,
                        Candle.interval == interval
                    ).order_by(Candle.timestamp.desc()).limit(100)
                    
                    res = await db.execute(stmt)
                    candles = res.scalars().all()
                    if not candles:
                        return
                        
                    # Reverse to chronological
                    candles = candles[::-1]
                    
                    df = pd.DataFrame([
                        {
                            "timestamp": c.timestamp,
                            "open": c.open,
                            "high": c.high,
                            "low": c.low,
                            "close": c.close,
                            "volume": c.volume
                        } for c in candles
                    ])
                    
                    # Calculate CRSI (or other indicators)
                    df_crsi = indicators.calculate_crsi(df)
                    latest_crsi = df_crsi.iloc[-1]
                    
                    indicator_data = {
                        "crsi": latest_crsi["cRSI"],
                        "crsi_upper": latest_crsi["cRSI_UpperBand"],
                        "crsi_lower": latest_crsi["cRSI_LowerBand"],
                    }
                    
                    await self.alert_engine.evaluate_symbol_alerts(
                        symbol_obj.id, 
                        candles[-1].close, 
                        indicator_data=indicator_data
                    )
                    
                logger.info(f"Incremental update for {ticker} ({interval}) complete.")

            except Exception as e:
                logger.error(f"Incremental update failed for {ticker}: {e}")
