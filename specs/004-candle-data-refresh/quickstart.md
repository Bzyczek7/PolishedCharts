# Quickstart: Candle Data and Refresh

**Feature**: 004-candle-data-refresh
**Date**: 2025-12-24
**Purpose**: Developer onboarding guide for implementing polling-based candle data refresh

---

## Overview

This feature adds polling-based data refresh to TradingAlert, allowing the main chart and watchlist to update periodically without using WebSockets. It extends the existing candle infrastructure with new services and React hooks.

---

## Prerequisites

### Required Knowledge
- Python 3.11+ with async/await patterns
- FastAPI framework basics
- React 19 hooks (useState, useEffect, useCallback, useMemo)
- TypeScript for React
- PostgreSQL and SQLAlchemy basics

### Environment Setup
```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │ ChartComponent│   │ Watchlist   │    │   Symbol    │    │
│  │             │    │             │    │   Search    │    │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    │
│         │                  │                  │            │
│         ▼                  ▼                  ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │useCandleData│    │useWatchlist │    │  (Direct)   │    │
│  │    Hook     │    │   Data Hook │    │   Fetch     │    │
│  └──────┬──────┘    └──────┬──────┘               │    │
│         │                  │                      │        │
│         └──────────┬───────┴──────────────────────┘        │
│                    ▼                                        │
│         ┌─────────────────────┐                            │
│         │  pollingScheduler.ts │ (shared utility)           │
│         └──────────┬───────────┘                            │
└────────────────────┼───────────────────────────────────────┘
                     │ HTTP (REST API)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │            FastAPI Router (/candles)                │   │
│  │  - GET /candles/{symbol}                           │   │
│  │  - GET /candles/latest_prices/{symbols}            │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          DataOrchestrator (existing)                │   │
│  │  - Coordinates providers and services               │   │
│  └────────────┬────────────────────────────────────────┘   │
│               │                                             │
│       ┌───────┴────────┐                                  │
│       ▼                ▼                                  │
│  ┌─────────┐    ┌──────────────┐                          │
│  │ Candle  │    │ YFinance     │                          │
│  │ Service │    │ Provider     │                          │
│  │ (DB)    │    │ (API)        │                          │
│  └────┬────┘    └──────────────┘                          │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PostgreSQL (Candles)                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Backend Services

#### Step 1.1: Create MarketSchedule Service

**File**: `backend/app/services/market_schedule.py`

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

class MarketSchedule:
    """Detects US market hours for polling optimization."""

    def __init__(self):
        self.et_zone = ZoneInfo('America/New_York')

    def is_market_open(self) -> bool:
        """Check if US market is currently open."""
        now = datetime.now(timezone.utc).astimezone(self.et_zone)

        # Weekend check
        if now.weekday() >= 5:  # Sat=5, Sun=6
            return False

        # Hours check: 9:30 AM - 4:00 PM ET
        hour_decimal = now.hour + now.minute / 60
        return 9.5 <= hour_decimal <= 16.0
```

**Test**: Write TDD tests first per Constitution V
```python
# tests/unit/services/test_market_schedule.py
import pytest
from app.services.market_schedule import MarketSchedule

def test_market_closed_on_weekend():
    schedule = MarketSchedule()
    # Mock datetime to Saturday
    assert not schedule.is_market_open()

def test_market_closed_outside_hours():
    schedule = MarketSchedule()
    # Mock datetime to 8 AM ET
    assert not schedule.is_market_open()
```

---

#### Step 1.2: Create PollingRefreshService

**File**: `backend/app/services/polling.py`

```python
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

@dataclass
class CacheEntry:
    last_fetch: datetime
    last_update: datetime
    fetch_count: int = 0
    is_stale: bool = False

class PollingRefreshService:
    """Manages polling cache and refresh intervals."""

    # Refresh intervals per spec clarification
    REFRESH_INTERVALS = {
        '1m': 5,    # 5 seconds
        '5m': 5,
        '15m': 15,  # 15 seconds
        '1h': 15,
        '1d': 60,   # 1 minute
        '1wk': 300, # 5 minutes
    }

    # Session-based cache invalidation thresholds
    CACHE_THRESHOLDS = {
        '1m': timedelta(minutes=10),   # 10 candles
        '5m': timedelta(minutes=50),   # 10 candles
        '15m': timedelta(hours=1),     # 4 candles
        '1h': timedelta(hours=4),
        '1d': timedelta(days=1),
        '1wk': timedelta(days=7),
    }

    def __init__(self, market_schedule: Optional['MarketSchedule'] = None):
        self.cache_metadata: Dict[str, CacheEntry] = {}
        self.market_schedule = market_schedule

    def get_refresh_interval(self, interval: str) -> int:
        """Get poll frequency in seconds for interval."""
        return self.REFRESH_INTERVALS.get(interval, 60)

    def should_fetch(self, symbol_id: int, interval: str) -> bool:
        """Check if new fetch needed based on cache."""
        key = f"{symbol_id}_{interval}"

        if key not in self.cache_metadata:
            return True

        entry = self.cache_metadata[key]

        # Check if stale based on threshold
        threshold = self.CACHE_THRESHOLDS.get(interval, timedelta(minutes=30))
        if datetime.now(timezone.utc) - entry.last_fetch > threshold:
            return True

        return False

    def mark_fetched(self, symbol_id: int, interval: str):
        """Update cache metadata after successful fetch."""
        key = f"{symbol_id}_{interval}"
        now = datetime.now(timezone.utc)

        if key in self.cache_metadata:
            self.cache_metadata[key].last_fetch = now
            self.cache_metadata[key].fetch_count += 1
        else:
            self.cache_metadata[key] = CacheEntry(
                last_fetch=now,
                last_update=now,
                fetch_count=1
            )

    def invalidate_cache(self, symbol_id: int, interval: str):
        """Manually invalidate cache."""
        key = f"{symbol_id}_{interval}"
        if key in self.cache_metadata:
            del self.cache_metadata[key]
```

**Test**: TDD first
```python
# tests/unit/services/test_polling.py
def test_refresh_intervals_match_spec():
    service = PollingRefreshService()
    assert service.get_refresh_interval('1m') == 5
    assert service.get_refresh_interval('1h') == 15
    assert service.get_refresh_interval('1d') == 60

def test_should_fetch_first_time():
    service = PollingRefreshService()
    assert service.should_fetch(1, '1d')  # No cache

def test_cache_validity():
    service = PollingRefreshService()
    service.mark_fetched(1, '1m')
    assert not service.should_fetch(1, '1m')  # Fresh
```

---

#### Step 1.3: Extend Candle Endpoints (if needed)

The existing endpoints in `app/api/v1/candles.py` should already support this feature. Verify:

- `GET /candles/{symbol}` - Supports `interval`, `from`, `to`, `local_only` params
- `GET /candles/latest_prices/{symbols}` - Supports batch watchlist queries

**No changes required** unless adding polling-specific optimizations.

---

### Phase 2: Frontend Implementation

#### Step 2.1: Create Polling Scheduler Utility

**File**: `frontend/src/lib/pollingScheduler.ts`

```typescript
/**
 * Centralized polling timer management utility
 */

export interface PollTimer {
  id: number;
  interval: number;
  callback: () => void;
  cancel: () => void;
}

/**
 * Creates a cancelable polling timer
 */
export function createPollTimer(
  callback: () => void,
  intervalMs: number
): PollTimer {
  const id = window.setTimeout(() => {
    callback();
    // Auto-recurse using setTimeout for better control than setInterval
    return createPollTimer(callback, intervalMs);
  }, intervalMs);

  return {
    id,
    interval: intervalMs,
    callback,
    cancel: () => clearTimeout(id),
  };
}

/**
 * Clears a poll timer
 */
export function clearPollTimer(timer: PollTimer | null): void {
  if (timer) {
    timer.cancel();
  }
}

/**
 * Get poll interval in milliseconds from interval string
 */
export function getPollIntervalMs(interval: string): number {
  const intervals: Record<string, number> = {
    '1m': 5000,    // 5 seconds
    '5m': 5000,
    '15m': 15000,  // 15 seconds
    '1h': 15000,
    '1d': 60000,   // 1 minute
    '1wk': 300000, // 5 minutes
  };
  return intervals[interval] || 60000; // Default 1 minute
}
```

**Test**:
```typescript
// frontend/src/tests/lib/pollingScheduler.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPollTimer, clearPollTimer, getPollIntervalMs } from '../../lib/pollingScheduler';

describe('pollingScheduler', () => {
  it('should return correct intervals per spec', () => {
    expect(getPollIntervalMs('1m')).toBe(5000);
    expect(getPollIntervalMs('1h')).toBe(15000);
    expect(getPollIntervalMs('1d')).toBe(60000);
  });

  it('should execute callback after interval', async () => {
    const callback = vi.fn();
    const timer = createPollTimer(callback, 100);
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(callback).toHaveBeenCalledTimes(1);
    timer.cancel();
  });
});
```

---

#### Step 2.2: Create useCandleData Hook

**File**: `frontend/src/hooks/useCandleData.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { getCandles, type Candle } from '../api/candles';
import { createPollTimer, clearPollTimer, getPollIntervalMs } from '../lib/pollingScheduler';

export interface CandlePollingState {
  candles: Candle[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isStale: boolean;
  hasMore: boolean;
}

export function useCandleData(symbol: string, interval: string = '1d') {
  const [state, setState] = useState<CandlePollingState>({
    candles: [],
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastUpdate: null,
    isStale: false,
    hasMore: true,
  });

  const pollTimerRef = useRef<ReturnType<typeof createPollTimer> | null>(null);
  const lastFetchSymbolRef = useRef(symbol);
  const lastFetchIntervalRef = useRef(interval);

  /**
   * Fetch candles from API
   */
  const fetchCandles = useCallback(async (isRefresh = false) => {
    // Cancel if symbol or interval changed
    if (symbol !== lastFetchSymbolRef.current || interval !== lastFetchIntervalRef.current) {
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: !isRefresh,
      isRefreshing: isRefresh,
      error: null,
    }));

    try {
      const candles = await getCandles(symbol, interval);

      setState(prev => ({
        ...prev,
        candles,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdate: new Date(),
        isStale: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: err instanceof Error ? err.message : 'Failed to fetch candles',
      }));
    }
  }, [symbol, interval]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    fetchCandles(false);
  }, [fetchCandles]);

  /**
   * Setup polling on mount and symbol/interval change
   */
  useEffect(() => {
    // Cancel existing timer if any
    if (pollTimerRef.current) {
      clearPollTimer(pollTimerRef.current);
    }

    // Update refs
    lastFetchSymbolRef.current = symbol;
    lastFetchIntervalRef.current = interval;

    // Initial fetch
    fetchCandles();

    // Setup polling
    const pollInterval = getPollIntervalMs(interval);
    pollTimerRef.current = createPollTimer(() => {
      fetchCandles(true); // Background refresh
    }, pollInterval);

    // Cleanup on unmount
    return () => {
      if (pollTimerRef.current) {
        clearPollTimer(pollTimerRef.current);
      }
    };
  }, [symbol, interval, fetchCandles]);

  return {
    ...state,
    refresh,
  };
}
```

**Test**:
```typescript
// frontend/src/tests/hooks/useCandleData.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCandleData } from '../../hooks/useCandleData';
import * as candlesApi from '../../api/candles';

vi.mock('../../api/candles');

describe('useCandleData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should fetch candles on mount', async () => {
    vi.mocked(candlesApi.getCandles).mockResolvedValue([
      { ticker: 'AAPL', timestamp: '2024-12-24T00:00:00Z', open: 195, high: 196, low: 194, close: 195.5, volume: 1000000 }
    ]);

    const { result } = renderHook(() => useCandleData('AAPL', '1d'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.candles).toHaveLength(1);
    });
  });
});
```

---

#### Step 2.3: Create useWatchlistData Hook

**File**: `frontend/src/hooks/useWatchlistData.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import type { WatchlistEntry } from '../components/types/watchlist'; // Adjust path as needed
import { createPollTimer, clearPollTimer } from '../lib/pollingScheduler';

export interface WatchlistPollingState {
  entries: WatchlistEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  errors: Map<string, string>;
  lastUpdate: Date | null;
}

export function useWatchlistData(symbols: string[]) {
  const [state, setState] = useState<WatchlistPollingState>({
    entries: [],
    isLoading: true,
    isRefreshing: false,
    errors: new Map(),
    lastUpdate: null,
  });

  const pollTimerRef = useRef<ReturnType<typeof createPollTimer> | null>(null);
  const lastSymbolsRef = useRef<string[]>([]);

  /**
   * Fetch latest prices for all symbols
   */
  const fetchPrices = useCallback(async (isRefresh = false) => {
    if (symbols.length === 0) {
      setState(prev => ({ ...prev, isLoading: false, entries: [] }));
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: !isRefresh,
      isRefreshing: isRefresh,
    }));

    try {
      // Batch API call for all symbols
      const symbolsStr = symbols.join(',');
      const response = await fetch(`/api/v1/candles/latest_prices/${symbolsStr}?interval=1d`);
      const data = await response.json();

      // Convert array to WatchlistEntry format
      const entries: WatchlistEntry[] = data
        .filter((item: any) => !item.error)
        .map((item: any) => ({
          symbol: item.symbol,
          price: item.price,
          change: item.change,
          changePercent: item.changePercent,
          timestamp: item.timestamp,
        }));

      // Extract errors
      const errors = new Map<string, string>();
      data.forEach((item: any) => {
        if (item.error) {
          errors.set(item.symbol, item.error);
        }
      });

      setState(prev => ({
        ...prev,
        entries,
        isLoading: false,
        isRefreshing: false,
        errors,
        lastUpdate: new Date(),
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
      }));
    }
  }, [symbols]);

  /**
   * Setup polling on mount
   */
  useEffect(() => {
    // Cancel existing timer
    if (pollTimerRef.current) {
      clearPollTimer(pollTimerRef.current);
    }

    // Initial fetch
    fetchPrices();

    // Setup 60-second polling for watchlist
    pollTimerRef.current = createPollTimer(() => {
      fetchPrices(true);
    }, 60000);

    // Cleanup
    return () => {
      if (pollTimerRef.current) {
        clearPollTimer(pollTimerRef.current);
      }
    };
  }, [fetchPrices]);

  return state;
}
```

---

#### Step 2.4: Update ChartComponent

Update `frontend/src/components/ChartComponent.tsx` to use the new hook:

```typescript
import { useCandleData } from '../hooks/useCandleData';

export function ChartComponent({ symbol, interval }: { symbol: string; interval: string }) {
  const { candles, isLoading, isRefreshing, error, lastUpdate, refresh } = useCandleData(symbol, interval);

  // Update lightweight-charts with candles data
  useEffect(() => {
    if (candles.length > 0) {
      // Update chart series with candle data
      candleSeries.setData(candles.map(c => ({
        time: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })));
    }
  }, [candles]);

  // Add backfill on scroll (using lightweight-charts event)
  useEffect(() => {
    const handleVisibleRangeChange = (range: any) => {
      // Trigger backfill if user scrolled near edge
      // See research.md for implementation
    };

    chart.subscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    return () => chart.unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
  }, [chart, symbol, interval]);

  // Render loading state
  if (isLoading) {
    return <div className="loading-spinner">Loading chart data...</div>;
  }

  // Render error state
  if (error) {
    return <div className="error-message">{error}</div>;
  }

  // Render refresh indicator
  return (
    <div>
      {isRefreshing && <div className="refresh-indicator">Updating...</div>}
      {lastUpdate && <div className="last-update">Updated: {lastUpdate.toLocaleTimeString()}</div>}
      {/* Chart rendering code */}
    </div>
  );
}
```

---

## Testing Strategy

### Backend Tests

```bash
# Unit tests (TDD - write these FIRST)
cd backend
pytest tests/unit/services/test_polling.py -v
pytest tests/unit/services/test_market_schedule.py -v

# Integration tests
pytest tests/integration/test_candles_api.py -v

# Coverage
pytest --cov=app/services/polling --cov=app/services/market_schedule
```

### Frontend Tests

```bash
# Unit tests
cd frontend
npm test -- pollingScheduler.test.ts
npm test -- useCandleData.test.ts
npm test -- useWatchlistData.test.ts

# Integration tests
npm test -- candleRefresh.test.ts

# Coverage
npm test -- --coverage
```

---

## Common Issues and Solutions

### Issue: Polling doesn't stop on component unmount

**Solution**: Ensure cleanup function in useEffect cancels the timer
```typescript
useEffect(() => {
  const timer = createPollTimer(callback, interval);
  return () => timer.cancel(); // Important!
}, [deps]);
```

### Issue: Data flickers on refresh

**Solution**: Use separate loading states for initial load vs refresh
```typescript
const [isLoading, setIsLoading] = useState(true);  // Initial
const [isRefreshing, setIsRefreshing] = useState(false);  // Background
```

### Issue: Backfill triggers too many API calls

**Solution**: Add threshold before triggering (see research.md)
```typescript
if (from < earliestLoaded + (to - from) * 0.1) {
  // Only trigger if within 10% of loaded range
  triggerBackfill();
}
```

---

## Performance Checklist

- [ ] Frontend: Debounce scroll events for backfill
- [ ] Frontend: Use `useMemo` for candle transformations
- [ ] Backend: Add database indexes on Candle timestamp
- [ ] Backend: Use `local_only=true` for cache hits
- [ ] Both: Implement exponential backoff on errors
- [ ] Both: Add performance metrics tracking

---

## Next Steps

After implementing the above:

1. **Run tests**: Ensure all tests pass
2. **Manual testing**: Open browser DevTools and verify:
   - Polling requests every N seconds
   - Cache headers respected
   - No duplicate requests
3. **Performance testing**: Measure initial load and refresh times
4. **Visual verification**: Check loading indicators are non-intrusive

---

## References

- [Spec](./spec.md) - Full feature specification
- [Research](./research.md) - Technical decisions and rationale
- [Data Model](./data-model.md) - Data structures and flows
- [API Contracts](./contracts/candles.yaml) - OpenAPI specification

---

**Version**: 1.0.0 | **Last Updated**: 2025-12-24
