from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime, timezone
from app.db.session import get_db
from app.models.symbol import Symbol
from app.schemas.candle import CandleResponse, BackfillRequest, BackfillResponse
from app.services.orchestrator import DataOrchestrator
from app.services.candles import CandleService
from app.services.backfill import BackfillService
from app.services.providers import YFinanceProvider, AlphaVantageProvider
from app.core.config import settings

router = APIRouter()

@router.get("/{symbol}", response_model=List[CandleResponse])
async def get_candles(
    symbol: str, 
    interval: str = Query("1d", description="Timeframe (e.g. 1m, 5m, 1h, 1d)"),
    from_ts: Optional[datetime] = Query(None, alias="from", description="Start timestamp (UTC)"),
    to_ts: Optional[datetime] = Query(None, alias="to", description="End timestamp (UTC)"),
    local_only: bool = Query(False, description="If true, returns only data from DB without gap filling"),
    db: AsyncSession = Depends(get_db)
):
    # Normalize interval to lowercase
    interval = interval.lower()
    if interval == "1w":
        interval = "1wk"
    
    # Find Symbol
    result = await db.execute(select(Symbol).filter(Symbol.ticker == symbol.upper()))
    symbol_obj = result.scalars().first()
    
    if not symbol_obj:
        raise HTTPException(status_code=404, detail="Symbol not found")
    
    # Initialize services and orchestrator
    candle_service = CandleService()
    yf_provider = YFinanceProvider()
    av_provider = AlphaVantageProvider(api_key=settings.ALPHA_VANTAGE_API_KEY)
    orchestrator = DataOrchestrator(candle_service, yf_provider, av_provider)

    # Use orchestrator to get candles
    candles_data = await orchestrator.get_candles(
        db=db,
        symbol_id=symbol_obj.id,
        ticker=symbol_obj.ticker,
        interval=interval,
        start=from_ts,
        end=to_ts,
        local_only=local_only
    )
        
    return candles_data

@router.post("/backfill", response_model=BackfillResponse)
async def trigger_backfill(
    request: BackfillRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger a historical data backfill for a given symbol and interval.
    """
    backfill_service = BackfillService()
    job = await backfill_service.create_job(
        db=db,
        symbol=request.symbol.upper(),
        interval=request.interval.lower(),
        start_date=request.start_date,
        end_date=request.end_date
    )
    return {
        "status": "pending",
        "job_id": job.id,
        "message": f"Backfill job created for {request.symbol}"
    }

@router.post("/update-latest", response_model=BackfillResponse)
async def update_latest(
    symbol: str = Query(..., description="Ticker symbol"),
    interval: str = Query("1h", description="Timeframe"),
    db: AsyncSession = Depends(get_db)
):
    """
    Incremental update endpoint for the most recent bars.
    """
    # Placeholder for incremental update trigger
    return {
        "status": "success",
        "message": f"Incremental update triggered for {symbol} ({interval})"
    }
