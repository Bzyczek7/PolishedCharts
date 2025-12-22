# Specification: Historical Data Backfill & Cache

## Overview
Implement a persistent storage system for market data (candles) to enable high-performance charting, deep historical analysis, and efficient data management. By caching candles locally in PostgreSQL, the system will provide a seamless "scroll-back" experience while minimizing reliance on external APIs and respecting provider rate limits.

## Functional Requirements

### 1. Persistent Candle Store
- **Storage:** Use the existing PostgreSQL database.
- **Schema:** Store candles with a composite primary key of `(symbol, interval, timestamp)`. Fields: Open, High, Low, Close, Volume.
- **Idempotency:** Use `INSERT ... ON CONFLICT (symbol, interval, timestamp) DO UPDATE SET ...` to ensure atomic, **database-level deduplication**.
- **Concurrency Control:** Implement a `backfill_jobs` table or PostgreSQL advisory locks to prevent overlapping backfill operations for the same `(symbol, interval)`.

### 2. Supported Intervals
- **Canonical Intervals:** Align with yfinance: `1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo`.
- **Normalization:** Map `60m` to `1h` internally to maintain a single canonical representation.
- **Lookback Caps:** Implement **"best-effort + adaptive fallback"** lookback limits (e.g., `1m` ~7 days, `1h` ~730 days).

### 3. API Endpoints
- **GET /candles**:
    - **Parameters:** `symbol`, `interval`, `from` (ISO-8601), `to` (ISO-8601).
    - **Logic:** Check local DB. Identify gaps using interval-specific step logic.
    - **Gap Rules:** Gap detection is **symbol/venue dependent** (e.g., ignoring weekends/holidays for equities, but 24/7 for crypto).
    - **Transparent Filling:** Dynamically fetch and cache missing data for gaps **up to a hard cap** (e.g., 500 candles or 30 days of `1h` data).
    - **Partial Data:** If gaps exceed the cap, return available data + `needs_backfill: true`.
- **POST /candles/backfill**: Admin/Worker endpoint to trigger large historical downloads.
- **POST /candles/update-latest**: Incremental update endpoint for the most recent bars.

### 4. Market Data Orchestration
- **Primary Provider:** yfinance for both historical and incremental data.
- **Orchestration Logic:** Handle chunked requests and retries with smaller time windows if provider limits are hit.
- **Throttling:** Implement basic rate-limiting/backoff for yfinance calls.

## Non-Functional Requirements
- **Performance:** DB reads must be indexed for sub-second chart loading.
- **Reliability:** Graceful handling of provider timeouts and "no data" responses.

## Acceptance Criteria
- Users can scroll back to August 2025 on the `1d` timeframe for supported symbols.
- Intraday timeframes show the **maximum history obtainable without repeated failures** (based on provider limits).
- Subsequent reloads of the same range are served rapidly from the local database.
- Database contains zero duplicate candles for any given `(symbol, interval, timestamp)`.

## Out of Scope
- Real-time WebSockets (future track).
- Multi-provider data reconciliation.
