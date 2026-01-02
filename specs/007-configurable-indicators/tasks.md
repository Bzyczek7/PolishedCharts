# Tasks: Configurable Indicator Instances

**Input**: Design documents from `/specs/007-configurable-indicators/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Tests are REQUIRED for this feature (specified in spec.md - "Testing Strategy" section)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/` for source, `backend/tests/` for tests
- **Frontend**: `frontend/src/` for source, `frontend/src/` for components

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify existing indicator registry architecture in `backend/app/services/indicator_registry/`
- [X] T002 Review existing API endpoints in `backend/app/api/v1/indicators.py`
- [X] T003 [P] Review test infrastructure in `backend/tests/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add `get_by_base_name()` method to `IndicatorRegistry` class in `backend/app/services/indicator_registry/registry.py`
  - Method signature: `def get_by_base_name(self, base_name: str) -> Optional[Indicator]`
  - Lookup indicator by `base_name` property (case-insensitive)
  - Return None if not found
- [X] T005 Add query parameter extraction utility in `backend/app/api/v1/indicators.py`
  - Function to extract and normalize query parameters from FastAPI `Query` dependencies
  - Support parameter name normalization (camelCase to snake_case)
  - Handle type conversion (string to int/float)
- [X] T006 Update parameter validation in `backend/app/api/v1/indicators.py`
  - Extract parameter definitions from indicator's `parameter_definitions` property
  - Validate types against ParameterDefinition.type
  - Validate ranges against ParameterDefinition.min/max
  - Return HTTP 400 with descriptive error message on validation failure

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Configure SMA with Custom Period (Priority: P1) 🎯 MVP

**Goal**: Enable users to request SMA indicator data with any period value via query parameters (e.g., `?period=50`)

**Independent Test**: Request SMA with period=20, period=50, period=200 and verify each returns correct calculated values with different period-specific results

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

 [X] T007 [P] [US1] Unit test `test_sma_default_period()` in `backend/tests/api/test_indicators.py` - Verify SMA uses period=20 when no parameter provided
 [X] T008 [P] [US1] Unit test `test_sma_custom_period()` in `backend/tests/api/test_indicators.py` - Verify SMA uses provided period value (50)
 [X] T009 [P] [US1] Unit test `test_sma_period_validation()` in `backend/tests/api/test_indicators.py` - Verify period=0 and period=1000 return 400 errors
 [X] T010 [P] [US1] Integration test `test_api_sma_with_query_params()` in `backend/tests/api/test_indicators.py` - Verify GET /indicators/AAPL/sma?period=50 works end-to-end
 [X] T011 [P] [US1] Performance test `test_sma_request_under_100ms()` in `backend/tests/api/test_indicators.py` - Benchmark indicator request performance

### Implementation for User Story 1

 [X] T012 [US1] Add query parameter support for SMA in `backend/app/api/v1/indicators.py`
  - Add `period: Optional[int] = Query(None)` parameter to `get_indicator()` endpoint
  - Extract and validate period parameter against SMA parameter_definitions (min=1, max=500, default=20)
  - Pass validated period to `indicator.calculate(df, period=value)`
 [X] T013 [US1] Update SMA indicator to accept kwargs period in `backend/app/services/indicator_registry/registry.py`
  - Ensure `SMAIndicator.calculate()` method accepts `period` kwargs
  - Use kwargs period if provided, otherwise use instance default
 [X] T014 [US1] Add error response for invalid SMA period in `backend/app/api/v1/indicators.py`
  - Return 400 with message: "SMA period must be between 1 and 500, got {value}"
  - Include parameter name and valid range in response

**Checkpoint**: At this point, User Story 1 should be fully functional - test with `curl "http://localhost:8000/api/v1/indicators/AAPL/sma?period=50"`

---

## Phase 4: User Story 2 - Configure EMA with Custom Period (Priority: P1)

**Goal**: Enable users to request EMA indicator data with any period value via query parameters

**Independent Test**: Request EMA with periods 9, 12, 20, 26, 50, 200 and verify each returns correct calculated values

### Tests for User Story 2 ⚠️

 [X] T015 [P] [US2] Unit test `test_ema_default_period()` in `backend/tests/api/test_indicators.py` - Verify EMA uses period=20 when no parameter provided
 [X] T016 [P] [US2] Unit test `test_ema_custom_period()` in `backend/tests/api/test_indicators.py` - Verify EMA uses provided period value (9)
 [X] T017 [P] [US2] Unit test `test_ema_period_validation()` in `backend/tests/api/test_indicators.py` - Verify period=0 and period=1000 return 400 errors
 [X] T018 [P] [US2] Integration test `test_api_ema_with_query_params()` in `backend/tests/api/test_indicators.py` - Verify GET /indicators/AAPL/ema?period=9 works end-to-end

### Implementation for User Story 2

 [X] T019 [US2] Add query parameter support for EMA in `backend/app/api/v1/indicators.py`
  - Reuse existing `period: Optional[int] = Query(None)` parameter
  - Extract and validate period parameter against EMA parameter_definitions (min=1, max=500, default=20)
  - Pass validated period to EMA indicator calculation
 [X] T020 [US2] Update EMA indicator to accept kwargs period in `backend/app/services/indicator_registry/registry.py`
  - Ensure `EMAIndicator.calculate()` method accepts `period` kwargs
  - Use kwargs period if provided, otherwise use instance default
 [X] T021 [US2] Add error response for invalid EMA period in `backend/app/api/v1/indicators.py`
  - Return 400 with message: "EMA period must be between 1 and 500, got {value}"

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Configure Multi-Parameter Indicators (Priority: P2)

**Goal**: Enable users to request indicators with multiple parameters (TDFI, cRSI, ADXVMA) via query parameters

**Independent Test**: Request cRSI with different parameter combinations and verify calculations are correct

### Tests for User Story 3 ⚠️

 [X] T022 [P] [US3] Unit test `test_tdfi_custom_params()` in `backend/tests/api/test_indicators.py` - Verify TDFI with lookback=20 works
 [X] T023 [P] [US3] Unit test `test_crsi_multiple_parameters()` in `backend/tests/api/test_indicators.py` - Verify cRSI with all parameters works
 [X] T024 [P] [US3] Unit test `test_crsi_partial_parameters()` in `backend/tests/api/test_indicators.py` - Verify partial parameters use defaults
 [X] T025 [P] [US3] Unit test `test_crsi_parameter_validation()` in `backend/tests/api/test_indicators.py` - Verify parameter bounds enforced
 [X] T026 [P] [US3] Unit test `test_adxvma_custom_period()` in `backend/tests/api/test_indicators.py` - Verify ADXVMA with adxvma_period=20 works
 [X] T027 [P] [US3] Integration test `test_api_multi_param_indicators()` in `backend/tests/api/test_indicators.py` - Verify GET /indicators/AAPL/crsi?dom_cycle=20&vibration=14 works

### Implementation for User Story 3

 [X] T028 [P] [US3] Add TDFI query parameters in `backend/app/api/v1/indicators.py`
  - Add `lookback: Optional[int] = Query(None)`, `filter_high: Optional[float] = Query(None)`, `filter_low: Optional[float] = Query(None)`
  - Validate against TDFI parameter_definitions
  - Pass to `indicator.calculate(df, lookback=value, filter_high=value, filter_low=value)`
 [X] T029 [P] [US3] Add cRSI query parameters in `backend/app/api/v1/indicators.py`
  - Add `dom_cycle: Optional[int] = Query(None)`, `vibration: Optional[int] = Query(None)`, `leveling: Optional[float] = Query(None)`, `cyclic_memory: Optional[int] = Query(None)`
  - Validate against cRSI parameter_definitions
  - Pass to indicator calculation
 [X] T030 [P] [US3] Add ADXVMA query parameters in `backend/app/api/v1/indicators.py`
  - Add `adxvma_period: Optional[int] = Query(None)`
  - Validate against ADXVMA parameter_definitions
  - Pass to indicator calculation
 [X] T031 [US3] Update TDFI indicator to accept kwargs in `backend/app/services/indicator_registry/registry.py`
 [X] T032 [US3] Update cRSI indicator to accept kwargs in `backend/app/services/indicator_registry/registry.py`
 [X] T033 [US3] Update ADXVMA indicator to accept kwargs in `backend/app/services/indicator_registry/registry.py`

**Checkpoint**: All multi-parameter indicators should now work with query parameters

---

## Phase 6: User Story 4 - Maintain Backward Compatibility (Priority: P1)

**Goal**: Ensure existing API consumers continue working without breaking changes

**Independent Test**: Request SMA and EMA without parameters and verify they return the same results as before

### Tests for User Story 4 ⚠️

 [X] T034 [P] [US4] Integration test `test_backward_compatibility_sma_no_params()` in `backend/tests/api/test_indicators.py` - Verify /indicators/AAPL/sma works with default period=20
 [X] T035 [P] [US4] Integration test `test_backward_compatibility_ema_no_params()` in `backend/tests/api/test_indicators.py` - Verify /indicators/AAPL/ema works with default period=20
 [X] T036 [P] [US4] Integration test `test_existing_endpoints_unchanged()` in `backend/tests/api/test_indicators.py` - Verify all existing endpoints work unchanged
 [X] T037 [P] [US4] Integration test `test_params_json_string_backward_compat()` in `backend/tests/api/test_indicators.py` - Verify legacy `?params={"period":50}` format still works

### Implementation for User Story 4

 [X] T038 [US4] Ensure default parameter values are applied in `backend/app/api/v1/indicators.py`
  - When no query parameters provided, use indicator's default values from parameter_definitions
  - Verify SMA defaults to period=20, EMA defaults to period=20
 [X] T039 [US4] Maintain support for legacy `params` JSON string in `backend/app/api/v1/indicators.py`
  - Keep existing `params: Optional[str] = Query(None)` parameter
  - Parse JSON string and merge with query parameters (query params take precedence)
 [X] T040 [US4] Add test for parameter precedence in `backend/tests/api/test_indicators.py`
  - Verify query params override JSON params when both provided

**Checkpoint**: Backward compatibility verified - all existing API consumers continue working

---

## Phase 7: User Story 5 - Discover Available Indicators (Priority: P2)

**Goal**: Enable users to discover all available indicators and their configurable parameters

**Independent Test**: Query `/api/v1/indicators/supported` and verify all indicators displayed with parameter definitions

### Tests for User Story 5 ⚠️

 [X] T041 [P] [US5] Integration test `test_api_supported_endpoint()` in `backend/tests/api/test_indicators.py` - Verify /api/v1/indicators/supported returns all indicators with parameters
 [X] T042 [P] [US5] Integration test `test_parameter_definitions_in_response()` in `backend/tests/api/test_indicators.py` - Verify parameters, types, and valid ranges are documented

### Implementation for User Story 5

 [X] T043 [US5] Verify `/supported` endpoint includes parameter definitions in `backend/app/api/v1/indicators.py`
  - Ensure `list_indicators_with_metadata()` returns parameter_definitions for each indicator
  - Verify parameter definitions include: name, type, default, min, max, description
 [X] T044 [US5] Update OpenAPI documentation in `backend/app/api/v1/indicators.py`
  - Add query parameter documentation to endpoint docstrings
  - Include parameter validation rules in API spec

**Checkpoint**: Users can discover all indicators and their configurable parameters via API

---

## Phase 8: Frontend Integration

**Goal**: Update frontend to use query parameters instead of JSON params

 [X] T045 [P] Update `useIndicatorData` hook in `frontend/src/hooks/useIndicatorData.ts`
  - Modify `getIndicator()` to build query string from params object
  - Use `URLSearchParams` to construct query parameters
  - Pass query string to API endpoint
 [X] T046 [P] Update `chartHelpers.ts` in `frontend/src/utils/chartHelpers.ts`
  - Update URL building functions to use query parameters
  - Add helper function to convert params object to query string
 [X] T047 [P] Add TypeScript interfaces for query parameters in `frontend/src/hooks/useIndicatorData.ts`
  - Define `IndicatorParams` interface with all indicator parameters
  - Ensure type safety for parameter values

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T048 [P] Performance test `test_concurrent_requests_100_plus()` in `backend/tests/api/test_indicators.py` - Verify 100+ concurrent requests handled without degradation (SC-005)
- [ ] T049 [P] Add comprehensive error response tests in `backend/tests/api/test_indicators.py`
  - Test unknown indicator returns 404 with available list
  - Test invalid parameter type returns 400
  - Test parameter out of range returns 400 with valid range
- [ ] T050 [P] Update OpenAPI spec in `specs/007-configurable-indicators/contracts/openapi.yaml`
  - Document all query parameters for each indicator
  - Include validation rules and error responses
 [X] T051 Run quickstart.md validation examples
  - Test all curl examples from quickstart.md
  - Verify all return correct responses
- [ ] T052 Update CLAUDE.md with new technology stack if needed
  - Already done by agent context update script

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed) or in priority order (P1 → P2)
- **Frontend Integration (Phase 8)**: Depends on backend API completion (US1-US4)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (shares `period` parameter handling with US1)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P1)**: Can start after US1 and US2 - Verifies backward compatibility of both
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - Independent discovery endpoint

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD approach per spec.md)
- Tests marked [P] can be written in parallel
- Implementation tasks follow test tasks
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: All review tasks marked [P] can run in parallel
- Phase 2: T005 and T006 can be developed in parallel (different functions)
- Phase 3 (US1): Tests T007-T011 can be written in parallel
- Phase 4 (US2): Tests T015-T018 can be written in parallel
- Phase 5 (US3): Tests T022-T027 can be written in parallel; T028-T030 can be implemented in parallel
- Phase 6 (US4): Tests T034-T037 can be written in parallel
- Phase 7 (US5): Tests T041-T042 can be written in parallel
- Phase 8: T045-T047 can be done in parallel (different files)
- Phase 9: T048-T051 can be done in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (TDD - write first):
Task: "Unit test test_sma_default_period() in backend/tests/api/test_indicators.py"
Task: "Unit test test_sma_custom_period() in backend/tests/api/test_indicators.py"
Task: "Unit test test_sma_period_validation() in backend/tests/api/test_indicators.py"
Task: "Integration test test_api_sma_with_query_params() in backend/tests/api/test_indicators.py"
Task: "Performance test test_sma_request_under_100ms() in backend/tests/api/test_indicators.py"

# After tests fail, implement features:
Task: "Add query parameter support for SMA in backend/app/api/v1/indicators.py"
Task: "Update SMA indicator to accept kwargs period in backend/app/services/indicator_registry/registry.py"
Task: "Add error response for invalid SMA period in backend/app/api/v1/indicators.py"
```

---

## Parallel Example: Multi-Parameter Indicators (User Story 3)

```bash
# Launch all multi-parameter indicator tests together:
Task: "Unit test test_tdfi_custom_params() in backend/tests/api/test_indicators.py"
Task: "Unit test test_crsi_multiple_parameters() in backend/tests/api/test_indicators.py"
Task: "Unit test test_adxvma_custom_period() in backend/tests/api/test_indicators.py"

# Launch all multi-parameter implementations in parallel:
Task: "Add TDFI query parameters in backend/app/api/v1/indicators.py"
Task: "Add cRSI query parameters in backend/app/api/v1/indicators.py"
Task: "Add ADXVMA query parameters in backend/app/api/v1/indicators.py"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (SMA with custom period)
4. Complete Phase 4: User Story 2 (EMA with custom period)
5. **STOP and VALIDATE**: Test SMA and EMA independently with various periods
6. Deploy/demo if ready

**MVP delivers**: Core value - dynamic SMA and EMA configuration without pre-registration

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + 2 (SMA/EMA) → Test independently → Deploy/Demo (MVP!)
3. Add User Story 3 (Multi-parameter) → Test independently → Deploy/Demo
4. Add User Story 4 (Backward compatibility verification) → Verify → Deploy/Demo
5. Add User Story 5 (Discovery endpoint) → Test → Deploy/Demo
6. Add Frontend integration → End-to-end test → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (SMA) + User Story 2 (EMA)
   - Developer B: User Story 3 (Multi-parameter: TDFI, cRSI, ADXVMA)
   - Developer C: User Story 5 (Discovery endpoint)
3. Developer A + B: User Story 4 (Backward compatibility verification)
4. All: Frontend integration (Phase 8)
5. All: Polish and performance tests (Phase 9)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests use TDD approach: write tests FIRST, ensure they FAIL, then implement
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Spec.md requires comprehensive testing strategy - all test tasks are mandatory
- Existing Feature 006 infrastructure provides foundation; Feature 007 adds query parameter support to API layer
