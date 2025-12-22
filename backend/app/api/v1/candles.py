from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime, timedelta
from app.db.session import get_db
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.schemas.candle import CandleResponse

router = APIRouter()

@router.get("/{symbol}", response_model=List[CandleResponse])
async def get_candles(
    symbol: str, 
    interval: str = Query("1d", description="Timeframe (e.g. 1m, 5m, 1h, 1d)"),
    from_ts: Optional[datetime] = Query(None, alias="from", description="Start timestamp (UTC)"),
    to_ts: Optional[datetime] = Query(None, alias="to", description="End timestamp (UTC)"),
    db: AsyncSession = Depends(get_db)
):
    # Find Symbol
    result = await db.execute(select(Symbol).filter(Symbol.ticker == symbol.upper()))
    symbol_obj = result.scalars().first()
    
    if not symbol_obj:
        raise HTTPException(status_code=404, detail="Symbol not found")
    
    # TODO: In Phase 2, use DataOrchestrator to fetch from local cache + providers
    # For now, fetch from local DB with range support
    
    stmt = select(Candle).filter(
        Candle.symbol_id == symbol_obj.id,
        Candle.interval == interval
    )
    
    if from_ts:
        stmt = stmt.filter(Candle.timestamp >= from_ts)
    if to_ts:
        stmt = stmt.filter(Candle.timestamp <= to_ts)
        
    stmt = stmt.order_by(Candle.timestamp.asc())
    
    # If no range provided, limit to last 300
    if not from_ts and not to_ts:
        # Need to subquery or sort desc then reverse to get *last* 300 in *asc* order
        count_stmt = select(Candle).filter(
            Candle.symbol_id == symbol_obj.id,
            Candle.interval == interval
        ).order_by(Candle.timestamp.desc()).limit(300)
        
        result = await db.execute(count_stmt)
        candles = list(result.scalars().all())
        candles.reverse()
    else:
        result = await db.execute(stmt)
        candles = result.scalars().all()
    
    # Transform to schema
    response = []
    for c in candles:
        response.append(CandleResponse(
            id=c.id,
            ticker=symbol_obj.ticker,
            interval=c.interval,
            timestamp=c.timestamp,
            open=c.open,
            high=c.high,
            low=c.low,
            close=c.close,
            volume=c.volume
        ))
        
    return response
