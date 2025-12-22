from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Any, Dict, Optional
import pandas as pd
import numpy as np
import logging

from app.db.session import get_db
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.services import indicators
from app.schemas.indicator import TDFIOutput, cRSIOutput, ADXVMAOutput, IndicatorMetadata
from app.services.orchestrator import DataOrchestrator
from app.services.candles import CandleService
from app.services.providers import YFinanceProvider, AlphaVantageProvider
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/{symbol}/{indicator_name}", response_model=Any)
async def get_indicator(
    symbol: str,
    indicator_name: str,
    interval: str = Query("1d", description="Timeframe"),
    db: AsyncSession = Depends(get_db)
):
    # Normalize interval
    interval = interval.lower()
    if interval == "1w":
        interval = "1wk"
    
    # 1. Fetch Symbol
    stmt = select(Symbol).where(Symbol.ticker == symbol.upper())
    result = await db.execute(stmt)
    db_symbol = result.scalars().first()
    if not db_symbol:
        raise HTTPException(status_code=404, detail="Symbol not found")

    candle_service = CandleService()
    yf_provider = YFinanceProvider()
    av_provider = AlphaVantageProvider(api_key=settings.ALPHA_VANTAGE_API_KEY)
    orchestrator = DataOrchestrator(candle_service, yf_provider, av_provider)

    # For indicators, we need enough historical data for the lookback period
    # Let's request a larger range explicitly.
    from datetime import datetime, timezone, timedelta
    end = datetime.now(timezone.utc)
    # Request 500 bars based on interval
    delta = yf_provider._get_default_lookback(interval)
    if interval == "1m":
        delta = timedelta(days=7)
    elif interval == "1d":
        delta = timedelta(days=365*2)
    
    start = end - delta

    candles_data = await orchestrator.get_candles(
        db=db,
        symbol_id=db_symbol.id,
        ticker=db_symbol.ticker,
        interval=interval,
        start=start,
        end=end
    )
    
    if not candles_data:
        raise HTTPException(status_code=404, detail="No candles found for symbol/interval")

    # 3. Convert to DataFrame
    df = pd.DataFrame(candles_data)
    # Ensure timestamp is datetime
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp")
    
    # Deduplicate by timestamp to ensure indicator accuracy
    # (Keep the first occurrence of each unique timestamp)
    df = df.drop_duplicates(subset=["timestamp"], keep="first")

    # 4. Calculate Indicator
    try:
        indicator_name = indicator_name.lower()
        logger.info(f"Calculating indicator {indicator_name} for {symbol} ({interval})")
        
        # Explicitly format timestamps to ISO string to ensure consistency
        timestamps = [ts.isoformat() for ts in df["timestamp"]]
        
        def to_json_list(series):
            # Replace NaN and Inf with None for JSON compatibility
            import math
            cleaned = []
            for x in series:
                try:
                    if x is None:
                        cleaned.append(None)
                    elif isinstance(x, (float, np.float64, np.float32, int, np.int64)):
                        if not math.isfinite(x):
                            cleaned.append(None)
                        else:
                            cleaned.append(float(x))
                    else:
                        val = float(x)
                        if not math.isfinite(val):
                            cleaned.append(None)
                        else:
                            cleaned.append(val)
                except:
                    cleaned.append(None)
            
            # Debug: check if any NaNs remain in the first 10
            if cleaned:
                logger.info(f"Cleaned series preview (first 5): {cleaned[:5]}")
            return cleaned

        if indicator_name == "tdfi":
            df_result = indicators.calculate_tdfi(df)
            metadata = IndicatorMetadata(
                display_type="pane",
                color_schemes={
                    "above": "#00ff00", # Lime
                    "below": "#ff0000", # Red
                    "neutral": "#64748b" # Slate 500
                },
                color_mode="threshold",
                thresholds={"high": 0.05, "low": -0.05},
                scale_ranges={"min": -1, "max": 1},
                series_metadata=[
                    {
                        "field": "tdfi",
                        "role": "main",
                        "label": "TDFI",
                        "line_color": "#64748b",
                        "line_style": "solid",
                        "line_width": 2,
                        "display_type": "line"
                    }
                ],
                reference_levels=[
                    {
                        "value": 0.05,
                        "line_color": "#00ff00",  # Green for upper threshold
                        "line_label": "Upper Threshold"
                    },
                    {
                        "value": -0.05,
                        "line_color": "#ff0000",  # Red for lower threshold
                        "line_label": "Lower Threshold"
                    }
                ]
            )
            return TDFIOutput(
                timestamps=timestamps,
                tdfi=to_json_list(df_result["TDFI"]),
                tdfi_signal=to_json_list(df_result["TDFI_Signal"]),
                metadata=metadata
            )
        
        elif indicator_name == "crsi":
            df_result = indicators.calculate_crsi(df)
            metadata = IndicatorMetadata(
                display_type="pane",
                color_schemes={
                    "main": "#4CAF50"
                },
                color_mode="single",
                scale_ranges={"min": 0, "max": 100},
                series_metadata=[
                    {
                        "field": "crsi",
                        "role": "main",
                        "label": "cRSI",
                        "line_color": "#4CAF50",
                        "line_style": "solid",
                        "line_width": 2,
                        "display_type": "line"
                    },
                    {
                        "field": "upper_band",
                        "role": "band",
                        "label": "Upper Band",
                        "line_color": "#ef4444",
                        "line_style": "dashed",
                        "line_width": 1,
                        "display_type": "line"
                    },
                    {
                        "field": "lower_band",
                        "role": "band",
                        "label": "Lower Band",
                        "line_color": "#22c55e",
                        "line_style": "dashed",
                        "line_width": 1,
                        "display_type": "line"
                    }
                ],
                reference_levels=[]
            )
            return cRSIOutput(
                timestamps=timestamps,
                crsi=to_json_list(df_result["cRSI"]),
                upper_band=to_json_list(df_result["cRSI_UpperBand"]),
                lower_band=to_json_list(df_result["cRSI_LowerBand"]),
                metadata=metadata
            )
        
        elif indicator_name == "adxvma":
            df_result = indicators.calculate_adxvma(df)
            metadata = IndicatorMetadata(
                display_type="overlay",
                color_schemes={
                    "above": "#00ff00", # Lime
                    "below": "#ff0000", # Red
                    "neutral": "#ffff00" # Yellow
                },
                color_mode="threshold",
                thresholds={"high": 0.5, "low": -0.5},
                scale_ranges=None,
                series_metadata=[
                    {
                        "field": "adxvma",
                        "role": "main",
                        "label": "ADXVMA",
                        "line_color": "#ffff00",
                        "line_style": "solid",
                        "line_width": 3,
                        "display_type": "line"
                    }
                ],
                reference_levels=[]
            )
            return ADXVMAOutput(
                timestamps=timestamps,
                adxvma=to_json_list(df_result["ADXVMA"]),
                metadata=metadata
            )
        
        else:
            raise HTTPException(status_code=404, detail="Indicator not found")
    except Exception as e:
        logger.error(f"Error calculating {indicator_name}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
