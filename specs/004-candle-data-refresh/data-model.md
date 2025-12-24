# Data Model: Candle Data and Refresh

**Feature**: 004-candle-data-refresh
**Date**: 2025-12-24
**Status**: Phase 1 - Data Model

## Overview

This feature uses existing data models with new query patterns and frontend state management. No database schema changes are required.

---

## Backend Data Models

### Existing Models

#### Symbol
**Purpose**: Represents a tradeable stock symbol

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PRIMARY KEY, AUTOINCREMENT | Internal identifier |
| ticker | String | UNIQUE, NOT NULL, INDEXED | Stock symbol (e.g., "AAPL") |
| name | String | INDEXED | Company name |

**Source**: `app/models/symbol.py` (existing)

---

#### Candle
**Purpose**: Historical OHLCV data for a symbol at a specific time interval

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| symbol_id | Integer | PRIMARY KEY (FK), NOT NULL | Foreign key to Symbol.id |
| timestamp | DateTime | PRIMARY KEY, INDEXED, TZ-aware | Candle timestamp in UTC |
| interval | String | PRIMARY KEY, INDEXED | Time interval (1m, 5m, 15m, 1h, 1d, 1wk) |
| open | Float | NOT NULL | Opening price |
| high | Float | NOT NULL | Highest price |
| low | Float | NOT NULL | Lowest price |
| close | Float | NOT NULL | Closing price |
| volume | Integer | NULLABLE | Trading volume |

**Constraints**:
- `uix_candle_symbol_timestamp_interval` - Unique constraint on (symbol_id, timestamp, interval)
- All timestamps stored in UTC per Constitution II (Correctness Over Cleverness)
- Deduplication via database constraint (inserts reject duplicates)

**Source**: `app/models/candle.py` (existing)

**No Changes Required**: Existing model fully supports feature requirements.

---

### Service Layer Models

#### PollingRefreshService (NEW)
**Purpose**: Manages polling logic and cache invalidation for backend polling

**Attributes**:
- `refresh_intervals: Dict[str, int]` - Maps interval to poll frequency in seconds
- `cache_metadata: Dict[str, CacheEntry]` - In-memory cache tracking
- `market_schedule: MarketSchedule` - Market hours detector

**Methods**:
- `get_refresh_interval(interval: str) -> int` - Returns poll frequency for interval
- `should_fetch(symbol_id: int, interval: str) -> bool` - Cache validity check
- `mark_fetched(symbol_id: int, interval: str)` - Update cache metadata
- `is_market_open() -> bool` - Market hours check
- `invalidate_cache(symbol_id: int, interval: str)` - Manual cache invalidation

**CacheEntry Structure**:
```python
@dataclass
class CacheEntry:
    last_fetch: datetime
    last_update: datetime
    fetch_count: int
    is_stale: bool
```

**Source**: `app/services/polling.py` (new)

---

#### MarketSchedule (NEW)
**Purpose**: Detects market hours for polling throttling

**Methods**:
- `is_market_open() -> bool` - Check if US market is currently open
- `next_market_open() -> datetime` - Next market open time
- `next_market_close() -> datetime` - Next market close time

**Logic**:
- US Market Hours: 9:30 AM - 4:00 PM Eastern Time, Mon-Fri
- Timezone: Uses `zoneinfo` for accurate ET/UTC conversion
- Holidays: Uses `pandas_market_calendars` if available, else simple heuristic

**Source**: `app/services/market_schedule.py` (new)

---

## Frontend Data Models

### TypeScript Interfaces

#### Candle (existing)
**Purpose**: Single candle data returned from API

```typescript
interface Candle {
  ticker: string;      // Symbol ticker
  timestamp: string;   // ISO 8601 datetime (UTC)
  open: number;        // Opening price
  high: number;        // Highest price
  low: number;         // Lowest price
  close: number;       // Closing price
  volume: number;      // Trading volume
}
```

**Source**: `frontend/src/api/candles.ts` (existing)

---

#### CandlePollingState (NEW)
**Purpose**: State managed by `useCandleData` hook

```typescript
interface CandlePollingState {
  candles: Candle[];           // Loaded candle data
  isLoading: boolean;          // Initial fetch in progress
  isRefreshing: boolean;       // Background refresh in progress
  error: string | null;        // Error message if any
  lastUpdate: Date | null;     // Last successful fetch timestamp
  isStale: boolean;            // Data may be outdated
  hasMore: boolean;            // More historical data available
}
```

**Source**: `frontend/src/hooks/useCandleData.ts` (new)

---

#### WatchlistEntry (existing, may extend)
**Purpose**: Watchlist item with price data

```typescript
interface WatchlistEntry {
  symbol: string;              // Stock ticker
  price: number;               // Current price
  change: number;              // Price change amount
  changePercent: number;       // Price change percentage
  timestamp: string;           // Last update time (ISO 8601)
}
```

**Source**: `frontend/src/api/watchlist.ts` (existing, may need to add fields)

---

#### WatchlistPollingState (NEW)
**Purpose**: State managed by `useWatchlistData` hook

```typescript
interface WatchlistPollingState {
  entries: WatchlistEntry[];   // Watchlist items with prices
  isLoading: boolean;          // Initial fetch in progress
  isRefreshing: boolean;       // Background refresh in progress
  errors: Map<string, string>; // Per-symbol errors
  lastUpdate: Date | null;     // Last successful fetch timestamp
}
```

**Source**: `frontend/src/hooks/useWatchlistData.ts` (new)

---

#### CacheMetadata (NEW)
**Purpose**: Frontend cache metadata for session-based caching

```typescript
interface CacheMetadata {
  [key: string]: CacheEntry;   // Key = `${symbol}_${interval}`
}

interface CacheEntry {
  lastFetch: number;           // Timestamp of last fetch
  lastUpdate: number;          // Timestamp of last data update
  isStale: boolean;            // Whether data is considered stale
  fetchCount: number;          // Number of fetches in session
}
```

**Source**: `frontend/src/lib/pollingScheduler.ts` (new)

---

#### PollTimer (NEW)
**Purpose**: Cancelable timer handle for polling

```typescript
interface PollTimer {
  id: number;                  // Timer ID (from setTimeout/setInterval)
  interval: number;            // Poll interval in milliseconds
  callback: () => void;        // Poll callback function
  cancel: () => void;          // Cancel function
}
```

**Source**: `frontend/src/lib/pollingScheduler.ts` (new)

---

## State Transitions

### Candle Data Lifecycle

```
┌─────────────┐
│   Initial   │
│ (isLoading) │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│   Loaded    │────▶│  Refreshing  │
│ (candles)   │     │ (isRefreshing)│
└──────┬──────┘     └──────────────┘
       │                    │
       │                    ▼
       │              ┌─────────────┐
       │              │   Updated   │
       │              │ (candles)   │
       │              └──────┬──────┘
       │                     │
       ▼                     ▼
┌─────────────┐     ┌──────────────┐
│    Error    │     │    Stale     │
│  (error)    │     │  (isStale)   │
└─────────────┘     └──────────────┘
```

**States**:
- **Initial**: No data loaded, fetching from API
- **Loaded**: Data available, displaying to user
- **Refreshing**: Background update in progress, showing stale data
- **Updated**: New data received, updating display
- **Error**: Fetch failed, showing error state
- **Stale**: Data older than cache threshold, still displayed

**Triggers**:
- Component mount → Initial fetch
- Interval change → Cancel + restart
- Poll timer → Refresh
- User manual refresh → Immediate fetch
- Scroll to edge → Backfill fetch

---

## Data Flow

### Backend Polling Flow

```
┌─────────────────┐
│ Frontend Request│
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ PollingRefreshService│
│ - Check cache       │
│ - Validate market   │
└────────┬────────────┘
         │ Cache Miss
         ▼
┌──────────────────┐
│ YFinanceProvider │
│ - Fetch candles  │
│ - Exponential    │
│   backoff        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ CandleService    │
│ - Store in DB    │
│ - Deduplicate    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Response to FE   │
└──────────────────┘
```

### Frontend Polling Flow

```
┌─────────────────┐
│ useCandleData   │
│   Hook Mount    │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Initial Load        │
│ - Show loading      │
│ - Fetch from API    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Display Candles     │
│ - Update chart      │
│ - Start poll timer  │
└────────┬────────────┘
         │
         ▼ (every N seconds)
┌─────────────────────┐
│ Poll Interval       │
│ - Background fetch  │
│ - Update state      │
└─────────────────────┘
```

---

## Validation Rules

### Backend Validation

| Field | Rule | Enforcement |
|-------|------|-------------|
| symbol_id | Must exist in Symbol table | Foreign key constraint |
| timestamp | Must be UTC | Application logic |
| interval | One of: 1m, 5m, 15m, 1h, 1d, 1wk | Application validation |
| open/high/low/close | Must be positive | Column constraint (NOT NULL) |
| volume | Must be non-negative | Application logic |

### Frontend Validation

| Field | Rule | Enforcement |
|-------|------|-------------|
| symbol | Non-empty string | TypeScript |
| interval | Valid interval string | TypeScript enum |
| polling interval | Matches refresh policy | Configuration |

---

## Performance Considerations

### Database Indexes
- `Candle.timestamp` - Indexed for time-range queries
- `Candle.interval` - Indexed for interval filtering
- `Candle.symbol_id` - Primary key component

### Query Optimization
- Use `local_only=true` for cache-only queries (no API call)
- Limit backfill queries to 500 candles per request
- Use `ORDER BY timestamp DESC` for latest data

### Frontend Optimization
- Debounce scroll events before triggering backfill
- Use `useMemo` for candle data transformations
- Cancel in-flight requests on component unmount

---

**Version**: 1.0.0 | **Last Updated**: 2025-12-24
