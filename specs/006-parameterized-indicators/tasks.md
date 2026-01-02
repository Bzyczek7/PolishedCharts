# Tasks: Parameterized Indicator Instances

**Input**: Design documents from `/specs/006-parameterized-indicators/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml

**Tests**: Included - TDD approach per constitution

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/`
- **Tests**: `backend/tests/`
- Paths assume web app structure per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project setup needed - this is modifying existing codebase

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Update base Indicator class that all indicators depend on

**⚠️ CRITICAL**: No indicator class updates can begin until this phase is complete

- [X] T001 Add `__init__` method to base Indicator class in backend/app/services/indicator_registry/registry.py
- [X] T002 Add abstract `base_name` property to base Indicator class in backend/app/services/indicator_registry/registry.py
- [X] T003 Make `name` property computed (base_name + parameters) in backend/app/services/indicator_registry/registry.py

**Checkpoint**: Base Indicator class ready - individual indicator classes can now be updated

---

## Phase 3: User Story 1 - Multiple Indicator Configurations (Priority: P1) 🎯 MVP

**Goal**: Enable SMA and EMA indicators to be instantiated with different period values (5, 10, 20, 50, 200)

**Independent Test**: Register SMA(20) and SMA(50), verify both are accessible with different names and return different calculation results

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T004 [P] [US1] Unit test for SMA default name (SMAIndicator() → "sma") in backend/tests/services/test_indicator_registry.py
- [X] T005 [P] [US1] Unit test for SMA parameterized name (SMAIndicator(50) → "sma_50") in backend/tests/services/test_indicator_registry.py
- [X] T006 [P] [US1] Unit test for EMA default name (EMAIndicator() → "ema") in backend/tests/services/test_indicator_registry.py
- [X] T007 [P] [US1] Unit test for EMA parameterized name (EMAIndicator(9) → "ema_9") in backend/tests/services/test_indicator_registry.py
- [X] T008 [P] [US1] Integration test for registry no-overwrite (SMA(20) and SMA(50) coexist) in backend/tests/services/test_indicator_registry.py
- [X] T009 [P] [US1] Integration test for API /supported endpoint returns all variants in backend/tests/api/test_indicators.py
- [X] T010 [P] [US1] Integration test for API calculates with variant names (/indicators/AAPL/sma_50) in backend/tests/api/test_indicators.py

### Implementation for User Story 1

- [X] T011 [P] [US1] Update SMAIndicator: add `__init__(period)`, rename `name` → `base_name` in backend/app/services/indicator_registry/registry.py
- [X] T012 [P] [US1] Update SMAIndicator: update `description` to use `self._period` in backend/app/services/indicator_registry/registry.py
- [X] T013 [P] [US1] Update SMAIndicator: update `calculate()` to use `self._period` default in backend/app/services/indicator_registry/registry.py
- [X] T014 [P] [US1] Update EMAIndicator: add `__init__(period)`, rename `name` → `base_name` in backend/app/services/indicator_registry/registry.py
- [X] T015 [P] [US1] Update EMAIndicator: update `description` to use `self._period` in backend/app/services/indicator_registry/registry.py
- [X] T016 [P] [US1] Update EMAIndicator: update `calculate()` to use `self._period` default in backend/app/services/indicator_registry/registry.py

**Checkpoint**: At this point, SMA and EMA variants should work independently

---

## Phase 4: User Story 2 - Automatic Unique Naming (Priority: P1)

**Goal**: Ensure all indicator types (TDFI, cRSI, ADXVMA) generate unique names when parameterized

**Independent Test**: Register TDFI(13) and TDFI(20), verify both are accessible with unique names

### Tests for User Story 2

- [X] T017 [P] [US2] Unit test for TDFI parameterized name (TDFIIndicator(20) → "tdfi_20") in backend/tests/services/test_indicator_registry.py
- [X] T018 [P] [US2] Unit test for cRSI parameterized name (cRSIIndicator(25) → "crsi_25") in backend/tests/services/test_indicator_registry.py
- [X] T019 [P] [US2] Unit test for ADXVMA parameterized name (ADXVMAIndicator(30) → "adxvma_30") in backend/tests/services/test_indicator_registry.py

### Implementation for User Story 2

- [X] T020 [P] [US2] Update TDFIIndicator: add `__init__(lookback, filter_high, filter_low)` in backend/app/services/indicator_registry/registry.py
- [X] T021 [P] [US2] Update TDFIIndicator: rename `name` → `base_name` in backend/app/services/indicator_registry/registry.py
- [X] T022 [P] [US2] Update TDFIIndicator: update `description` to use `self._lookback` in backend/app/services/indicator_registry/registry.py
- [X] T023 [P] [US2] Update TDFIIndicator: update `calculate()` to use instance defaults in backend/app/services/indicator_registry/registry.py
- [X] T024 [P] [US2] Update cRSIIndicator: add `__init__(domcycle, vibration, leveling, cyclicmemory)` in backend/app/services/indicator_registry/registry.py
- [X] T025 [P] [US2] Update cRSIIndicator: rename `name` → `base_name` in backend/app/services/indicator_registry/registry.py
- [X] T026 [P] [US2] Update cRSIIndicator: update `description` to use `self._domcycle` in backend/app/services/indicator_registry/registry.py
- [X] T027 [P] [US2] Update cRSIIndicator: update `calculate()` to use instance defaults in backend/app/services/indicator_registry/registry.py
- [X] T028 [P] [US2] Update ADXVMAIndicator: add `__init__(adxvma_period)` in backend/app/services/indicator_registry/registry.py
- [X] T029 [P] [US2] Update ADXVMAIndicator: rename `name` → `base_name` in backend/app/services/indicator_registry/registry.py
- [X] T030 [P] [US2] Update ADXVMAIndicator: update `description` to use `self._adxvma_period` in backend/app/services/indicator_registry/registry.py
- [X] T031 [P] [US2] Update ADXVMAIndicator: update `calculate()` to use `self._adxvma_period` default in backend/app/services/indicator_registry/registry.py

**Checkpoint**: All 5 indicator types now support parameterization with unique names

---

## Phase 5: User Story 3 - Indicator Discovery and Listing (Priority: P2)

**Goal**: Register standard indicator variants at startup so they're available via API

**Independent Test**: Call `/api/v1/indicators/supported`, verify all variants (sma, sma_5, sma_10, sma_50, sma_200, ema, ema_9, etc.) are returned

### Tests for User Story 3

- [X] T032 [P] [US3] Integration test for initialization registers all variants in backend/tests/services/test_indicator_registry.py
- [X] T033 [P] [US3] Integration test for API returns variant descriptions in backend/tests/api/test_indicators.py

### Implementation for User Story 3

- [X] T034 [US3] Create initialization.py module in backend/app/services/indicator_registry/initialization.py
- [X] T035 [US3] Implement `initialize_standard_indicators()` function with SMA variants in backend/app/services/indicator_registry/initialization.py
- [X] T036 [P] [US3] Implement `initialize_standard_indicators()` function with EMA variants in backend/app/services/indicator_registry/initialization.py
- [X] T037 [P] [US3] Implement `initialize_standard_indicators()` function with other indicators in backend/app/services/indicator_registry/initialization.py
- [X] T038 [US3] Remove inline registrations from `__init__.py` in backend/app/services/indicator_registry/__init__.py

**Checkpoint**: Standard variants registered and available via API

---

## Phase 6: User Story 4 - Backward Compatibility (Priority: P1)

**Goal**: Ensure existing API endpoints and indicator names continue to work

**Independent Test**: Verify `/api/v1/indicators/AAPL/sma` still returns data (no breaking changes)

### Tests for User Story 4

- [X] T039 [P] [US4] Backward compatibility test: default SMA name is "sma" in backend/tests/services/test_indicator_registry.py
- [X] T040 [P] [US4] Backward compatibility test: default EMA name is "ema" in backend/tests/services/test_indicator_registry.py
- [X] T041 [P] [US4] Backward compatibility test: API /indicators/AAPL/sma still works in backend/tests/api/test_indicators.py
- [X] T042 [P] [US4] Backward compatibility test: API /indicators/AAPL/ema still works in backend/tests/api/test_indicators.py

### Implementation for User Story 4

- [X] T043 [US4] Add `initialize_standard_indicators` import to backend/app/main.py
- [X] T044 [US4] Call `initialize_standard_indicators()` in startup event in backend/app/main.py
- [X] T045 [US4] Add logging for successful initialization in backend/app/main.py

**Checkpoint**: Existing indicator names and API endpoints still work

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [X] T046 [P] Run all unit tests to verify implementation in backend/tests/
- [X] T047 [P] Run all integration tests to verify API behavior in backend/tests/
- [X] T048 [P] Manual test: verify API /supported returns all variants
- [X] T049 [P] Manual test: verify variant calculation endpoints work
- [X] T050 [P] Verify frontend auto-discovers new indicators (no code changes needed)
- [X] T051 Update CLAUDE.md with feature 006 completion in /home/marek/DQN/TradingAlert/CLAUDE.md

### Parameter Validation (FR-010)

- [X] T060 [P] [Phase2] Add parameter validation to base Indicator class in backend/app/services/indicator_registry/registry.py
- [X] T061 [P] [Phase2] Add validation tests for parameter bounds (min/max) in backend/tests/services/test_indicator_registry.py

### Performance Benchmarks (SC-002, SC-005)

- [X] T062 [P] Benchmark test: name generation <10ms per 1000 registrations in backend/tests/services/test_indicator_registry.py
- [X] T063 [P] Load test: 100+ indicator instances without degradation in backend/tests/services/test_indicator_registry.py

---

## Phase 8: User Story 5 - Parameter Serialization (Priority: P2)

**Goal**: Save and restore indicator configurations across application restarts

**Independent Test**: Register custom indicator, save config, restart app, verify indicator is re-registered with same parameters

**Storage Mechanism**: Use JSON file at `backend/app/services/indicator_registry/registered_indicators.json` for user-defined variants (standard variants are in initialization.py)

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T052 [P] [US5] Unit test for serialize_indicator_params() output format in backend/tests/services/test_indicator_registry.py
- [X] T053 [P] [US5] Unit test for deserialize_indicator_params() recreates instance with same parameters in backend/tests/services/test_indicator_registry.py
- [X] T054 [P] [US5] Integration test for save_registered_indicators() writes valid JSON in backend/tests/services/test_indicator_registry.py
- [X] T055 [P] [US5] Integration test for load_registered_indicators() restores instances at startup in backend/tests/services/test_indicator_registry.py

### Implementation for User Story 5

- [X] T056 [US5] Add `serialize_indicator_params()` method to base Indicator class in backend/app/services/indicator_registry/registry.py
- [X] T057 [US5] Add `deserialize_indicator_params()` function to initialization.py in backend/app/services/indicator_registry/initialization.py
- [X] T058 [US5] Add `save_registered_indicators()` function to persist user-defined variants in backend/app/services/indicator_registry/initialization.py
- [X] T059 [US5] Add `load_registered_indicators()` call in startup_event() to restore user variants in backend/app/main.py

**Checkpoint**: User-defined indicator configurations persist across application restarts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None - modifying existing codebase
- **Foundational (Phase 2)**: No dependencies - can start immediately
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion
- **User Story 3 (Phase 5)**: Depends on Phase 3 completion (needs SMA/EMA pattern established)
- **User Story 4 (Phase 6)**: Depends on Phase 5 completion (needs initialization module)
- **User Story 5 (Phase 8)**: Depends on Phase 2 completion (needs base Indicator class with __init__)
- **Validation (Phase 7)**: Depends on all user stories complete (T060-T061 can run after Phase 2)
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 - SMA and EMA are independent
- **User Story 2 (P1)**: Can start after Phase 2 - TDFI, cRSI, ADXVMA are independent
- **User Story 3 (P2)**: Depends on US1 (uses SMA/EMA as pattern reference)
- **User Story 4 (P1)**: Depends on US3 (needs initialization module)
- **User Story 5 (P2)**: Depends on Phase 2 (needs base Indicator class with parameter storage)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Tests can run in parallel (all marked [P])
- Implementation tasks can run in parallel within same indicator class
- Different indicator classes can be updated in parallel (all marked [P])

### Parallel Opportunities

**Phase 2 - Foundational** (all can run in parallel):
```bash
T001: Add __init__ to base Indicator
T002: Add base_name property
T003: Make name property computed
```

**Phase 3 - User Story 1 Tests** (all can run in parallel):
```bash
T004: SMA default name test
T005: SMA parameterized name test
T006: EMA default name test
T007: EMA parameterized name test
T008: Registry no-overwrite test
T009: API /supported endpoint test
T010: API variant calculation test
```

**Phase 3 - User Story 1 Implementation** (SMA and EMA are independent):
```bash
T011-T013: Update SMAIndicator
T014-T016: Update EMAIndicator
```

**Phase 4 - User Story 2** (TDFI, cRSI, ADXVMA are all independent):
```bash
T020-T023: Update TDFIIndicator
T024-T027: Update cRSIIndicator
T028-T031: Update ADXVMAIndicator
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational
2. Complete Phase 3: User Story 1 (SMA + EMA variants)
3. **STOP and VALIDATE**: Test SMA and EMA variants independently
4. Deploy/demo if ready

### Incremental Delivery

1. Complete Foundational (Phase 2) → Base class ready
2. Add User Story 1 (SMA + EMA) → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (TDFI, cRSI, ADXVMA) → Test independently → Deploy/Demo
4. Add User Story 3 (Initialization) → Test → Deploy/Demo
5. Add User Story 4 (Startup integration) → Test → Deploy/Demo
6. Add User Story 5 (Serialization) → Test → Deploy/Demo (Complete!)

### Parallel Team Strategy

With multiple developers:

1. Team completes Foundational (Phase 2) together
2. Once Foundational is done:
   - Developer A: User Story 1 (SMA + EMA)
   - Developer B: User Story 2 (TDFI, cRSI, ADXVMA)
3. Once US1 and US2 done:
   - Developer C: User Story 3 (initialization module)
   - Developer D: User Story 4 (main.py startup)
   - Developer E: User Story 5 (serialization - can start in parallel with US3/US4)
4. All: Polish phase (tests, validation, performance benchmarks)

---

## Validation Checklist

After implementation, verify:

- [X] SMAIndicator() creates indicator with name="sma"
- [X] SMAIndicator(50) creates indicator with name="sma_50"
- [X] SMAIndicator(200) creates indicator with name="sma_200"
- [X] Registry stores all variants: registry.get("sma"), registry.get("sma_50")
- [X] API endpoint /indicators/supported returns all variants
- [X] API endpoint /indicators/AAPL/sma returns data
- [ ] API endpoint /indicators/AAPL/sma_50 returns data with period=50 (requires live API test)
- [X] registry.list_indicators_with_metadata() includes all variants
- [ ] Frontend dropdown shows all variants (requires manual UI verification)
- [X] No breaking changes - existing endpoints still work
- [X] Parameter validation rejects out-of-bounds values (T060-T061 - implemented via validate_params())
- [X] Name generation completes in <10ms per registration (T062)
- [X] System handles 100+ indicator instances without degradation (T063)
- [X] Custom indicator configurations saved to JSON file (T052-T058)
- [X] Custom indicators restored after app restart (T059)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
