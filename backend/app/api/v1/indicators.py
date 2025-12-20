from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Any, Dict
import pandas as pd
import numpy as np

from app.db.session import get_db
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.services import indicators
from app.schemas.indicator import TDFIOutput, cRSIOutput, ADXVMAOutput, IndicatorMetadata

router = APIRouter()

@router.get("/{symbol}/{indicator_name}", response_model=Any)
async def get_indicator(
    symbol: str,
    indicator_name: str,
    db: AsyncSession = Depends(get_db)
):
    # 1. Fetch Symbol
    stmt = select(Symbol).where(Symbol.ticker == symbol)
    result = await db.execute(stmt)
    db_symbol = result.scalars().first()
    if not db_symbol:
        raise HTTPException(status_code=404, detail="Symbol not found")

    # 2. Fetch Candles
    stmt = select(Candle).where(Candle.symbol_id == db_symbol.id).order_by(Candle.timestamp.asc())
    result = await db.execute(stmt)
    db_candles = result.scalars().all()
    
    if not db_candles:
        raise HTTPException(status_code=404, detail="No candles found for symbol")

    # 3. Convert to DataFrame
    df = pd.DataFrame([
        {
            "timestamp": c.timestamp,
            "open": c.open,
            "high": c.high,
            "low": c.low,
            "close": c.close,
            "volume": c.volume
        } for c in db_candles
    ])

    # 4. Calculate Indicator
    indicator_name = indicator_name.lower()
    
    if indicator_name == "tdfi":
        df_result = indicators.calculate_tdfi(df)
        metadata = IndicatorMetadata(
            display_type="pane",
            color_schemes={"line": "#2196F3", "histogram": "#E91E63"},
            scale_ranges={"min": -1, "max": 1}
        )
        return TDFIOutput(
            tdfi=df_result["TDFI"].replace({np.nan: None}).tolist(),
            tdfi_signal=df_result["TDFI_Signal"].replace({np.nan: None}).tolist(),
            metadata=metadata
        )
    
    elif indicator_name == "crsi":
        df_result = indicators.calculate_crsi(df)
        metadata = IndicatorMetadata(
            display_type="pane",
            color_schemes={"line": "#4CAF50", "bands": "#81C784"},
            scale_ranges={"min": 0, "max": 100}
        )
        return cRSIOutput(
            crsi=df_result["cRSI"].replace({np.nan: None}).tolist(),
            upper_band=df_result["cRSI_UpperBand"].replace({np.nan: None}).tolist(),
            lower_band=df_result["cRSI_LowerBand"].replace({np.nan: None}).tolist(),
            metadata=metadata
        )
    
    elif indicator_name == "adxvma":
        df_result = indicators.calculate_adxvma(df)
        metadata = IndicatorMetadata(
            display_type="overlay",
            color_schemes={"line": "#FF9800"},
            scale_ranges=None
        )
        return ADXVMAOutput(
            adxvma=df_result["ADXVMA"].replace({np.nan: None}).tolist(),
            metadata=metadata
        )
    
    else:
        raise HTTPException(status_code=404, detail="Indicator not found")
