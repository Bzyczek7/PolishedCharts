"""Indicators API endpoints.

This module provides REST API endpoints for:
- Listing all available indicators with metadata
- Getting indicator calculation results with standardized output
- Fetching full indicator metadata for frontend rendering
"""

import time
from fastapi import APIRouter, Depends, HTTPException, Query, Request
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
from app.services.watchlist import get_or_create_symbol
from app.schemas.indicator import (
    IndicatorOutput,
    IndicatorInfo,
    IndicatorMetadata,
    ParameterDefinition,
    IndicatorRequest,
    BatchIndicatorRequest,
    ErrorDetail,
    BatchIndicatorResponse,
)
from app.services.orchestrator import DataOrchestrator
from app.core.config import settings
from app.api.decorators import public_endpoint
# T020b: Performance logging
from app.services.performance import performance_logger

router = APIRouter()
logger = logging.getLogger(__name__)


# --- Dependency Providers ---

def get_orchestrator(request: Request) -> DataOrchestrator:
    """Dependency to get the singleton DataOrchestrator from app state."""
    return request.app.state.orchestrator


@router.get("/", response_model=List[Dict[str, Any]])
@public_endpoint
async def list_indicators():
    """
    List all available technical indicators.

    Returns basic info about each indicator including name, description, and parameters.
    For full metadata, use GET /indicators/supported.
    """
    registry = get_registry()
    return registry.list_indicators()


@router.get("/supported", response_model=List[Dict[str, Any]])
@public_endpoint
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


def _calculate_warmup_period(indicator_name: str, params: Dict[str, Any]) -> int:
    """Calculate warm-up periods needed for accurate indicator values.

    Uses the ACTUAL normalized parameter names that the backend builds.
    The frontend sends 'period' which gets mapped to 'length' for many indicators.
    The API accepts: length, domcycle, cyclicmemory, adxvmaperiod, fast, slow, signal, etc.

    Args:
        indicator_name: Name of the indicator (e.g., 'rsi', 'ema', 'crsi')
        params: Normalized parameter dict using backend param names

    Returns:
        Number of periods needed for warm-up (minimum 10)
    """
    warmup = 0

    # Use the actual normalized keys that exist in indicator_params
    # (NOT the frontend aliases like 'dom_cycle', 'period', etc.)
    actual_param_names = [
        'length',      # Most indicators: SMA, EMA, RSI, etc.
        'lookback',    # Some oscillators
        'window',      # Window-based indicators
        'domcycle',    # cRSI (note: frontend sends 'dom_cycle', mapped to 'domcycle')
        'cyclicmemory',# cRSI (note: frontend sends 'cyclic_memory', mapped here)
        'adxvmaperiod',# ADXVMA (note: frontend sends 'adxvma_period', mapped here)
        'fast',        # MACD fast period
        'slow',        # MACD slow period
        'signal',      # MACD signal period
    ]

    for param_name in actual_param_names:
        if param_name in params:
            warmup = max(warmup, int(params[param_name]))

    # Special handling for multi-parameter indicators
    if indicator_name.lower().startswith('macd'):
        slow = params.get('slow', 26)
        signal = params.get('signal', 9)
        warmup = max(warmup, slow + signal)
    elif indicator_name.lower() == 'bbands':
        warmup = max(warmup, 20)  # Bollinger Bands need ~20 periods

    return max(warmup, 10)  # Minimum 10 periods for stability


@router.get("/{symbol}/{indicator_name}", response_model=IndicatorOutput)
async def get_indicator(
    symbol: str,
    indicator_name: str,
    interval: str = Query("1d", description="Timeframe (1m, 5m, 15m, 1h, 4h, 1d)"),
    limit: int = Query(10000, description="Max data points to return (default 10000 for full 10+ year historical data)"),
    params: Optional[str] = Query(None, description="Indicator params as JSON string (legacy)"),
    # Date range filtering (NEW - for synchronized candle/indicator loading)
    from_ts: Optional[datetime] = Query(
        None,
        alias="from",
        description="Start timestamp as ISO 8601 string (UTC)"
    ),
    to_ts: Optional[datetime] = Query(
        None,
        alias="to",
        description="End timestamp as ISO 8601 string (UTC)"
    ),
    # Individual query parameters for indicators
    period: Optional[str] = Query(None, description="Indicator period (for SMA, EMA)"),
    lookback: Optional[str] = Query(None, description="Lookback period (for TDFI)"),
    filter_high: Optional[str] = Query(None, description="Filter high threshold (for TDFI)"),
    filter_low: Optional[str] = Query(None, description="Filter low threshold (for TDFI)"),
    # cRSI parameters - note: indicator uses no underscores (domcycle, cyclicmemory)
    # but API uses snake_case (dom_cycle, cyclic_memory) for consistency
    dom_cycle: Optional[str] = Query(None, description="Dominant cycle period (for cRSI)"),
    vibration: Optional[str] = Query(None, description="Vibration period (for cRSI)"),
    leveling: Optional[str] = Query(None, description="Leveling factor (for cRSI)"),
    cyclic_memory: Optional[str] = Query(None, description="Cyclic memory period (for cRSI)"),
    adxvma_period: Optional[str] = Query(None, description="ADXVMA period (for ADXVMA)"),
    db: AsyncSession = Depends(get_db),
    orchestrator: DataOrchestrator = Depends(get_orchestrator),
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
    - from: Start timestamp as ISO 8601 string (optional, for date range filtering)
    - to: End timestamp as ISO 8601 string (optional, for date range filtering)
    - params: JSON string of indicator-specific parameters (legacy, still supported)

    Indicator-specific query parameters (recommended):
    - period: For SMA, EMA (integer, 2-500)
    - lookback: For TDFI (integer, 2-200)
    - filter_high: For TDFI (float, -1.0 to 1.0)
    - filter_low: For TDFI (float, -1.0 to 1.0)
    - dom_cycle: For cRSI (integer, 5-100)
    - vibration: For cRSI (integer, 2-50)
    - leveling: For cRSI (float, 1.0-50.0)
    - cyclic_memory: For cRSI (integer, 10-100)
    - adxvma_period: For ADXVMA (integer, 2-100)

    If both query parameters and params JSON are provided, query parameters take precedence.

    Date Range Filtering:
    When from/to are provided, the endpoint returns indicator data only for that range.
    A warm-up period is automatically included before the 'from' date to ensure
    accurate indicator calculation. The warm-up period is calculated based on the
    indicator's parameters (e.g., a 20-period SMA needs 20 periods of warm-up data).

    Example: from=2023-01-01T00:00:00Z&to=2024-01-01T00:00:00Z
    """
    import json

    # Normalize inputs
    interval = interval.lower()
    if interval == "1w":
        interval = "1wk"
    indicator_name = indicator_name.lower()

    # Validate date range order (only validate order - don't enforce MAX_RANGE_DAYS like candles endpoint)
    # Indicators can have wider ranges (currently defaults to 1990)
    # The orchestrator/provider has hard caps (10,000 bar limit) that will apply
    if from_ts and to_ts and from_ts >= to_ts:
        raise HTTPException(
            status_code=400,
            detail="'from' must be before 'to'"
        )

    # Build indicator params dict from individual query parameters
    # These take precedence over JSON params
    indicator_params: Dict[str, Any] = {}

    # Add individual query parameters if provided and not empty strings
    if period is not None and period != "":
        try:
            indicator_params["period"] = int(period)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Parameter 'period' must be an integer, got '{period}'")
    if lookback is not None and lookback != "":
        try:
            indicator_params["lookback"] = int(lookback)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Parameter 'lookback' must be an integer, got '{lookback}'")
    if filter_high is not None and filter_high != "":
        try:
            indicator_params["filter_high"] = float(filter_high)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Parameter 'filter_high' must be a number, got '{filter_high}'")
    if filter_low is not None and filter_low != "":
        try:
            indicator_params["filter_low"] = float(filter_low)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Parameter 'filter_low' must be a number, got '{filter_low}'")
    if dom_cycle is not None and dom_cycle != "":
        try:
            indicator_params["domcycle"] = int(dom_cycle)  # Map dom_cycle -> domcycle for cRSI
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Parameter 'dom_cycle' must be an integer, got '{dom_cycle}'")
    if vibration is not None and vibration != "":
        try:
            indicator_params["vibration"] = int(vibration)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Parameter 'vibration' must be an integer, got '{vibration}'")
    if leveling is not None and leveling != "":
        try:
            indicator_params["leveling"] = float(leveling)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Parameter 'leveling' must be a number, got '{leveling}'")
    if cyclic_memory is not None and cyclic_memory != "":
        try:
            indicator_params["cyclicmemory"] = int(cyclic_memory)  # Map cyclic_memory -> cyclicmemory for cRSI
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Parameter 'cyclic_memory' must be an integer, got '{cyclic_memory}'")
    if adxvma_period is not None and adxvma_period != "":
        try:
            indicator_params["adxvma_period"] = int(adxvma_period)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Parameter 'adxvma_period' must be an integer, got '{adxvma_period}'")

    # Parse legacy JSON params and merge (query params take precedence)
    if params:
        try:
            json_params = json.loads(params)
            # Only add JSON params that weren't already provided via query params
            for key, value in json_params.items():
                if key not in indicator_params:
                    indicator_params[key] = value
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid params JSON string")

    # Validate interval
    valid_intervals = ["1m", "5m", "15m", "1h", "4h", "1d", "1wk"]
    if interval not in valid_intervals:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid interval. Must be one of: {', '.join(valid_intervals)}"
        )

    # FEATURE 014 T019: Check indicator cache first
    from app.services.cache import get_indicator_result, cache_indicator_result

    try:
        cached_result = get_indicator_result(
            symbol=symbol.upper(),
            interval=interval,
            indicator_name=indicator_name,
            params=indicator_params,
            from_ts=from_ts,
            to_ts=to_ts
        )

        if cached_result is not None:
            logger.info(f"Indicator cache hit for {symbol}/{indicator_name}")
            performance_logger.record(
                operation=f"get_indicator_cache_hit",
                duration_ms=1.0,
                category="cache",
                context={"symbol": symbol, "indicator": indicator_name}
            )
            return cached_result

        logger.info(f"Indicator cache miss for {symbol}/{indicator_name}")
    except Exception as e:
        # T022: Graceful error handling for cache failures - fallback to DB
        logger.warning(f"Cache get failed for {symbol}/{indicator_name}: {e}, falling back to calculation")

    # 1. Fetch or create Symbol (auto-creates in Symbol table for price lookups)
    db_symbol = await get_or_create_symbol(db, symbol.upper())
    if not db_symbol:
        raise HTTPException(status_code=404, detail=f"Invalid ticker symbol: {symbol}")

    # 2. Determine fetch range with warm-up consideration
    end = to_ts if to_ts else datetime.now(timezone.utc)

    if from_ts:
        # Calculate warm-up period using the actual normalized parameter names
        warmup_periods = _calculate_warmup_period(indicator_name, indicator_params)

        # Convert periods to time delta
        interval_seconds = {
            '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
            '1h': 3600, '4h': 14400, '1d': 86400, '1wk': 604800
        }.get(interval, 86400)

        warmup_delta = timedelta(seconds=warmup_periods * interval_seconds)
        start = from_ts - warmup_delta

        # Guard: ensure start < end (edge case for tiny windows)
        if start >= end:
            start = from_ts  # Fall back to requested range without warmup
    else:
        # Default behavior: fetch all data from 1990
        start = datetime(1990, 1, 1, tzinfo=timezone.utc)

    # 3. Fetch candles
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

    # 4. Convert to DataFrame and prepare
    df = pd.DataFrame(candles_data)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp")
    df = df.drop_duplicates(subset=["timestamp"], keep="first")

    # Limit data points if requested
    if limit and len(df) > limit:
        df = df.tail(limit)

    # 5. Get indicator from registry - try by instance name first, then by base name
    registry = get_registry()
    indicator = registry.get(indicator_name)
    if not indicator:
        # Try looking up by base name for dynamic parameter configuration
        indicator = registry.get_by_base_name(indicator_name)
    if not indicator:
        raise HTTPException(
            status_code=404,
            detail=f"Indicator '{indicator_name}' not found. Available: {list(registry._indicators.keys())}"
        )

    # 5.5 Validate indicator parameters
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

    # 6. Calculate indicator
    try:
        # T020b: Instrument only the expensive operation with performance logging
        calc_start_time = time.time()
        df_result = indicator.calculate(df, **indicator_params)
        duration_ms = (time.time() - calc_start_time) * 1000
        performance_logger.record(
            operation=f"calculate_{indicator_name}",
            duration_ms=duration_ms,
            category="calculation",
            context={"symbol": symbol, "interval": interval}
        )

        # 7. Filter results to requested range (apply both bounds)
        # This ensures indicators match the candle window exactly
        if from_ts:
            df_result = df_result[df_result['timestamp'] >= from_ts]
        if to_ts:
            df_result = df_result[df_result['timestamp'] <= to_ts]

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

        # 9. Build and return the result
        result = IndicatorOutput(
            symbol=symbol.upper(),
            interval=interval,
            timestamps=timestamps,
            data=data,
            metadata=metadata,
            calculated_at=datetime.utcnow(),
            data_points=len(timestamps)
        )

        # T020: Cache the result after calculation
        try:
            cache_indicator_result(
                symbol=symbol.upper(),
                interval=interval,
                indicator_name=indicator_name,
                params=indicator_params,
                result=result,
                from_ts=from_ts,
                to_ts=to_ts
            )
            logger.debug(f"Cached indicator result for {symbol}/{indicator_name}")
        except Exception as e:
            # T022: Graceful degradation - cache failure shouldn't break the endpoint
            logger.warning(f"Failed to cache indicator result for {symbol}/{indicator_name}: {e}")

        # T021: Add cache hit/miss logging with performance_logger
        performance_logger.record(
            operation=f"get_indicator_cache_miss",
            duration_ms=duration_ms,
            category="cache",
            context={"symbol": symbol, "indicator": indicator_name, "cached": False}
        )

        return result

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


@router.post("/batch", response_model=BatchIndicatorResponse)
async def calculate_batch_indicators(
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    orchestrator: DataOrchestrator = Depends(get_orchestrator),
):
    """
    T032-T039 [US2]: Calculate multiple indicators in a single request.

    Features:
    - Cache-first strategy (check cache before any DB work)
    - Parallel processing for independent requests
    - Partial failure support (continues on individual errors)
    - Deduplication of identical requests
    - Timeout protection (5 second max)
    - Performance logging

    **Performance Targets**:
    - 3 indicators: <200ms total (SC-003)
    - Cached requests: <100ms (SC-001)
    - Uncached requests: <500ms (SC-002)

    **Constraints**:
    - Maximum 10 requests per batch (FR-010)
    - Maximum processing time: 5 seconds (FR-014)
    """
    import asyncio
    from app.services.cache import get_indicator_result, cache_indicator_result

    start_time = time.time()
    results = []
    errors = []
    cache_hits = 0
    cache_misses = 0

    # T033: Validate request (1-10 items) - Pydantic handles this via schema
    try:
        batch_request = BatchIndicatorRequest(**request)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    # For deduplication (T036): Track processed request signatures
    processed_signatures: Dict[str, Any] = {}
    request_tasks = []

    async def process_single_indicator(
        idx: int,
        req: IndicatorRequest,
    ) -> Optional[IndicatorOutput]:
        """T035, T038 [US2]: Process a single indicator request.

        Returns IndicatorOutput on success, None on failure.
        Errors are collected separately.
        """
        nonlocal cache_hits, cache_misses

        try:
            # T036: Create request signature for deduplication
            params = req.params or {}
            req_signature = f"{req.symbol}:{req.interval}:{req.indicator_name}:{sorted(params.items())}"

            # T036: Check if this exact request was already processed
            if req_signature in processed_signatures:
                logger.debug(f"Duplicate request detected: {req_signature}, reusing cached result")
                return processed_signatures[req_signature]

            # T034: Check cache first
            cached = get_indicator_result(
                symbol=req.symbol.upper(),
                interval=req.interval,
                indicator_name=req.indicator_name,
                params=params,
                from_ts=req.from_ts,
                to_ts=req.to_ts
            )

            if cached is not None:
                cache_hits += 1
                logger.info(f"Batch: Cache hit for {req.symbol}/{req.indicator_name}")
                processed_signatures[req_signature] = cached
                return cached

            cache_misses += 1
            logger.info(f"Batch: Cache miss for {req.symbol}/{req.indicator_name}")

            # Fetch symbol from database
            db_symbol = await get_or_create_symbol(db, req.symbol.upper())
            if not db_symbol:
                raise ValueError(f"Invalid ticker symbol: {req.symbol}")

            # Determine fetch range
            end = req.to_ts if req.to_ts else datetime.now(timezone.utc)
            start = req.from_ts if req.from_ts else datetime(1990, 1, 1, tzinfo=timezone.utc)

            # Fetch candles
            candles_data = await orchestrator.get_candles(
                db=db,
                symbol_id=db_symbol.id,
                ticker=db_symbol.ticker,
                interval=req.interval,
                start=start,
                end=end
            )

            if not candles_data:
                raise ValueError("No candles found for symbol/interval")

            # Convert to DataFrame
            df = pd.DataFrame(candles_data)
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df = df.sort_values("timestamp")
            df = df.drop_duplicates(subset=["timestamp"], keep="first")

            # Get indicator from registry
            registry = get_registry()
            indicator = registry.get(req.indicator_name)
            if not indicator:
                indicator = registry.get_by_base_name(req.indicator_name)
            if not indicator:
                raise ValueError(f"Indicator '{req.indicator_name}' not found")

            # Calculate
            df_result = indicator.calculate(df, **params)

            # Build output
            metadata = indicator.metadata
            data = {}
            for series_meta in metadata.series_metadata:
                field = series_meta.field
                if field in df_result.columns:
                    data[field] = _clean_series(df_result[field])

            timestamps = [
                int(ts.replace(tzinfo=timezone.utc).timestamp())
                for ts in df_result["timestamp"]
            ]

            result = IndicatorOutput(
                symbol=req.symbol.upper(),
                interval=req.interval,
                indicator_name=req.indicator_name,
                timestamps=timestamps,
                data=data,
                metadata=metadata,
                calculated_at=datetime.utcnow(),
                data_points=len(timestamps)
            )

            # Cache the result
            cache_indicator_result(
                symbol=req.symbol.upper(),
                interval=req.interval,
                indicator_name=req.indicator_name,
                params=params,
                result=result,
                from_ts=req.from_ts,
                to_ts=req.to_ts
            )

            # T036: Store in processed signatures for deduplication
            processed_signatures[req_signature] = result

            return result

        except Exception as e:
            logger.error(f"Error processing indicator {req.indicator_name} for {req.symbol}: {e}")
            # Return None for error - caller will add to errors list
            return None

    # T035: Process all requests in parallel using asyncio.gather
    # T037: Timeout protection - wrap with asyncio.wait_for
    try:
        # batch_request.requests is already a list of IndicatorRequest objects (validated by Pydantic)
        tasks = [
            process_single_indicator(idx, req)
            for idx, req in enumerate(batch_request.requests)
        ]

        # T037: Add 5-second timeout protection
        outputs = await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=5.0
        )
    except asyncio.TimeoutError:
        logger.error("Batch processing timed out after 5 seconds")
        raise HTTPException(
            status_code=504,
            detail="Batch processing timeout (5 seconds exceeded)"
        )

    # T038: Separate results and errors (partial failure handling)
    for idx, output in enumerate(outputs):
        # batch_request.requests is a list of IndicatorRequest objects
        req = batch_request.requests[idx]

        if isinstance(output, Exception):
            # Exception from asyncio.gather
            errors.append(ErrorDetail(
                index=idx,
                symbol=req.symbol,
                indicator_name=req.indicator_name,
                error=str(output)
            ))
        elif output is None:
            # Error returned from function (e.g., invalid symbol)
            errors.append(ErrorDetail(
                index=idx,
                symbol=req.symbol,
                indicator_name=req.indicator_name,
                error="Failed to calculate indicator"
            ))
        elif isinstance(output, IndicatorOutput):
            results.append(output)
        else:
            # Unexpected type
            errors.append(ErrorDetail(
                index=idx,
                symbol=req.symbol,
                indicator_name=req.indicator_name,
                error=f"Unexpected result type: {type(output)}"
            ))

    total_duration_ms = (time.time() - start_time) * 1000

    # T039: Add performance logging
    performance_logger.record(
        operation="batch_indicators",
        duration_ms=total_duration_ms,
        category="batch",
        context={
            "request_count": len(batch_request.requests),
            "result_count": len(results),
            "error_count": len(errors),
            "cache_hits": cache_hits,
            "cache_misses": cache_misses
        }
    )

    logger.info(
        f"Batch completed: {len(results)} results, {len(errors)} errors, "
        f"{cache_hits} cache hits, {cache_misses} cache misses, "
        f"{total_duration_ms:.1f}ms"
    )

    return BatchIndicatorResponse(
        results=results,
        errors=errors,
        total_duration_ms=total_duration_ms,
        cache_hits=cache_hits,
        cache_misses=cache_misses
    )


@router.get("/cache/stats", response_model=Dict[str, Any])
async def get_cache_statistics():
    """
    T044 [US3]: Get cache statistics for monitoring and health checks.

    Returns statistics for both indicator and candle caches including:
    - entries: Number of cached items
    - max_size: Maximum cache size
    - memory_used_bytes: Current memory usage
    - hits: Number of cache hits
    - misses: Number of cache misses
    - hit_rate: Cache hit rate (0-1)

    **Response Example**:
    ```json
    {
        "indicator_cache": {
            "entries": 42,
            "max_size": 100,
            "memory_used_bytes": 524288,
            "hits": 1200,
            "misses": 300,
            "hit_rate": 0.8
        },
        "candle_cache": {
            "entries": 15,
            "max_size": 50,
            "memory_used_bytes": 262144,
            "hits": 800,
            "misses": 200,
            "hit_rate": 0.8
        }
    }
    ```
    """
    from app.services.cache import get_all_cache_stats
    return get_all_cache_stats()
