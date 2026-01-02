# Implementation Plan: Indicator API Performance Optimization

**Branch**: `014-indicator-cache-optimization` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-indicator-cache-optimization/spec.md`

## Summary

Optimize indicator API performance by implementing multi-layer caching strategy and batch processing capabilities. Current bottleneck: Database query for candles takes ~300ms on every indicator request, while indicator calculation is already fast (~3ms). The solution involves: (1) Extending the existing LRU cache service for indicator results, (2) Adding in-memory caching for candle data with invalidation on updates, (3) Implementing batch indicator calculation API endpoint, (4) Optimizing database queries through improved indexing and query patterns.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9+ (frontend)
**Primary Dependencies**: FastAPI 0.104+, SQLAlchemy 2.0+, asyncpg 0.29+, pandas 2.1+, numpy 1.26+, redis 5.0+, pandas-ta 0.3.14b0
**Storage**: PostgreSQL (existing candles table with composite primary key), In-memory LRU cache (existing), Redis (optional for distributed caching - out of scope for MVP)
**Testing**: pytest, vitest (frontend)
**Target Platform**: Linux server (backend), Browser (frontend)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: 100ms cached indicator response (90th percentile), 500ms uncached (90th percentile), 200ms for 3-indicator batch, 70%+ cache hit rate
**Constraints**: <500MB memory footprint (constitution), single-server caching (MVP), maintain backward compatibility with existing endpoints
**Scale/Scope**: Support 50 concurrent users, 10 indicators per batch max, existing symbol universe (S&P 500 + user watchlist)

### Existing Infrastructure

- **Cache Service**: `backend/app/services/cache.py` - LRU cache with TTL, memory budget, statistics
- **Indicator API**: `backend/app/api/v1/indicators.py` - Single indicator endpoint at `GET /indicators/{symbol}/{indicator_name}`
- **Candle Model**: Composite primary key (symbol_id, timestamp, interval), unique constraint
- **Indicator Registry**: Plugin pattern with `calculate(candles, params)` interface

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) match TradingView behavior - N/A (backend-only changes)
- [x] UI changes include before/after verification - N/A (no UI changes planned)
- [x] Performance budgets: 60fps panning, 3s initial load - Improves indicator loading (target: 100ms cached)

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented - Existing candle service handles UTC normalization
- [x] Deduplication strategy: database constraints or idempotent inserts - Existing unique constraint on candles
- [x] Alert semantics: above/below/crosses defined with edge cases tested - N/A (indicators only)
- [x] Gap handling: explicit marking and backfill strategy - Existing gap detector service

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count - N/A (caching layer only)
- [x] Alert evaluation performance budgeted (500ms) - May improve via faster candle queries
- [x] Graceful degradation defined for high alert volumes - Cache fallback to DB on miss

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally - In-memory cache supplements existing DB storage
- [x] Offline behavior: charts, alerts, history remain accessible - Cache improves local responsiveness
- [x] Provider error handling: graceful degradation with user feedback - Existing error handling maintained

### Testing and Quality Gates

- [x] Core logic uses TDD (alert engine, indicators, candle normalization) - Cache layer tests will be TDD
- [x] Bug fixes include regression tests - N/A (new feature)
- [x] CI includes: lint, typecheck, unit, integration tests - Will add cache-specific tests

### Performance Budgets

- [x] Initial chart load: 3 seconds - Cache will improve indicator loading (spec target: <150ms average)
- [x] Price update latency: 2 seconds - Cache invalidation on candle updates ensures freshness
- [x] Alert evaluation: 500ms - Faster candle queries may improve alert engine performance
- [x] UI panning: 60fps - N/A (backend-only)
- [x] Memory: 500MB for 5 symbols / 20 alerts - Spec requires <10% cache evictions/hour

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern - Existing registry maintained, cache added as decorator/layer
- [x] Data providers implement common interface - Cache transparent to provider layer
- [x] Provider-specific logic isolated from UI - Cache sits between API and provider

### Security & Privacy

- [x] No telemetry or data upload without consent - In-memory cache only, no external telemetry
- [x] API keys stored securely (not in repo) - N/A (no new credentials)
- [x] Local data treated as sensitive - In-memory cache is transient

### Governance

- [x] If any principle violated: justification in Complexity Tracking - No violations identified

## Project Structure

### Documentation (this feature)

```text
specs/014-indicator-cache-optimization/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── batch-indicators-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── indicators.py    # Modify: add batch endpoint, integrate cache
│   ├── services/
│   │   ├── cache.py             # Modify: add candle caching, improve invalidation
│   │   ├── candles.py           # Modify: add cache layer integration
│   │   └── orchestrator.py      # Modify: add cache-aware candle fetching
│   ├── core/
│   │   └── performance_config.py # Modify: add interval-based TTL config
│   └── schemas/
│       └── indicator.py         # Modify: add batch request/response models
└── tests/
    ├── services/
    │   ├── test_cache.py        # New: cache layer tests
    │   └── test_indicators_cache_integration.py
    └── api/
        └── v1/
            └── test_indicators_batch.py  # New: batch endpoint tests

frontend/
├── src/
│   └── api/
│       └── indicators.ts        # Modify: add batch API client method
└── tests/
    └── api/
        └── test_indicators_batch.test.ts  # New: frontend batch tests
```

**Structure Decision**: Web application structure (backend + frontend) - this is an existing FastAPI + React application. Backend changes are primary; frontend changes minimal (batch API client).

## Complexity Tracking

> No constitution violations requiring justification
