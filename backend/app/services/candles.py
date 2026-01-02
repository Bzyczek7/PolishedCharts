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

        Normalizes timestamps to midnight (00:00:00 UTC) for 1d and 1wk intervals
        to prevent duplicate candles with different times for the same day.
        """
        lock = self._get_lock(symbol_id, interval)

        async with lock:
            if not candles_data:
                return

            # Prepare values for bulk insert
            values = []
            for c in candles_data:
                timestamp = c["timestamp"]

                # Normalize timestamps to midnight for 1d and 1wk intervals
                # This prevents duplicate entries where one has time component and one doesn't
                if interval in ('1d', '1wk'):
                    if isinstance(timestamp, str):
                        timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    # Truncate to midnight (00:00:00) for daily/weekly intervals
                    from datetime import datetime, timezone
                    if timestamp.tzinfo is None:
                        timestamp = timestamp.replace(tzinfo=timezone.utc)
                    timestamp = timestamp.replace(hour=0, minute=0, second=0, microsecond=0)

                values.append({
                    "symbol_id": symbol_id,
                    "interval": interval,
                    "timestamp": timestamp,
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
        ticker: str,
        interval: str, 
        start: datetime, 
        end: datetime
    ) -> List[tuple]:
        """
        Identify missing data segments within a given range.
        Returns a list of (start, end) tuples representing the gaps.
        """
        from app.services.gap_detector import GapDetector
        detector = GapDetector()

        # 1. Fetch all existing timestamps in the range
        stmt = select(Candle.timestamp).where(
            Candle.symbol_id == symbol_id,
            Candle.interval == interval,
            Candle.timestamp >= start,
            Candle.timestamp <= end
        ).order_by(Candle.timestamp.asc())
        
        result = await db.execute(stmt)
        existing_ts = [r[0] for r in result.all()]
        
        return detector.detect_gaps(existing_ts, start, end, interval, ticker)

    def _get_interval_delta(self, interval: str) -> timedelta:
        from app.core.intervals import get_interval_delta
        return get_interval_delta(interval)
