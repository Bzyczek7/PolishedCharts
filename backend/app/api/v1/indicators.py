"""Indicators API endpoints.

This module provides REST API endpoints for:
- Listing all available indicators with metadata
- Getting indicator calculation results with standardized output
- Fetching full indicator metadata for frontend rendering
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Any, Dict, Optional, List
import pandas as pd
import numpy as np
import logging
from datetime import datetime, timezone, timedelta

from app.db.session import get_db
from app.models.symbol import Symbol
from app.services.indicator_registry import get_registry
from app.schemas.indicator import (
    IndicatorOutput,
    IndicatorInfo,
    IndicatorMetadata,
    ParameterDefinition,
)
from app.services.orchestrator import DataOrchestrator
from app.services.candles import CandleService
from app.services.providers import YFinanceProvider, AlphaVantageProvider
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[Dict[str, Any]])
async def list_indicators():
    """
    List all available technical indicators.

    Returns basic info about each indicator including name, description, and parameters.
    For full metadata, use GET /indicators/supported.
    """
    registry = get_registry()
    return registry.list_indicators()


@router.get("/supported", response_model=List[Dict[str, Any]])
async def list_indicators_with_metadata():
    """
    List all available technical indicators with full metadata.

    Returns complete metadata for each indicator including:
    - name, description, display_type, category
    - parameter definitions with validation
    - full IndicatorMetadata for rendering
    - alert condition templates

    This endpoint provides everything needed for dynamic indicator selection
    and generic frontend rendering.
    """
    registry = get_registry()
    try:
        return registry.list_indicators_with_metadata()
    except Exception as e:
        logger.error(f"Error listing indicators with metadata: {e}")
        # Fallback to basic list if metadata not available
        return registry.list_indicators()


@router.get("/{symbol}/{indicator_name}", response_model=IndicatorOutput)
async def get_indicator(
    symbol: str,
    indicator_name: str,
    interval: str = Query("1d", description="Timeframe (1m, 5m, 15m, 1h, 4h, 1d)"),
    limit: int = Query(1000, ge=1, le=10000, description="Max data points to return"),
    params: Optional[str] = Query(None, description="Indicator params as JSON string"),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate and return indicator data with rendering metadata.

    Returns a standardized IndicatorOutput containing:
    - timestamps: Unix timestamps in seconds
    - data: Dict mapping field names to value arrays
    - metadata: IndicatorMetadata for rendering

    Query parameters:
    - interval: Candle timeframe (1m, 5m, 15m, 1h, 4h, 1d)
    - limit: Max number of data points (default 1000, max 10000)
    - params: JSON string of indicator-specific parameters (e.g., '{"period": 20}')
    """
    import json

    # Normalize inputs
    interval = interval.lower()
    if interval == "1w":
        interval = "1wk"
    indicator_name = indicator_name.lower()

    # Parse indicator parameters if provided
    indicator_params: Dict[str, Any] = {}
    if params:
        try:
            indicator_params = json.loads(params)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid params JSON string")

    # Validate interval
    valid_intervals = ["1m", "5m", "15m", "1h", "4h", "1d", "1wk"]
    if interval not in valid_intervals:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid interval. Must be one of: {', '.join(valid_intervals)}"
        )

    # 1. Fetch Symbol
    stmt = select(Symbol).where(Symbol.ticker == symbol.upper())
    result = await db.execute(stmt)
    db_symbol = result.scalars().first()
    if not db_symbol:
        raise HTTPException(status_code=404, detail="Symbol not found")

    # 2. Setup data providers
    candle_service = CandleService()
    yf_provider = YFinanceProvider()
    av_provider = AlphaVantageProvider(api_key=settings.ALPHA_VANTAGE_API_KEY)
    orchestrator = DataOrchestrator(candle_service, yf_provider, av_provider)

    # 3. Determine lookback period based on indicator params
    # Request additional data for indicator calculation
    end = datetime.now(timezone.utc)
    delta = yf_provider._get_default_lookback(interval)

    # Extend lookback for indicators that need more history
    period = indicator_params.get('period', 20)
    if isinstance(period, int) and period > 50:
        # Add extra lookback for long-period indicators
        delta = timedelta(days=period * 2)
    elif interval == "1d":
        delta = timedelta(days=730)  # 2 years for daily

    start = end - delta

    # 4. Fetch candles
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

    # 5. Convert to DataFrame and prepare
    df = pd.DataFrame(candles_data)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp")
    df = df.drop_duplicates(subset=["timestamp"], keep="first")

    # Limit data points if requested
    if limit and len(df) > limit:
        df = df.tail(limit)

    # 6. Get indicator from registry
    registry = get_registry()
    indicator = registry.get(indicator_name)
    if not indicator:
        raise HTTPException(
            status_code=404,
            detail=f"Indicator '{indicator_name}' not found. Available: {list(registry._indicators.keys())}"
        )

    # 6.5 Validate indicator parameters
    param_defs = indicator.parameter_definitions
    for param_name, param_value in indicator_params.items():
        if param_name not in param_defs:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid parameter '{param_name}' for indicator '{indicator_name}'. "
                       f"Valid parameters: {list(param_defs.keys())}"
            )

        param_def = param_defs[param_name]

        # Type validation
        expected_type = param_def.type
        if expected_type == "integer":
            if not isinstance(param_value, int):
                try:
                    indicator_params[param_name] = int(param_value)
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Parameter '{param_name}' must be an integer, got {type(param_value).__name__}"
                    )
        elif expected_type == "float":
            if not isinstance(param_value, (int, float)):
                try:
                    indicator_params[param_name] = float(param_value)
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Parameter '{param_name}' must be a number, got {type(param_value).__name__}"
                    )

        # Range validation
        if hasattr(param_def, 'min') and param_def.min is not None:
            if indicator_params[param_name] < param_def.min:
                raise HTTPException(
                    status_code=400,
                    detail=f"Parameter '{param_name}' must be >= {param_def.min}, got {indicator_params[param_name]}"
                )
        if hasattr(param_def, 'max') and param_def.max is not None:
            if indicator_params[param_name] > param_def.max:
                raise HTTPException(
                    status_code=400,
                    detail=f"Parameter '{param_name}' must be <= {param_def.max}, got {indicator_params[param_name]}"
                )

    # 7. Calculate indicator
    try:
        df_result = indicator.calculate(df, **indicator_params)

        # 8. Convert result to standardized output format
        # Get metadata from indicator
        metadata = indicator.metadata

        # Collect all series data
        data: Dict[str, List[Optional[float]]] = {}
        for series_meta in metadata.series_metadata:
            field = series_meta.field
            if field in df_result.columns:
                data[field] = _clean_series(df_result[field])

        # Convert timestamps to Unix timestamps (seconds)
        timestamps = [
            int(ts.replace(tzinfo=timezone.utc).timestamp())
            for ts in df_result["timestamp"]
        ]

        # 9. Return standardized IndicatorOutput
        return IndicatorOutput(
            symbol=symbol.upper(),
            interval=interval,
            timestamps=timestamps,
            data=data,
            metadata=metadata,
            calculated_at=datetime.utcnow(),
            data_points=len(timestamps)
        )

    except Exception as e:
        logger.error(f"Error calculating {indicator_name}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating indicator: {str(e)}"
        )


def _clean_series(series: pd.Series) -> List[Optional[float]]:
    """Clean a pandas series for JSON serialization.

    Replaces NaN and Inf with None for JSON compatibility.
    """
    import math
    cleaned = []
    for x in series:
        if pd.isna(x) or not math.isfinite(x):
            cleaned.append(None)
        elif isinstance(x, (float, np.floating)):
            cleaned.append(float(x))
        elif isinstance(x, (int, np.integer)):
            cleaned.append(float(x))
        else:
            try:
                val = float(x)
                if math.isfinite(val):
                    cleaned.append(val)
                else:
                    cleaned.append(None)
            except (TypeError, ValueError):
                cleaned.append(None)
    return cleaned
