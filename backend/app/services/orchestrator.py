import logging
import asyncio
import math
from datetime import datetime, timezone, timedelta
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
        import time
        total_start = time.time()

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

        # FIX: For daily intervals, don't include "today" in the request
        # Today's candle doesn't exist until the day closes, so requesting up to "now"
        # returns 0 candles and causes useless cache churn
        if interval == '1d' or interval == '1d':
            now_utc = datetime.now(timezone.utc)
            # If end is today, set it to yesterday (last complete trading day)
            # This prevents requesting candles that don't exist yet
            if end.date() == now_utc.date():
                # Use end of day (23:59:59) to include candles stored with timestamps later in the day
                # Candles are stored as 06:00:00+01 (CET), so we need to include the full day
                end = end.replace(hour=23, minute=59, second=59, microsecond=999999) - timedelta(days=1)

        # FEATURE 014: Check candle cache first
        from app.services.cache import get_candle_data, cache_candle_data, candle_cache
        from app.services.performance import performance_logger

        # DEBUG: Log cache stats before checking
        cache_stats = candle_cache.get_stats()
        logger.debug(f"[CACHE DEBUG] Request: {ticker} {interval} {start.date()} to {end.date()}")
        logger.debug(f"[CACHE DEBUG] Cache stats: {cache_stats['entries']} entries, {cache_stats['hits']} hits, {cache_stats['misses']} misses")

        cached_candles = get_candle_data(ticker, interval, start, end)
        if cached_candles is not None:
            logger.debug(f"🎯 CANDLE CACHE HIT for {ticker} ({interval}) - returned {len(cached_candles)} candles from cache")
            performance_logger.record(
                operation="get_candles_cache_hit",
                duration_ms=0.5,  # Sub-millisecond for cache hit
                category="cache",
                context={"symbol": ticker, "interval": interval}
            )
            return cached_candles

        logger.debug(f"❌ CANDLE CACHE MISS for {ticker} ({interval}) - will fetch from DB/yfinance")

        # 1. Query DB FIRST - return what we have immediately
        # Only fetch gaps if DB is empty or missing significant data
        from sqlalchemy.future import select
        from app.models.candle import Candle
        from app.core.intervals import get_interval_delta

        db_start = time.time()
        stmt = select(Candle).where(
            Candle.symbol_id == symbol_id,
            Candle.interval == interval,
            Candle.timestamp >= start,
            Candle.timestamp <= end
        ).order_by(Candle.timestamp.asc())

        result = await db.execute(stmt)
        candles = result.scalars().all()

        # Convert SQLAlchemy objects to dictionaries immediately to avoid lazy-loading issues
        # This ensures all attributes are loaded while we're still in the async context
        candles = [
            {
                "timestamp": c.timestamp,
                "open": float(c.open) if c.open is not None else None,
                "high": float(c.high) if c.high is not None else None,
                "low": float(c.low) if c.low is not None else None,
                "close": float(c.close) if c.close is not None else None,
                "volume": int(c.volume) if (c.volume is not None and math.isfinite(c.volume)) else 0,
                "interval": c.interval,
                "ticker": ticker,
                "symbol_id": c.symbol_id,
            }
            for c in candles
        ]

        db_time = (time.time() - db_start) * 1000
        logger.info(f"[TIMING] Database query took {db_time:.0f}ms for {ticker} ({interval}), returned {len(candles)} candles")

        # 2. Only fetch gaps if DB is empty OR missing significant data
        # This prevents blocking on yfinance when we already have most of the data
        gap_fill_start = time.time()
        gaps_to_fill = None
        interval_delta = get_interval_delta(interval)
        expected_candles = (end - start).total_seconds() / interval_delta.total_seconds() + 1
        coverage_ratio = len(candles) / expected_candles if expected_candles > 0 else 0

        # Only fetch from yfinance if:
        # - DB is empty (0 candles) OR
        # - Coverage is less than 50% (significant gap)
        should_fetch_from_yf = len(candles) == 0 or coverage_ratio < 0.5

        if not local_only and should_fetch_from_yf:
            gaps = await self.candle_service.find_gaps(db, symbol_id, ticker, interval, start, end)
            gap_time = (time.time() - gap_fill_start) * 1000

            if gaps:
                logger.info(f"Found {len(gaps)} gaps for {ticker} ({interval}) - DB has {len(candles)}/{int(expected_candles)} candles ({coverage_ratio*100:.0f}% coverage)")

                # Check if total missing bars exceed hard cap
                total_missing = 0
                for g_start, g_end in gaps:
                    total_missing += (g_end - g_start).total_seconds() / interval_delta.total_seconds() + 1

                HARD_CAP = 10000
                if total_missing > HARD_CAP:
                    logger.warning(f"Gap size {total_missing} exceeds hard cap of {HARD_CAP}. Skipping dynamic fill.")
                else:
                    # Find the total range covering all gaps and fetch it once
                    all_gap_starts = [g[0] for g in gaps]
                    all_gap_ends = [g[1] for g in gaps]

                    fill_start = min(all_gap_starts)
                    fill_end = max(all_gap_ends)

                    # Ensure aware
                    if fill_start.tzinfo is None:
                        fill_start = fill_start.replace(tzinfo=timezone.utc)
                    if fill_end.tzinfo is None:
                        fill_end = fill_end.replace(tzinfo=timezone.utc)

                    logger.info(f"🔄 Fetching missing data from yfinance: {fill_start.date()} to {fill_end.date()}")
                    fetch_start = time.time()
                    try:
                        await asyncio.wait_for(
                            self.fetch_and_save(db, symbol_id, ticker, interval, fill_start, fill_end),
                            timeout=30.0
                        )
                        fetch_time = (time.time() - fetch_start) * 1000
                        logger.info(f"[TIMING] Gap fill (yfinance) took {fetch_time:.0f}ms for {ticker}")

                        # Re-query DB after filling gaps to get fresh data
                        result = await db.execute(stmt)
                        candles = result.scalars().all()
                        logger.info(f"📊 After gap fill: {len(candles)} candles")
                    except asyncio.TimeoutError:
                        logger.error(f"Gap filling timed out for {ticker} ({interval})")
                        await db.rollback()
                    except Exception as e:
                        logger.error(f"Error filling gaps for {ticker}: {e}")
                        await db.rollback()
        elif len(candles) > 0:
            logger.info(f"✅ DB has sufficient data ({len(candles)} candles, {coverage_ratio*100:.0f}% coverage) - skipping yfinance fetch")

        # 3. Filter out candles with invalid price data
        # Candles are already dictionaries from the conversion above
        valid_candles = []
        for c in candles:
            # Check if any of the price values are invalid
            if (c.get("open") is not None and math.isfinite(c["open"]) and
                c.get("high") is not None and math.isfinite(c["high"]) and
                c.get("low") is not None and math.isfinite(c["low"]) and
                c.get("close") is not None and math.isfinite(c["close"])):
                valid_candles.append(c)

        # FEATURE 014: Cache the results after DB query
        try:
            cache_candle_data(ticker, interval, start, end, valid_candles)
            logger.debug(f"💾 CACHED {len(valid_candles)} candles for {ticker} ({interval})")
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
