import logging
from datetime import datetime
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
        end: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Main entry point for getting candles. 
        Checks cache, identifies gaps, fetches missing segments, and returns merged result.
        """
        if not start or not end:
            # Default window if not provided
            delta = self.yf_provider._get_default_lookback(interval)
            end = end or datetime.now()
            start = start or (end - delta)

        # 1. Identify Gaps
        gaps = await self.candle_service.find_gaps(db, symbol_id, interval, start, end)
        
        if gaps:
            logger.info(f"Found {len(gaps)} gaps for {ticker} ({interval}) in range {start} to {end}")
            for gap_start, gap_end in gaps:
                await self._fill_gap(db, symbol_id, ticker, interval, gap_start, gap_end)

        # 2. Fetch all from DB after filling gaps
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
        
        return [
            {
                "id": c.id,
                "timestamp": c.timestamp,
                "open": c.open,
                "high": c.high,
                "low": c.low,
                "close": c.close,
                "volume": c.volume,
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
        
        now = datetime.now()
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
