import asyncio
import logging
from typing import List, Callable, Any
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.services.alpha_vantage import AlphaVantageService

logger = logging.getLogger(__name__)

class DataPoller:
    def __init__(self, alpha_vantage_service: AlphaVantageService, symbols: List[str], interval: int = 3600, db_session_factory: Callable[[], Any] = None):
        self.av_service = alpha_vantage_service
        self.symbols = symbols
        self.interval = interval # Seconds
        self.is_running = False
        self.db_session_factory = db_session_factory

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
                    if self.db_session_factory:
                        await self._save_candles_to_db(ticker, candles)
                except Exception as e:
                    logger.error(f"Error fetching data for {ticker}: {e}")
                
                # Simple rate limit handling: wait a bit between symbols if needed
                await asyncio.sleep(12) # 5 calls per minute (free tier) -> 12s per call

            # Wait for next interval
            await asyncio.sleep(self.interval)

    def stop(self):
        self.is_running = False
        logger.info("Stopping DataPoller...")

    async def _save_candles_to_db(self, ticker: str, candles_data: List[dict]):
        # Just use the factory directly if it's an async context manager or returns a session
        # Assuming db_session_factory returns an AsyncSession or context manager
        
        # We need to handle the factory correctly. 
        # If it's the `get_db` dependency it's an async generator.
        # If it's `AsyncSessionLocal` it's a class.
        
        # For simplicity in this implementation, let's assume it returns an AsyncSession context manager
        # But `get_db` is an async generator.
        
        # Let's support a simple async context manager factory
        async with self.db_session_factory() as session:
            # 1. Get or Create Symbol
            result = await session.execute(select(Symbol).filter(Symbol.ticker == ticker))
            symbol = result.scalars().first()
            if not symbol:
                symbol = Symbol(ticker=ticker)
                session.add(symbol)
                await session.commit()
                await session.refresh(symbol)
            
            # 2. Save Candles
            # For efficiency, we should probably check existence or use upsert.
            # For MVP, let's just insert checking for duplicates is slow one by one.
            # A better way is to get the latest candle for the symbol and only insert newer ones.
            
            latest_candle_result = await session.execute(
                select(Candle).filter(Candle.symbol_id == symbol.id).order_by(Candle.timestamp.desc()).limit(1)
            )
            latest_candle = latest_candle_result.scalars().first()
            latest_timestamp = latest_candle.timestamp if latest_candle else None

            new_candles = []
            for c_data in candles_data:
                # Alpha Vantage returns date strings "YYYY-MM-DD". Need to convert to datetime if model expects it.
                # Or relying on implicit conversion? better be explicit.
                # Assuming model handles string assignment or we parse it.
                # Candle.timestamp is DateTime.
                
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
            
            await session.commit()
            logger.info(f"Saved {len(new_candles)} new candles for {ticker}")
