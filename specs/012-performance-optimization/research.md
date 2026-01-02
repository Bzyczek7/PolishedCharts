# Research: Performance Optimization for Chart and Indicator Rendering

**Feature**: 012-performance-optimization
**Date**: 2025-12-31
**Status**: Phase 0 Complete

## Overview

This research documents findings about performance bottlenecks in the TradingAlert application and identifies approaches for comprehensive performance monitoring and optimization.

## Current State Analysis

### Existing Performance Testing

The codebase already has some performance testing infrastructure:

**Backend Benchmarks** (`backend/tests/benchmarks/`):
- `test_alert_performance.py` - Tests alert evaluation at scale (100, 1000, 10000 alerts)
- Performance budget: 500ms for 1000+ alerts (Constitution VI)

**Frontend Performance Tests** (`frontend/tests/performance/`):
- `test-rendering.test.ts` - Tests rendering 5+ indicator panes at 60fps
- `test-symbol-switch.test.ts` - Tests symbol switch restore time (<1s requirement)

**Limitations**:
- Tests use basic `performance.now()` timing
- No centralized performance logging infrastructure
- No production performance monitoring
- Tests don't generate actionable bottleneck reports

### Data Fetching Patterns

**Frontend**:
- `useCandleData` hook: Fetches candles via `getCandles()` API call
- `useIndicatorData` hook: Fetches indicator data via `getIndicator()` API call
- Both hooks trigger fetches on symbol/interval change
- No request deduplication for concurrent identical requests
- `indicatorMetadataCache` exists in App.tsx for indicator metadata

**Backend**:
- `YFinanceProvider`: Fetches data from yfinance with chunking for large ranges
- `CandleService`: Upserts candles to PostgreSQL
- `IndicatorRegistry`: Calculates indicators on-demand (no caching)
- No in-memory caching layer for candle data

### Identified Potential Bottlenecks

Based on code analysis, these are likely bottlenecks to investigate:

1. **Network Round-trips**:
   - Each indicator fetch is a separate API call
   - No batch API for fetching multiple indicators
   - Candle fetches may not be optimally cached

2. **Indicator Calculation**:
   - Indicators calculated on every request (no result caching)
   - pandas-ta calculations may be expensive for large datasets

3. **Chart Rendering**:
   - lightweight-charts performance with many data points
   - Multiple indicator panes requiring separate chart instances

4. **React Re-renders**:
   - State updates in `useCandleData` and `useIndicatorData` may cause unnecessary re-renders
   - No memoization of expensive computations

5. **Database Queries**:
   - Candle queries fetch full date ranges without pagination
   - No query optimization for recent data

## Technology Decisions

### Performance Monitoring Approach

**Decision**: Browser-native Performance API + Backend timing middleware

**Rationale**:
- `performance.now()` provides sub-millisecond precision
- `PerformanceObserver` allows passive monitoring without code instrumentation
- Backend timing via async context managers
- No external dependencies required
- Works in all modern browsers

**Alternatives Considered**:
- **Lighthouse/CI integration**: Rejected - only measures page load, not ongoing interactions
- **Web Vitals library**: Rejected - focused on Core Web Vitals, not custom operations
- **Custom APM (e.g., Sentry Performance)**: Rejected - adds complexity, external service dependency

### Caching Strategy

**Decision**: Multi-tier caching

1. **Frontend Browser Cache**:
   - Use `cache` API or IndexedDB for candle data
   - In-memory Map for indicator results with LRU eviction
   - Cache key: `{symbol}:{interval}:{indicatorKey}`

2. **Backend In-Memory Cache** (new):
   - functools.lru_cache for indicator calculations
   - TTL-based invalidation (align with poll intervals)
   - Cache size limit to prevent memory bloat

3. **Database Optimization**:
   - Add indexes on `(symbol_id, interval, timestamp)`
   - Consider materialized view for recent candles

**Rationale**:
- Aligns with Local-First principle (Constitution IV)
- Reduces redundant network requests
- Indicator calculation is deterministic for same input
- Existing PostgreSQL cache works for persistence, in-memory for speed

**Alternatives Considered**:
- **Redis**: Rejected - adds infrastructure complexity, single-user context
- **Service Worker Cache API**: Rejected - overkill for current scope, adds complexity

### Performance Logging Format

**Decision**: Structured JSON logs with operation categories

**Rationale**:
- Machine-readable for report generation
- Easy to filter and aggregate
- Compatible with existing logger infrastructure

**Log Structure**:
```json
{
  "timestamp": "2025-12-31T12:00:00.000Z",
  "operation": "fetch_candles",
  "category": "data_fetch",
  "duration_ms": 1234,
  "context": {
    "symbol": "AAPL",
    "interval": "1d",
    "candle_count": 252
  }
}
```

### Bottleneck Identification Method

**Decision**: Statistical analysis with threshold-based alerting

**Rationale**:
- Pareto analysis (80/20 rule) aligns with spec (FR-007)
- Thresholds configurable per operation type
- Percentile-based reporting (p50, p95, p99) for realistic view

**Algorithm**:
1. Aggregate logs by operation type
2. Calculate total time contribution
3. Flag operations > 20% of total load time
4. Flag operations exceeding threshold (e.g., chart load > 3s)
5. Rank by duration descending

## Performance Targets

From spec and constitution:

| Operation | Target | Constitution Reference |
|-----------|--------|------------------------|
| Chart initial load | 3 seconds | SC-003, Constitution VI |
| Indicator calculation | 1 second | SC-004, FR-012 |
| Symbol switch (cached) | 1 second | SC-005 |
| 5 indicators total | 5 seconds | SC-006 |
| UI feedback | 200ms | FR-013, SC-007 |
| Single operation % of total | < 20% | SC-008 |

## Implementation Risks

1. **Memory Bloat**: Aggressive caching could exceed 500MB budget
   - **Mitigation**: LRU eviction with size limits, monitor memory usage

2. **Cache Staleness**: Cached indicators may not reflect latest candles
   - **Mitigation**: TTL based on poll interval, cache invalidation on new data

3. **Measurement Overhead**: Performance logging itself adds overhead
   - **Mitigation**: Passive monitoring where possible, sampling for high-frequency operations

4. **External API Variability**: yfinance response times may skew measurements
   - **Mitigation**: Separate external vs internal timing, use p95/p99 instead of averages

## Open Questions Resolved

1. **Q**: Should we use Web Workers for indicator calculation?
   - **A**: No - indicators calculated server-side. Frontend only receives results.

2. **Q**: Should we implement virtual scrolling for chart data?
   - **A**: No - lightweight-charts handles large datasets efficiently. Focus on data fetch optimization.

3. **Q**: Should we batch indicator API calls?
   - **A**: Yes - add `/indicators/batch` endpoint for fetching multiple indicators in one request (Phase 2 optimization)

## Next Steps

Phase 1 will create:
1. Data model for performance logs and reports
2. API contracts for performance monitoring endpoints
3. Quickstart guide for implementing performance logging
4. Update implementation plan with concrete technical details
