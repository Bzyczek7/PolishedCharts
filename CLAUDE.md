# PolishedCharts Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-30

**Application**: PolishedCharts - A technical analysis and charting platform for traders

## Active Technologies
- Python 3.11+ (backend), TypeScript 5.9+ (frontend) + FastAPI 0.104+, SQLAlchemy 2.0+, pandas 2.1+, numpy 1.26+, lightweight-charts 5.1+, React 19 (003-advanced-indicators)
- PostgreSQL (via SQLAlchemy with asyncpg driver) for candles, alerts, alert triggers (003-advanced-indicators)
- PostgreSQL (via SQLAlchemy with asyncpg driver) for cached candle data (004-candle-data-refresh)
- Parameterized indicator instances with automatic unique naming (006-parameterized-indicators)
- Python 3.11 (backend), TypeScript 5.9 (frontend) + FastAPI 0.104, SQLAlchemy 2.0, pandas 2.1, React 19 (007-configurable-indicators)
- PostgreSQL via SQLAlchemy; indicators in-memory only (007-configurable-indicators)
- TypeScript 5.9 (frontend), React 19 + Lightweight Charts 5.1.0, Radix UI, shadcn/ui (008-overlay-indicator-rendering)
- Browser localStorage (no backend changes needed) (008-overlay-indicator-rendering)
- PostgreSQL (alerts, triggers via SQLAlchemy with asyncpg driver) (001-indicator-alerts)
- Python 3.11+ (backend), TypeScript 5.9+ (frontend) + FastAPI 0.104+, SQLAlchemy 2.0+, yfinance, React 19, lightweight-charts (009-watchlist-search-add)
- PostgreSQL via AsyncSessionLocal (SQLAlchemy async with asyncpg driver) (009-watchlist-search-add)
- PostgreSQL (candles, symbols, watchlist, ticker_universe) (009-watchlist-search-add)
- Python 3.11+ (backend), TypeScript 5.9+ (frontend) + pandas-ta (NEW), FastAPI 0.104+, SQLAlchemy 2.0+, pandas 2.1+, numpy 1.26+ (010-pandas-ta-indicators)
- PostgreSQL via SQLAlchemy with asyncpg driver (existing candle/alerts database) (010-pandas-ta-indicators)
- PostgreSQL (existing candles table, no schema changes needed) (010-pandas-ta-indicators)
- Python 3.11+ (backend), TypeScript 5.9+ (frontend) + firebase-admin>=6.0.0 (backend), firebase@^10.0.0 (frontend), FastAPI 0.104+, SQLAlchemy 2.0+, React 19 (011-firebase-auth)
- Firebase Authentication (email/password, Google OAuth) for user authentication (011-firebase-auth)
- Firebase Admin SDK (Python) for token verification and user management (011-firebase-auth)
- Browser localStorage for guest mode data persistence (alerts, watchlist, layouts) (011-firebase-auth)
- PostgreSQL via SQLAlchemy with asyncpg driver (users, alerts, watchlist, layouts with user_id and UUID columns) (011-firebase-auth)
- Python 3.11+ (backend), TypeScript 5.9+ (frontend) + react-hot-toast (frontend), Telegram Bot API (backend) (013-alarm-notifications)
- PostgreSQL (existing for alerts), localStorage (guest preferences) (013-alarm-notifications)
- Python 3.11+ (backend), TypeScript 5.9+ (frontend) + FastAPI 0.104+, SQLAlchemy 2.0+, asyncpg 0.29+, pandas 2.1+, numpy 1.26+, redis 5.0+, pandas-ta 0.3.14b0 (014-indicator-cache-optimization)
- PostgreSQL (existing candles table with composite primary key), In-memory LRU cache (existing), Redis (optional for distributed caching - out of scope for MVP) (014-indicator-cache-optimization)
- TypeScript 5.9 (frontend), React 19 + React hooks (useEffect, useCallback, useMemo), lightweight-charts 5.1.0, React 19 (015-symbol-load-performance)
- N/A (frontend-only optimization) (015-symbol-load-performance)

- Python 3.11+ (backend), TypeScript 5.9+ (frontend) (001-initial-setup)

## Project Structure

```text
src/
tests/
```

## Commands

cd src [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] pytest [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] ruff check .

## Code Style

Python 3.11+ (backend), TypeScript 5.9+ (frontend): Follow standard conventions

## Recent Changes
- 015-symbol-load-performance: Added TypeScript 5.9 (frontend), React 19 + React hooks (useEffect, useCallback, useMemo), lightweight-charts 5.1.0, React 19
- 014-indicator-cache-optimization: Added Python 3.11+ (backend), TypeScript 5.9+ (frontend) + FastAPI 0.104+, SQLAlchemy 2.0+, asyncpg 0.29+, pandas 2.1+, numpy 1.26+, redis 5.0+, pandas-ta 0.3.14b0
- 014-indicator-cache-optimization: Added Python 3.11+ (backend), TypeScript 5.9+ (frontend) + FastAPI 0.104+, SQLAlchemy 2.0+, asyncpg 0.29+, pandas 2.1+, numpy 1.26+, redis 5.0+, pandas-ta 0.3.14b0


<!-- MANUAL ADDITIONS START -->
  library/API documentation. This means you should automatically use the Context7 MCP
  tools to resolve library id and get library docs without me having to explicitly ask.

## Cache Configuration (Feature 014)

### Indicator Caching
- **Cache Type**: In-memory LRU (Least Recently Used)
- **Max Size**: 100 entries
- **TTL**: Interval-based (configurable in `backend/app/core/performance_config.py`)
  - 1m, 2m, 5m: 60 seconds
  - 15m, 30m: 300 seconds (5 minutes)
  - 1h: 3600 seconds (1 hour)
  - 4h: 14400 seconds (4 hours)
  - 1d: 86400 seconds (1 day)
  - 1wk: 604800 seconds (1 week)
- **Invalidation**: Symbol-based (all indicators for a symbol invalidated when candles update)
- **Cache Key**: `symbol:interval:indicator_name:sorted_params`

### Candle Data Caching
- **Cache Type**: In-memory LRU
- **Max Size**: 50 entries
- **TTL**: Interval-based (same as indicators above)
- **Cache Key**: `symbol_id:interval:start:end`

### Performance Targets
- **Cached indicator requests**: <100ms (P90), targeting <50ms median
- **Uncached indicator requests**: <500ms (P90)
- **Batch of 3 indicators**: <200ms (P90)
- **Database query**: <100ms (with composite index on `symbol_id, timestamp, interval`)

### Monitoring
- **Cache Stats Endpoint**: `GET /api/v1/indicators/cache/stats`
- **Returns**: `entries`, `max_size`, `memory_used_bytes`, `hits`, `misses`, `hit_rate`
- **Performance Logging**: Automatically logged via `performance_logger` for all indicator calculations

### Cache Invalidation
- **Automatic**: Triggered by `data_updater.py` when candle data is saved to database
- **Fallback**: TTL-based expiration acts as safety net
- **Manual**: Can call `invalidate_symbol(symbol)` from `app.services.cache`

## Performance Optimization Patterns (Feature 015)

### Frontend Caching
- **T031**: Use symbol:interval cache key to prevent re-fetching on candle updates
  - Store current cache key in a ref (`currentCacheKeyRef`)
  - Only clear fetched cache when symbol or interval actually changes
  - Prevents duplicate indicator fetches when websocket updates arrive

- **T036**: Cache axios instance to avoid repeated token fetches
  - Store authenticated axios instance in a module-level variable
  - Only recreate when token changes
  - Significantly improves parallel indicator request performance

- **T037**: Reduce auth buffer from 100ms to 10ms
  - Faster authentication initialization
  - Reduces initial load time

- **T040**: Reduce INITIAL_CANDLE_COUNT from 1000 to 200
  - Faster initial data fetch
  - Less data to transfer and render

### Performance Metrics (Measured)
- Target: ~2500ms total load time
- Typical range after optimizations: 3000-6500ms (varies by network conditions)
- Key bottlenecks: candle fetching (800-2800ms), indicator calculation (1500-4000ms)
<!-- MANUAL ADDITIONS END -->
