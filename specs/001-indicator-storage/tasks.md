# Tasks: Indicator Database Storage

**Input**: Design documents from `/specs/001-indicator-storage/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Tests are REQUIRED for this feature (Constitution: TDD for core merge logic, CI includes tests)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a **web application** with separate backend and frontend:
- **Backend**: `backend/app/` for source, `backend/tests/` for tests
- **Frontend**: `frontend/src/` for source, `frontend/src/tests/` or `frontend/__tests__/` for tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verify existing codebase structure

- [X] T001 Verify backend project structure at `backend/app/` exists with FastAPI setup
- [X] T002 Verify frontend project structure at `frontend/src/` exists with React setup
- [X] T003 [P] Verify PostgreSQL database connectivity and SQLAlchemy async session configuration in `backend/app/db/session.py`
- [X] T004 [P] Verify Firebase authentication middleware exists in `backend/app/services/auth_middleware.py`
- [X] T005 [P] Review existing Alert/UserWatchlist/Layout models in `backend/app/models/` to understand patterns for IndicatorConfig

**Checkpoint**: Existing project structure verified - ready to implement new feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database model and API infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create IndicatorConfig database model in `backend/app/models/indicator_config.py` with composite unique constraint on (user_id, uuid)
- [X] T007 Add IndicatorConfig export to `backend/app/models/__init__.py`
- [X] T008 Generate Alembic migration for indicator_configs table: `alembic revision --autogenerate -m "Add indicator_configs table"`
- [X] T009 Run Alembic migration to create indicator_configs table in PostgreSQL
- [X] T010 Verify table creation and constraints in PostgreSQL (check `uq_indicator_config_user_uuid` constraint exists)
- [X] T011 Create Pydantic request/response schemas in `backend/app/api/v1/indicator_configs.py` (IndicatorStyle, IndicatorConfigCreate, IndicatorConfigUpdate, IndicatorConfigResponse)
- [X] T012 Implement GET /indicator-configs endpoint in `backend/app/api/v1/indicator_configs.py` to retrieve all indicators for authenticated user
- [X] T013 Implement POST /indicator-configs endpoint in `backend/app/api/v1/indicator_configs.py` to create new indicator configuration
- [X] T014 Implement PUT /indicator-configs/{uuid} endpoint in `backend/app/api/v1/indicator_configs.py` to update existing indicator
- [X] T015 Implement DELETE /indicator-configs/{uuid} endpoint in `backend/app/api/v1/indicator_configs.py` to delete indicator
- [X] T016 Register indicator_configs router in `backend/app/api/api.py` at `/api/v1/indicator-configs`
- [X] T017 Create TypeScript interface GuestIndicator in `frontend/src/types/auth.ts`
- [X] T018 Update LocalStorageData interface to include indicators array in `frontend/src/types/auth.ts`
- [X] T019 Update MergeRequest interface to include indicators array in `frontend/src/types/auth.ts`
- [X] T020 Update MergeResponse interface to include indicators stats in `frontend/src/types/auth.ts`
- [X] T021 Update MergeStatus interface to include indicators count in `frontend/src/types/auth.ts`
- [X] T021a [US1] Implement indicator parameter validation in `backend/app/api/v1/indicator_configs.py` (validate parameter names, types, ranges per indicator specification; reject invalid configs with 400 error)

**Checkpoint**: Foundation ready - API endpoints created, types updated, user story implementation can now begin

---

## Phase 3: User Story 1 - Multi-Device Indicator Sync (Priority: P1) 🎯 MVP

**Goal**: Traders can access their exact same indicator configurations on any device within 2 seconds of signing in. All indicators (parameters, colors, settings) sync across desktop, mobile, and different computers.

**Independent Test**: Create 3 indicators (SMA 20, EMA 50, TDFI) on desktop with specific colors. Sign in on mobile device. Verify all 3 indicators appear with identical parameters and styling. Update indicator color on desktop, refresh mobile, verify color updated. Delete indicator on desktop, verify it's gone on mobile.

### Tests for User Story 1 (REQUIRED - TDD Approach) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T022 [P] [US1] Write contract test for GET /indicator-configs endpoint in `backend/tests/test_indicator_configs.py` (verifies response schema, 200 status, user isolation)
- [X] T023 [P] [US1] Write contract test for POST /indicator-configs endpoint in `backend/tests/test_indicator_configs.py` (verifies creation, 201 status, UUID generation)
- [X] T024 [P] [US1] Write contract test for PUT /indicator-configs/{uuid} endpoint in `backend/tests/test_indicator_configs.py` (verifies update, 200 status, timestamp update)
- [X] T025 [P] [US1] Write contract test for DELETE /indicator-configs/{uuid} endpoint in `backend/tests/test_indicator_configs.py` (verifies deletion, 204 status)
- [X] T026 [P] [US1] Write integration test for multi-device sync in `backend/tests/test_indicator_configs.py` (create indicator as user1, verify user2 cannot see it, verify user1 can retrieve on "second device" via new session)

### Implementation for User Story 1

- [X] T027 [US1] Implement getAuthToken() function in `frontend/src/hooks/useIndicatorInstances.ts` to retrieve Firebase ID token
- [X] T028 [US1] Implement cached axios instance with getAuthClient() in `frontend/src/hooks/useIndicatorInstances.ts` to avoid repeated token fetches (performance optimization)
- [X] T029 [US1] Implement generateUUID() helper function in `frontend/src/hooks/useIndicatorInstances.ts` for creating new indicator IDs
- [X] T030 [US1] Implement createIndicatorInstance() helper function in `frontend/src/hooks/useIndicatorInstances.ts` to create new indicator objects with defaults
- [X] T031 [US1] Refactor loadInstances effect in `frontend/src/hooks/useIndicatorInstances.ts` to call GET /indicator-configs API when authenticated
- [X] T032 [US1] Add API error handling with localStorage fallback in `frontend/src/hooks/useIndicatorInstances.ts` (FR-008: fallback when database unavailable)
- [X] T033 [US1] Refactor addIndicator callback in `frontend/src/hooks/useIndicatorInstances.ts` to call POST /indicator-configs API when authenticated
- [X] T034 [US1] Implement optimistic updates in addIndicator callback in `frontend/src/hooks/useIndicatorInstances.ts` (update UI immediately, rollback on error)
- [X] T035 [US1] Refactor removeIndicator callback in `frontend/src/hooks/useIndicatorInstances.ts` to call DELETE /indicator-configs/{uuid} API when authenticated
- [X] T036 [US1] Refactor updateStyle callback in `frontend/src/hooks/useIndicatorInstances.ts` to call PUT /indicator-configs/{uuid} API when authenticated
- [X] T037 [US1] Refactor updateParams callback in `frontend/src/hooks/useIndicatorInstances.ts` to call PUT /indicator-configs/{uuid} API with indicator_params update
- [X] T038 [US1] Refactor toggleVisibility callback in `frontend/src/hooks/useIndicatorInstances.ts` to call PUT /indicator-configs/{uuid} API with is_visible update
- [X] T039 [US1] Add retry logic with exponential backoff (30-second timeout) in `frontend/src/hooks/useIndicatorInstances.ts` for API failures
- [X] T040 [US1] Add loading and error states to hook return value in `frontend/src/hooks/useIndicatorInstances.ts` for better UX

**Checkpoint**: At this point, User Story 1 should be fully functional - authenticated users can create indicators on one device and see them on another device. Test independently by signing in on two devices/browsers.

---

## Phase 4: User Story 2 - Persistent Indicator Configuration (Priority: P2)

**Goal**: Indicators persist across browser cache clearing, browser switching, and transient database unavailability. Zero data loss when database temporarily unavailable.

**Independent Test**: Configure 5 indicators as authenticated user. Clear browser cache completely. Reopen application and sign in. Verify all 5 indicators restored from database. Test database unavailable scenario: stop backend, create indicator, verify localStorage fallback used, start backend, verify retry syncs to database within 30 seconds.

### Tests for User Story 2 (REQUIRED - TDD Approach) ⚠️

- [X] T041 [P] [US2] Write integration test for localStorage fallback in `frontend/src/hooks/useIndicatorInstances.test.ts` (mock API failure, verify localStorage used)
- [X] T042 [P] [US2] Write integration test for retry logic in `frontend/src/hooks/useIndicatorInstances.test.ts` (mock API 500 error, verify retry with backoff, verify success on retry)
- [X] T043 [P] [US2] Write integration test for optimistic updates rollback in `frontend/src/hooks/useIndicatorInstances.test.ts` (mock API failure after optimistic update, verify state rollback)

### Implementation for User Story 2

- [X] T044 [P] [US2] Implement safeSetItem() helper in `frontend/src/hooks/useIndicatorInstances.ts` with quota-exceeded error handling
- [X] T045 [P] [US2] Implement safeGetItem() helper in `frontend/src/hooks/useIndicatorInstances.ts` with error handling
- [X] T046 [P] [US2] Implement safeRemoveItem() helper in `frontend/src/hooks/useIndicatorInstances.ts` with error handling
- [X] T047 [P] [US2] Implement clearLocalStorage() function in `frontend/src/hooks/useIndicatorInstances.ts` to clean up after successful API sync
- [X] T048 [US2] Add localStorage write scheduling with debounce (100ms) in `frontend/src/hooks/useIndicatorInstances.ts` using scheduleInstanceWrite()
- [X] T049 [US2] Implement flushPendingWrites() function in `frontend/src/hooks/useIndicatorInstances.ts` to persist pending changes on unmount
- [X] T050 [US2] Add useEffect cleanup in `frontend/src/hooks/useIndicatorInstances.ts` to flush pending writes when component unmounts
- [X] T051 [US2] Implement API-to-localStorage fallback logic in loadInstances effect in `frontend/src/hooks/useIndicatorInstances.ts` (try API first, fallback to localStorage on error)
- [X] T052 [US2] Add isOffline state tracking in `frontend/src/hooks/useIndicatorInstances.ts` to show sync status to user
- [X] T053 [US2] Implement automatic retry with exponential backoff in `frontend/src/hooks/useIndicatorInstances.ts` (30-second timeout per SC-003)
- [X] T054 [US2] Add visual sync indicator to UI components consuming useIndicatorInstances hook (show pending sync when isOffline=true)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Test persistence by clearing browser cache and verifying indicators restored from database. Test offline scenario by stopping backend server.

---

## Phase 5: User Story 3 - Guest to Authenticated User Transition (Priority: P3)

**Goal**: Guest users can configure indicators while exploring, and when they sign in/create account, their guest indicators merge with their account without loss.

**Independent Test**: Configure 2 indicators as guest user (not signed in). Sign in with existing account that already has 3 indicators. Verify all 5 indicators visible (2 guest + 3 account). Test with new account: configure indicators as guest, create new account, verify guest indicators now associated with new account.

### Tests for User Story 3 (REQUIRED - TDD Approach) ⚠️

> **NOTE: Merge logic is CRITICAL for data integrity (SC-004: 100% success rate). MUST be test-driven.

- [X] T055 [P] [US3] Write unit test for upsert_indicator_configs() with new user (no existing indicators) in `backend/tests/test_merge_util.py`
- [X] T056 [P] [US3] Write unit test for upsert_indicator_configs() with existing indicators (UUID match) in `backend/tests/test_merge_util.py`
- [X] T057 [P] [US3] Write unit test for upsert_indicator_configs() timestamp conflict resolution (guest newer by >2min) in `backend/tests/test_merge_util.py`
- [X] T058 [P] [US3] Write unit test for upsert_indicator_configs() timestamp conflict resolution (cloud newer or within ±2min) in `backend/tests/test_merge_util.py`
- [X] T059 [P] [US3] Write unit test for upsert_indicator_configs() edge case: exactly 2 minutes apart (deterministic: keep existing) in `backend/tests/test_merge_util.py`
- [X] T060 [P] [US3] Write integration test for guest→auth merge via POST /merge/sync endpoint in `backend/tests/test_merge.py`
- [X] T061 [P] [US3] Write integration test for GET /merge/status endpoint includes indicators count in `backend/tests/test_merge.py`

### Implementation for User Story 3

- [X] T062 [P] [US3] Implement upsert_indicator_configs() function in `backend/app/services/merge_util.py` following upsert_alert() pattern
- [X] T063 [P] [US3] Implement should_update() timestamp comparison helper in `backend/app/services/merge_util.py` (checks if guest > existing + 2 minutes)
- [X] T064 [P] [US3] Add GuestIndicator Pydantic schema to `backend/app/api/v1/merge.py` (id, indicatorType, displayName, style, isVisible, createdAt)
- [X] T065 [P] [US3] Update MergeRequest schema in `backend/app/api/v1/merge.py` to include indicators: List[GuestIndicator]
- [X] T066 [P] [US3] Update MergeResponse schema in `backend/app/api/v1/merge.py` to include indicators stats
- [X] T067 [P] [US3] Update MergeStatus schema in `backend/app/api/v1/merge.py` to include indicators count
- [X] T068 [US3] Add upsert_indicator_configs() import to POST /merge/sync endpoint in `backend/app/api/v1/merge.py`
- [X] T069 [US3] Call upsert_indicator_configs() in POST /merge/sync endpoint in `backend/app/api/v1/merge.py` (pass guest indicators from request)
- [X] T070 [US3] Add indicator count query to GET /merge/status endpoint in `backend/app/api/v1/merge.py` (count IndicatorConfig WHERE user_id = ?)
- [X] T071 [US3] Update frontend merge payload to include indicators array in merge service/hook (collect from localStorage before sending to POST /merge)
- [X] T072 [US3] Clear localStorage indicators after successful merge in frontend merge handler (call clearLocalStorage() after merge succeeds)
- [X] T073 [US3] Reload indicators from API after successful guest→auth merge in frontend (trigger loadInstances effect)

**Checkpoint**: All user stories should now be independently functional. Test guest→auth transition by configuring indicators as guest, then signing in, and verifying all indicators preserved and merged correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Test file creation (Constitution compliance), OpenAPI spec generation, migration script, documentation, performance validation, and CI integration

### Constitution Compliance: Test Files (REQUIRED) ⚠️

> **NOTE: Constitution Check in plan.md shows tests incomplete with [ ] checkboxes. These tasks address those gaps.**

- [X] T074 [P] Create backend test file structure: `backend/tests/test_indicator_configs.py` with pytest fixtures and imports
- [X] T075 [P] Create backend test file structure: `backend/tests/test_merge_util.py` with pytest fixtures and imports
- [X] T076 [P] Create frontend test file structure: `frontend/src/hooks/useIndicatorInstances.test.ts` with vitest setup and mocks
- [X] T077 [P] Create frontend test file structure: `frontend/src/migrations/migrateIndicatorsToCloud.test.ts` for migration script validation
- [X] T078 [P] Configure pytest in `backend/pyproject.toml` or `backend/pytest.ini` with async test support and coverage settings
- [X] T079 [P] Configure vitest in `frontend/vitest.config.ts` with test environment variables and coverage settings
- [X] T080 [P] Add GitHub Actions workflow for backend tests in `.github/workflows/backend-tests.yml` (pytest, coverage, typecheck) - EXISTING ci.yml already covers backend
- [X] T081 [P] Add GitHub Actions workflow for frontend tests in `.github/workflows/frontend-tests.yml` (vitest, coverage, typecheck) - EXISTING ci.yml already covers frontend

### OpenAPI Specification

- [X] T082 Generate OpenAPI spec from implemented FastAPI endpoints: `cd backend && python -c "from app.api.v1.indicator_configs import router; import json; print(json.dumps(router.openapi(), indent=2))"` and merge into `specs/001-indicator-storage/contracts/openapi.yaml`
- [X] T083 Verify OpenAPI spec matches implementation: all endpoints (GET, POST, PUT, DELETE /indicator-configs) documented with correct schemas

### Migration Script & Documentation

- [X] T084 [P] Create one-time migration script `frontend/src/migrations/migrateIndicatorsToCloud.ts` to move localStorage indicators to cloud
- [X] T085 [P] Add migration instructions to quickstart.md (how to run migration script in browser console, expected output, rollback procedure)
- [X] T086 [P] Update CLAUDE.md with IndicatorConfig model and API endpoints documentation

### Performance Monitoring & Validation

- [ ] T087 [P] Add performance monitoring to indicator load operations in `backend/app/api/v1/indicator_configs.py` (log query time, verify <2s per SC-001)
- [ ] T088 [P] Add performance monitoring to indicator sync operations in `frontend/src/hooks/useIndicatorInstances.ts` (log API time, verify <1s per SC-003)
- [ ] T089 [P] Run end-to-end test: create indicators on device1, sign in on device2, verify all indicators appear within 2 seconds (SC-001 validation)
- [ ] T090 [P] Run end-to-end test: clear browser cache, verify 100% indicators restored from database (SC-002 validation)
- [ ] T091 [P] Run end-to-end test: configure indicators as guest, sign in, verify 100% success without data loss (SC-004 validation)
- [ ] T092 [P] Run end-to-end test: execute migration script with existing localStorage indicators, verify zero data loss (SC-005 validation)

### Test Execution & Code Quality

- [ ] T093 Verify all backend tests pass: `cd backend && pytest tests/test_indicator_configs.py -v`
- [ ] T094 Verify all merge tests pass: `cd backend && pytest tests/test_merge_util.py -v`
- [ ] T095 Verify all frontend tests pass: `cd frontend && npm test useIndicatorInstances.test.ts`
- [ ] T096 Run TypeScript type check: `cd frontend && npx tsc --noEmit`
- [ ] T097 Run Python type check: `cd backend && mypy app/` (if mypy configured)
- [ ] T098 Run backend linting: `cd backend && ruff check app/`
- [ ] T099 Run frontend linting: `cd frontend && npm run lint` (if ESLint configured)

### Manual QA & Edge Cases

- [ ] T100 Manual QA: Test with 50+ indicators to verify performance is acceptable (edge case from spec)
- [ ] T101 Manual QA: Test concurrent updates from multiple devices (verify last write wins behavior)
- [ ] T102 Manual QA: Test migration script with real localStorage data (verify zero data loss, rollback on failure)
- [ ] T103 Code cleanup: Remove any debug console.log statements, add missing error handling, ensure consistent code style

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately (verifies existing codebase)
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - **Critical Path**: T006-T021 must be complete before ANY user story work can begin
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1 - Multi-Device Sync)**: Can start after Foundational (Phase 2) - No dependencies on other stories
  - **Core Value**: Enables indicators to sync across devices
  - **MVP Candidate**: First story to complete for minimum viable product
- **User Story 2 (P2 - Persistence)**: Can start after Foundational (Phase 2) - Extends US1 with localStorage fallback
  - **Integration**: Uses same API endpoints as US1, adds error handling and offline support
  - **Independent Test**: Can be tested without US3 (guest mode)
- **User Story 3 (P3 - Guest Transition)**: Can start after Foundational (Phase 2) - Adds merge capability
  - **Integration**: Uses same API endpoints as US1/US2, adds merge endpoint
  - **Independent Test**: Can be tested with fresh guest session

### Within Each User Story

- **TDD Approach**: Tests MUST be written and FAIL before implementation (per Constitution)
- **Test Tasks**: All test tasks marked [P] within a story can run in parallel
- **Implementation Tasks**: Follow order: models → services → endpoints → integration → error handling
- **Story Complete**: Only mark story complete when all acceptance scenarios from spec.md pass

### Parallel Opportunities

**Setup Phase (Phase 1)**:
```bash
# Can run in parallel (T003-T005):
Task: "Verify PostgreSQL database connectivity"
Task: "Verify Firebase authentication middleware exists"
Task: "Review existing Alert/UserWatchlist/Layout models"
```

**Foundational Phase (Phase 2)**:
- No parallel opportunities - sequential dependencies (model → migration → API → types)

**User Story 1 Tests (Phase 3)**:
```bash
# Can run in parallel (T022-T026):
Task: "Write contract test for GET /indicator-configs endpoint"
Task: "Write contract test for POST /indicator-configs endpoint"
Task: "Write contract test for PUT /indicator-configs/{uuid} endpoint"
Task: "Write contract test for DELETE /indicator-configs/{uuid} endpoint"
Task: "Write integration test for multi-device sync"
```

**User Story 2 Tests (Phase 4)**:
```bash
# Can run in parallel (T041-T043):
Task: "Write integration test for localStorage fallback"
Task: "Write integration test for retry logic"
Task: "Write integration test for optimistic updates rollback"
```

**User Story 3 Tests (Phase 5)**:
```bash
# Can run in parallel (T055-T061):
Task: "Write unit test for upsert_indicator_configs() - new user"
Task: "Write unit test for upsert_indicator_configs() - existing indicators"
Task: "Write unit test for timestamp conflict resolution (guest newer)"
Task: "Write unit test for timestamp conflict resolution (cloud newer)"
Task: "Write unit test for edge case: exactly 2 minutes apart"
Task: "Write integration test for guest→auth merge via POST /merge/sync"
Task: "Write integration test for GET /merge/status includes indicators"
```

**User Story 2 Implementation (Phase 4)**:
```bash
# Can run in parallel (T044-T047):
Task: "Implement safeSetItem() helper"
Task: "Implement safeGetItem() helper"
Task: "Implement safeRemoveItem() helper"
Task: "Implement clearLocalStorage() function"
```

**User Story 3 Implementation (Phase 5)**:
```bash
# Can run in parallel (T062-T067):
Task: "Implement upsert_indicator_configs() function"
Task: "Implement should_update() timestamp comparison helper"
Task: "Add GuestIndicator Pydantic schema to merge.py"
Task: "Update MergeRequest schema to include indicators"
Task: "Update MergeResponse schema to include indicators stats"
Task: "Update MergeStatus schema to include indicators count"
```

**Polish Phase (Phase 6)**:
```bash
# Constitution Compliance - Test Files (T074-T081, can run in parallel):
Task: "Create backend test file structure: test_indicator_configs.py"
Task: "Create backend test file structure: test_merge_util.py"
Task: "Create frontend test file structure: useIndicatorInstances.test.ts"
Task: "Create frontend test file structure: migrateIndicatorsToCloud.test.ts"
Task: "Configure pytest in pyproject.toml"
Task: "Configure vitest in vitest.config.ts"
Task: "Add GitHub Actions workflow for backend tests"
Task: "Add GitHub Actions workflow for frontend tests"

# OpenAPI & Documentation (T082-T086, can run in parallel):
Task: "Generate OpenAPI spec from FastAPI endpoints"
Task: "Verify OpenAPI spec matches implementation"
Task: "Create migration script"
Task: "Add migration instructions to quickstart.md"
Task: "Update CLAUDE.md documentation"

# Performance & QA (T087-T103, can run in parallel):
Task: "Add performance monitoring to backend"
Task: "Add performance monitoring to frontend"
Task: "Run end-to-end test: SC-001 validation"
Task: "Run end-to-end test: SC-002 validation"
Task: "Run end-to-end test: SC-004 validation"
Task: "Run end-to-end test: SC-005 validation"
# ... and all test execution, linting, manual QA tasks
```

**Cross-Story Parallelization** (with multiple developers):
```bash
# Once Foundational (Phase 2) is complete, all 3 user stories can proceed in parallel:
Developer A: User Story 1 (T022-T040)
Developer B: User Story 2 (T041-T054)
Developer C: User Story 3 (T055-T073)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Target**: Minimum Viable Product - Multi-device indicator sync

1. Complete Phase 1: Setup (verify existing codebase) → 30 minutes
2. Complete Phase 2: Foundational (model, API, types) → 4 hours
3. Complete Phase 3: User Story 1 (API-based sync) → 6 hours
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Create indicators on device1
   - Sign in on device2
   - Verify all indicators appear within 2 seconds (SC-001)
5. Deploy/demo MVP if ready

**MVP Deliverable**: Traders can access indicators on any device. No offline support yet, no guest mode yet.

### Incremental Delivery

**Sprint 1 (MVP)**: Foundation + User Story 1
- Complete Setup + Foundational → Database model and API endpoints ready
- Add User Story 1 → Test independently → Deploy/Demo (MVP!)
- **Value**: Users can sync indicators across devices

**Sprint 2**: User Story 2
- Add User Story 2 → Test independently → Deploy/Demo
- **Value**: Indicators persist across browser cache clearing, offline support

**Sprint 3**: User Story 3
- Add User Story 3 → Test independently → Deploy/Demo
- **Value**: Smooth guest → authenticated transition

**Sprint 4**: Polish
- Complete Phase 6 → Migration script, performance validation, CI
- **Value**: Production-ready with monitoring and migration path

### Parallel Team Strategy

**With 3 developers** (after Foundational phase completes):

```
Foundation (All 3 developers): Phase 1 + Phase 2 (5 hours)

↓ Foundation Complete ↓

Developer A (Backend Focus):
  - User Story 1 API tests (T022-T026)
  - User Story 3 merge logic (T062-T070)
  - Polish: backend performance monitoring (T077)

Developer B (Frontend Focus):
  - User Story 1 hook implementation (T027-T040)
  - User Story 2 offline support (T044-T054)
  - Polish: migration script (T074)

Developer C (Full Stack + QA):
  - User Story 2 tests (T041-T043)
  - User Story 3 tests (T055-T061)
  - User Story 3 frontend integration (T071-T073)
  - Polish: end-to-end validation (T079-T082, T088-T089)
```

**Timeline**: ~20-25 hours total (3-4 days with 3 developers)

---

## Format Validation

✅ **All tasks follow checklist format**: `- [ ] [ID] [P?] [Story] Description with file path`

✅ **Total Task Count**: 104 tasks
  - Setup: 5 tasks
  - Foundational: 17 tasks (BLOCKS all stories) +1 validation task
  - User Story 1: 19 tasks (5 tests + 14 implementation)
  - User Story 2: 14 tasks (3 tests + 11 implementation)
  - User Story 3: 19 tasks (7 tests + 12 implementation)
  - Polish: 30 tasks (8 test files/CI + 2 OpenAPI + 3 migration/docs + 6 performance + 7 QA + 4 cleanup)

✅ **Parallel Opportunities**: 47 tasks marked [P] can run in parallel within their phases

✅ **Independent Test Criteria**: Each user story has clear independent test criteria from spec.md

✅ **MVP Scope**: User Story 1 (T022-T040) + Polish subset = deployable MVP

✅ **Constitution Compliance**: All three test gaps addressed:
  - ✅ T074-T081: Create test file structures and CI workflows
  - ✅ T082-T083: Generate and verify OpenAPI spec
  - ✅ T084: Migration script with comprehensive validation

---

## Notes

- **TDD Required**: Constitution requires test-driven development for merge logic (User Story 3 tests are MANDATORY)
- **Constitution Compliance**:
  - ✅ Correctness Over Cleverness: UTC timestamps, composite unique constraint for deduplication
  - ✅ Local-First: localStorage fallback maintained (FR-008)
  - ✅ Unlimited Alerts Philosophy: No hard caps on indicator count
  - ✅ Testing: TDD for merge logic, CI includes tests
- **Performance Targets**:
  - SC-001: <2 seconds indicator load (T077, T078, T079 validate)
  - SC-003: <1 second sync for typical configs (T078, T079 validate)
  - SC-004: 100% merge success (T055-T061 ensure via comprehensive tests)
  - SC-005: Zero data loss during migration (T074, T082 validate)
- **Commit Strategy**: Commit after each task or logical group (e.g., all tests for a story)
- **Validation Gates**: Stop at each checkpoint to validate story independently before proceeding
- **Avoid**: Vague tasks ("implement feature"), same-file conflicts in parallel tasks, cross-story dependencies that break independence
