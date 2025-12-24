# Implementation Plan: Advanced Indicators and Indicator-Driven Alerts

**Branch**: `003-advanced-indicators` | **Date**: 2025-12-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-advanced-indicators/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a metadata-driven indicator system that enables adding new technical indicators (cRSI, TDFI, ADXVMA, EMA/SMA) with full TradingView parity without requiring custom frontend rendering code. The backend will expose rich indicator metadata (display_type, colors, thresholds, scale ranges, series definitions) that drives generic frontend rendering helpers. Indicator-driven alerts integrate with the existing alert engine to trigger on signal changes, threshold crossings, and slope changes.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9+ (frontend)
**Primary Dependencies**: FastAPI 0.104+, SQLAlchemy 2.0+, pandas 2.1+, numpy 1.26+, lightweight-charts 5.1+, React 19
**Storage**: PostgreSQL (via SQLAlchemy with asyncpg driver) for candles, alerts, alert triggers
**Testing**: pytest (backend), vitest (frontend)
**Target Platform**: Web application (local-first, browser-based)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: 60fps chart panning with 5+ indicator panes, 500ms alert evaluation, 3s initial chart load
**Constraints**: Must match TradingView visual appearance 95%+, no arbitrary alert caps, offline-capable with local caching
**Scale/Scope**: Support 10+ indicators, 5+ simultaneous indicator panes, unlimited alerts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) - Existing Supercharts UI (feature 002) provides this foundation
- [ ] UI changes include before/after verification - Required for indicator rendering changes
- [ ] Performance budgets: 60fps panning, 3s initial load - Must verify with 5+ indicator panes
- [ ] **NEW**: Indicator visual appearance must match TradingView 95%+ (colors, band positions, signal interpretation)

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization - Existing candle model uses UTC
- [x] Deduplication strategy: Database constraints exist on candles
- [ ] Alert semantics: above/below/crosses defined - **NEW**: Must extend to indicator conditions (crosses_upper, turns_positive, slope_bullish)
- [ ] **NEW**: Indicator NaN/null handling for early periods (insufficient data)
- [ ] **NEW**: Alert delivery retry with exponential backoff (cap at 5 attempts)

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count - Existing alert engine enforces this
- [ ] Alert evaluation performance budgeted (500ms) - **NEW**: Must verify with indicator-based alerts
- [ ] Graceful degradation defined for high alert volumes - **NEW**: Batch evaluation when >1000 alerts (T106b)

### Local-First and Offline-Tolerant

- [x] Caching strategy: All market data stored in PostgreSQL
- [ ] Offline behavior: Charts cached, **NEW**: Per-symbol indicator preferences in localStorage
- [x] Provider error handling: Existing providers implement graceful degradation

### Testing and Quality Gates

- [ ] Core logic uses TDD - **NEW**: Indicator calculations (cRSI, TDFI, ADXVMA), alert condition evaluation
- [ ] Bug fixes include regression tests
- [x] CI includes: lint, typecheck, unit, integration tests - Existing infrastructure

### Performance Budgets

- [ ] Initial chart load: 3 seconds - **NEW**: Must verify with multiple indicator panes
- [x] Price update latency: 2 seconds - Existing orchestrator meets this
- [ ] Alert evaluation: 500ms - **NEW**: Must verify with indicator-based alerts
- [ ] UI panning: 60fps - **NEW**: Must verify with 5+ indicator panes
- [ ] Memory: 500MB for 5 symbols / 20 alerts - **NEW**: Must verify with cached indicator data

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern - Existing `IndicatorRegistry` in `backend/app/services/indicator_registry/`
- [ ] **NEW**: Generic frontend rendering helpers (formatDataForChart, splitSeriesByThresholds, splitSeriesByTrend)
- [ ] **NEW**: Indicator metadata contract drives rendering without per-indicator code
- [x] Data providers implement common interface - Existing `DataProvider` pattern

### Security & Privacy

- [x] No telemetry or data upload without consent - Local-first architecture
- [x] API keys stored securely (not in repo) - Environment variable pattern
- [x] Local data treated as sensitive - Per-symbol indicators in localStorage (client-side only)

### Governance

- [ ] If any principle violated: justification in Complexity Tracking - No violations anticipated
- [x] Constitution supersedes spec/plan conflicts - Acknowledged

**Gate Status**: PASS - Proceeding to Phase 0 research

## Project Structure

### Documentation (this feature)

```text
specs/003-advanced-indicators/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── indicators.yaml  # OpenAPI spec for indicator endpoints
│   └── alerts.yaml      # OpenAPI spec for alert endpoints with indicator conditions
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Structure Decision**: Web application (backend + frontend detected in codebase)

```text
backend/
├── app/
│   ├── models/
│   │   ├── alert.py              # Existing: Alert model
│   │   ├── alert_trigger.py      # Existing: AlertTrigger model
│   │   └── symbol.py             # Existing: Symbol model
│   ├── services/
│   │   ├── indicators.py         # Existing: Standalone indicator functions (SMA, TDFI, cRSI, ADXVMA)
│   │   ├── indicator_registry/   # Existing: Plugin-based indicator registry
│   │   │   ├── registry.py       # Indicator base class, IndicatorRegistry
│   │   │   └── __init__.py       # SMAIndicator registration
│   │   ├── alert_engine.py       # Existing: Alert evaluation engine
│   │   └── providers.py          # Existing: Data provider abstraction
│   ├── schemas/
│   │   ├── alert.py              # Existing: Alert Pydantic schemas
│   │   └── indicator.py          # NEW: Indicator metadata and output schemas
│   ├── api/
│   │   └── v1/
│   │       ├── indicators.py     # Existing: GET /, GET /{symbol}/{indicator_name}
│   │       └── alerts.py         # Existing: CRUD + triggers endpoints
│   └── core/
│       └── enums.py              # Existing: AlertCondition enum
├── tests/
│   ├── services/
│   │   ├── test_indicators.py    # NEW: Indicator calculation tests
│   │   └── test_alert_engine.py  # UPDATE: Add indicator-based alert tests
│   └── api/
│       └── v1/
│           └── test_indicators.py # NEW: API endpoint tests

frontend/
├── src/
│   ├── components/
│   │   ├── ChartComponent.tsx    # Existing: Main chart with lightweight-charts
│   │   ├── IndicatorPane.tsx     # Existing: Separate pane for oscillator indicators
│   │   ├── indicators/
│   │   │   ├── IndicatorDialog.tsx  # Existing: Indicator selection modal
│   │   │   └── [NEW] GenericIndicatorRenderer.tsx # Generic rendering component
│   │   ├── toolbar/
│   │   │   ├── DrawingToolbar.tsx    # Existing
│   │   │   └── [NEW] IndicatorToolbar.tsx # Indicator visibility controls
│   │   ├── settings/
│   │   │   ├── AppearanceTab.tsx     # Existing
│   │   │   ├── ScalesTab.tsx         # Existing
│   │   │   ├── SettingsDialog.tsx    # Existing
│   │   │   └── [NEW] IndicatorSettings.tsx # Indicator parameter editing
│   │   └── types/
│   │       └── indicators.ts     # Existing: INDICATOR_PRESETS, type definitions
│   ├── utils/
│   │   └── [NEW] chartHelpers.ts # formatDataForChart, splitSeriesByThresholds, splitSeriesByTrend
│   ├── api/
│   │   ├── indicators.ts         # Existing: Indicator API client
│   │   └── alerts.ts             # Existing: Alert API client
│   ├── hooks/
│   │   └── [NEW] useIndicators.ts # Per-symbol indicator state management hook
│   ├── contexts/
│   │   └── [NEW] IndicatorContext.tsx # Global indicator state
│   └── App.tsx                   # UPDATE: Integrate generic rendering
└── tests/
    └── utils/
        └── [NEW] chartHelpers.test.ts # Tests for generic rendering helpers
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
