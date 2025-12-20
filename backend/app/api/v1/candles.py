from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app.db.session import get_db
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.schemas.candle import CandleResponse

router = APIRouter()

@router.get("/{symbol}", response_model=List[CandleResponse])
async def get_candles(symbol: str, db: AsyncSession = Depends(get_db)):
    # Find Symbol
    result = await db.execute(select(Symbol).filter(Symbol.ticker == symbol.upper()))
    symbol_obj = result.scalars().first()
    
    if not symbol_obj:
        raise HTTPException(status_code=404, detail="Symbol not found")
    
    # Get Candles
    result = await db.execute(
        select(Candle).filter(Candle.symbol_id == symbol_obj.id).order_by(Candle.timestamp.asc())
    )
    candles = result.scalars().all()
    
    # Transform to schema (including ticker)
    response = []
    for c in candles:
        # Manually constructing response because Candle model doesn't have ticker field directly
        # and Pydantic from_attributes needs it.
        # Alternatively, we could join in the query, but this is simple enough.
        response.append(CandleResponse(
            id=c.id,
            ticker=symbol_obj.ticker,
            timestamp=c.timestamp,
            open=c.open,
            high=c.high,
            low=c.low,
            close=c.close,
            volume=c.volume
        ))
        
    return response
