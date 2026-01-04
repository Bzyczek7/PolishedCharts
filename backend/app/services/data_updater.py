import asyncio
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.symbol import Symbol
from app.services.providers import YFinanceProvider
from app.services.candles import CandleService
from app.core.config import settings

logger = logging.getLogger(__name__)

class DataUpdater:
    """
    Service for automatically updating market data at scheduled intervals
    """
    def __init__(self):
        self.yf_provider = YFinanceProvider()
        self.candle_service = CandleService()
        self.update_intervals = {
            "1m": 900,    # 15 minutes (900 seconds)
            "2m": 1800,   # 30 minutes (1800 seconds)
            "5m": 1800,   # 30 minutes (1800 seconds)
            "15m": 1800,  # 30 minutes (1800 seconds)
            "30m": 1800,  # 30 minutes (1800 seconds)
            "1h": 3600,   # 1 hour (3600 seconds)
            "4h": 14400,  # 4 hours (14400 seconds)
            "1d": 86400,  # 1 day (86400 seconds)
            "1wk": 604800 # 1 week (604800 seconds)
        }
        self.is_running = False
        self.update_tasks = {}
        self.engine = create_async_engine(settings.async_database_url)
        self.SessionLocal = sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

    async def start_updates(self):
        """Start the automated data update service"""
        logger.info("Starting automated data update service...")
        self.is_running = True
        
        # Get all symbols that need updates
        async with self.SessionLocal() as session:
            result = await session.execute(select(Symbol))
            symbols = result.scalars().all()
        
        logger.info(f"Found {len(symbols)} symbols to update")
        
        # Start update tasks for each symbol and interval combination
        for symbol in symbols:
            for interval in self.update_intervals.keys():
                task_name = f"{symbol.ticker}_{interval}"
                self.update_tasks[task_name] = asyncio.create_task(
                    self._run_update_task(symbol.ticker, interval)
                )
        
        logger.info("All update tasks started")
    
    async def _run_update_task(self, symbol: str, interval: str):
        """Run update task for a specific symbol and interval"""
        interval_seconds = self.update_intervals[interval]
        
        while self.is_running:
            try:
                logger.info(f"Updating data for {symbol} with interval {interval}")
                await self.update_symbol_data(symbol, interval)
                
                # Wait for the specified interval before next update
                # Add some jitter to prevent all updates from happening simultaneously
                jitter = random.uniform(-0.1, 0.1) * interval_seconds
                await asyncio.sleep(interval_seconds + jitter)
                
            except Exception as e:
                logger.error(f"Error updating {symbol} ({interval}): {e}")
                # Wait a bit before retrying to avoid rapid error loops
                await asyncio.sleep(60)
    
    async def update_symbol_data(self, symbol: str, interval: str):
        """Update data for a specific symbol and interval"""
        try:
            # Determine the appropriate time range based on interval
            now = datetime.now(timezone.utc)
            
            if interval in ["1m", "2m", "5m", "15m", "30m"]:
                # For intraday intervals, update last few hours of data
                start = now - timedelta(hours=24)  # Last 24 hours for intraday
            elif interval == "1h":
                # For 1-hour interval, update last few days
                start = now - timedelta(days=7)  # Last 7 days
            elif interval == "4h":
                # For 4-hour interval, update last few days
                start = now - timedelta(days=14)  # Last 14 days
            elif interval == "1d":
                # For daily interval, update last few weeks
                start = now - timedelta(days=30)  # Last 30 days
            elif interval in ["1wk", "1w"]:
                # For weekly interval, update last few months
                start = now - timedelta(weeks=12)  # Last 12 weeks
            else:
                # Default fallback
                start = now - timedelta(days=7)
            
            # Fetch latest data from provider
            candles = await self.yf_provider.fetch_candles(
                symbol=symbol,
                interval=interval,
                start=start,
                end=now
            )
            
            if candles:
                # Save to database using atomic upsert (no race condition)
                async with self.SessionLocal() as session:
                    symbol_result = await session.execute(
                        select(Symbol.id).where(Symbol.ticker == symbol)
                    )
                    symbol_id = symbol_result.scalar_one_or_none()

                    if symbol_id:
                        await self.candle_service.upsert_candles(
                            session, symbol_id, interval, candles
                        )
                        await session.commit()

                # Invalidate cache
                from app.services.cache import invalidate_symbol
                invalidate_symbol(symbol)
                logger.info(f"Updated {len(candles)} candles for {symbol} ({interval})")
            else:
                logger.warning(f"No new data fetched for {symbol} ({interval})")
                
        except Exception as e:
            logger.error(f"Error updating data for {symbol} ({interval}): {e}")
            raise

    async def stop_updates(self):
        """Stop all update tasks"""
        logger.info("Stopping automated data update service...")
        self.is_running = False

        # Cancel all running tasks
        for task in self.update_tasks.values():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass  # Expected when cancelling tasks

        self.update_tasks.clear()
        logger.info("All update tasks stopped")

    async def force_update_symbol(self, symbol: str, interval: str = None):
        """Force an immediate update for a specific symbol"""
        intervals = [interval] if interval else self.update_intervals.keys()

        for interval in intervals:
            try:
                await self.update_symbol_data(symbol, interval)
                logger.info(f"Force updated {symbol} ({interval})")
            except Exception as e:
                logger.error(f"Error force updating {symbol} ({interval}): {e}")