# Implementation Plan: Initial Project Setup

**Branch**: `001-initial-setup` | **Date**: 2025-12-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-initial-setup/spec.md`

## Summary

Establish the foundational infrastructure for a local-first TradingView-like charting application with unlimited alerts. This feature sets up: repo structure, app skeleton, data access layer (provider abstraction + caching), persistence layer (SQLite), and a thin vertical slice proving the architecture (chart rendering + alerts + basic indicator pipeline).

The existing codebase already has a Python FastAPI backend with alembic migrations and a React + Vite + TypeScript frontend with Tailwind CSS. This plan leverages and completes that existing foundation.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9+ (frontend)
**Primary Dependencies**:
  - Backend: FastAPI 0.116+, SQLAlchemy 2+, alembic, yfinance, pytest
  - Frontend: React 19, lightweight-charts 5.1+, Radix UI, axios, Vite 7
**Storage**: SQLite for candles cache, alerts, alert triggers, app settings
**Testing**: pytest (backend), vitest (frontend)
**Target Platform**: Local web app (user runs `npm run dev` and backend, opens browser tab)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: 60fps UI panning, 3s initial chart load, 500ms alert evaluation
**Constraints**: Offline-capable, no application-level alert caps, <500MB memory for 5 symbols/20 alerts
**Scale/Scope**: Single-user local app, 100+ alerts per symbol, 10,000+ candles in memory

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [ ] Chart interactions (zoom/pan/crosshair) match TradingView behavior
- [ ] UI changes include before/after verification
- [ ] Performance budgets: 60fps panning, 3s initial load

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented (in spec)
- [ ] Deduplication strategy: database constraints or idempotent inserts
- [x] Alert semantics: above/below/crosses defined with edge cases tested (in spec)
- [ ] Gap handling: explicit marking and backfill strategy

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count (in spec FR-007)
- [x] Alert evaluation performance budgeted (500ms in NFR-003)
- [x] Graceful degradation defined for high alert volumes (edge cases)

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally (SQLite in spec)
- [x] Offline behavior: charts, alerts, history remain accessible (FR-015)
- [x] Provider error handling: graceful degradation with user feedback (edge cases)

### Testing and Quality Gates

- [ ] Core logic uses TDD (alert engine, indicators, candle normalization)
- [ ] Bug fixes include regression tests
- [ ] CI includes: lint, typecheck, unit, integration tests

### Performance Budgets

- [x] Initial chart load: 3 seconds (NFR-001)
- [x] Price update latency: 2 seconds (NFR-002)
- [x] Alert evaluation: 500ms (NFR-003)
- [x] UI panning: 60fps (NFR-004)
- [x] Memory: 500MB for 5 symbols / 20 alerts (NFR-005)

### Architecture for Extensibility

- [ ] Indicators use plugin registry pattern
- [x] Data providers implement common interface (in spec)
- [ ] Provider-specific logic isolated from UI

### Security & Privacy

- [x] No telemetry or data upload without consent (constitution)
- [x] API keys stored securely (not in repo) (constitution)
- [x] Local data treated as sensitive (constitution)

### Governance

- [ ] If any principle violated: justification in Complexity Tracking
- [x] Constitution supersedes spec/plan conflicts (acknowledged)

**Gate Status**: PASS (with 7 checkboxes to be addressed during implementation)

## Project Structure

### Documentation (this feature)

```text
specs/001-initial-setup/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── candles.yaml     # OpenAPI contract for candles API
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (existing structure - to be completed)

```text
backend/
├── alembic/             # Database migrations (exists)
├── app/
│   ├── api/             # FastAPI endpoints (exists, to be expanded)
│   ├── core/            # Core business logic (exists)
│   ├── db/              # Database session management (exists)
│   ├── models/          # SQLAlchemy models (exists, to be expanded)
│   ├── schemas/         # Pydantic schemas (exists, to be expanded)
│   ├── services/        # Business logic layer (exists, to be expanded)
│   │   ├── providers/   # Data provider adapters (to be added)
│   │   ├── alerts.py    # Alert evaluation engine (to be added)
│   │   ├── indicators/  # Indicator calculations (to be added)
│   │   └── caching.py   # Caching layer (to be added)
│   └── main.py          # FastAPI app entry point (exists)
├── tests/
│   ├── api/             # API endpoint tests (exists)
│   ├── services/        # Service layer tests (exists)
│   └── conftest.py      # Pytest fixtures (exists)
├── alembic.ini          # Alembic config (exists)
└── pyproject.toml       # Python dependencies (to be verified)

frontend/
├── src/
│   ├── api/             # API client functions (exists)
│   ├── components/      # React components (exists, to be expanded)
│   │   ├── ChartComponent.tsx    # Chart rendering (exists, uses lightweight-charts)
│   │   └── IndicatorPane.tsx     # Indicator configuration (exists)
│   ├── lib/             # Utilities (exists)
│   ├── services/        # Frontend services (exists)
│   ├── App.tsx          # Main app (exists)
│   └── main.tsx         # Entry point (exists)
├── tests/               # Vitest tests (exists)
├── index.html           # HTML template (exists)
├── vite.config.ts       # Vite config (exists)
├── tailwind.config.js   # Tailwind config (exists)
└── package.json         # NPM dependencies (exists)
```

**Structure Decision**: Web application (backend/frontend) - Option 2. The existing structure is appropriate and will be extended rather than replaced.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations requiring justification at this time.
