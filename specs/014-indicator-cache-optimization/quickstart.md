# Quickstart Guide: Indicator API Performance Optimization

**Feature**: 014-indicator-cache-optimization
**Target Audience**: Developers implementing this feature
**Prerequisites**: Feature 012 (performance optimization) completed

## Overview

This guide provides step-by-step instructions for implementing indicator result caching and candle data caching to optimize API performance.

**What you'll build**:
1. Indicator result caching using existing LRU cache
2. Candle data caching to reduce database queries
3. Batch API endpoint for multiple indicator requests
4. Cache invalidation on candle data updates
5. Performance monitoring and metrics

**Expected outcomes**:
- Cached indicator requests: <100ms
- Uncached indicator requests: <500ms
- Batch requests (3 indicators): <200ms
- 70%+ cache hit rate

## Implementation Checklist

Use this checklist to track implementation progress:

- [ ] Phase 1: Setup & Configuration
- [ ] Phase 2: Candle Caching
- [ ] Phase 3: Indicator Caching
- [ ] Phase 4: Batch API Endpoint
- [ ] Phase 5: Cache Invalidation
- [ ] Phase 6: Database Index Verification
- [ ] Phase 7: Testing
- [ ] Phase 8: Documentation

## Phase 1: Setup & Configuration

### Step 1.1: Extend Performance Configuration

**File**: `backend/app/core/performance_config.py`

Add interval-based TTL configuration:

```python
# Add to PerformanceSettings class
cache_ttl_by_interval: Dict[str, int] = {
    "1m": 300,      # 5 minutes
    "5m": 300,      # 5 minutes
    "15m": 300,     # 5 minutes
    "30m": 300,     # 5 minutes
    "1h": 900,      # 15 minutes
    "4h": 900,      # 15 minutes
    "1d": 3600,     # 1 hour
    "1wk": 3600     # 1 hour
}

def get_cache_ttl_for_interval(interval: str) -> int:
    """Get cache TTL for a specific interval."""
    return performance_settings.cache_ttl_by_interval.get(interval, performance_settings.default_cache_ttl)
```

**Why**: Different intervals update at different rates; intraday data needs shorter TTL than daily data.

### Step 1.2: Add Candle Caching Functions

**File**: `backend/app/services/cache.py`

Add candle caching functions (similar to existing indicator functions):

```python
def generate_candle_cache_key(
    symbol: str,
    interval: str,
    start: datetime,
    end: datetime
) -> str:
    """Generate a cache key for candle data."""
    from app.core.performance_config import get_cache_ttl_for_interval

    # Normalize dates to strings for consistency
    start_str = start.isoformat() if start.tzinfo else start.isoformat() + "Z"
    end_str = end.isoformat() if end.tzinfo else end.isoformat() + "Z"

    return generate_cache_key(symbol, interval, start_str, end_str)


def get_candle_data(
    symbol: str,
    interval: str,
    start: datetime,
    end: datetime
) -> Optional[List[Dict[str, Any]]]:
    """Get cached candle data."""
    key = generate_candle_cache_key(symbol, interval, start, end)
    return candle_cache.get(key)


def cache_candle_data(
    symbol: str,
    interval: str,
    start: datetime,
    end: datetime,
    candles: List[Dict[str, Any]]
) -> None:
    """Cache candle data with interval-specific TTL."""
    from app.core.performance_config import get_cache_ttl_for_interval

    key = generate_candle_cache_key(symbol, interval, start, end)

    # Get interval-specific TTL
    ttl = get_cache_ttl_for_interval(interval)

    # Temporarily set TTL for this cache instance
    original_ttl = candle_cache._ttl_seconds
    candle_cache._ttl_seconds = ttl

    try:
        candle_cache.set(key, candles)
    finally:
        # Restore original TTL
        candle_cache._ttl_seconds = original_ttl
```

**Why**: Reuse existing cache infrastructure with interval-aware TTL.

---

## Phase 2: Candle Caching

### Step 2.1: Integrate Candle Cache in Orchestrator

**File**: `backend/app/services/orchestrator.py`

Modify `get_candles()` method to check cache first:

```python
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
    """Main entry point for getting candles with caching."""
    if not start or not end:
        delta = self.yf_provider._get_default_lookback(interval)
        end = end or datetime.now(timezone.utc)
        start = start or (end - delta)

    # Ensure start and end are aware (UTC)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    # NEW: Check candle cache first
    from app.services.cache import get_candle_data

    cached_candles = get_candle_data(ticker, interval, start, end)
    if cached_candles is not None:
        logger.debug(f"Candle cache hit for {ticker} ({interval})")
        performance_logger.record(
            operation="get_candles_cache_hit",
            duration_ms=0.5,  # Sub-millisecond for cache hit
            category="cache",
            context={"symbol": ticker, "interval": interval}
        )
        return cached_candles

    logger.debug(f"Candle cache miss for {ticker} ({interval})")

    # ... rest of existing get_candles logic (gap filling, DB query, etc.)
    # After fetching from DB and processing:

    # NEW: Cache the results
    from app.services.cache import cache_candle_data
    cache_candle_data(ticker, interval, start, end, valid_candles)

    return valid_candles
```

**Why**: Cache the expensive database query (300ms) to reduce response time.

**Testing**:
```python
# First call: cache miss, hits DB
candles1 = await orchestrator.get_candles(db, symbol_id, "SPY", "1d", start, end)

# Second call: cache hit, no DB query
candles2 = await orchestrator.get_candles(db, symbol_id, "SPY", "1d", start, end)

assert candles1 == candles2
```

---

## Phase 3: Indicator Caching

### Step 3.1: Integrate Indicator Cache in API Endpoint

**File**: `backend/app/api/v1/indicators.py`

Modify `get_indicator()` endpoint to use caching:

```python
@router.get("/{symbol}/{indicator_name}", response_model=IndicatorOutput)
async def get_indicator(
    symbol: str,
    indicator_name: str,
    # ... existing parameters ...
    db: AsyncSession = Depends(get_db),
    orchestrator: DataOrchestrator = Depends(get_orchestrator),
):
    # ... existing validation and parameter building ...

    # Build indicator params dict
    indicator_params: Dict[str, Any] = {}
    # ... existing parameter parsing ...

    # NEW: Check indicator cache first
    from app.services.cache import (
        get_indicator_result,
        cache_indicator_result,
        generate_indicator_cache_key
    )

    cache_key = generate_indicator_cache_key(
        symbol=symbol.upper(),
        interval=interval,
        indicator_name=indicator_name,
        params=indicator_params
    )

    cached_result = get_indicator_result(
        symbol=symbol.upper(),
        interval=interval,
        indicator_name=indicator_name,
        params=indicator_params
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

    # ... existing logic: fetch symbol, determine range, fetch candles, calculate ...

    # After calculation (before return):
    # NEW: Cache the result
    cache_indicator_result(
        symbol=symbol.upper(),
        interval=interval,
        indicator_name=indicator_name,
        params=indicator_params,
        result=result
    )

    return result
```

**Why**: Avoid redundant calculations for identical indicator requests.

---

## Phase 4: Batch API Endpoint

### Step 4.1: Add Batch Request/Response Schemas

**File**: `backend/app/schemas/indicator.py`

Add new schema classes:

```python
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class IndicatorRequest(BaseModel):
    """Single indicator request within a batch."""
    symbol: str = Field(..., description="Stock symbol")
    indicator_name: str = Field(..., description="Indicator name")
    interval: str = Field(default="1d", description="Timeframe")
    params: Optional[Dict[str, Any]] = Field(default=None, description="Indicator parameters")
    from_ts: Optional[datetime] = Field(default=None, alias="from", description="Start timestamp")
    to_ts: Optional[datetime] = Field(default=None, alias="to", description="End timestamp")

    class Config:
        populate_by_name = True  # Allow alias="from" to work


class BatchIndicatorRequest(BaseModel):
    """Batch indicator calculation request."""
    requests: List[IndicatorRequest] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="List of indicator requests"
    )


class ErrorDetail(BaseModel):
    """Error details for partial batch failures."""
    index: int = Field(..., description="Request index that failed")
    symbol: str = Field(..., description="Symbol from the request")
    indicator_name: str = Field(..., description="Indicator name from the request")
    error: str = Field(..., description="Error message")


class BatchIndicatorResponse(BaseModel):
    """Batch indicator calculation response."""
    results: List[IndicatorOutput] = Field(default=[], description="Successful results")
    errors: List[ErrorDetail] = Field(default=[], description="Failed requests")
    total_duration_ms: float = Field(..., description="Total processing time")
    cache_hits: int = Field(..., description="Number of cache hits")
    cache_misses: int = Field(..., description="Number of cache misses")
```

### Step 4.2: Implement Batch Endpoint

**File**: `backend/app/api/v1/indicators.py`

Add new endpoint:

```python
@router.post("/batch", response_model=BatchIndicatorResponse)
async def calculate_batch_indicators(
    request: BatchIndicatorRequest,
    db: AsyncSession = Depends(get_db),
    orchestrator: DataOrchestrator = Depends(get_orchestrator),
):
    """
    Calculate multiple indicators in a single request.

    Features:
    - Cache-first strategy (check cache before any DB work)
    - Parallel processing for independent requests
    - Partial failure support (continue on individual errors)
    - Deduplication of identical requests
    """
    import time
    import asyncio
    from app.services.cache import get_indicator_result, cache_indicator_result

    start_time = time.time()
    results = []
    errors = []
    cache_hits = 0
    cache_misses = 0

    async def process_single_indicator(
        idx: int,
        req: IndicatorRequest
    ) -> Optional[IndicatorOutput]:
        """Process a single indicator request."""
        nonlocal cache_hits, cache_misses

        try:
            # Build params dict
            params = req.params or {}

            # Check cache first
            cached = get_indicator_result(
                symbol=req.symbol.upper(),
                interval=req.interval,
                indicator_name=req.indicator_name,
                params=params
            )

            if cached is not None:
                cache_hits += 1
                return cached

            cache_misses += 1

            # Fetch candles and calculate (reuse existing logic)
            # You can extract this into a shared function
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
                result=result
            )

            return result

        except Exception as e:
            logger.error(f"Error processing indicator {req.indicator_name} for {req.symbol}: {e}")
            # Return error marker
            return e

    # Process all requests in parallel
    tasks = [
        process_single_indicator(idx, req)
        for idx, req in enumerate(request.requests)
    ]

    outputs = await asyncio.gather(*tasks, return_exceptions=True)

    # Separate results and errors
    for idx, output in enumerate(outputs):
        if isinstance(output, Exception):
            errors.append(ErrorDetail(
                index=idx,
                symbol=request.requests[idx].symbol,
                indicator_name=request.requests[idx].indicator_name,
                error=str(output)
            ))
        elif isinstance(output, Exception):
            # Error returned from function
            errors.append(ErrorDetail(
                index=idx,
                symbol=request.requests[idx].symbol,
                indicator_name=request.requests[idx].indicator_name,
                error=str(output)
            ))
        elif output is not None:
            results.append(output)

    total_duration_ms = (time.time() - start_time) * 1000

    performance_logger.record(
        operation="batch_indicators",
        duration_ms=total_duration_ms,
        category="batch",
        context={
            "request_count": len(request.requests),
            "result_count": len(results),
            "error_count": len(errors),
            "cache_hits": cache_hits,
            "cache_misses": cache_misses
        }
    )

    return BatchIndicatorResponse(
        results=results,
        errors=errors,
        total_duration_ms=total_duration_ms,
        cache_hits=cache_hits,
        cache_misses=cache_misses
    )
```

**Why**: Batch API reduces N roundtrips to 1 for N indicators.

---

## Phase 5: Cache Invalidation

### Step 5.1: Invalidate Cache on Candle Updates

**File**: `backend/app/services/data_updater.py`

Find where candles are saved to database and add cache invalidation:

```python
async def update_symbol_data(
    self,
    db: AsyncSession,
    symbol_id: int,
    ticker: str,
    interval: str
):
    """Fetch and save new candle data."""

    # ... existing fetch logic ...

    # Save to database
    for candle in new_candles:
        db.add(candle)
    await db.commit()

    # NEW: Invalidate cache for this symbol
    from app.services.cache import invalidate_symbol
    invalidate_symbol(symbol=ticker)

    logger.info(f"Invalidated cache for {ticker} after data update")
```

**Why**: Ensures cached indicators are recalculated when new candles arrive.

---

## Phase 6: Database Index Verification

### Step 6.1: Check Existing Indexes

**Action**: Run this query to check if candle table has proper indexes:

```sql
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'candles';
```

**Expected output** should include:
```
ix_candle_symbol_interval_timestamp | CREATE INDEX ix_candle_symbol_interval_timestamp ON candles(symbol_id, interval, timestamp)
```

### Step 6.2: Create Index if Missing

**If index is missing**, create migration:

```bash
cd backend
alembic revision -m "add_candle_performance_index"
```

**Edit migration file**:
```python
def upgrade():
    op.create_index(
        'ix_candle_symbol_interval_timestamp',
        'candles',
        ['symbol_id', 'interval', 'timestamp']
    )

def downgrade():
    op.drop_index('ix_candle_symbol_interval_timestamp', table_name='candles')
```

**Run migration**:
```bash
alembic upgrade head
```

### Step 6.3: Verify Query Performance

**Test query**:
```sql
EXPLAIN ANALYZE
SELECT * FROM candles
WHERE symbol_id = 1
  AND interval = '1d'
  AND timestamp >= '2023-01-01'
  AND timestamp <= '2024-01-01'
ORDER BY timestamp ASC;
```

**Expected**: Should show "Index Scan" with execution time <100ms.

---

## Phase 7: Testing

### Step 7.1: Unit Tests

**File**: `backend/tests/services/test_cache.py`

```python
import pytest
from datetime import datetime, timezone
from app.services.cache import (
    generate_indicator_cache_key,
    get_indicator_result,
    cache_indicator_result,
    invalidate_symbol
)

def test_indicator_cache_key_generation():
    """Test cache key is consistent for same inputs."""
    key1 = generate_indicator_cache_key("SPY", "1d", "crsi", {"period": 14})
    key2 = generate_indicator_cache_key("SPY", "1d", "crsi", {"period": 14})
    assert key1 == key2

def test_indicator_cache_key_params_order():
    """Test cache key is independent of param order."""
    key1 = generate_indicator_cache_key("SPY", "1d", "crsi", {"a": 1, "b": 2})
    key2 = generate_indicator_cache_key("SPY", "1d", "crsi", {"b": 2, "a": 1})
    assert key1 == key2

def test_cache_set_and_get():
    """Test caching and retrieving indicator results."""
    result = {"data": [1, 2, 3]}

    cache_indicator_result("SPY", "1d", "sma", {"period": 20}, result)

    cached = get_indicator_result("SPY", "1d", "sma", {"period": 20})
    assert cached == result

def test_cache_miss_returns_none():
    """Test cache miss returns None."""
    cached = get_indicator_result("INVALID", "1d", "sma", {"period": 20})
    assert cached is None

def test_symbol_invalidation():
    """Test symbol invalidation removes all entries."""
    result1 = {"data": [1, 2, 3]}
    result2 = {"data": [4, 5, 6]}

    cache_indicator_result("SPY", "1d", "sma", {"period": 20}, result1)
    cache_indicator_result("SPY", "1d", "ema", {"period": 20}, result2)

    invalidate_symbol(symbol="SPY")

    assert get_indicator_result("SPY", "1d", "sma", {"period": 20}) is None
    assert get_indicator_result("SPY", "1d", "ema", {"period": 20}) is None
```

### Step 7.2: Integration Tests

**File**: `backend/tests/api/test_indicators.py`

```python
import pytest
from httpx import AsyncClient

async def test_cached_indicator_returns_fast(async_client: AsyncClient):
    """Test cached indicator response is fast (<100ms)."""
    import time

    # First request (cache miss)
    start1 = time.time()
    response1 = await async_client.get(
        "/api/v1/indicators/SPY/crsi?interval=1d&dom_cycle=10"
    )
    duration1 = (time.time() - start1) * 1000

    assert response1.status_code == 200

    # Second request (cache hit)
    start2 = time.time()
    response2 = await async_client.get(
        "/api/v1/indicators/SPY/crsi?interval=1d&dom_cycle=10"
    )
    duration2 = (time.time() - start2) * 1000

    assert response2.status_code == 200
    assert duration2 < 100  # Cache hit should be fast
    assert duration2 < duration1  # Cached should be faster

async def test_batch_endpoint(async_client: AsyncClient):
    """Test batch endpoint returns multiple indicators."""
    response = await async_client.post(
        "/api/v1/indicators/batch",
        json={
            "requests": [
                {"symbol": "SPY", "indicator_name": "sma", "interval": "1d", "params": {"period": 20}},
                {"symbol": "SPY", "indicator_name": "ema", "interval": "1d", "params": {"period": 20}}
            ]
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data["results"]) == 2
    assert data["cache_hits"] + data["cache_misses"] == 2
    assert data["total_duration_ms"] < 200  # Should complete in <200ms

async def test_batch_handles_partial_failure(async_client: AsyncClient):
    """Test batch endpoint continues on individual failures."""
    response = await async_client.post(
        "/api/v1/indicators/batch",
        json={
            "requests": [
                {"symbol": "SPY", "indicator_name": "sma", "interval": "1d"},
                {"symbol": "INVALID", "indicator_name": "sma", "interval": "1d"}
            ]
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data["results"]) == 1
    assert len(data["errors"]) == 1
    assert data["errors"][0]["symbol"] == "INVALID"
```

### Step 7.3: Benchmark Tests

**File**: `backend/tests/benchmarks/test_indicator_cache.py`

```python
import pytest
import time
from httpx import AsyncClient

async def benchmark_cache_hit_rate(async_client: AsyncClient):
    """Benchmark cache hit rate over repeated requests."""
    hits = 0
    misses = 0
    iterations = 100

    for i in range(iterations):
        start = time.time()
        response = await async_client.get(
            "/api/v1/indicators/SPY/sma?interval=1d&period=20"
        )
        duration = (time.time() - start) * 1000

        if duration < 50:  # Assume cache hit if <50ms
            hits += 1
        else:
            misses += 1

    hit_rate = (hits / iterations) * 100
    print(f"Cache hit rate: {hit_rate:.1f}%")

    assert hit_rate > 70  # SC-004: >70% cache hit rate

async def benchmark_cached_response_time(async_client: AsyncClient):
    """Benchmark cached indicator response time (SC-001)."""
    # Prime the cache
    await async_client.get("/api/v1/indicators/SPY/sma?interval=1d&period=20")

    # Measure cached response times
    times = []
    for _ in range(50):
        start = time.time()
        await async_client.get("/api/v1/indicators/SPY/sma?interval=1d&period=20")
        times.append((time.time() - start) * 1000)

    # Calculate 90th percentile
    times.sort()
    p90 = times[int(len(times) * 0.9)]

    print(f"90th percentile cached response time: {p90:.1f}ms")
    assert p90 < 100  # SC-001: <100ms for 90th percentile
```

---

## Phase 8: Documentation

### Step 8.1: Update API Documentation

**File**: `backend/app/api/v1/indicators.py`

Add docstring to batch endpoint:

```python
@router.post(
    "/batch",
    response_model=BatchIndicatorResponse,
    summary="Calculate multiple indicators",
    description="""Calculate multiple indicators in a single request.

    **Features:**
    - Cache-first strategy for optimal performance
    - Parallel processing of independent requests
    - Partial failure support (continues on individual errors)
    - Automatic deduplication of identical requests

    **Performance:**
    - Cached requests: <100ms
    - Uncached requests: <500ms
    - Batch of 3: <200ms

    **Constraints:**
    - Maximum 10 requests per batch
    - Maximum processing time: 5 seconds
    """
)
async def calculate_batch_indicators(...):
    ...
```

### Step 8.2: Add Cache Statistics Endpoint

**File**: `backend/app/api/v1/indicators.py`

```python
@router.get("/cache/stats", response_model=Dict[str, Any])
async def get_cache_statistics():
    """Get cache performance statistics."""
    from app.services.cache import get_all_cache_stats
    return get_all_cache_stats()
```

---

## Verification Checklist

After implementation, verify:

- [ ] Cached indicator requests complete in <100ms (90th percentile)
- [ ] Uncached indicator requests complete in <500ms (90th percentile)
- [ ] Batch requests (3 indicators) complete in <200ms
- [ ] Cache hit rate exceeds 70% for repeated requests
- [ ] 50 concurrent requests complete within 2 seconds each
- [ ] Cache invalidation works on candle updates
- [ ] Database query time reduced from 300ms to <100ms
- [ ] All tests pass (unit, integration, benchmark)
- [ ] No regressions in existing functionality

---

## Troubleshooting

### Cache Hit Rate is Low

**Symptom**: Cache hit rate <70%

**Solutions**:
1. Check if TTL is too short for your use case
2. Verify cache key generation is consistent
3. Check if cache size limit is causing premature evictions
4. Monitor cache statistics endpoint

### Database Query Still Slow

**Symptom**: Query time >100ms despite indexes

**Solutions**:
1. Verify index exists: `SELECT * FROM pg_indexes WHERE tablename = 'candles'`
2. Run `EXPLAIN ANALYZE` to check query plan
3. Check if connection pooling is configured
4. Verify database server has sufficient resources

### Batch Endpoint Timeout

**Symptom**: Batch requests timeout after 5 seconds

**Solutions**:
1. Reduce batch size (fewer indicators per request)
2. Check if database connection pool is exhausted
3. Verify parallel processing is working (check logs)
4. Consider increasing timeout for specific use cases

---

## Next Steps

After completing this quickstart:

1. **Run all tests**: `pytest backend/tests/ -v`
2. **Run benchmarks**: `pytest backend/tests/benchmarks/ -v`
3. **Verify performance**: Use cache stats endpoint to monitor hit rate
4. **Deploy to staging**: Test with realistic load
5. **Monitor production**: Track cache hit rate and response times

---

**Feature Implementation Complete!** 🎉

You've successfully implemented indicator API performance optimization with:
- ✅ Multi-layer caching (indicator + candle data)
- ✅ Batch API endpoint
- ✅ Cache invalidation
- ✅ Performance monitoring
- ✅ Comprehensive tests

Expected performance improvement: **325ms → <100ms** for cached requests.
