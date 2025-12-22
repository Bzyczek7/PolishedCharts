import asyncio
import logging
from typing import List, Dict, Any
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
                constraint="uq_candle_symbol_interval_timestamp",
                set_=update_dict
            )

            await db.execute(stmt)
            await db.commit()
            logger.info(f"Upserted {len(values)} candles for symbol_id={symbol_id}, interval={interval}")
