# Research: Initial Project Setup

**Feature**: 001-initial-setup
**Date**: 2025-12-23
**Status**: Complete

## Overview

This document captures research findings and technology decisions for the initial setup feature. The existing codebase already has significant implementation in place; this research identifies what exists, what gaps remain, and how to complete the vertical slice.

## Existing Implementation Analysis

### Already Implemented

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| **Backend Framework** | `backend/app/main.py` | ✅ Complete | FastAPI application with CORS configured |
| **Database Layer** | `backend/app/db/`, `backend/alembic/` | ✅ Complete | SQLAlchemy with alembic migrations |
| **Data Provider Interface** | `backend/app/services/providers.py` | ✅ Complete | `MarketDataProvider` ABC with `YFinanceProvider` implementation |
| **Rate Limiting** | `backend/app/services/rate_limiter.py` | ✅ Complete | Token bucket rate limiter with tenacity retries |
| **Candle Model** | `backend/app/models/candle.py` | ✅ Complete | Composite PK (symbol_id, timestamp, interval) |
| **Alert Model** | `backend/app/models/alert.py` | ✅ Complete | Basic alert entity |
| **Candle Service** | `backend/app/services/candles.py` | ✅ Complete | CRUD operations for candles |
| **Alert Engine** | `backend/app/services/alert_engine.py` | ✅ Complete | Basic alert evaluation logic |
| **Indicator Service** | `backend/app/services/indicators.py` | ✅ Complete | SMA, EMA, RSI, MACD calculations |
| **Frontend Framework** | `frontend/` | ✅ Complete | React 19 + Vite 7 + TypeScript |
| **Chart Component** | `frontend/src/components/ChartComponent.tsx` | ✅ Complete | Uses lightweight-charts |
| **Indicator Pane** | `frontend/src/components/IndicatorPane.tsx` | ✅ Complete | Indicator configuration UI |
| **API Layer** | `backend/app/api/` | ✅ Partial | Some endpoints exist |

### Gaps Identified

| Component | Gap | Priority |
|-----------|-----|----------|
| **Constitution Compliance** | Alert semantics need to match clarified spec (above/below/crosses) | P0 |
| **Constitution Compliance** | Timestamp UTC normalization needs enforcement | P0 |
| **Constitution Compliance** | Deduplication strategy (idempotent inserts) | P0 |
| **Constitution Compliance** | TDD for alert evaluation (tests first) | P0 |
| **API Endpoints** | Alerts CRUD endpoints incomplete | P1 |
| **API Endpoints** | Indicator computation endpoint needs exposure | P1 |
| **Gap Handling** | Visual gap marking on charts | P2 |
| **Testing** | Alert evaluation edge case tests (exact price, oscillations) | P0 |
| **Testing** | Integration tests for full alert flow | P1 |
| **Testing** | CI pipeline configuration | P1 |
| **Observability** | Structured logging throughout | P2 |

## Technology Decisions

### Decision 1: Data Provider - Yahoo Finance (yfinance)

**Choice**: Yahoo Finance via the `yfinance` library

**Rationale**:
- Free, no API key required (aligns with constitution security principles)
- Excellent coverage of US equities
- Widely used and battle-tested
- Python native with async support via run_in_executor
- Already implemented in codebase

**Alternatives Considered**:
- **Alpha Vantage**: Rejected - requires API key, low rate limits (25 requests/day free tier)
- **Polygon.io**: Rejected - requires API key, more complex setup for limited additional value
- **IEX Cloud**: Rejected - paid tier required for historical data

**Constraints Accepted**:
- 15-20 minute data delay (typical for free US equity providers)
- Rate limits: ~2 requests/second to avoid blocking
- Lookback limits vary by interval (e.g., 7 days for 1m, 2 years for 1h)

---

### Decision 2: Rate Limiting Strategy

**Choice**: Exponential backoff with jitter, implemented via tenacity library

**Rationale**:
- Constitution (Principle IV) requires exponential backoff
- Tenacity library provides robust retry with exponential backoff
- Jitter prevents thundering herd problems
- Already implemented in codebase with `RateLimiter` class

**Implementation**:
```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=30),
    retry=retry_if_exception_type(requests.exceptions.RequestException)
)
```

---

### Decision 3: Timestamp Handling

**Choice**: Store all timestamps in UTC; display in user's local timezone

**Rationale**:
- Constitution (Principle II) requires UTC normalization
- Avoids daylight saving time issues
- Enables consistent comparisons across exchanges
- SQLite `DateTime(timezone=True)` column type stores timezone info

**Implementation**:
```python
# On fetch from provider
timestamp_utc = provider_timestamp.astimezone(timezone.utc)

# On display
timestamp_local = timestamp_utc.astimezone(tzlocal)
```

---

### Decision 4: Alert Condition Semantics

**Choice**: Inclusive crossing (exact match triggers)

**Rationale**:
- Matches constitution guidance (Principle II)
- More intuitive for traders (price touching level = trigger)
- Testable edge cases: exact target price, rapid oscillations

**Semantics**:
```
above:     current > target  AND previous <= target
below:     current < target  AND previous >= target
crosses-up:   previous < target AND current >= target
crosses-down: previous > target AND current <= target
```

---

### Decision 5: Deduplication Strategy

**Choice**: Database unique constraint + idempotent insert logic

**Rationale**:
- Constitution (Principle II) requires deduplication
- Composite unique constraint at database level prevents duplicates
- SQLAlchemy `ON CONFLICT DO UPDATE` for idempotent inserts

**Implementation**:
```python
# Database model
class Candle(Base):
    __table_args__ = (
        UniqueConstraint('symbol_id', 'timestamp', 'interval', name='uix_candle'),
    )

# Idempotent insert
INSERT INTO candles (...) VALUES (...)
ON CONFLICT (symbol_id, timestamp, interval)
DO UPDATE SET open=EXCLUDED.open, high=EXCLUDED.high, ...
```

---

### Decision 6: Storage - SQLite

**Choice**: SQLite for local persistence

**Rationale**:
- Constitution (Principle IV) requires local caching
- Single-user app (no multi-user concurrency needs)
- Zero configuration, embedded in Python
- Sufficient performance for local use
- Easy migration path to PostgreSQL if needed later

**Stored Data**:
- Candles cache (all fetched market data)
- Alerts (user-defined alert rules)
- Alert triggers (history of fired alerts)
- App settings (user preferences)

---

### Decision 7: Frontend Charting Library

**Choice**: lightweight-charts (TradingView's open-source library)

**Rationale**:
- Already implemented in codebase
- TradingView-native look and feel (constitution Principle I)
- Excellent performance (handles 10,000+ candles at 60fps)
- Maintained by TradingView team
- MIT license

**Alternatives Considered**:
- **Recharts**: Rejected - not optimized for financial charting
- **Victory Charts**: Rejected - generic charting library
- **D3.js**: Rejected - too much custom work required

---

### Decision 8: Indicator Architecture

**Choice**: Plugin registry pattern with stable interface

**Rationale**:
- Constitution (Principle VII) requires extensibility
- New indicators addable without core changes
- Interface: `calculate(candles: Candle[], params: IndicatorParams): IndicatorSeries[]`

**Implementation**:
```python
class IndicatorRegistry:
    _indicators: Dict[str, Indicator] = {}

    @classmethod
    def register(cls, name: str, indicator: Indicator):
        cls._indicators[name] = indicator

    @classmethod
    def get(cls, name: str) -> Indicator:
        return cls._indicators.get(name)

# Example usage
IndicatorRegistry.register("sma", SMAIndicator())
```

---

### Decision 9: Testing Strategy

**Choice**: TDD for core logic; pytest for backend, vitest for frontend

**Rationale**:
- Constitution (Principle V) requires TDD for core logic
- Core logic = alert engine, indicator calculations, candle normalization
- Pytest for backend (Python standard)
- Vitest for frontend (fast, native to Vite)

**Test Coverage Required**:
- Alert evaluation: all condition types, edge cases (exact price, gaps, oscillations)
- Indicator calculations: verify against known values
- Candle normalization: UTC conversion, deduplication
- API contracts: endpoint integration tests

---

### Decision 10: CI Pipeline

**Choice**: GitHub Actions (standard for GitHub-hosted repos)

**Rationale**:
- Free for public repositories
- Excellent Python/Node.js support
- Easy caching for dependencies

**Pipeline Steps**:
1. Lint (ruff for Python, eslint for TypeScript)
2. Type check (mypy for Python, tsc for TypeScript)
3. Unit tests (pytest, vitest)
4. Integration tests (pytest with test database)

---

## Open Questions (Resolved)

All questions from the specification clarification have been resolved:

| Question | Answer | Documented In |
|----------|--------|---------------|
| Initial market | US Equities | spec.md Clarifications |
| Notification type | In-app only | spec.md Clarifications |
| Packaging approach | Pure local web app | spec.md Clarifications |
| Alert "crosses" semantics | Inclusive crossing | spec.md Key entities |
| Data provider | Yahoo Finance (yfinance) | spec.md Data provider strategy |
| Rate limit backoff | Exponential with jitter | spec.md FR-014 |
| Timestamp timezone | UTC storage | spec.md Key entities (Candle) |
| Edge case UX | User-friendly errors | spec.md Edge cases |

## Dependencies Matrix

| Backend Dependency | Version | Purpose |
|-------------------|---------|---------|
| FastAPI | 0.116+ | Web framework |
| SQLAlchemy | 2.0+ | ORM |
| alembic | 1.12+ | Database migrations |
| yfinance | latest | Data provider |
| tenacity | 8.0+ | Retry logic with exponential backoff |
| pytest | 7.0+ | Testing |
| pydantic | 2.0+ | Data validation |

| Frontend Dependency | Version | Purpose |
|--------------------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.9+ | Type safety |
| Vite | 7+ | Build tool |
| lightweight-charts | 5.1+ | Charting |
| Radix UI | latest | UI components |
| axios | latest | HTTP client |
| vitest | latest | Testing |

## Performance Budgets

From constitution and spec NFRs:

| Metric | Budget | Measurement Approach |
|--------|--------|---------------------|
| Initial chart load | 3 seconds | Time from API call to first render |
| Price update latency | 2 seconds | Time from provider data to chart update |
| Alert evaluation | 500ms | Benchmark test with 100 alerts |
| UI panning | 60fps | Browser performance API |
| Memory footprint | 500MB | Node.js heap + browser memory profiling |

## Migration Strategy

The existing implementation is largely aligned with requirements. The migration path:

1. **Phase 1 - Constitution Alignment** (P0)
   - Update alert engine semantics to match clarified spec
   - Add UTC timestamp normalization enforcement
   - Implement idempotent candle inserts
   - Add TDD tests for alert evaluation edge cases

2. **Phase 2 - API Completion** (P1)
   - Complete alerts CRUD endpoints
   - Expose indicator computation endpoint
   - Add gap detection endpoint

3. **Phase 3 - Testing & CI** (P1)
   - Add integration tests for full alert flow
   - Configure GitHub Actions CI pipeline
   - Add performance benchmark tests

4. **Phase 4 - Polish** (P2)
   - Add visual gap marking on charts
   - Add structured logging
   - Add observability metrics

## References

- Constitution: `.specify/memory/constitution.md`
- Spec: `specs/001-initial-setup/spec.md`
- Existing codebase: `backend/app/`, `frontend/src/`
