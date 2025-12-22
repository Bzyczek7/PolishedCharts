import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.candles import CandleService
from app.services.providers import YFinanceProvider, AlphaVantageProvider

logger = logging.getLogger(__name__)

class DataOrchestrator:
    def __init__(self, candle_service: CandleService, yf_provider: YFinanceProvider, av_provider: AlphaVantageProvider):
        self.candle_service = candle_service
        self.yf_provider = yf_provider
        self.av_provider = av_provider

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
                
                HARD_CAP = 500
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
                        # Timeout protection: don't hang the API request for more than 10s
                        await asyncio.wait_for(
                            self._fill_gap(db, symbol_id, ticker, interval, fill_start, fill_end),
                            timeout=10.0
                        )
                    except asyncio.TimeoutError:
                        logger.error(f"Gap filling timed out for {ticker} ({interval})")
                    except Exception as e:
                        logger.error(f"Error filling gaps for {ticker}: {e}")

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
        
        import math
        def clean_price(val):
            if val is None or not math.isfinite(val):
                return None
            return float(val)

        return [
            {
                "timestamp": c.timestamp,
                "open": clean_price(c.open),
                "high": clean_price(c.high),
                "low": clean_price(c.low),
                "close": clean_price(c.close),
                "volume": int(c.volume) if (c.volume is not None and math.isfinite(c.volume)) else None,
                "interval": c.interval,
                "ticker": ticker
            } for c in candles
        ]

    async def _fill_gap(
        self, 
        db: AsyncSession, 
        symbol_id: int, 
        ticker: str, 
        interval: str, 
        gap_start: datetime, 
        gap_end: datetime
    ):
        """
        Fetch missing data for a gap and save to DB.
        """
        # Strategy: 
        # If gap is recent (within last 24h), try Alpha Vantage first for high precision.
        # Otherwise, or if AV fails/limit hit, use yfinance for history.
        
        now = datetime.now(timezone.utc)
        use_av = (now - gap_start) < self.yf_provider._get_default_lookback(interval) # Example heuristic
        
        candles = []
        if use_av:
            try:
                candles = await self.av_provider.fetch_candles(ticker, interval, gap_start, gap_end)
            except Exception as e:
                logger.warning(f"Alpha Vantage failed to fill gap for {ticker}: {e}. Falling back to yfinance.")
                use_av = False
        
        if not use_av:
            try:
                candles = await self.yf_provider.fetch_candles(ticker, interval, gap_start, gap_end)
            except Exception as e:
                logger.error(f"yfinance failed to fill gap for {ticker}: {e}")
        
        if candles:
            # Prepare for upsert
            await self.candle_service.upsert_candles(db, symbol_id, interval, candles)
