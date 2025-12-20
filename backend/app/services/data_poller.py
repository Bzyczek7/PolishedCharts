import asyncio
import logging
from typing import List, Callable, Any
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.services.alpha_vantage import AlphaVantageService
from app.services.alert_engine import AlertEngine

logger = logging.getLogger(__name__)

class DataPoller:
    def __init__(self, alpha_vantage_service: AlphaVantageService, symbols: List[str], interval: int = 3600, db_session_factory: Callable[[], Any] = None, alert_engine: AlertEngine = None):
        self.av_service = alpha_vantage_service
        self.symbols = symbols
        self.interval = interval # Seconds
        self.is_running = False
        self.db_session_factory = db_session_factory
        self.alert_engine = alert_engine

    async def start(self):
        self.is_running = True
        logger.info("Starting DataPoller...")
        while self.is_running:
            for ticker in self.symbols:
                if not self.is_running:
                    break
                try:
                    logger.info(f"Fetching data for {ticker}")
                    candles = await self.av_service.fetch_daily_candles(ticker)
                    
                    symbol_id = None
                    if self.db_session_factory:
                        symbol_id = await self._save_candles_to_db(ticker, candles)
                    
                    if self.alert_engine and candles and symbol_id:
                        latest_close = candles[-1]["close"]
                        await self.alert_engine.evaluate_symbol_alerts(symbol_id, latest_close)

                except Exception as e:
                    logger.error(f"Error fetching data for {ticker}: {e}")
                
                # Simple rate limit handling: wait a bit between symbols if needed
                await asyncio.sleep(12) # 5 calls per minute (free tier) -> 12s per call

            # Wait for next interval
            await asyncio.sleep(self.interval)

    def stop(self):
        self.is_running = False
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
                from datetime import datetime
                c_date = datetime.strptime(c_data["date"], "%Y-%m-%d")
                
                if latest_timestamp and c_date <= latest_timestamp.replace(tzinfo=None):
                     continue

                candle = Candle(
                    symbol_id=symbol.id,
                    timestamp=c_date,
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
