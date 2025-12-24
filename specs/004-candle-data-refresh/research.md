# Research: Candle Data and Refresh

**Feature**: 004-candle-data-refresh
**Date**: 2025-12-24
**Status**: Phase 0 Complete

## Overview

This document captures research findings and technical decisions for implementing polling-based candle data refresh without WebSockets. Research focused on React polling patterns, lightweight-charts integration, yfinance provider behavior, and caching strategies.

---

## 1. Polling Scheduler Architecture

### Decision: **Per-Hook Polling with Shared Timer Management**

**Rationale**:
- **Centralized scheduler** adds complexity with singleton patterns and global state management
- **Per-component polling** is simpler and aligns with React's component lifecycle model
- **Shared utility** (`pollingScheduler.ts`) can provide common timer management without imposing a singleton

**Implementation Approach**:
- Create `pollingScheduler.ts` as a utility module (not a singleton service)
- Each hook (`useCandleData`, `useWatchlistData`) manages its own polling timer
- Shared utility provides:
  - `createPollTimer(callback, interval)` - creates a cancelable timer
  - `clearPollTimer(timerId)` - cleanup function
- This pattern allows multiple independent polls without coordination overhead

**Alternatives Considered**:
| Alternative | Pros | Cons | Rejected Because |
|-------------|------|------|------------------|
| Centralized singleton scheduler | Coordinated polling, deduplication | Global state, complex lifecycle, harder to test | Adds unnecessary complexity for 2 polling hooks |
| SWR/React Query | Built-in caching, polling, deduplication | New dependency, doesn't match existing patterns | Project uses custom hooks; prefer consistency |
| Pure per-component without utility | Simplest | Code duplication, inconsistent behavior | DRY principle - shared utility reduces duplication |

---

## 2. Refresh Interval Management

### Decision: **Immediate Cancellation and Restart on Interval Change**

**Rationale**:
- When user changes intervals (e.g., 1m → 1h), old polling is immediately irrelevant
- Restarting ensures data freshness for the new interval
- Cache invalidation happens naturally via new interval data fetch

**Implementation Approach**:
```typescript
// In useCandleData hook
useEffect(() => {
  // Cancel existing timer
  if (pollTimer) {
    clearPollTimer(pollTimer);
  }

  // Start new polling with new interval
  const newTimer = createPollTimer(() => {
    fetchCandles(symbol, newInterval);
  }, getPollFrequency(newInterval));

  setPollTimer(newTimer);

  return () => clearPollTimer(newTimer);
}, [symbol, interval]); // Re-run on interval change
```

**Alternatives Considered**:
| Alternative | Pros | Cons | Rejected Because |
|-------------|------|------|------------------|
| Complete timer on interval switch | Clean state, no stale data | Brief gap in updates | Gap is acceptable; simpler than queueing |
| Queue timer change until next tick | No API disruption | Stale data until next cycle | User expects immediate update on interval change |
| Multiple simultaneous polls | Smoothest UX | API waste, cache pollution | Violates "no redundant requests" requirement |

---

## 3. Backfill Trigger Strategy

### Decision: **lightweight-charts `visible_range_changed` Event with Threshold**

**Rationale**:
- lightweight-charts provides `visible_range_changed` event for exactly this use case
- Threshold-based triggering prevents excessive API calls during pan
- Time-range calculation enables efficient backfill queries

**Implementation Approach**:
```typescript
chart.subscribeVisibleTimeRangeChange((range) => {
  const { from, to } = range;
  const earliestLoaded = candles[0]?.time;

  // Trigger backfill if user scrolled within 10% of loaded range
  if (from < earliestLoaded + (to - from) * 0.1) {
    triggerBackfill(symbol, interval, from);
  }
});
```

**Alternatives Considered**:
| Alternative | Pros | Cons | Rejected Because |
|-------------|------|------|------------------|
| Scroll event listener | Works without chart lib | Not chart-aware, thrashes easily | lightweight-charts has native event |
| Time-based (every 5 seconds) | Simple | Wasteful if not scrolling | Pull-based is more efficient |
| Manual "Load More" button | User control, no surprise | Poor UX, breaks immersion | TradingView auto-loads; parity expected |

---

## 4. Watchlist Polling Optimization

### Decision: **Batched Single Request with `/latest_prices` Endpoint**

**Rationale**:
- Existing `/latest_prices/{symbols}` endpoint accepts comma-separated symbols
- Single HTTP request is more efficient than N parallel requests
- HTTP/2 multiplexing not needed; one request already minimal
- Backend can parallelize yfinance calls if needed

**Implementation Approach**:
```typescript
// Fetch all 50 symbols in one request
const symbols = watchlist.map(w => w.symbol).join(',');
const response = await api.get(`/candles/latest_prices/${symbols}`);
```

**Backend Optimization**:
- Use `asyncio.gather()` to parallelize yfinance calls per symbol
- Batch yfinance requests if provider supports multi-symbol queries

**Alternatives Considered**:
| Alternative | Pros | Cons | Rejected Because |
|-------------|------|------|------------------|
| Batched single request | 1 HTTP roundtrip, simple | Backend complexity | Minimal complexity; already have endpoint |
| Parallel frontend requests | Frontend control | N HTTP roundtrips, CORS overhead | 50 requests = browser connection pool saturation |
| Chunked batches (5x10) | Balance | Extra frontend code | Single batch simpler; backend handles parallelism |

---

## 5. Session-based Caching Implementation

### Decision: **In-Memory for Metadata, localStorage for Optional Persistence**

**Rationale**:
- **In-memory (React state)**: Simple, fast, automatically cleared on refresh
- **localStorage**: Optional persistence across page reloads
- Cache metadata = timestamps, last fetch times, not actual candle data
- Actual candle data cached in PostgreSQL (backend)

**Implementation Approach**:
```typescript
// In-memory cache state
interface CacheMetadata {
  [key: string]: {  // key = `${symbol}_${interval}`
    lastFetch: number;
    lastUpdate: number;
    isStale: boolean;
  }
}

// Optional localStorage for persistence
const CACHE_KEY = 'tradingalert_candle_cache_meta';
```

**Alternatives Considered**:
| Alternative | Pros | Cons | Rejected Because |
|-------------|------|------|------------------|
| In-memory only | Simplest, auto-clear | Lost on refresh | Acceptable; candles re-fetched from DB cache |
| localStorage only | Survives refresh | 5-10MB limit, sync API | Metadata small; candles in DB anyway |
| IndexedDB | Larger storage | Complex, async API | Overkill for timestamp metadata |
| SessionStorage | Auto-clear | 5-10MB limit, tab-specific | localStorage + in-memory more flexible |

---

## 6. Integration Patterns

### 6.1 yfinance Rate Limits

**Finding**: yfinance has no official published rate limits

**Best Practices**:
- Respect HTTP 429 responses with exponential backoff (already specified)
- Use `time.sleep()` between batches in bulk operations
- Avoid simultaneous requests for same symbol/interval
- Cache aggressively to minimize redundant fetches

**Implementation**:
- yfinance Python library includes basic rate limiting
- Additional backoff in `YFinanceProvider` for safety
- Monitor `Retry-After` header on 429 responses

### 6.2 Exponential Backoff Patterns

**Finding**: 1s, 2s, 4s delays are standard for transient failures

**Confirmation**:
- Industry standard for HTTP retry policies
- yfinance typical failures resolve within 1-2 seconds
- 3 retries covers most transient network issues
- Final failure after ~7 seconds total (1s + 2s + 4s)

**Implementation**:
```python
async def fetch_with_backoff(url, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await httpx.get(url)
        except httpx.HTTPStatusError as e:
            if e.response.status == 429:
                delay = 2 ** attempt  # 1s, 2s, 4s
                await asyncio.sleep(delay)
            else:
                raise
```

### 6.3 Market Schedule APIs

**Finding**: No dedicated market schedule API needed

**Approach**:
- Use Python `pandas_market_calendars` library if precise schedule needed
- Simple heuristic: reduce polling frequency on weekends
- US market hours: 9:30 AM - 4:00 PM ET, Mon-Fri

**Implementation**:
```python
def is_market_open():
    now = datetime.now(timezone.utc)
    now_et = now.astimezone(ZoneInfo('America/New_York'))
    # Weekend check
    if now_et.weekday() >= 5:
        return False
    # Hours check
    return 9:30 <= now_et.hour + now_et.minute/60 <= 16:00
```

---

## Summary of Decisions

| Area | Decision | Impact |
|------|----------|--------|
| Polling Architecture | Per-hook with shared utility | Simple, testable, React-idiomatic |
| Interval Switching | Cancel and restart immediately | Fresh data, clean cache invalidation |
| Backfill Trigger | lightweight-charts visible range event | Efficient, chart-aware |
| Watchlist Polling | Batched single request | Meets SC-005 (<10s for 50 symbols) |
| Cache Metadata | In-memory + optional localStorage | Simple, fast, auto-clear |
| yfinance Rate Limits | Dynamic via 429 responses | No hard limits, adapts to provider |
| Backoff Delays | 1s, 2s, 4s (3 retries) | Standard pattern, covers transient failures |
| Market Schedule | Simple timezone check | Reduces unnecessary polling |

---

## Open Questions Resolved

All Phase 0 technical unknowns have been resolved. No blocking questions remain.

**Ready to proceed to Phase 1**: Data Model, API Contracts, Quickstart.

---

**Version**: 1.0.0 | **Last Updated**: 2025-12-24
