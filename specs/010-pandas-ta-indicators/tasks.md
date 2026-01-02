# Tasks: pandas-ta Indicator Pack

**Input**: Design documents from `/specs/010-pandas-ta-indicators/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests included following TDD approach per Constitution V (Testing and Quality Gates)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/`, `backend/tests/`
- **Frontend**: `frontend/src/` (no changes needed for this feature)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install pandas-ta dependency and verify compatibility

- [X] T001 Add pandas-ta dependency to backend/requirements.txt
- [X] T002 Install pandas-ta library via pip install pandas-ta
- [X] T003 Verify pandas-ta installation by importing and checking version in Python shell

**Checkpoint**: ✅ pandas-ta library installed and ready to use

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core indicator infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Review existing Indicator base class in backend/app/services/indicator_registry/registry.py
- [X] T005 Review existing initialization pattern in backend/app/services/indicator_registry/initialization.py
- [X] T006 Review existing API endpoints in backend/app/api/v1/indicators.py
- [X] T007 Review existing test patterns in backend/tests/services/test_indicator_registry.py

**Checkpoint**: ✅ Foundation ready - indicator implementation can now begin

---

## Phase 3: User Story 1 - Discover and Add pandas-ta Indicators (Priority: P1) 🎯 MVP

**Goal**: Expose 4 pandas-ta indicators (RSI, MACD, BBANDS, ATR) through the Indicator Registry so users can discover and add them to charts

**Independent Test**: Open the IndicatorDialog (which loads from `/indicators/supported`), verify the 4 new indicators appear, add each one to a chart with existing candle data, and confirm values appear and align with candle timestamps

### Tests for User Story 1 (TDD - Write First, Ensure They Fail) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

**Parameterized Unit Tests** (covers all 4 indicators with less duplication):
- [X] T008 [P] [US1] Write parameterized unit test for pandas-ta indicator name generation in backend/tests/services/test_indicator_registry.py (tests RSI, MACD, BBANDS, ATR)
- [X] T009 [P] [US1] Write parameterized unit test for pandas-ta indicator calculation output alignment in backend/tests/services/test_indicator_registry.py (verifies output arrays match input timestamp array length AND metadata.series_metadata.field exists in DataFrame output for all 4 indicators per FR-008 and FR-021)
- [X] T010 [P] [US1] Write parameterized unit test for pandas-ta indicator output JSON safety in backend/tests/services/test_indicator_registry.py (verifies all outputs align to input length and NaN→None conversion for all 4 indicators)
- [X] T011 [P] [US1] Write parameterized unit test for pandas-ta indicator metadata structure in backend/tests/services/test_indicator_registry.py (validates display_type, color_mode, series_metadata for all 4 indicators)
- [X] T012 [P] [US1] Write parameterized unit test for pandas-ta indicator parameter validation in backend/tests/services/test_indicator_registry.py (validates min/max bounds for all 4 indicators)

**Response Key Casing Validation** (CRITICAL - ensures backend JSON keys match frontend expectations):
- [X] T013 [US1] Write integration test to validate response key casing matches canonical contract in backend/tests/api/test_indicators.py (asserts IndicatorOutput.metadata uses snake_case: series_metadata, display_type, color_mode, reference_levels per contracts/indicator-metadata.json and frontend/src/components/types/indicators.ts)

**Indicator-Specific Integration Tests**:
- [X] T014 [US1] Write integration test for GET /api/v1/indicators/supported includes pandas-ta indicators in backend/tests/api/test_indicators.py
- [X] T015 [P] [US1] Write integration test for GET /api/v1/indicators/AAPL/rsi returns valid IndicatorOutput in backend/tests/api/test_indicators.py
- [X] T016 [P] [US1] Write integration test for GET /api/v1/indicators/AAPL/macd returns valid IndicatorOutput in backend/tests/api/test_indicators.py
- [X] T017 [P] [US1] Write integration test for GET /api/v1/indicators/AAPL/bbands returns valid IndicatorOutput in backend/tests/api/test_indicators.py
- [X] T018 [P] [US1] Write integration test for GET /api/v1/indicators/AAPL/atr returns valid IndicatorOutput in backend/tests/api/test_indicators.py

**Verify all tests FAIL before proceeding to implementation**

### Implementation for User Story 1

- [X] T019 [P] [US1] Implement RSIIndicator class in backend/app/services/indicator_registry/registry.py
- [X] T020 [P] [US1] Implement MACDIndicator class in backend/app/services/indicator_registry/registry.py
- [X] T021 [P] [US1] Implement BBANDSIndicator class in backend/app/services/indicator_registry/registry.py
- [X] T022 [P] [US1] Implement ATRIndicator class in backend/app/services/indicator_registry/registry.py
- [X] T023 [US1] Register RSIIndicator in backend/app/services/indicator_registry/initialization.py (depends on T019)
- [X] T024 [US1] Register MACDIndicator in backend/app/services/indicator_registry/initialization.py (depends on T020)
- [X] T025 [US1] Register BBANDSIndicator in backend/app/services/indicator_registry/initialization.py (depends on T021)
- [X] T026 [US1] Register ATRIndicator in backend/app/services/indicator_registry/initialization.py (depends on T022)
- [X] T027 [US1] Add RSIIndicator to indicator_classes mapping in backend/app/services/indicator_registry/initialization.py
- [X] T028 [US1] Add MACDIndicator to indicator_classes mapping in backend/app/services/indicator_registry/initialization.py
- [X] T029 [US1] Add BBANDSIndicator to indicator_classes mapping in backend/app/services/indicator_registry/initialization.py
- [X] T030 [US1] Add ATRIndicator to indicator_classes mapping in backend/app/services/indicator_registry/initialization.py

**Checkpoint**: ✅ All tests pass - User Story 1 implementation complete. 4 pandas-ta indicators (RSI, MACD, BBANDS, ATR) are now available through the Indicator Registry and can be discovered and added to charts via the existing UI.

---

## Phase 4: User Story 2 - Configure pandas-ta Indicator Parameters (Priority: P2)

**Goal**: Enable users to customize indicator parameters (RSI period, MACD fast/slow/signal, BBANDS length/std, ATR period) through the existing settings UI

**Independent Test**: Add an indicator to a chart, open its settings, change a parameter value, save settings, and verify the indicator recalculates with new values. Try invalid values and verify validation errors appear.

**⚠️ DEPENDENCY**: This user story DEPENDS on User Story 1 completion - all tests require the indicators (RSI, MACD, BBANDS, ATR) to exist from US1

### Tests for User Story 2 (TDD - Write First, Ensure They Fail) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
> **NOTE**: US2 tests validate that the existing parameter plumbing works correctly with the new pandas-ta indicators

- [X] T031 [P] [US2] Write integration test for parameter customization via API in backend/tests/api/test_indicators.py (validates parameter passing for RSI period, MACD fast/slow/signal, BBANDS length/std, ATR period)
- [X] T032 [P] [US2] Write integration test for parameter validation errors in backend/tests/api/test_indicators.py (tests out-of-bounds and type errors)
- [X] T032a [P] [US2] Write integration test for meaningful error messages in backend/tests/api/test_indicators.py (asserts HTTP 400 for validation errors and that the error message includes parameter name, expected range/type, and received value per FR-013 and FR-014)
- [X] T033 [P] [US2] Write integration test for RSI with custom period=21 in backend/tests/api/test_indicators.py
- [X] T034 [P] [US2] Write integration test for MACD with custom fast=8, slow=21 in backend/tests/api/test_indicators.py
- [X] T035 [P] [US2] Write integration test for BBANDS with custom length=10, std=1.5 in backend/tests/api/test_indicators.py
- [X] T036 [P] [US2] Write integration test for ATR with custom period=21 in backend/tests/api/test_indicators.py

**Verify all tests FAIL before proceeding to implementation**

### Implementation for User Story 2

**Note**: Parameter customization is already supported by the existing Indicator Registry architecture. The indicators implemented in US1 already accept dynamic parameters through the API. This phase primarily validates that the feature works correctly.

- [X] T037 [US2] Verify parameter passing works end-to-end by running integration tests (may require adjustments if tests fail)
- [X] T038 [US2] Add logging for parameter validation errors if needed in backend/app/api/v1/indicators.py
- [X] T039 [US2] Document parameter ranges in indicator descriptions if needed

**Checkpoint**: ✅ Run all tests - should now PASS. User Story 2 should be fully functional. Users can customize parameters through existing settings UI.

---

## Phase 5: User Story 3 - Remove and Manage pandas-ta Indicators (Priority: P3)

**Goal**: Enable users to remove pandas-ta indicators from charts and manage indicator instances

**Independent Test**: Add multiple indicators to a chart, remove one, verify it disappears while others remain. Refresh the chart and verify the removed indicator does not reappear.

**⚠️ DEPENDENCY**: This user story DEPENDS on User Story 1 completion - requires the indicators (RSI, MACD, BBANDS, ATR) to exist from US1

**Note**: Frontend changes are NOT needed for this feature - the existing metadata-driven rendering system and indicator management UI should automatically work with pandas-ta indicators. This phase uses manual verification instead of frontend tests.

### Manual Verification for User Story 3

- [ ] T040 [US3] Manual test: Add RSI, MACD, BBANDS, and ATR to a chart, then remove one indicator and verify it disappears while others remain
- [ ] T041 [US3] Manual test: Remove all pandas-ta indicators, verify they disappear from chart
- [ ] T042 [US3] Manual test: After removing indicators, open IndicatorDialog and verify pandas-ta indicators are still available to add
- [ ] T043 [US3] Manual test: If indicator persistence is implemented, verify removed indicators do not reappear after chart refresh

**Checkpoint**: Manual verification complete. User Story 3 should be fully functional. Users can add and remove pandas-ta indicators just like existing indicators.

---

## Phase 6: User Story 4 - Access All pandas-ta Indicators (Priority: P4 - Phase 2)

**Goal**: Expose all 130+ pandas-ta indicators through the existing integration pattern

**Prerequisites**: Phase 1 (User Stories 1-3) must be complete and approved by the user

**Independent Test**: Query the supported indicators API and confirm 130+ pandas-ta indicators appear. Add a diverse set of indicators to verify they work.

### Implementation for User Story 4

- [ ] T044 [US4] Research pandas-ta library to identify all available indicators
- [ ] T045 [US4] Design auto-discovery mechanism for pandas-ta indicators
- [ ] T046 [US4] Implement generic pandas-ta indicator wrapper class in backend/app/services/indicator_registry/pandas_ta_wrapper.py
- [ ] T047 [US4] Implement auto-discovery and registration function in backend/app/services/indicator_registry/initialization.py
- [ ] T048 [US4] Add tests for representative indicators from each category in backend/tests/services/test_pandas_ta_auto_discovery.py
- [ ] T049 [US4] Document any indicators that cannot be auto-exposed with reasons in specs/010-pandas-ta-indicators/exclusions.md

**Checkpoint**: All 130+ pandas-ta indicators exposed and tested. User can access any indicator from the library.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T050 [P] Update CLAUDE.md with pandas-ta dependency information and application name (PolishedCharts)
- [X] T051 Run all unit tests and ensure 100% pass rate (39 passed)
- [X] T052 Run all integration tests and ensure 100% pass rate (47 passed)
- [ ] T053 Manual testing: Open IndicatorDialog and verify all 4 pandas-ta indicators appear
- [ ] T054 Manual testing: Add each indicator to a chart and verify rendering is correct
- [ ] T055 Manual testing: Change parameters for each indicator and verify recalculation works
- [ ] T056 Manual testing: Remove indicators and verify they disappear correctly
- [ ] T057 Performance test: Verify calculations complete within 2 seconds for 1000 candles and within 10 seconds for 10,000 candles (per SC-002 and SC-003)
- [ ] T058 Memory test: Verify no memory leaks with multiple indicator calculations
- [ ] T059 Document pandas-ta integration in README or docs folder
- [ ] T059a [US1-US4] Generate Parity Report for pandas-ta indicators in specs/010-pandas-ta-indicators/parity_report.md (documents indicator values on deterministic datasets, axis bounds / scale_ranges, reference_levels / thresholds, color_mode / color schemes, and calculation methodology; compare against TradingView per FR-015 and FR-016)
- [ ] T060 Run quickstart.md validation from specs/010-pandas-ta-indicators/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Stories 1-3 can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
  - User Story 4 is Phase 2 and requires explicit user approval of Phase 1
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: **DEPENDS ON US1** - Requires indicators (RSI, MACD, BBANDS, ATR) to exist from US1
- **User Story 3 (P3)**: **DEPENDS ON US1** - Requires indicators (RSI, MACD, BBANDS, ATR) to exist from US1
- **User Story 4 (P4 - Phase 2)**: Requires US1-US3 complete and user approval - extends the proven pattern

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Tests marked [P] within a story can run in parallel
- Indicator classes marked [P] can be implemented in parallel
- Registration depends on indicator class creation
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: All tasks can run sequentially (install, verify)
- **Phase 2**: All review tasks marked [P] can run in parallel (different files)
- **Phase 3 (US1)**:
  - All parameterized tests (T008-T012) can run in parallel
  - All indicator-specific integration tests (T015-T018) can run in parallel
  - All indicator classes (T019-T022) can be implemented in parallel
  - Registrations (T023-T030) must follow indicator class creation
- **Phase 4 (US2)**: All tests (T031-T036) can run in parallel
- **Phase 5 (US3)**: Manual tests (T040-T043) can be executed in any order
- **Phase 7**: Most tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1 Test & Implementation

```bash
# Launch all parameterized unit tests together (in separate terminals/shells):
Terminal 1: "Write parameterized unit test for pandas-ta indicator name generation in backend/tests/services/test_indicator_registry.py"
Terminal 2: "Write parameterized unit test for pandas-ta indicator calculation output alignment in backend/tests/services/test_indicator_registry.py"
Terminal 3: "Write parameterized unit test for pandas-ta indicator output JSON safety in backend/tests/services/test_indicator_registry.py"
Terminal 4: "Write parameterized unit test for pandas-ta indicator metadata structure in backend/tests/services/test_indicator_registry.py"
Terminal 5: "Write parameterized unit test for pandas-ta indicator parameter validation in backend/tests/services/test_indicator_registry.py"

# Launch all 4 indicator implementations together:
Terminal 1: "Implement RSIIndicator class in backend/app/services/indicator_registry/registry.py"
Terminal 2: "Implement MACDIndicator class in backend/app/services/indicator_registry/registry.py"
Terminal 3: "Implement BBANDSIndicator class in backend/app/services/indicator_registry/registry.py"
Terminal 4: "Implement ATRIndicator class in backend/app/services/indicator_registry/registry.py"

# Once complete, launch all registrations together:
Terminal 1: "Register RSIIndicator in backend/app/services/indicator_registry/initialization.py"
Terminal 2: "Register MACDIndicator in backend/app/services/indicator_registry/initialization.py"
Terminal 3: "Register BBANDSIndicator in backend/app/services/indicator_registry/initialization.py"
Terminal 4: "Register ATRIndicator in backend/app/services/indicator_registry/initialization.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install pandas-ta)
2. Complete Phase 2: Foundational (review existing code)
3. Complete Phase 3: User Story 1 (TDD tests + indicator implementation)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Open IndicatorDialog
   - Verify RSI, MACD, BBANDS, ATR appear
   - Add each indicator to a chart
   - Verify rendering is correct
5. Get user approval before proceeding to Phase 2 (US4)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **Deploy/Demo (MVP!)**
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories
6. After user approval: Add User Story 4 (Phase 2) → Full library exposure

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: RSIIndicator (US1)
   - Developer B: MACDIndicator (US1)
   - Developer C: BBANDSIndicator (US1)
   - Developer D: ATRIndicator (US1)
3. Tests run in parallel across all indicators
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- TDD approach: Write tests FIRST, ensure they FAIL, then implement
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Frontend changes are NOT needed - existing metadata-driven rendering handles new indicators automatically
- API endpoint changes are NOT needed - existing registry pattern handles new indicators
- Avoid: vague tasks, same file conflicts (use parallel execution carefully), cross-story dependencies that break independence

---

## Task Summary

- **Total Tasks**: 62 (increased from 60 to address constitution compliance and coverage gaps)
- **Setup Phase**: 3 tasks
- **Foundational Phase**: 4 tasks
- **User Story 1 (P1)**: 23 tasks (11 tests [5 parameterized unit + 1 key casing + 5 integration] + 12 implementation)
- **User Story 2 (P2)**: 10 tasks (7 integration tests + 3 validation)
- **User Story 3 (P3)**: 4 tasks (manual verification only - no code changes)
- **User Story 4 (P4 - Phase 2)**: 6 tasks (implementation only)
- **Polish Phase**: 12 tasks (includes T057 updated for 10k performance, T059a for Parity Report)
- **Parallel Opportunities**: 36+ tasks marked [P] can run in parallel with appropriate coordination
- **Independent Test Criteria**: Each user story has clear independent test criteria
- **Suggested MVP Scope**: User Story 1 only (cornerstone indicators RSI, MACD, BBANDS, ATR)

**Key Improvements**:
- ✅ Consolidated 16 per-indicator unit tests into 5 parameterized tests (better ROI, less maintenance)
- ✅ Added response key casing validation task (T013) to assert JSON uses canonical snake_case per contracts/indicator-metadata.json and frontend/src/components/types/indicators.ts
- ✅ Fixed US2/US3 dependencies - correctly marked as depending on US1 completion
- ✅ Replaced US3 frontend tests with manual verification (no frontend changes needed)
- ✅ **NEW**: Updated T009 to explicitly validate array length alignment (FR-008, FR-021)
- ✅ **NEW**: Added T032a to test meaningful error messages (FR-013, FR-014)
- ✅ **NEW**: Updated T057 to test both 1k and 10k candle performance (SC-002, SC-003)
- ✅ **NEW**: Added T059a to generate Parity Report (Constitution Principle I compliance, FR-015, FR-016)

**Format Validation**: ✅ ALL tasks follow the checklist format with checkbox, ID, labels, and file paths
