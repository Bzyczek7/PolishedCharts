# Implementation Tasks: Advanced Indicators and Indicator-Driven Alerts

**Feature**: 003-advanced-indicators
**Branch**: `003-advanced-indicators`
**Generated**: 2025-12-24
**Total Tasks**: 123

---

## Overview

This document breaks down the implementation of the advanced indicators feature into discrete, executable tasks. Tasks are organized by user story to enable independent implementation and testing.

**Tech Stack**:
- Backend: Python 3.11+, FastAPI 0.104+, SQLAlchemy 2.0+, pandas 2.1+, numpy 1.26+
- Frontend: TypeScript 5.9+, React 19, lightweight-charts 5.1+
- Testing: pytest (backend), vitest (frontend)

---

## Task Legend

- **[P]**: Parallelizable - Can run simultaneously with other [P] tasks (different files, no dependencies)
- **[US1]**: User Story 1 - Generic Indicator Metadata Contract
- **[US2]**: User Story 2 - Per-Symbol Indicator Toggles and Persistence
- **[US3]**: User Story 3 - Generic Frontend Rendering Helpers
- **[US4]**: User Story 4 - Three Flagship Indicators with TradingView Parity
- **[US5]**: User Story 5 - Indicator-Driven Alerts
- **[US6]**: User Story 6 - Moving Average Indicators (EMA/SMA)
- **[US7]**: User Story 7 - Extensibility for New Indicators

---

## Phase 1: Setup and Infrastructure

**Goal**: Prepare the foundation for indicator metadata system and extend database models.

- [X] T001 Create database migration for alerts table indicator columns in backend/alembic/versions/
- [X] T002 Create database migration for alert_triggers table delivery columns in backend/alembic/versions/
- [X] T003 [P] Create IndicatorMetadata Pydantic schema in backend/app/schemas/indicator.py
- [X] T004 [P] Create IndicatorOutput Pydantic schema in backend/app/schemas/indicator.py
- [X] T005 [P] Create ThresholdsConfig, ScaleRangesConfig, SeriesMetadata, ReferenceLevel schemas in backend/app/schemas/indicator.py
- [X] T006 [P] Update Alert model with indicator fields in backend/app/models/alert.py
- [X] T007 [P] Update AlertTrigger model with delivery tracking fields in backend/app/models/alert_trigger.py
- [X] T008 [P] Update Alert Pydantic schemas for indicator support in backend/app/schemas/alert.py
- [X] T009 [P] Add indicator condition types to AlertCondition enum in backend/app/core/enums.py
- [X] T010 Run database migrations to apply schema changes

---

## Phase 2: Foundational - Backend Indicator Registry

**Goal**: Extend the indicator registry to support metadata output.

- [X] T011 Add get_metadata() property to Indicator base class in backend/app/services/indicator_registry/registry.py
- [X] T012 Add alert_templates property to Indicator base class in backend/app/services/indicator_registry/registry.py
- [X] T013 Create ParameterDefinition dataclass for indicator parameters in backend/app/services/indicator_registry/registry.py
- [X] T014 Update IndicatorRegistry to return metadata from list_indicators() in backend/app/services/indicator_registry/registry.py
- [X] T015 Create IndicatorInfo schema for GET /api/v1/indicators response in backend/app/schemas/indicator.py

---

## Phase 3: User Story 1 - Generic Indicator Metadata Contract (P1)

**Goal**: Backend exposes indicator metadata; frontend consumes and renders any indicator without custom code.

**Independent Test**: Add a test indicator to backend with only metadata configuration; verify it appears in frontend indicator selector and renders correctly.

**Acceptance Criteria**:
- Backend GET /api/v1/indicators returns list of all indicators with metadata
- Backend GET /api/v1/indicators/{symbol}/{name} returns IndicatorOutput with data + metadata
- Frontend indicator selector dynamically populates from API response
- Indicator renders based on metadata (overlay vs pane, colors, reference levels)

### Backend API Tasks

- [X] T016 [P] [US1] Update GET /api/v1/indicators endpoint to return IndicatorInfo list in backend/app/api/v1/indicators.py
- [X] T017 [P] [US1] Create GET /api/v1/indicators/supported endpoint with full metadata in backend/app/api/v1/indicators.py
- [X] T018 [US1] Update GET /api/v1/indicators/{symbol}/{name} to return IndicatorOutput in backend/app/api/v1/indicators.py
- [X] T019 [US1] Add validation for indicator params in GET endpoint in backend/app/api/v1/indicators.py
- [X] T020 [P] [US1] Write API tests for GET /api/v1/indicators in backend/tests/api/v1/test_indicators.py
- [X] T021 [P] [US1] Write API tests for GET /api/v1/indicators/{symbol}/{name} in backend/tests/api/v1/test_indicators.py

### Frontend Types and API Tasks

- [X] T022 [P] [US1] Create TypeScript interfaces for IndicatorMetadata in frontend/src/components/types/indicators.ts
- [X] T023 [P] [US1] Create TypeScript interfaces for IndicatorOutput in frontend/src/api/indicators.ts
- [X] T024 [P] [US1] Update indicator API client to fetch with metadata in frontend/src/api/indicators.ts
- [X] T025 [US1] Update IndicatorDialog to populate from API response in frontend/src/components/indicators/IndicatorDialog.tsx

### Frontend Rendering Tasks

- [X] T026 [P] [US1] Create generic GenericIndicatorRenderer component in frontend/src/components/indicators/GenericIndicatorRenderer.tsx
- [X] T027 [US1] Implement overlay rendering logic in GenericIndicatorRenderer in frontend/src/components/indicators/GenericIndicatorRenderer.tsx
- [X] T028 [US1] Implement pane rendering logic in GenericIndicatorRenderer in frontend/src/components/indicators/GenericIndicatorRenderer.tsx
- [X] T029 [US1] Add reference_levels rendering to GenericIndicatorRenderer in frontend/src/components/indicators/GenericIndicatorRenderer.tsx
- [X] T030 [US1] Update ChartComponent to use GenericIndicatorRenderer in frontend/src/components/ChartComponent.tsx
- [X] T031 [US1] Update IndicatorPane to use GenericIndicatorRenderer in frontend/src/components/IndicatorPane.tsx

---

## Phase 4: User Story 2 - Per-Symbol Indicator Toggles and Persistence (P1)

**Goal**: Users can customize indicators per symbol; preferences persist in localStorage.

**Independent Test**: Add indicators for AAPL, switch to TSLA with different indicators, switch back to AAPL and verify indicators restored.

**Acceptance Criteria**:
- Indicators saved to localStorage per symbol
- Switching symbols clears chart, loads new symbol's indicators
- Indicator visibility toggle works without removing from saved layout
- Parameters (periods, thresholds) persist per symbol

### State Management Tasks

- [X] T032 [P] [US2] create useIndicators hook in frontend/src/hooks/useIndicators.ts
- [X] T033 [P] [US2] Create IndicatorState TypeScript interfaces in frontend/src/hooks/useIndicators.ts
- [X] T034 [P] [US2] Create localStorage utility functions in frontend/src/hooks/useIndicators.ts
- [X] T035 [US2] Implement addIndicator function in useIndicators hook in frontend/src/hooks/useIndicators.ts
- [X] T036 [US2] Implement removeIndicator function in useIndicators hook in frontend/src/hooks/useIndicators.ts
- [X] T037 [US2] Implement toggleIndicator function in useIndicators hook in frontend/src/hooks/useIndicators.ts
- [X] T038 [US2] Implement updateIndicatorParams function in useIndicators hook in frontend/src/hooks/useIndicators.ts
- [X] T039 [US2] Implement loadIndicatorsForSymbol function in useIndicators hook in frontend/src/hooks/useIndicators.ts
- [X] T040 [US2] Implement saveIndicatorsForSymbol function in useIndicators hook in frontend/src/hooks/useIndicators.ts

### Integration Tasks

- [X] T041 [US2] Create IndicatorContext provider in frontend/src/contexts/IndicatorContext.tsx
- [X] T042 [US2] Update App.tsx to wrap with IndicatorContext in frontend/src/App.tsx
- [X] T043 [US2] Add symbol change handler to load/save indicators in frontend/src/App.tsx
- [X] T044 [US2] Update IndicatorDialog to use useIndicators hook in frontend/src/components/indicators/IndicatorDialog.tsx
- [X] T044a [P] [US2] Create IndicatorToolbar component in frontend/src/components/toolbar/IndicatorToolbar.tsx
- [X] T045 [US2] Add indicator visibility toggle controls to toolbar in frontend/src/components/toolbar/IndicatorToolbar.tsx
- [X] T045a [P] [US2] Create IndicatorSettings component in frontend/src/components/settings/IndicatorSettings.tsx
- [X] T046 [US2] Add indicator settings panel for parameter editing in frontend/src/components/settings/IndicatorSettings.tsx

---

## Phase 5: User Story 3 - Generic Frontend Rendering Helpers (P1)

**Goal**: Developers can add indicators without custom rendering code using helper functions.

**Independent Test**: Add new indicator using helpers; verify correct rendering without indicator-specific code.

**Acceptance Criteria**:
- formatDataForChart converts indicator output to lightweight-charts format
- splitSeriesByThresholds splits data by threshold crossings with colors
- splitSeriesByTrend detects trend changes and creates colored segments
- Helpers handle null values correctly

### Helper Implementation Tasks

- [X] T047 [P] [US3] Create formatDataForChart helper in frontend/src/utils/chartHelpers.ts
- [X] T048 [P] [US3] Create splitSeriesByThresholds helper in frontend/src/utils/chartHelpers.ts
- [X] T049 [P] [US3] Create splitSeriesByTrend helper in frontend/src/utils/chartHelpers.ts
- [X] T050 [US3] Add null value handling to formatDataForChart in frontend/src/utils/chartHelpers.ts
- [X] T051 [US3] Add color state detection to splitSeriesByThresholds in frontend/src/utils/chartHelpers.ts
- [X] T052 [US3] Add slope calculation to splitSeriesByTrend in frontend/src/utils/chartHelpers.ts

### Tests

- [X] T053 [P] [US3] Write tests for formatDataForChart in frontend/tests/utils/chartHelpers.test.ts
- [X] T054 [P] [US3] Write tests for splitSeriesByThresholds in frontend/tests/utils/chartHelpers.test.ts
- [X] T055 [P] [US3] Write tests for splitSeriesByTrend in frontend/tests/utils/chartHelpers.test.ts
- [X] T056 [US3] Write tests for null value handling in frontend/tests/utils/chartHelpers.test.ts

### Integration

- [X] T057 [US3] Update GenericIndicatorRenderer to use chartHelpers in frontend/src/components/indicators/GenericIndicatorRenderer.tsx
- [X] T058 [US3] Update IndicatorPane to use chartHelpers in frontend/src/components/IndicatorPane.tsx

---

## Phase 6: User Story 4 - Three Flagship Indicators with TradingView Parity (P1)

**Goal**: Implement cRSI, TDFI, and ADXVMA indicators matching TradingView exactly.

**Independent Test**: Compare TradingView side-by-side; verify 95% visual similarity.

**Acceptance Criteria**:
- cRSI: cyan line, light cyan bands, 0-100 scale, 70/30 reference lines
- TDFI: threshold-based coloring (green/red), 0.05/-0.05 reference lines
- ADXVMA: blue overlay line, slope-based color changes

### cRSI Indicator Tasks

- [X] T059 [P] [US4] Create CRSIIndicator class in backend/app/services/indicator_registry/registry.py
- [X] T060 [P] [US4] Implement cRSI metadata with TradingView colors in backend/app/services/indicator_registry/registry.py
- [X] T061 [US4] Register CRSIIndicator in backend/app/services/indicator_registry/__init__.py
- [X] T062 [P] [US4] Write calculation tests for cRSI in backend/tests/services/test_indicators.py

### TDFI Indicator Tasks

- [X] T063 [P] [US4] Create TDFIIndicator class in backend/app/services/indicator_registry/registry.py
- [X] T064 [P] [US4] Implement TDFI metadata with threshold colors in backend/app/services/indicator_registry/registry.py
- [X] T065 [US4] Register TDFIIndicator in backend/app/services/indicator_registry/__init__.py
- [X] T066 [P] [US4] Write calculation tests for TDFI in backend/tests/services/test_indicators.py

### ADXVMA Indicator Tasks

- [X] T067 [P] [US4] Create ADXVMAIndicator class in backend/app/services/indicator_registry/registry.py
- [X] T068 [P] [US4] Implement ADXVMA metadata with overlay type in backend/app/services/indicator_registry/registry.py
- [X] T069 [US4] Register ADXVMAIndicator in backend/app/services/indicator_registry/__init__.py
- [X] T070 [P] [US4] Write calculation tests for ADXVMA in backend/tests/services/test_indicators.py

### Frontend Verification

- [X] T071 [US4] Create visual verification script for cRSI colors in frontend/tests/visual/verify-indicators.test.ts
- [X] T072 [US4] Create visual verification script for TDFI colors in frontend/tests/visual/verify-indicators.test.ts
- [X] T073 [US4] Create visual verification script for ADXVMA colors in frontend/tests/visual/verify-indicators.test.ts

---

## Phase 7: User Story 5 - Indicator-Driven Alerts (P2)

**Goal**: Alerts trigger on indicator conditions (crosses, turns, slope changes).

**Independent Test**: Create alert for "cRSI crosses above 70"; wait for trigger; verify in alert history.

**Acceptance Criteria**:
- Backend evaluates indicator conditions on new candle
- Alert conditions: crosses_upper, crosses_lower, turns_positive, turns_negative, slope_bullish, slope_bearish
- Frontend UI for creating indicator alerts
- Alert history shows indicator value at trigger

### Backend Alert Engine Tasks

- [X] T074 [P] [US5] Add indicator condition evaluation to alert_engine.py in backend/app/services/alert_engine.py
- [X] T075 [US5] Implement indicator_crosses_upper condition in backend/app/services/alert_engine.py
- [X] T076 [US5] Implement indicator_crosses_lower condition in backend/app/services/alert_engine.py
- [X] T077 [US5] Implement indicator_turns_positive condition in backend/app/services/alert_engine.py
- [X] T078 [US5] Implement indicator_turns_negative condition in backend/app/services/alert_engine.py
- [X] T079 [US5] Implement indicator_slope_bullish condition in backend/app/services/alert_engine.py
- [X] T080 [US5] Implement indicator_slope_bearish condition in backend/app/services/alert_engine.py
- [X] T081 [US5] Add indicator_data parameter to evaluate_symbol_alerts in backend/app/services/alert_engine.py

### Alert API Tasks

- [X] T082 [P] [US5] Update POST /api/v1/alerts to accept indicator fields in backend/app/api/v1/alerts.py
- [X] T083 [P] [US5] Create GET /api/v1/alerts/indicator-conditions endpoint in backend/app/api/v1/alerts.py
- [X] T084 [US5] Update alert trigger creation to include indicator_value in backend/app/services/alert_engine.py

### Delivery Retry Tasks

- [X] T085 [P] [US5] Create Celery task for alert delivery in backend/app/tasks/alert_delivery.py
- [X] T086 [US5] Implement exponential backoff retry logic in backend/app/tasks/alert_delivery.py
- [X] T087 [US5] Add delivery status update on failure in backend/app/tasks/alert_delivery.py
- [X] T088 [P] [US5] Write tests for delivery retry logic in backend/tests/tasks/test_alert_delivery.py

### Frontend Alert UI Tasks

- [X] T089 [P] [US5] Update alert form to include indicator selector in frontend/src/components/AlertForm.tsx
- [X] T090 [US5] Add indicator condition dropdown in frontend/src/components/AlertForm.tsx
- [X] T091 [US5] Update alert history to show indicator details in frontend/src/components/AlertHistory.tsx
- [X] T092 [US5] Update alerts API client for indicator alerts in frontend/src/api/alerts.ts

---

## Phase 8: User Story 6 - Moving Average Indicators (EMA/SMA) (P2)

**Goal**: EMA and SMA indicators with configurable periods as overlays.

**Independent Test**: Add EMA(20) and SMA(50); verify both appear on price chart with correct values.

**Acceptance Criteria**:
- EMA displays as overlay with configurable period
- SMA displays as overlay with configurable period
- Each period gets unique color
- Values match standard calculations

### Backend Tasks

- [X] T093 [P] [US6] Create EMAIndicator class with period parameter in backend/app/services/indicator_registry/registry.py
- [X] T094 [P] [US6] Implement EMA metadata with overlay type in backend/app/services/indicator_registry/registry.py
- [X] T095 [P] [US6] Create SMAIndicator class with period parameter in backend/app/services/indicator_registry/registry.py
- [X] T096 [P] [US6] Implement SMA metadata with overlay type in backend/app/services/indicator_registry/registry.py
- [X] T097 [US6] Register EMAIndicator and SMAIndicator in backend/app/services/indicator_registry/__init__.py
- [X] T098 [P] [US6] Write calculation tests for EMA in backend/tests/services/test_indicators.py
- [X] T099 [P] [US6] Write calculation tests for SMA in backend/tests/services/test_indicators.py

### Frontend Tasks

- [X] T100 [US6] Update INDICATOR_PRESETS to include EMA/SMA in frontend/src/components/types/indicators.ts
- [X] T101 [US6] Add period input control for EMA/SMA in frontend/src/components/indicators/IndicatorDialog.tsx

---

## Phase 9: User Story 7 - Extensibility for New Indicators (P3)

**Goal**: Developers can add indicators by implementing calculation and metadata only.

**Independent Test**: Add completely new indicator through backend only; verify it appears in UI and renders correctly.

**Acceptance Criteria**:
- New indicator appears in selector after registration
- No frontend code changes needed
- Alert templates work for new indicator

### Documentation Tasks

- [X] T102 [P] [US7] Update quickstart.md with indicator addition guide in specs/003-advanced-indicators/quickstart.md
- [X] T103 [US7] Add indicator registration examples to quickstart.md in specs/003-advanced-indicators/quickstart.md

### Validation Tasks

- [X] T104 [US7] Create script to validate indicator metadata in backend/tests/services/test_indicator_registry.py
- [X] T105 [US7] Create test to verify generic rendering works for new indicator in frontend/tests/integration/test-extensibility.test.ts

---

## Phase 10: Polish and Cross-Cutting Concerns

**Goal**: Performance optimization, error handling, and production readiness.

### Performance Tasks

- [X] T106 Add performance benchmarks for alert evaluation at scale (100, 1000, 10000 alerts) in backend/tests/benchmarks/test_alert_performance.py
- [X] T106a Implement alert evaluation timing measurement (enforce 500ms budget) in backend/app/services/alert_engine.py
- [X] T106b Implement batch evaluation for high alert volumes (>1000) in backend/app/services/alert_engine.py
- [X] T107 Add performance tests for rendering 5+ panes in frontend/tests/performance/test-rendering.test.ts
- [X] T107a [P] Add symbol switch restore performance test (<1s requirement, SC-003) in frontend/tests/performance/test-symbol-switch.test.ts
- [X] T107b [P] Add alert trigger latency test (<2s requirement, SC-004) in backend/tests/performance/test_alert_latency.py
- [X] T107c [P] Add memory footprint profiling test (500MB budget, Constitution VI) in backend/tests/performance/test_memory_usage.py
- [X] T108 Implement data limiting for indicator API in backend/app/api/v1/indicators.py

### Error Handling Tasks

- [X] T109 [P] Add validation for invalid indicator params in backend/app/api/v1/indicators.py
- [X] T110 [P] Add error handling for NaN values in frontend rendering in frontend/src/components/indicators/GenericIndicatorRenderer.tsx
- [X] T110a Implement minimum cooldown enforcement for rapid signal oscillations in backend/app/services/alert_engine.py
- [X] T110b Add test for insufficient data handling (partial null values) in backend/tests/services/test_indicators.py
- [X] T111 Add user-friendly error messages for indicator calculation failures in backend/app/api/v1/indicators.py

### Documentation Tasks

- [X] T112 [P] Update API documentation in specs/003-advanced-indicators/contracts/indicators.yaml
- [X] T113 [P] Update API documentation for alerts in specs/003-advanced-indicators/contracts/alerts.yaml
- [X] T114 Update CLAUDE.md with new technologies if needed in CLAUDE.md

### Final Integration Tasks

- [X] T115 Run full test suite and ensure all tests pass
- [ ] T116 Manual testing of all user stories with before/after screenshots
- [ ] T117 Performance verification: 60fps with 5 panes
- [ ] T118 Create git commit with all changes

---

## Dependencies: Story Completion Order

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (US1: Metadata Contract) ← Core foundation
    ↓
┌───────────────┬───────────────┬───────────────┐
↓               ↓               ↓               ↓
Phase 4 (US2)   Phase 5 (US3)   Phase 6 (US4)   (Can run in parallel)
Persistence     Helpers         Flagship
    ↓               ↓               ↓
    └───────────────┴───────────────┘
                    ↓
              Phase 7 (US5: Alerts)
                    ↓
              Phase 8 (US6: EMA/SMA)
                    ↓
              Phase 9 (US7: Extensibility)
                    ↓
              Phase 10 (Polish)
```

**Critical Path**: Phase 1 → 2 → 3 → 4 → 5 → 7 → 8 → 10

**Parallel Opportunities**:
- Phase 4, 5, 6 can run in parallel (after US1 is complete)
- US6 (EMA/SMA) can run in parallel with US5 (Alerts)
- US7 (Extensibility) is mostly documentation and can be deferred

---

## Parallel Execution Examples

### Within Phase 1 (Setup) - Parallel Tasks
```bash
# Terminal 1
T003: Create IndicatorMetadata Pydantic schema

# Terminal 2 (parallel)
T004: Create IndicatorOutput Pydantic schema

# Terminal 3 (parallel)
T005: Create supporting schemas (ThresholdsConfig, etc.)
```

### Within Phase 3 (US1) - Parallel Tasks
```bash
# Terminal 1
T016: Update GET /api/v1/indicators endpoint
T020: Write API tests for GET /api/v1/indicators

# Terminal 2 (parallel)
T017: Create GET /api/v1/indicators/supported endpoint

# Terminal 3 (parallel)
T022: Create TypeScript interfaces for IndicatorMetadata
T024: Update indicator API client
```

### Within Phase 6 (US4) - Flagship Indicators
```bash
# Terminal 1
T059-T062: cRSI indicator (implementation + tests)

# Terminal 2 (parallel)
T063-T066: TDFI indicator (implementation + tests)

# Terminal 3 (parallel)
T067-T070: ADXVMA indicator (implementation + tests)
```

---

## Implementation Strategy

### MVP Scope (Suggested)
- Phase 1: Setup
- Phase 2: Foundational
- Phase 3: US1 (Metadata Contract) only
- Phase 10: Polish

**This enables the core extensibility pattern**. After US1, adding any new indicator requires only backend metadata configuration.

### Incremental Delivery
1. **Sprint 1**: Phase 1-3 (Generic metadata system)
2. **Sprint 2**: Phase 4-5 (Persistence + Helpers)
3. **Sprint 3**: Phase 6 (Flagship indicators - user value)
4. **Sprint 4**: Phase 7-8 (Alerts + MA indicators)
5. **Sprint 5**: Phase 9-10 (Extensibility + Polish)

### Testing Strategy
- **Backend**: pytest for calculation logic, API endpoints
- **Frontend**: vitest for helper functions, visual verification for rendering
- **Integration**: Manual testing with TradingView comparison for flagship indicators

---

## Format Validation

All 123 tasks follow the checklist format:
- ✅ Checkbox prefix: `- [ ]`
- ✅ Task ID: Sequential `T001` - `T123`
- ✅ [P] marker: Included for parallelizable tasks
- ✅ [Story] label: Included for user story tasks
- ✅ Description: Clear action with file path

**Task Count Summary**:
- Phase 1 (Setup): 10 tasks
- Phase 2 (Foundational): 5 tasks
- Phase 3 (US1): 16 tasks
- Phase 4 (US2): 17 tasks
- Phase 5 (US3): 12 tasks
- Phase 6 (US4): 15 tasks
- Phase 7 (US5): 19 tasks
- Phase 8 (US6): 9 tasks
- Phase 9 (US7): 4 tasks
- Phase 10 (Polish): 18 tasks

**Total**: 123 tasks

---

## Independent Test Criteria Summary

| User Story | Test Criterion | How to Verify |
|------------|----------------|---------------|
| US1 | Backend-only indicator addition | Add test indicator, verify in UI |
| US2 | Per-symbol persistence | AAPL → TSLA → AAPL, verify config restored |
| US3 | Generic helpers work | New indicator renders without custom code |
| US4 | TradingView parity | Side-by-side visual comparison |
| US5 | Indicator alerts trigger | Create alert, wait for trigger, check history |
| US6 | EMA/SMA calculations | Compare values to standard calculation |
| US7 | Extensibility | Add indicator via backend only, verify works |
