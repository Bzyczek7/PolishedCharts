# Research: Indicator API Performance Optimization

**Feature**: 014-indicator-cache-optimization
**Date**: 2026-01-02
**Status**: Phase 0 Complete

## Research Objective

Investigate technology options and architectural decisions for implementing indicator result caching and candle data caching to reduce API response time from ~325ms to <100ms for cached requests.

## Current State Analysis

### Performance Bottleneck Identification

From feature 012 performance optimization work:
- **Indicator calculation**: Now fast (~3-5ms) after vectorization with pandas
- **Database query for candles**: ~300ms (the actual bottleneck)
- **API roundtrip**: ~325ms total

The bottleneck is in `backend/app/services/orchestrator.py:get_candles()` at lines 87-97:
```python
stmt = select(Candle).where(
    Candle.symbol_id == symbol_id,
    Candle.interval == interval,
    Candle.timestamp >= start,
    Candle.timestamp <= end
).order_by(Candle.timestamp.asc())
result = await db.execute(stmt)
candles = result.scalars().all()
```

Every indicator request triggers this database query, even when requesting the same indicator multiple times with identical parameters.

### Existing Infrastructure

**Cache Layer** (`backend/app/services/cache.py`):
- `LRUCache` class already implemented with:
  - TTL-based expiration
  - LRU eviction when size limit reached
  - Memory budget enforcement (100MB default)
  - Cache statistics (hits, misses, hit rate)
- Global instances: `indicator_cache` and `candle_cache` (50MB each)
- Helper functions: `generate_indicator_cache_key()`, `get_indicator_result()`, `cache_indicator_result()`
- Symbol invalidation: `invalidate_symbol()` for cache clearing on updates

**Performance Configuration** (`backend/app/core/performance_config.py`):
- `default_cache_ttl: int = 60` (1 minute)
- `max_cache_entries: int = 100`
- `cache_memory_budget: int = 500 * 1024 * 1024` (500MB)
- Configurable via environment variables (`PERFORMANCE_*` prefix)

**Indicator API** (`backend/app/api/v1/indicators.py:get_indicator()`):
- Lines 313-320: `orchestrator.get_candles()` call (the 300ms bottleneck)
- Lines 396-403: Indicator calculation with performance logging
- No caching currently implemented (cache infrastructure exists but unused)

## Technology Decisions

### Decision 1: Caching Strategy

**Options Considered**:
1. **In-memory LRU cache** (existing infrastructure)
2. **Redis** (dependencies include redis==5.0.1 but not configured)
3. **Database-backed cache** (PostgreSQL materialized views)

**Decision**: Use existing in-memory LRU cache

**Rationale**:
- **Simplicity**: Infrastructure already exists and is tested
- **Performance**: In-memory is fastest for <100ms target (Redis adds network roundtrip)
- **Sufficient for scale**: Single-server deployment typical for MVP
- **Cost**: No additional infrastructure or configuration
- **Graceful degradation**: If cache fails, fall back to database (FR-012)

**Future Consideration**: If multi-server deployment is needed, Redis can be added later by implementing the cache interface.

### Decision 2: Cache Key Design

**Approach**: Use existing `generate_indicator_cache_key()` function

**Key Components** (from spec FR-005):
- `symbol`: Stock ticker (e.g., "SPY")
- `interval`: Timeframe (e.g., "1d", "1h")
- `indicator_name`: Indicator type (e.g., "crsi", "sma")
- `params`: Sorted parameter key-value pairs (e.g., "domcycle=10,cyclicmemory=30")

**Implementation** (already exists in `cache.py:244-268`):
```python
def generate_indicator_cache_key(
    symbol: str,
    interval: str,
    indicator_name: str,
    params: Dict[str, Any],
) -> str:
    sorted_params = sorted(params.items())
    param_str = ",".join(f"{k}={v}" for k, v in sorted_params)
    return generate_cache_key(symbol, interval, indicator_name, param_str)
```

**Rationale**: MD5 hash provides short, unique keys; sorted params ensure consistency.

### Decision 3: Cache TTL Configuration

**Approach**: Interval-based TTL (from spec FR-006)

| Interval | TTL | Rationale |
|----------|-----|-----------|
| 1m, 5m, 15m | 5 minutes | Intraday data updates frequently |
| 1h, 4h | 15 minutes | Hourly data updates less frequently |
| 1d, 1wk | 1 hour | Daily data updates once per market close |

**Implementation**: Extend `performance_config.py` with interval-based TTL map.

**Rationale**:
- Balances freshness (invalidate when new candles arrive) with cache hit rate
- Matches data update patterns from `data_updater.py`
- Prevents stale indicators during market hours

### Decision 4: Cache Invalidation Strategy

**Approach**: Proactive invalidation on candle updates

**Implementation Points**:
1. **Data polling updates** (`backend/app/services/data_updater.py`):
   - When new candles are saved, call `cache.invalidate_symbol(symbol)`
   - Clears both `indicator_cache` and `candle_cache` for that symbol

2. **Manual data refresh** (if users trigger refresh):
   - Same invalidation call after successful candle fetch

3. **TTL-based expiration** (passive fallback):
   - LRU cache automatically expires entries after TTL
   - Handles edge cases where proactive invalidation fails

**Rationale**:
- **Proactive invalidation** ensures immediate freshness on updates
- **TTL fallback** provides safety net for missed invalidations
- **Symbol-level invalidation** is simple and effective (most traders watch limited symbols)

### Decision 5: Batch API Design

**Approach**: New endpoint `/api/v1/indicators/batch` (FR-004, FR-010)

**Request Schema**:
```python
class BatchIndicatorRequest(BaseModel):
    requests: List[IndicatorRequest]
    # Max 10 items per spec FR-010

class IndicatorRequest(BaseModel):
    symbol: str
    indicator_name: str
    interval: str = "1d"
    params: Optional[Dict[str, Any]] = None
    from_ts: Optional[datetime] = None
    to_ts: Optional[datetime] = None
```

**Response Schema**:
```python
class BatchIndicatorResponse(BaseModel):
    results: List[IndicatorOutput]
    errors: List[ErrorDetail]  # Partial failure support (FR-003 acceptance)
    total_duration_ms: float
    cache_hits: int
    cache_misses: int
```

**Optimization Strategy**:
1. **Deduplicate requests**: If same indicator requested twice, calculate once
2. **Batch candle fetch**: Fetch candles for all symbols once (if possible)
3. **Parallel calculation**: Use `asyncio.gather()` for independent indicators
4. **Cache check first**: Check cache before any database work

**Rationale**:
- Reduces N roundtrips to 1 roundtrip for N indicators
- Deduplication prevents redundant work
- Parallel calculation maximizes throughput
- Cache-first approach minimizes database load

### Decision 6: Database Query Optimization

**Approach**: Verify and add indexes if missing (FR-013)

**Expected Index** (should already exist):
```sql
CREATE INDEX ix_candle_symbol_interval_timestamp
ON candles (symbol_id, interval, timestamp);
```

**Verification Plan**:
1. Check existing migrations in `backend/alembic/versions/`
2. If index missing, add migration file
3. Test query performance before/after with `EXPLAIN ANALYZE`

**Target**: Reduce query time from 300ms to <100ms (SC-007)

**Rationale**:
- Composite index on `(symbol_id, interval, timestamp)` covers the query WHERE clause
- Index-only scan possible if columns are in index
- Low write overhead (candles are append-only)

### Decision 7: Candle Data Caching

**Approach**: Extend existing `candle_cache` for raw OHLCV data

**Cache Key**: `generate_cache_key(symbol, interval, str(start), str(end))`

**Cached Value**: List of candle dictionaries (same format as `get_candles()` returns)

**Integration Point**: In `orchestrator.get_candles()`:
```python
# Check cache first
cache_key = generate_cache_key(ticker, interval, str(start), str(end))
cached = candle_cache.get(cache_key)
if cached:
    return cached

# Fetch from DB
candles = await db.execute(stmt)

# Store in cache
candle_cache.set(cache_key, candles)
return candles
```

**Rationale**:
- Caches the 300ms database query result
- Reusable across multiple indicators for same symbol/interval
- Works seamlessly with indicator caching (layered caching)

## Open Questions & Resolutions

### Q1: Should we use Redis instead of in-memory cache?

**Resolution**: No. Use existing in-memory LRU cache.
- Redis adds complexity without clear benefit for single-server deployment
- Can migrate to Redis later if multi-server scaling is needed
- In-memory cache provides <100ms response time (meets SC-001)

### Q2: What TTL should we use for different intervals?

**Resolution**: Interval-based TTL (Decision 3).
- 5 minutes for intraday (1m, 5m, 15m)
- 15 minutes for hourly (1h, 4h)
- 1 hour for daily/weekly (1d, 1wk)

### Q3: How do we ensure cache invalidation when candles update?

**Resolution**: Proactive invalidation + TTL fallback (Decision 4).
- Call `cache.invalidate_symbol()` in `data_updater.py` after saving candles
- Rely on TTL as safety net

### Q4: Should batch requests be processed serially or in parallel?

**Resolution**: Parallel with cache-first approach.
- Use `asyncio.gather()` for independent indicator calculations
- Check cache before any work (avoid redundant database queries)
- Deduplicate identical requests within batch

### Q5: Do we need database indexes?

**Resolution**: Verify existing indexes, add if missing.
- Check alembic migrations for candle table indexes
- Target: `(symbol_id, interval, timestamp)` composite index
- Test with `EXPLAIN ANALYZE` to confirm query plan

## Implementation Considerations

### Performance Monitoring

**Metrics to Track** (FR-007, SC-004):
- Cache hit rate (target: >70%)
- Cache hit response time (target: <100ms)
- Cache miss response time (target: <500ms)
- Database query time (target: <100ms)
- Batch request duration (target: <200ms for 3 indicators)

**Implementation**: Use existing `performance_logger` from feature 012.

### Error Handling

**Graceful Degradation** (FR-012):
- If cache `get()` fails: Fall back to database query
- If cache `set()` fails: Log error, continue without caching
- If database query times out: Return user-friendly error (SC edge case)

**Logging**:
```python
logger.warning(f"Cache get failed for key {cache_key}: {e}, falling back to DB")
logger.error(f"Database query timeout for {symbol}: {e}")
```

### Testing Strategy

**Unit Tests** (TDD approach per Constitution V):
- `test_cache_hit_returns_cached_result()`
- `test_cache_miss_fetches_from_db_and_caches()`
- `test_cache_invalidation_removes_entries()`
- `test_cache_expiration_after_ttl()`
- `test_batch_deduplication()`

**Integration Tests**:
- `test_indicator_caching_end_to_end()`
- `test_batch_api_with_mixed_cache_hits_misses()`
- `test_cache_invalidation_on_candle_update()`

**Benchmark Tests** (per Constitution VI):
- `test_cached_indicator_response_time()`: Assert <100ms (90th percentile)
- `test_uncached_indicator_response_time()`: Assert <500ms (90th percentile)
- `test_batch_3_indicators_response_time()`: Assert <200ms
- `test_cache_hit_rate()`: Assert >70% for repeated requests

## Dependencies and Constraints

### Existing Dependencies Used

- `LRUCache` from `backend/app/services/cache.py`
- `performance_settings` from `backend/app/core/performance_config.py`
- `performance_logger` from feature 012
- `indicator_registry` from feature 010

### No New Dependencies Required

- Redis: Already in requirements.txt but not needed for MVP
- Pandas: Already used for calculations
- SQLAlchemy: Already used for database access

### Constraints

- Must maintain backward compatibility with single-indicator API (FR-011)
- Cache failures must not break API (FR-012)
- Maximum batch size: 10 indicators (FR-010)
- Maximum batch processing time: 5 seconds (FR-014)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Request                                  │
│           GET /api/v1/indicators/{symbol}/{indicator}               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
        ┌──────────────────────────────────────────────┐
        │         1. Check Indicator Cache             │
        │    (symbol, interval, name, params)          │
        └────────────────────┬─────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
            HIT │                         │ MISS
                │                         │
                ▼                         ▼
        ┌───────────────┐       ┌──────────────────────┐
        │ Return Cached │       │ 2. Check Candle Cache │
        │   Result      │       │   (symbol, interval)  │
        │   (<50ms)     │       └──────────┬───────────┘
        └───────────────┘                  │
                                    ┌───────┴────────┐
                                    │                │
                                HIT │                │ MISS
                                    │                │
                                    ▼                ▼
                            ┌─────────────┐  ┌──────────────────┐
                            │ Use Cached  │  │ 3. Query DB      │
                            │ Candles     │  │   (target <100ms)│
                            └──────┬──────┘  └────────┬─────────┘
                                   │                   │
                                   └───────┬───────────┘
                                           │
                                           ▼
                                ┌───────────────────────┐
                                │ 4. Calculate Indicator│
                                │    (already fast:     │
                                │     ~3-5ms)           │
                                └───────────┬───────────┘
                                            │
                                            ▼
                                ┌───────────────────────┐
                                │ 5. Cache Results      │
                                │    (indicator + candle)│
                                └───────────┬───────────┘
                                            │
                                            ▼
                                ┌───────────────────────┐
                                │ 6. Return Response     │
                                └───────────────────────┘
```

## Success Criteria Mapping

| Success Criterion | Implementation Approach |
|-------------------|------------------------|
| SC-001: <100ms cached | In-memory cache hit + minimal processing |
| SC-002: <500ms uncached | DB optimization + fast calculation |
| SC-003: <200ms batch of 3 | Parallel calc + shared candle fetch |
| SC-004: >70% cache hit rate | Effective cache key design + appropriate TTL |
| SC-005: 50 concurrent users | Efficient cache + connection pooling |
| SC-006: <10% evictions/hour | Sufficient memory budget (50MB per cache) |
| SC-007: DB query <100ms | Composite index verification |
| SC-008: User latency <150ms | Combined effect of all optimizations |

## Phase 0 Completion Checklist

- [x] Identified performance bottleneck (database query, not calculation)
- [x] Confirmed existing cache infrastructure can be leveraged
- [x] Designed cache key strategy for indicators
- [x] Designed interval-based TTL configuration
- [x] Designed cache invalidation strategy
- [x] Designed batch API endpoint structure
- [x] Planned database index verification
- [x] Planned candle data caching layer
- [x] Defined performance metrics and monitoring approach
- [x] Outlined testing strategy (unit, integration, benchmark)

**Phase 0 Status**: COMPLETE ✓

**Next Steps**: Proceed to Phase 1 (Design) to create data-model.md, contracts/, and quickstart.md.
