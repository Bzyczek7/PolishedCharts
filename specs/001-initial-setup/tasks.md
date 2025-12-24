# Tasks: Initial Project Setup

**Input**: Design documents from `/specs/001-initial-setup/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: TDD is required for core logic per constitution (alert engine, indicators, candle normalization).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web application**: `backend/app/`, `frontend/src/`
- Paths shown below reflect the actual project structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify and complete project initialization

- [x] T001 Verify Python dependencies in backend/pyproject.toml include: fastapi>=0.116, sqlalchemy>=2.0, alembic, yfinance, tenacity, pytest
- [x] T002 [P] Verify frontend dependencies in frontend/package.json include: react@19, lightweight-charts@5.1+, axios
- [x] T003 [P] Verify database exists and migrations are up to date by running `alembic upgrade head`
- [x] T004 [P] Verify backend runs with `uvicorn app.main:app --reload`
- [x] T005 [P] Verify frontend runs with `npm run dev`

**Checkpoint**: Development environment is ready for feature implementation ✅

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Add unique constraint to Candle model in backend/app/models/candle.py for idempotent inserts
- [x] T007 Create Alembic migration in backend/alembic/versions/ to add unique constraint on (symbol_id, timestamp, interval)
- [x] T008 Create AlertTrigger model in backend/app/models/alert_trigger.py with fields: id, alert_id (FK), triggered_at (UTC), observed_price
- [x] T009 Create Alembic migration in backend/alembic/versions/ to add alert_trigger table with indexes
- [x] T010 Create AlertCondition enum in backend/app/core/enums.py with values: ABOVE, BELOW, CROSSES_UP, CROSSES_DOWN
- [x] T011 Update Alert model in backend/app/models/alert.py to use AlertCondition enum and add cooldown field
- [x] T012 Create AlertTrigger schema in backend/app/schemas/alert.py for API responses
- [x] T013 [P] Update AlertCreate and AlertUpdate schemas in backend/app/schemas/alert.py to use AlertCondition enum and validate threshold > 0
- [x] T014 [P] Create test fixtures in backend/tests/conftest.py for test database and sample symbols/candles
- [x] T015 [P] Configure CI pipeline in .github/workflows/ci.yml with: ruff, mypy, pytest, eslint, tsc, vitest

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Market Price Charts (Priority: P1) 🎯 MVP

**Goal**: Display real-time and historical candlestick charts for any symbol

**Independent Test**: Launch the app, select a symbol (e.g., AAPL), verify OHLCV candles appear, change interval to 1h and verify candles update correctly

### Tests for User Story 1 (TDD - Write First, Ensure They Fail) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T016 [P] [US1] Write test for UTC timestamp normalization in backend/tests/services/test_providers.py::test_yfinance_utc_normalization
- [x] T017 [P] [US1] Write test for idempotent candle insert in backend/tests/services/test_candles.py::test_idempotent_insert
- [x] T018 [P] [US1] Write test for candle deduplication in backend/tests/services/test_candles.py::test_duplicate_candles_rejected
- [x] T019 [P] [US1] Write test for exponential backoff with jitter in backend/tests/services/test_providers.py::test_exponential_backoff_on_rate_limit
- [x] T020 [P] [US1] Write test for honoring Retry-After header in backend/tests/services/test_providers.py::test_retry_after_header_honored
- [x] T021 [P] [US1] Write test for "no data available" error response in backend/tests/api/test_candles.py::test_no_data_returns_404_with_message
- [x] T022 [P] [US1] Write test for "provider unavailable" error with served_from_cached flag in backend/tests/api/test_candles.py::test_provider_error_returns_cached_data_flag
- [x] T023 [P] [US1] Write integration test for GET /api/v1/candles/{symbol} in backend/tests/api/test_candles.py::test_get_candles_success

### Implementation for User Story 1

- [x] T024 [US1] Implement exponential backoff with jitter in backend/app/services/providers.py using tenacity (start 1s, max 30s, jitter enabled)
- [x] T025 [US1] Add Retry-After header parsing in backend/app/services/providers.py to honor provider's retry duration when present
- [x] T026 [US1] Create ErrorDetail schema in backend/app/schemas/common.py with fields: code, message, served_from_cached (bool), retry_after (optional)
- [x] T027 [US1] Update YFinanceProvider in backend/app/services/providers.py to normalize timestamps to UTC
- [x] T028 [US1] Implement idempotent insert logic in backend/app/services/candles.py using ON CONFLICT DO UPDATE
- [x] T029 [US1] Update GET /api/v1/candles/{symbol} endpoint in backend/app/api/v1/candles.py to return cached data with served_from_cached=true when offline/down
- [x] T030 [US1] Update GET /api/v1/candles/{symbol} endpoint in backend/app/api/v1/candles.py to return 404 with ErrorDetail when no data exists for symbol
- [x] T031 [US1] Update GET /api/v1/candles/{symbol} endpoint in backend/app/api/v1/candles.py to handle provider errors gracefully with ErrorDetail response
- [x] T032 [US1] Verify symbol selector component exists in frontend/src/components/SymbolSelector.tsx
- [x] T033 [US1] Verify interval selector component exists in frontend/src/components/IntervalSelector.tsx
- [x] T034 [US1] Ensure ChartComponent in frontend/src/components/ChartComponent.tsx handles interval changes and updates chart

**Checkpoint**: User Story 1 complete - charts display with real data, pan/zoom work, intervals switch correctly, errors handled gracefully

---

## Phase 4: User Story 2 - Create Unlimited Price Alerts (Priority: P1) 🎯 MVP

**Goal**: Create price-based alerts with conditions (above, below, crosses-up, crosses-down) that persist and trigger

**Independent Test**: Create 100+ alerts for AAPL at various prices, verify all persist after restart, trigger alerts when price crosses thresholds

### Tests for User Story 2 (TDD - Write First, Ensure They Fail) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T035 [P] [US2] Write test for alert evaluation: above condition in backend/tests/services/test_alert_engine.py::test_alert_above_triggers
- [x] T036 [P] [US2] Write test for alert evaluation: below condition in backend/tests/services/test_alert_engine.py::test_alert_below_triggers
- [x] T037 [P] [US2] Write test for alert evaluation: crosses_up condition in backend/tests/services/test_alert_engine.py::test_alert_crosses_up_triggers
- [x] T038 [P] [US2] Write test for alert evaluation: crosses_down condition in backend/tests/services/test_alert_engine.py::test_alert_crosses_down_triggers
- [x] T039 [P] [US2] Write test for alert evaluation: exact price edge case in backend/tests/services/test_alert_engine.py::test_alert_crosses_exact_price
- [x] T040 [P] [US2] Write test for alert evaluation: rapid oscillations in backend/tests/services/test_alert_engine.py::test_alert_rapid_oscillations
- [x] T041 [P] [US2] Write test for alert evaluation: 1000+ alerts performance budget in backend/tests/benchmarks/test_alert_performance.py::test_1000_alerts_under_500ms
- [x] T042 [P] [US2] Write integration test for alert persistence in backend/tests/integration/test_alert_persistence.py::test_alerts_survive_restart
- [x] T043 [P] [US2] Write contract test for POST /api/v1/alerts in backend/tests/api/test_alerts.py::test_create_alert_success
- [x] T044 [P] [US2] Write contract test for alert validation error in backend/tests/api/test_alerts.py::test_negative_threshold_rejected

### Implementation for User Story 2

- [x] T045 [US1-US2] Update alert engine in backend/app/services/alert_engine.py with clarified semantics (above/below/crosses)
- [x] T046 [US2] Add AlertTrigger creation logic in backend/app/services/alert_engine.py when alerts fire
- [x] T047 [US2] Implement GET /api/v1/alerts endpoint in backend/app/api/v1/alerts.py to list all alerts
- [x] T048 [US2] Implement POST /api/v1/alerts endpoint in backend/app/api/v1/alerts.py with validation (threshold > 0)
- [x] T049 [US2] Implement PUT /api/v1/alerts/{alert_id} endpoint in backend/app/api/v1/alerts.py for updates
- [x] T050 [US2] Implement DELETE /api/v1/alerts/{alert_id} endpoint in backend/app/api/v1/alerts.py
- [x] T051 [US2] Implement GET /api/v1/alerts/{alert_id}/triggers endpoint in backend/app/api/v1/alerts.py for alert history
- [x] T052 [US2] Implement GET /api/v1/alerts/triggers endpoint in backend/app/api/v1/alerts.py for all recent triggers
- [x] T053 [US2] Create alert creation UI component in frontend/src/components/AlertCreateDialog.tsx
- [x] T054 [US2] Create alert list component in frontend/src/components/AlertList.tsx
- [x] T055 [US2] Create alert trigger history component in frontend/src/components/AlertHistory.tsx
- [x] T056 [US2] Implement in-app notification when alert triggers in frontend/src/components/AlertNotification.tsx

**Checkpoint**: User Stories 1 AND 2 complete - core charting and unlimited alerts working end-to-end

---

## Phase 5: User Story 3 - Apply Technical Indicators (Priority: P2)

**Goal**: Overlay technical indicators (SMA minimum) on charts with configurable parameters

**Independent Test**: Add SMA indicator to chart with period=20, verify it overlays candles, change period to 50 and verify update

### Tests for User Story 3 (TDD - Write First, Ensure They Fail) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T057 [P] [US3] Write test for SMA calculation in backend/tests/services/test_indicators.py::test_sma_calculation_known_values
- [x] T058 [P] [US3] Write integration test for GET /api/v1/indicators/sma in backend/tests/api/test_indicators.py::test_sma_endpoint_returns_correct_values

### Implementation for User Story 3

- [x] T059 [US3] Create IndicatorRegistry class in backend/app/services/indicators/registry.py with register() and get() methods
- [x] T060 [US3] Refactor existing indicators in backend/app/services/indicators.py to use plugin pattern
- [x] T061 [US3] Register SMA indicator in backend/app/services/indicators/__init__.py using IndicatorRegistry
- [x] T062 [US3] Implement GET /api/v1/indicators endpoint in backend/app/api/v1/indicators.py to list available indicators
- [x] T063 [US3] Implement GET /api/v1/indicators/{indicator_name}/calculate endpoint in backend/app/api/v1/indicators.py
- [x] T064 [US3] Update IndicatorPane in frontend/src/components/IndicatorPane.tsx to call indicator computation API
- [x] T065 [US3] Update ChartComponent in frontend/src/components/ChartComponent.tsx to render indicator overlays

**Checkpoint**: User Stories 1, 2, AND 3 complete - charting, alerts, and indicators all working

---

## Phase 6: User Story 4 - Manage Multiple Symbols (Priority: P2)

**Goal**: Track multiple symbols simultaneously with independent chart state

**Independent Test**: Open charts for AAPL and SPY simultaneously, verify each maintains independent state and alerts identify which symbol triggered

### Tests for User Story 4 (TDD - Write First, Ensure They Fail) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T066 [P] [US4] Write test for multi-symbol state isolation in frontend/tests/components/test_chart_component.tsx::test_multiple_charts_independent_state

### Implementation for User Story 4

- [x] T067 [US4] Implement multi-chart tab/panel layout in frontend/src/App.tsx
- [x] T068 [US4] Ensure each chart component maintains independent symbol and interval state
- [x] T069 [US4] Update alert notification in frontend/src/components/AlertNotification.tsx to include symbol name
- [x] T070 [US4] Update alert triggers list in frontend/src/components/AlertHistory.tsx to show symbol for each trigger

**Checkpoint**: All user stories complete - full vertical slice validated

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and constitution compliance

- [x] T071 [P] Add gap detection logic in backend/app/services/gap_detector.py and mark gaps in candle responses
- [x] T072 [P] Add visual gap marking on chart in frontend/src/components/ChartComponent.tsx (show "gap" label for missing data)
- [x] T073 [P] Implement structured logging throughout backend using Python logging module with consistent format
- [x] T074 [P] Add user-friendly error message components in frontend/src/components/ErrorDisplay.tsx with retry options and served_from_cached display
- [x] T075 [P] Run quickstart.md validation by executing all steps in the guide
- [x] T076 [P] Add integration test for full alert flow in backend/tests/integration/test_full_alert_flow.py (create alert, price update, trigger, verify history)
- [x] T077 Verify all TDD tests pass: pytest tests/services/test_alert_engine.py -v
- [x] T078 Verify all API tests pass: pytest tests/api/ -v
- [x] T079 Verify all integration tests pass: pytest tests/integration/ -v
- [x] T080 Verify CI passes on main branch: check GitHub Actions workflow results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P1 → P2 → P2)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 (charts + alerts on same symbol) but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Extends US1 with indicator overlays
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Extends US1/US2 to multiple charts

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD per constitution)
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Setup (Phase 1)**:
- T001, T002, T003, T004, T005 can all run in parallel (different environments)

**Foundational (Phase 2)**:
- T013, T014, T015 can run in parallel after T006-T012 complete

**User Story 1 Tests**:
- T016-T023 can all run in parallel (test files)

**User Story 2 Tests**:
- T035-T044 can all run in parallel (test files)

**User Story 3 Tests**:
- T057, T058 can run in parallel

**User Story 4 Tests**:
- T066 is standalone

**Polish (Phase 7)**:
- T071-T076 can run in parallel (different files/concerns)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together (they must fail first):
pytest tests/services/test_providers.py::test_yfinance_utc_normalization -v
pytest tests/services/test_candles.py::test_idempotent_insert -v
pytest tests/services/test_candles.py::test_duplicate_candles_rejected -v
pytest tests/services/test_providers.py::test_exponential_backoff_on_rate_limit -v
pytest tests/services/test_providers.py::test_retry_after_header_honored -v
pytest tests/api/test_candles.py::test_no_data_returns_404_with_message -v
pytest tests/api/test_candles.py::test_provider_error_returns_cached_data_flag -v
pytest tests/api/test_candles.py::test_get_candles_success -v
```

---

## Parallel Example: User Story 2 Tests

```bash
# Launch all tests for User Story 2 together (they must fail first):
pytest tests/services/test_alert_engine.py::test_alert_above_triggers -v
pytest tests/services/test_alert_engine.py::test_alert_below_triggers -v
pytest tests/services/test_alert_engine.py::test_alert_crosses_up_triggers -v
pytest tests/services/test_alert_engine.py::test_alert_crosses_down_triggers -v
pytest tests/services/test_alert_engine.py::test_alert_crosses_exact_price -v
pytest tests/services/test_alert_engine.py::test_alert_rapid_oscillations -v
pytest tests/benchmarks/test_alert_performance.py::test_1000_alerts_under_500ms -v
pytest tests/integration/test_alert_persistence.py::test_alerts_survive_restart -v
pytest tests/api/test_alerts.py::test_create_alert_success -v
pytest tests/api/test_alerts.py::test_negative_threshold_rejected -v
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Charts)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Complete Phase 4: User Story 2 (Alerts)
6. **STOP and VALIDATE**: Test User Stories 1 AND 2 together
7. Deploy/demo if ready (MVP has charting + unlimited alerts!)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Charting MVP
3. Add User Story 2 → Test with US1 → Full MVP (charting + alerts)
4. Add User Story 3 → Test independently → Indicators available
5. Add User Story 4 → Test independently → Multi-symbol support
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Charts)
   - Developer B: User Story 2 (Alerts)
   - Developer C: User Story 3 (Indicators) - after US1 mostly complete
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **TDD is required for core logic**: tests MUST fail before implementation
- Follow constitution: alert semantics, UTC timestamps, idempotent inserts, no alert caps
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Report CI failures immediately - they block merge
