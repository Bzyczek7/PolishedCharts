import logging
import asyncio
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.candles import CandleService
from app.services.providers import YFinanceProvider
from app.services.gap_detector import GapDetector

logger = logging.getLogger(__name__)

class DataOrchestrator:
    def __init__(self, candle_service: CandleService, yf_provider: YFinanceProvider):
        self.candle_service = candle_service
        self.yf_provider = yf_provider

    async def get_candles(
        self, 
        db: AsyncSession, 
        symbol_id: int, 
        ticker: str, 
        interval: str, 
        start: Optional[datetime] = None, 
        end: Optional[datetime] = None,
        local_only: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Main entry point for getting candles. 
        Checks cache, identifies gaps, fetches missing segments, and returns merged result.
        """
        if not start or not end:
            # Default window if not provided
            delta = self.yf_provider._get_default_lookback(interval)
            end = end or datetime.now(timezone.utc)
            start = start or (end - delta)
        
        # Ensure start and end are aware (UTC) if they were passed as naive
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        # FEATURE 014: Check candle cache first
        from app.services.cache import get_candle_data, cache_candle_data
        from app.services.performance import performance_logger

        cached_candles = get_candle_data(ticker, interval, start, end)
        if cached_candles is not None:
            logger.debug(f"Candle cache hit for {ticker} ({interval})")
            performance_logger.record(
                operation="get_candles_cache_hit",
                duration_ms=0.5,  # Sub-millisecond for cache hit
                category="cache",
                context={"symbol": ticker, "interval": interval}
            )
            return cached_candles

        logger.debug(f"Candle cache miss for {ticker} ({interval})")

        # 1. Identify Gaps (only if not local_only)
        if not local_only:
            gaps = await self.candle_service.find_gaps(db, symbol_id, ticker, interval, start, end)

            if gaps:
                logger.info(f"Found {len(gaps)} gaps for {ticker} ({interval}) in range {start} to {end}")

                # Check if total missing bars exceed hard cap
                total_missing = 0
                from app.core.intervals import get_interval_delta
                delta = get_interval_delta(interval)
                for g_start, g_end in gaps:
                    total_missing += (g_end - g_start) / delta + 1

                HARD_CAP = 10000 # Increased to allow more history in dynamic fills
                if total_missing > HARD_CAP:
                    logger.warning(f"Gap size {total_missing} exceeds hard cap of {HARD_CAP}. Skipping dynamic fill.")
                    # In Phase 3/4 we might return 'needs_backfill: True'
                else:
                    # Optimize: Instead of filling each gap individually,
                    # find the total range covering all gaps and fetch it once.
                    all_gap_starts = [g[0] for g in gaps]
                    all_gap_ends = [g[1] for g in gaps]

                    fill_start = min(all_gap_starts)
                    fill_end = max(all_gap_ends)

                    # Ensure aware
                    if fill_start.tzinfo is None:
                        fill_start = fill_start.replace(tzinfo=timezone.utc)
                    if fill_end.tzinfo is None:
                        fill_end = fill_end.replace(tzinfo=timezone.utc)

                    logger.info(f"Filling gaps with single fetch: {fill_start} to {fill_end}")
                    try:
                        # Timeout protection: don't hang the API request (increased from 10s to 30s)
                        await asyncio.wait_for(
                            self.fetch_and_save(db, symbol_id, ticker, interval, fill_start, fill_end),
                            timeout=30.0
                        )
                    except asyncio.TimeoutError:
                        logger.error(f"Gap filling timed out for {ticker} ({interval})")
                        # Rollback the transaction to prevent "invalid transaction" errors
                        await db.rollback()
                    except Exception as e:
                        logger.error(f"Error filling gaps for {ticker}: {e}")
                        # Rollback on any error to prevent transaction issues
                        await db.rollback()

        # 2. Fetch all from DB
        # We re-query the full range to ensure we have a continuous, sorted, deduplicated set.
        # This is slightly less efficient than merging in memory, but much safer for data integrity.
        from sqlalchemy.future import select
        from app.models.candle import Candle
        
        stmt = select(Candle).where(
            Candle.symbol_id == symbol_id,
            Candle.interval == interval,
            Candle.timestamp >= start,
            Candle.timestamp <= end
        ).order_by(Candle.timestamp.asc())
        
        result = await db.execute(stmt)
        candles = result.scalars().all()

        # Filter out candles with invalid price data
        valid_candles = []
        for c in candles:
            # Check if any of the price values are invalid
            if (c.open is not None and math.isfinite(c.open) and
                c.high is not None and math.isfinite(c.high) and
                c.low is not None and math.isfinite(c.low) and
                c.close is not None and math.isfinite(c.close)):
                valid_candles.append({
                    "timestamp": c.timestamp,
                    "open": float(c.open),
                    "high": float(c.high),
                    "low": float(c.low),
                    "close": float(c.close),
                    "volume": int(c.volume) if (c.volume is not None and math.isfinite(c.volume)) else 0,  # Use 0 instead of None for volume
                    "interval": c.interval,
                    "ticker": ticker
                })

        # FEATURE 014: Cache the results after DB query
        try:
            cache_candle_data(ticker, interval, start, end, valid_candles)
            logger.debug(f"Cached {len(valid_candles)} candles for {ticker} ({interval})")
        except Exception as e:
            # Graceful degradation: cache failure should not break the endpoint
            logger.warning(f"Failed to cache candle data for {ticker}: {e}")

        return valid_candles

    async def fetch_and_save(
        self,
        db: AsyncSession,
        symbol_id: int,
        ticker: str,
        interval: str,
        start: datetime,
        end: datetime
    ):
        """
        Fetch data for a range and save to DB.
        """
        # Use yfinance for all data fetching
        try:
            candles = await self.yf_provider.fetch_candles(ticker, interval, start, end)
        except Exception as e:
            logger.error(f"yfinance failed for {ticker}: {e}")
            raise e

        if candles:
            # Prepare for upsert
            await self.candle_service.upsert_candles(db, symbol_id, interval, candles)
