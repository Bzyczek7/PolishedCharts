# Performance Optimization Quickstart

**Feature**: 012-performance-optimization
**Branch**: `012-performance-optimization`

## Overview

This quickstart guide helps you implement performance monitoring and optimization for the TradingAlert application. The focus is on measuring first, then optimizing bottlenecks one at a time.

## Phase 0: Initial Performance Audit

### Step 1: Enable Performance Monitoring

Add the performance monitoring utilities to your frontend:

```typescript
// frontend/src/lib/performance.ts
import { PerformanceStore } from './performanceStore';

// Create global performance store
export const performanceStore = new PerformanceStore();

// Helper to time async operations
export async function measurePerformance<T>(
  operation: string,
  category: 'data_fetch' | 'calculation' | 'rendering' | 'ui_interaction',
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    performanceStore.record({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      category,
      operation,
      duration_ms: duration,
      context: context || {}
    });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    performanceStore.record({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      category,
      operation,
      duration_ms: duration,
      context: { ...context, error: true }
    });
    throw error;
  }
}
```

### Step 2: Instrument Data Fetching

Update `useCandleData.ts` to measure candle fetches:

```typescript
import { measurePerformance } from '@/lib/performance';

// In fetchCandles function:
const candles = await measurePerformance(
  'fetch_candles',
  'data_fetch',
  () => getCandles(symbol, interval),
  { symbol, interval }
);
```

Update `useIndicatorData.ts` to measure indicator fetches:

```typescript
const data = await measurePerformance(
  `calculate_${indicator.indicatorType.name}`,
  'calculation',
  () => getIndicator(symbol, indicatorName, interval, indicator.indicatorType.params),
  { symbol, indicator: indicator.indicatorType.name, params: indicator.indicatorType.params }
);
```

### Step 3: Instrument Rendering

Add performance tracking to chart component:

```typescript
// In ChartComponent.tsx
useEffect(() => {
  const start = performance.now();
  // ... chart rendering logic ...
  const end = performance.now();
  performanceStore.record({
    id: crypto.randomUUID(),
    timestamp: new Date(),
    category: 'rendering',
    operation: 'render_chart',
    duration_ms: end - start,
    context: { candle_count: candles.length, overlay_count: overlays.length }
  });
}, [candles, overlays]);
```

### Step 4: Generate First Report

Add a performance report component:

```typescript
// frontend/src/components/PerformanceReport.tsx
import { performanceStore } from '@/lib/performance';

export function PerformanceReport() {
  const [report, setReport] = useState<PerformanceReport | null>(null);

  const generateReport = () => {
    const r = performanceStore.generateReport();
    setReport(r);
  };

  return (
    <div>
      <button onClick={generateReport}>Generate Report</button>
      {report && (
        <div>
          <h3>Bottlenecks</h3>
          {report.bottlenecks.map(b => (
            <div key={b.operation}>
              {b.operation}: {b.total_duration_ms}ms ({b.percent_of_total}%)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Phase 1: Analyze Results

### Step 1: Review Top 5 Bottlenecks

1. Run the app and navigate to a chart
2. Generate a performance report
3. Identify the top 5 operations by total duration

Example output:
```
1. fetch_candles: 2500ms (45% of total)
2. calculate_rsi: 800ms (15% of total)
3. calculate_macd: 600ms (12% of total)
4. render_chart: 400ms (8% of total)
5. fetch_indicator_metadata: 200ms (4% of total)
```

### Step 2: Select First Bottleneck to Fix

Choose the bottleneck with highest impact. Example: `fetch_candles` at 2500ms.

## Phase 2: Fix Bottlenecks One at a Time

### Fix 1: Candle Fetch Performance

**Problem**: Each symbol switch fetches candles from API, even for recently viewed symbols.

**Solution**: Add frontend caching.

```typescript
// frontend/src/lib/candleCache.ts
class CandleCache {
  private cache = new Map<string, { candles: Candle[], timestamp: Date }>();
  private TTL = 60000; // 1 minute

  get(symbol: string, interval: string): Candle[] | null {
    const key = `${symbol}:${interval}`;
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp.getTime() < this.TTL) {
      return entry.candles;
    }
    return null;
  }

  set(symbol: string, interval: string, candles: Candle[]): void {
    const key = `${symbol}:${interval}`;
    this.cache.set(key, { candles, timestamp: new Date });
  }
}

export const candleCache = new CandleCache();
```

Update `useCandleData.ts`:

```typescript
// Check cache first
const cached = candleCache.get(symbol, interval);
if (cached) {
  setState(prev => ({
    ...prev,
    candles: cached,
    isLoading: false,
    lastUpdate: new Date()
  }));
  return;
}

// Fetch from API
const candles = await getCandles(symbol, interval);
candleCache.set(symbol, interval, candles);
```

### Verify Fix

1. Clear performance logs
2. Navigate to symbol A
3. Navigate to symbol B
4. Navigate back to symbol A (should be cached)
5. Generate new report

Expected result: Second load of symbol A should be < 100ms (cache hit).

### Fix 2: Indicator Calculation Batching

**Problem**: Each indicator is a separate API call.

**Solution**: Add batch endpoint.

Backend (`backend/app/api/v1/indicators.py`):

```python
@router.post("/batch")
async def calculate_indicators_batch(
    symbol: str,
    requests: List[IndicatorRequest],
    interval: str = "1d",
    db: AsyncSession = Depends(get_db)
):
    """Calculate multiple indicators in one request."""
    results = {}
    candles = await get_candles_from_db(db, symbol, interval)
    df = candles_to_dataframe(candles)

    for req in requests:
        indicator = registry.get_indicator(req.name, **req.params)
        output = indicator.calculate(df)
        results[req.name] = output

    return results
```

Frontend:

```typescript
// Fetch all indicators in one call
const indicatorData = await measurePerformance(
  'calculate_indicators_batch',
  'calculation',
  () => post('/indicators/batch', {
    symbol,
    interval,
    requests: indicators.map(i => ({
      name: i.indicatorType.name,
      params: i.indicatorType.params
    }))
  })
);
```

### Verify Fix

Generate report and compare:
- Before: 5 indicators × 200ms = 1000ms
- After: 1 batch call × 300ms = 300ms

## Phase 3: Continue Iteratively

For each bottleneck:
1. Measure current performance
2. Implement fix
3. Verify improvement with new report
4. Move to next bottleneck

## Common Optimization Patterns

### Frontend Caching
- Use `useMemo` for expensive computations
- Cache API responses in localStorage or Map
- Implement request deduplication

### Backend Caching
- Use `@lru_cache` for indicator calculations
- Add database query result caching
- Implement connection pooling

### Rendering Optimization
- Use `React.memo` for components
- Virtualize long lists
- Defer non-critical rendering

### Network Optimization
- Batch multiple requests
- Implement GraphQL for precise data fetching
- Use compression for large payloads

## Performance Targets

| Operation | Target | Status |
|-----------|--------|--------|
| Chart initial load | 3s | ⬜ Not met |
| Indicator calculation | 1s | ⬜ Not met |
| Symbol switch (cached) | 1s | ⬜ Not met |
| 5 indicators total | 5s | ⬜ Not met |
| UI feedback | 200ms | ⬜ Not met |

## Troubleshooting

**Issue**: Performance logs not appearing
- **Fix**: Ensure `performanceStore.record()` is called after operations complete

**Issue**: Reports show "insufficient_data"
- **Fix**: Perform more operations (minimum 3 per operation type)

**Issue**: Cache not working
- **Fix**: Check cache key consistency (symbol case sensitivity)

**Issue**: Batch endpoint slower than individual calls
- **Fix**: Check for N+1 queries in batch handler
