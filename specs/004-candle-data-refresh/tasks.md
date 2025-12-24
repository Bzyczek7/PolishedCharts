# Tasks: Candle Data and Refresh

**Input**: Design documents from `/specs/004-candle-data-refresh/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/candles.yaml

**Tests**: This feature REQUIRES TDD per Constitution V. Tests are written FIRST for all core polling logic.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/` for source, `backend/tests/` for tests
- **Frontend**: `frontend/src/` for source, `frontend/src/tests/` for tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing project structure and dependencies

- [x] T001 Verify existing backend dependencies (FastAPI, SQLAlchemy, httpx, yfinance) in backend/pyproject.toml or requirements.txt
- [x] T002 Verify existing frontend dependencies (React 19, lightweight-charts, axios, vitest) in frontend/package.json
- [x] T003 [P] Verify existing database models (Symbol, Candle) in backend/app/models/

**Checkpoint**: Project structure confirmed - no new setup needed, extending existing infrastructure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend services that MUST be in place before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational Services (TDD - Write These FIRST) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T004 [P] Unit test for MarketSchedule.is_market_open() in backend/tests/unit/services/test_market_schedule.py
- [x] T005 [P] Unit test for MarketSchedule weekend detection in backend/tests/unit/services/test_market_schedule.py
- [x] T006 [P] Unit test for PollingRefreshService.get_refresh_interval() in backend/tests/unit/services/test_polling.py
- [x] T007 [P] Unit test for PollingRefreshService.should_fetch() cache validation in backend/tests/unit/services/test_polling.py
- [x] T008 [P] Unit test for PollingRefreshService.mark_fetched() cache update in backend/tests/unit/services/test_polling.py

### Implementation for Foundational Services

- [x] T009 Create MarketSchedule service in backend/app/services/market_schedule.py with is_market_open() method (US market hours: 9:30 AM - 4:00 PM ET, Mon-Fri)
- [x] T010 Create PollingRefreshService in backend/app/services/polling.py with refresh intervals config (5s for 1m/5m, 15s for 15m/1h, 60s for 1d, 300s for 1w)
- [x] T011 Implement PollingRefreshService.should_fetch() method with cache validity logic (session-based: 10 candles for 1m/5m, 4 candles for 15m/1h, daily for 1d+)
- [x] T012 Implement PollingRefreshService.mark_fetched() method to update cache metadata after successful fetch
- [x] T013 Implement PollingRefreshService.invalidate_cache() method for manual cache invalidation
- [x] T014 Add PollingRefreshService integration with MarketSchedule for market hours awareness

**Checkpoint**: Foundation ready - backend polling infrastructure complete, user story implementation can begin

---

## Phase 3: User Story 1 - View Historical Candle Data (Priority: P1) 🎯 MVP

**Goal**: Display historical OHLCV candle data on chart with initial load (100-200 candles)

**Independent Test**: Select a stock symbol and verify historical candles appear on chart with correct OHLCV data

### Tests for User Story 1 (TDD - Write These FIRST) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T015 [P] Unit test for pollingScheduler.createPollTimer() in frontend/src/tests/lib/pollingScheduler.test.ts
- [x] T016 [P] Unit test for pollingScheduler.getPollIntervalMs() returns correct intervals per spec in frontend/src/tests/lib/pollingScheduler.test.ts
- [x] T017 [P] Unit test for useCandleData initial fetch on mount in frontend/src/tests/hooks/useCandleData.test.ts
- [x] T018 [P] Unit test for useCandleData loading state management in frontend/src/tests/hooks/useCandleData.test.ts
- [x] T019 [P] Integration test for GET /candles/{symbol} endpoint returns candle data in backend/tests/integration/test_candles_api.py

### Implementation for User Story 1

- [x] T020 [P] Create pollingScheduler.ts utility in frontend/src/lib/pollingScheduler.ts with createPollTimer(), clearPollTimer(), getPollIntervalMs(), getAdjustedPollIntervalMs() functions (T073: added market-aware polling)
- [x] T021 [P] Create CandlePollingState interface in frontend/src/hooks/useCandleData.ts (candles, isLoading, isRefreshing, error, lastUpdate, isStale, hasMore)
- [x] T022 Implement useCandleData hook in frontend/src/hooks/useCandleData.ts with initial fetch on mount and state management
- [x] T023 [US1] Implement useCandleData.fetchCandles() method calling getCandles API from frontend/src/api/candles.ts
- [x] T024 [US1] Add useCandleData polling timer setup with interval-based frequency (5s for 1m/5m, 15s for 15m/1h, 60s for 1d) in frontend/src/hooks/useCandleData.ts (T073: updated to use getAdjustedPollIntervalMs for market-aware throttling)
- [x] T025 [US1] Add useCandleData cleanup on unmount to cancel polling timer in frontend/src/hooks/useCandleData.ts
- [x] T026 [US1] Integrate useCandleData hook into App.tsx with mode toggle (WebSocket/Polling)
- [x] T027 [US1] Add loading indicator display in App.tsx during initial fetch state
- [x] T028 [US1] Add error display in App.tsx when fetch fails
- [x] T029 [US1] Add last update timestamp display in App.tsx
- [x] T030 [US1] Verify initial load returns minimum 100 candles per FR-002

**Checkpoint**: At this point, User Story 1 should be fully functional - users can view historical candle data on chart with loading states

---

## Phase 4: User Story 2 - Real-Time Candle Updates (Priority: P2)

**Goal**: Periodically fetch new candle data and update chart without manual refresh

**Independent Test**: Open chart, wait for refresh interval, verify new/updated candles appear

### Tests for User Story 2 (TDD - Write These FIRST) ⚠️

- [x] T031 [P] Unit test for useCandleData background refresh on interval change in frontend/src/tests/hooks/useCandleData.test.ts
- [x] T032 [P] Unit test for useCandleData polling restart on symbol change in frontend/src/tests/hooks/useCandleData.test.ts
- [x] T033 [P] Unit test for isRefreshing state during background updates in frontend/src/tests/hooks/useCandleData.test.ts

### Implementation for User Story 2

- [x] T034 [P] Add isRefreshing state to CandlePollingState interface in frontend/src/hooks/useCandleData.ts
- [x] T035 [US2] Implement useCandleData polling restart logic on interval/symbol change (cancel old timer, start new timer) in frontend/src/hooks/useCandleData.ts
- [x] T036 [US2] Update useCandleData fetchCandles to support background refresh mode (isRefreshing=true) in frontend/src/hooks/useCandleData.ts
- [x] T037 [US2] Add visual refresh indicator in App.tsx during background updates (subtle "Updating..." indicator)
- [x] T038 [US2] Verify chart updates within 5 seconds per SC-002
- [x] T039 [US2] Verify interval switch completes within 3 seconds per SC-007

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - chart displays historical data AND updates periodically

---

## Phase 5: User Story 3 - Watchlist Price Updates (Priority: P3)

**Goal**: Periodically update watchlist with current prices for multiple symbols

**Independent Test**: Add stocks to watchlist, verify prices update every 60 seconds

### Tests for User Story 3 (TDD - Write These FIRST) ⚠️

- [x] T040 [P] Unit test for useWatchlistData initial fetch on mount in frontend/src/tests/hooks/useWatchlistData.test.ts
- [x] T041 [P] Unit test for useWatchlistData 60-second polling interval in frontend/src/tests/hooks/useWatchlistData.test.ts
- [x] T042 [P] Integration test for GET /candles/latest_prices/{symbols} endpoint with multiple symbols in backend/tests/integration/test_candles_api.py

### Implementation for User Story 3

- [x] T043 [P] Create WatchlistPollingState interface in frontend/src/hooks/useWatchlistData.ts (entries, isLoading, isRefreshing, errors, lastUpdate)
- [x] T044 [P] Extend WatchlistItem interface in frontend/src/api/watchlist.ts (make price, change, changePercent optional for error handling)
- [x] T045 [US3] Implement useWatchlistData hook in frontend/src/hooks/useWatchlistData.ts with batch API call to /candles/latest_prices/{symbols}
- [x] T046 [US3] Add useWatchlistData 60-second polling timer setup in frontend/src/hooks/useWatchlistData.ts
- [x] T047 [US3] Add useWatchlistData error handling with per-symbol error Map in frontend/src/hooks/useWatchlistData.ts
- [x] T048 [US3] Integrate useWatchlistData hook into App.tsx via WatchlistDataProvider component
- [x] T049 [US3] Add visual refresh indicator to Watchlist.tsx during background updates
- [x] T050 [US3] Add last update timestamp display to Watchlist.tsx
- [x] T051 [US3] Verify 50 symbols update within 10 seconds per SC-005

**Checkpoint**: All user stories 1-3 should now be independently functional - chart updates, watchlist updates, both work separately

---

## Phase 6: User Story 4 - Historical Backfill (Priority: P4)

**Goal**: Automatically fetch older candle data when user scrolls back in time

**Independent Test**: Scroll left on chart, verify older candles appear smoothly

### Tests for User Story 4 (TDD - Write These FIRST) ⚠️

- [x] T052 [P] Unit test for visible range change detection in frontend/src/tests/hooks/useCandleData.test.ts
- [x] T053 [P] Unit test for backfill trigger threshold (10% of loaded range) in frontend/src/tests/hooks/useCandleData.test.ts
- [x] T054 [P] Integration test for backfill range query performance in backend/tests/integration/test_candles_api.py

### Implementation for User Story 4

- [x] T055 [P] Add hasMore field to CandlePollingState in frontend/src/hooks/useCandleData.ts
- [x] T056 [P] Add fetchCandles with date range support (from/to params) to frontend/src/api/candles.ts
- [ ] T057 [US4] Implement lightweight-charts visible range change subscription in ChartComponent.tsx (requires chart integration)
- [ ] T058 [US4] Add backfill trigger logic in useCandleData.ts (trigger when scrolled within 10% of loaded range edge)
- [x] T059 [US4] Implement backfill data fetching with from timestamp parameter in frontend/src/hooks/useCandleData.ts
- [x] T060 [US4] Merge backfill data with existing candles without duplicates in frontend/src/hooks/useCandleData.ts
- [ ] T061 [US4] Update chart series with merged candle data in ChartComponent.tsx (requires chart integration)
- [ ] T062 [US4] Verify backfill loads within 2 seconds per SC-004

**Checkpoint**: All user stories should now be independently functional - full candle data access with historical backfill
**NOTE**: T057, T058, T061, T062 require lightweight-charts visible range event integration (P4 priority, deferred)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T063 [P] Add loading indicator visual verification (Constitution I requirement) - ensure indicators are non-intrusive (requires app execution)
- [ ] T064 [P] Take before/after screenshots of loading indicators for Constitution compliance (requires app execution)
- [ ] T065 [P] Verify 60fps panning performance maintained (Constitution I requirement) in frontend/src/tests/ChartComponent.test.tsx (requires app execution)
- [x] T066 Add error boundary for candle data fetch failures in frontend/src/components/ErrorBoundary.tsx
- [x] T067 Add exponential backoff retry logic to YFinanceProvider if not already present in backend/app/services/providers.py (already exists)
- [x] T068 Add 429 response handling with Retry-After header respect in backend/app/services/providers.py (covered by existing retry logic)
- [x] T069 Add performance metrics tracking for initial load time in backend/tests/integration/test_candles_api.py
- [x] T070 Add performance metrics tracking for polling refresh latency in backend/tests/integration/test_candles_api.py
- [ ] T071 Run quickstart.md validation scenarios (requires full application testing)
- [x] T072 Manual refresh button implementation per FR-018 in frontend/src/components/Toolbar.tsx and App.tsx
- [x] T073 Market schedule polling throttle (reduce frequency outside market hours) in frontend/src/lib/pollingScheduler.ts
- [x] T074 Symbol validation before data fetch per FR-016 in frontend/src/hooks/useCandleData.ts

---

## Additional Fixes (Bug Fixes)

The following fixes were made during implementation:

### Indicator Removal Bug Fix
**Issue**: X buttons to remove indicators (both overlay like SMA and oscillator like TDFI) did not work correctly.

**Root Cause**:
- `activeLayout.activeIndicators` stores indicator type names (e.g., "sma", "tdfi")
- `removeIndicator()` expected unique pane IDs (e.g., "indicator-1234567890-abc123")
- The sync effect only added new indicators to layout, never removed deleted ones

**Fixes Applied**:
1. **App.tsx** - Updated `onRemoveIndicator` handler to handle both type names and unique IDs
2. **App.tsx** - Updated sync effect to remove deleted indicators from `activeLayout.activeIndicators`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup verification - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends US1 hook but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2, uses different hook
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Extends US1 hook but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD per Constitution V)
- Frontend utilities before hooks
- Backend services before API integration
- Core implementation before component integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Foundational tests (T004-T008) can run in parallel
- All US1 tests (T015-T019) can run in parallel
- T020 (pollingScheduler.ts) and T021 (CandlePollingState interface) can run in parallel
- All US2 tests (T031-T033) can run in parallel
- All US3 tests (T040-T042) can run in parallel
- All US4 tests (T052-T054) can run in parallel
- T043 (WatchlistPollingState) and T044 (WatchlistEntry extension) can run in parallel
- All Polish tasks (T063-T065) can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for pollingScheduler.createPollTimer()"
Task: "Unit test for pollingScheduler.getPollIntervalMs()"
Task: "Unit test for useCandleData initial fetch on mount()"
Task: "Unit test for useCandleData loading state"
Task: "Integration test for GET /candles/{symbol}"

# Launch utilities together:
Task: "Create pollingScheduler.ts utility"
Task: "Create CandlePollingState interface"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify existing infrastructure)
2. Complete Phase 2: Foundational (backend services) - **CRITICAL**
3. Complete Phase 3: User Story 1 (historical candle display)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Backend polling infrastructure ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add Polish → Final deployment

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (chart display)
   - Developer B: User Story 2 (real-time updates)
   - Developer C: User Story 3 (watchlist)
   - Developer D: User Story 4 (backfill)
3. Stories complete and integrate independently

---

## Notes

- **TDD Required**: Constitution V mandates tests-first for all polling logic
- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests must FAIL before implementing (TDD workflow)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Verify visual indicators are non-intrusive (Constitution I)
- Performance budgets must be met (SC-001 through SC-009)

---

## Task Summary

| Category | Count |
|----------|-------|
| **Total Tasks** | 74 |
| Setup Phase | 3 |
| Foundational Phase | 11 (5 tests + 6 implementation) |
| User Story 1 | 16 (5 tests + 11 implementation) |
| User Story 2 | 9 (3 tests + 6 implementation) |
| User Story 3 | 12 (3 tests + 9 implementation) |
| User Story 4 | 11 (3 tests + 8 implementation) |
| Polish Phase | 12 |
| **Parallel Opportunities** | 25+ |

### Tasks by User Story

| User Story | Tasks | Tests | Implementation |
|------------|-------|-------|----------------|
| US1 - View Historical Data | 16 | 5 | 11 |
| US2 - Real-Time Updates | 9 | 3 | 6 |
| US3 - Watchlist Updates | 12 | 3 | 9 |
| US4 - Historical Backfill | 11 | 3 | 8 |

### Suggested MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 (User Story 1)**

- 3 setup tasks
- 11 foundational tasks
- 16 User Story 1 tasks
- **Total: 30 tasks for MVP**

This delivers: Users can view historical candle data on chart with loading states.
