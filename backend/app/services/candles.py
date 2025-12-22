import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy.future import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.candle import Candle

logger = logging.getLogger(__name__)

class CandleService:
    _locks: Dict[tuple, asyncio.Lock] = {}

    def _get_lock(self, symbol_id: int, interval: str) -> asyncio.Lock:
        key = (symbol_id, interval)
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    async def upsert_candles(
        self, 
        db: AsyncSession, 
        symbol_id: int, 
        interval: str, 
        candles_data: List[Dict[str, Any]]
    ):
        """
        Bulk upsert candles for a given symbol and interval.
        Uses a lock to prevent concurrent backfills for the same (symbol, interval).
        """
        lock = self._get_lock(symbol_id, interval)
        
        async with lock:
            if not candles_data:
                return

            # Prepare values for bulk insert
            values = []
            for c in candles_data:
                values.append({
                    "symbol_id": symbol_id,
                    "interval": interval,
                    "timestamp": c["timestamp"],
                    "open": c["open"],
                    "high": c["high"],
                    "low": c["low"],
                    "close": c["close"],
                    "volume": c.get("volume", 0)
                })

            # PostgreSQL specific ON CONFLICT DO UPDATE
            stmt = insert(Candle).values(values)
            
            update_dict = {
                "open": stmt.excluded.open,
                "high": stmt.excluded.high,
                "low": stmt.excluded.low,
                "close": stmt.excluded.close,
                "volume": stmt.excluded.volume,
            }

            stmt = stmt.on_conflict_do_update(
                index_elements=["symbol_id", "interval", "timestamp"],
                set_=update_dict
            )

            await db.execute(stmt)
            await db.commit()
            logger.info(f"Upserted {len(values)} candles for symbol_id={symbol_id}, interval={interval}")

    async def find_gaps(
        self, 
        db: AsyncSession, 
        symbol_id: int, 
        interval: str, 
        start: datetime, 
        end: datetime
    ) -> List[tuple]:
        """
        Identify missing data segments within a given range.
        Returns a list of (start, end) tuples representing the gaps.
        """
        # 1. Fetch all existing timestamps in the range
        stmt = select(Candle.timestamp).where(
            Candle.symbol_id == symbol_id,
            Candle.interval == interval,
            Candle.timestamp >= start,
            Candle.timestamp <= end
        ).order_by(Candle.timestamp.asc())
        
        result = await db.execute(stmt)
        # result.all() returns rows, each row is a tuple (timestamp,)
        existing_ts = []
        for r in result.all():
            ts = r[0]
            if ts.tzinfo is None:
                from datetime import timezone
                ts = ts.replace(tzinfo=timezone.utc)
            existing_ts.append(ts)
        
        gaps = []
        
        if not existing_ts:
            return [(start, end)]
            
        # Check for gap at the beginning (Head)
        # Using a small buffer (half interval) to avoid precision issues
        buffer = self._get_interval_delta(interval) / 2
        
        if existing_ts[0] > (start + buffer):
            # The gap ends just before the first existing timestamp
            gap_end = existing_ts[0] - self._get_interval_delta(interval)
            if gap_end >= start:
                gaps.append((start, gap_end))
                
        # Check for gaps in the middle
        for i in range(len(existing_ts) - 1):
            curr = existing_ts[i]
            nxt = existing_ts[i+1]
            
            expected_next = curr + self._get_interval_delta(interval)
            # If next is significantly after expected next (more than 1.5x interval)
            if nxt > (expected_next + buffer):
                # There's a gap
                gaps.append((expected_next, nxt - self._get_interval_delta(interval)))
                
        # Check for gap at the end (Tail)
        if existing_ts[-1] < (end - buffer):
            gap_start = existing_ts[-1] + self._get_interval_delta(interval)
            if gap_start <= end:
                gaps.append((gap_start, end))
                
        return gaps

    def _get_interval_delta(self, interval: str) -> timedelta:
        # yfinance intervals: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
        mapping = {
            "1m": timedelta(minutes=1),
            "2m": timedelta(minutes=2),
            "5m": timedelta(minutes=5),
            "15m": timedelta(minutes=15),
            "30m": timedelta(minutes=30),
            "60m": timedelta(hours=1),
            "90m": timedelta(minutes=90),
            "1h": timedelta(hours=1),
            "1d": timedelta(days=1),
            "5d": timedelta(days=5),
            "1w": timedelta(weeks=1),
            "1wk": timedelta(weeks=1),
            "1mo": timedelta(days=30), # Approximation, but good enough for gap detection
        }
        return mapping.get(interval, timedelta(days=1))
