# Tasks: Watchlist Search, Add, and Historical Data Backfill

**Feature**: 009-watchlist-search-add
**Input**: Design documents from `/specs/009-watchlist-search-add/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD is specified in constitution for core logic (backfill, search, market-hours gating). Test tasks are included and should be written FIRST.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/` for source, `backend/tests/` for tests
- **Frontend**: `frontend/src/` for source, `frontend/tests/` for tests
- **Migrations**: `backend/alembic/versions/` (Alembic DB migrations)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migrations and initial project setup

- [X] T001 Add pandas_market_calendars to backend/requirements.txt for holiday detection
- [X] T002 Add beautifulsoup4 to backend/requirements.txt for Wikipedia scraping in seed script
- [X] T003 Add pytz to backend/requirements.txt for timezone handling
- [X] T004 Create Alembic migration for ticker_universe table in backend/alembic/versions/
- [X] T005 Create Alembic migration for watchlist table in backend/alembic/versions/
- [X] T006 Run database migrations (alembic upgrade head) to apply schema changes

**Checkpoint**: Database schema ready - foundational work can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core models and seed script that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Models (All stories depend on these)

- [X] T007 [P] Create TickerUniverse model in backend/app/models/ticker_universe.py with ticker, display_name, asset_class, exchange, created_at columns
- [X] T008 [P] Create WatchlistEntry model in backend/app/models/watchlist.py with symbol_id FK, added_at, unique constraint on symbol_id
- [X] T009 [P] Add TickerUniverse and WatchlistEntry to backend/app/models/__init__.py

### Seed Script (Shared infrastructure)

- [X] T010 Create seed_ticker_universe.py script in backend/app/scripts/seed_ticker_universe.py fetching S&P 500 from Wikipedia with yfinance validation
- [X] T011 Run seed script to populate ticker_universe table (~500 S&P 500 symbols)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Search and Add Tickers to Watchlist (Priority: P1) 🎯 MVP

**Goal**: Enable users to search for stock tickers and add them to a global shared watchlist with automatic historical data backfill

**Independent Test**: Open the watchlist page, type "AAPL" in search, select it, click "+", and verify the ticker appears in the watchlist with complete historical data

### Tests for User Story 1 (TDD - Write FIRST, ensure FAIL) ⚠️

- [X] T012 [P] [US1] Unit test for SearchService.search_tickers() in backend/tests/services/test_search.py
- [X] T013 [P] [US1] Unit test for BackfillService.backfill_historical() in backend/tests/services/test_backfill.py
- [X] T014 [P] [US1] Unit test for YFRateLimitError retry handling via existing providers.py in backend/tests/services/test_backfill.py
- [X] T015 [P] [US1] Unit test for WatchlistService.add_to_watchlist() transaction logic in backend/tests/services/test_watchlist.py
- [X] T016 [P] [US1] Integration test for POST /api/v1/watchlist with yfinance mock in backend/tests/api/test_watchlist.py
- [X] T017 [P] [US1] Integration test for GET /api/v1/symbols/search in backend/tests/api/test_search.py
- [X] T018 [P] [US1] Frontend unit test for WatchlistSearch component debounce in frontend/tests/components/test_WatchlistSearch.test.tsx
- [X] T019 [P] [US1] Frontend unit test for useWatchlist hook in frontend/tests/hooks/test_useWatchlist.test.tsx

### Implementation for User Story 1

#### Backend Services

- [X] T020 [P] [US1] Create SearchService with search_tickers() method in backend/app/services/search.py
- [X] T021 [US1] Create BackfillService with backfill_historical() method that calls existing YFinanceProvider.fetch_candles() (NOTE: retry/backoff already in providers.py via tenacity, do NOT duplicate) in backend/app/services/backfill.py
- [X] T022 [P] [US1] Create WatchlistService with add_to_watchlist(), list_watchlist(), remove_from_watchlist() in backend/app/services/watchlist.py

#### Backend API Endpoints

- [X] T023 [P] [US1] Create GET /api/v1/symbols/search endpoint in backend/app/api/v1/search.py querying ticker_universe with ILIKE, limit 10, validate query length 1-5
- [X] T024 [P] [US1] Create GET /api/v1/watchlist endpoint in backend/app/api/v1/watchlist.py returning watchlist entries with ticker, name, added_at
- [X] T025 [P] [US1] Create POST /api/v1/watchlist endpoint in backend/app/api/v1/watchlist.py implementing atomic flow: normalize → validate in ticker_universe → get/create symbol → backfill max daily candles → create watchlist entry → return status + candles_count
- [X] T026 [P] [US1] Create DELETE /api/v1/watchlist/{symbol} endpoint in backend/app/api/v1/watchlist.py
- [X] T027 [US1] Add 60-second timeout enforcement to backfill operation using asyncio.wait_for() with asyncio.TimeoutError

#### Backend Validation & Error Handling

- [X] T028 [US1] Add ticker normalization (uppercase, trim) in POST /api/v1/watchlist
- [X] T029 [US1] Add crypto ticker rejection (*-USD, */USD formats) with error "Only US equities supported in watchlist add/backfill" in backend/app/api/v1/watchlist.py
- [X] T030 [US1] Add unique constraint handling for duplicate watchlist entries (return 200 with status="already_present") in backend/app/api/v1/watchlist.py
- [X] T031 [US1] Add transaction wrapper for add operation (async with db.begin()) in backend/app/services/watchlist.py
- [X] T032 [US1] Add error handling for yfinance failures (invalid ticker, no data, network error) with clear messages in backend/app/api/v1/watchlist.py

#### Backend Logging

- [X] T033 [US1] Add logging for watchlist operations (add_attempt, add_success, add_rejected) in backend/app/api/v1/watchlist.py
- [X] T034 [US1] Add logging for backfill operations (started, completed, failed, rate_limited_with_retry) in backend/app/services/backfill.py

#### Frontend Components

- [X] T035 [P] [US1] Create WatchlistSearch component with shadcn/ui Command and 300ms debounce in frontend/src/components/WatchlistSearch.tsx
- [X] T036 [P] [US1] Create WatchlistAdd button component with loading state in frontend/src/components/WatchlistAdd.tsx
- [X] T037 [P] [US1] Create useWatchlist hook for state management in frontend/src/hooks/useWatchlist.ts

#### Frontend API Client

- [X] T038 [P] [US1] Create watchlist API client in frontend/src/api/watchlist.ts with searchSymbols(), getWatchlist(), addToWatchlist(), removeFromWatchlist()
- [X] T039 [US1] Integrate WatchlistSearch and WatchlistAdd with existing Watchlist component in frontend/src/components/Watchlist.tsx
- [X] T040 [US1] Update frontend/src/App.tsx to remove localStorage watchlist persistence, fetch from API on mount via getWatchlist()

**Checkpoint**: At this point, User Story 1 should be fully functional - users can search, add tickers, and see them in watchlist with historical data

---

## Phase 4: User Story 2 - Transactional Historical Data Backfill (Priority: P1)

**Goal**: Ensure watchlist entries are only created after successful historical data backfill with idempotent storage

**Independent Test**: Add a new ticker via watchlist and verify that (a) historical daily OHLCV candles have been stored AND (b) the watchlist entry only appears after successful backfill

### Tests for User Story 2 (TDD - Write FIRST, ensure FAIL) ⚠️

- [X] T042 [P] [US2] Unit test for backfill idempotency (re-run doesn't create duplicates) in backend/tests/services/test_backfill.py
- [X] T043 [P] [US2] Integration test for transaction rollback on backfill failure in backend/tests/api/test_watchlist.py
- [X] T044 [P] [US2] Integration test for timeout handling (60s limit, returns 408) in backend/tests/services/test_backfill.py
- [X] T045 [P] [US2] Frontend component test: verify ticker does NOT appear in watchlist UI until POST /api/v1/watchlist returns status=added in frontend/tests/components/test_WatchlistAdd.test.tsx

### Implementation for User Story 2

#### Idempotent Backfill Logic

- [X] T046 [US2] Implement ON CONFLICT DO UPDATE for candle insertion in backend/app/services/backfill.py using existing CandleService.upsert_candles() pattern
- [X] T047 [US2] Verify existing candle table unique constraint on (symbol_id, timestamp, interval) exists in backend/app/models/candle.py
- [X] T048 [US2] Add candle count verification after backfill (return candles_backfilled in response)

#### Transaction Rollback Verification

- [X] T049 [US2] Verify add operation uses async transaction (db.begin()) wrapping all steps in backend/app/services/watchlist.py
- [X] T050 [US2] Add specific error messages for each failure type (invalid_ticker, no_data, timeout, rate_limited) in backend/app/api/v1/watchlist.py
- [X] T051 [US2] Ensure frontend displays loading state during backfill and only shows ticker on success in frontend/src/components/WatchlistAdd.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - add operation is fully transactional

---

## Phase 5: User Story 3 - Dynamic Poller with Market-Hours Gating (Priority: P2)

**Goal**: Data poller automatically picks up tickers from watchlist and only fetches equity prices during US market hours

**Independent Test**: (a) Add a ticker to watchlist and verify poller picks it up within 30 seconds, (b) Verify equity polling is skipped on weekends/holidays

### Tests for User Story 3 (TDD - Write FIRST, ensure FAIL) ⚠️

- [X] T052 [P] [US3] Unit test for MarketHoursService.is_market_open(dt) with injected datetime in backend/tests/services/test_market_hours.py
- [X] T053 [P] [US3] Unit test for MarketHoursService.is_market_day() with NYSE holidays in backend/tests/services/test_market_hours.py
- [X] T054 [P] [US3] Unit test for MarketHoursService.should_skip_equity_polling() returning (skip, reason) in backend/tests/services/test_market_hours.py
- [X] T055 [P] [US3] Integration test for poller loading from database in backend/tests/services/test_data_poller.py (use fake YFinanceProvider, small interval, stop after one iteration)
- [X] T056 [P] [US3] Integration test for poller market-hours gating on weekend in backend/tests/services/test_data_poller.py (verify log contains "skipped_equity_polling: ticker=... reason=...")

### Implementation for User Story 3

#### Market Hours Service

- [X] T057 [P] [US3] Create MarketHoursService in backend/app/services/market_hours.py
- [X] T058 [US3] Implement is_market_day() using pandas_market_calendars with NYSE calendar in backend/app/services/market_hours.py
- [X] T059 [US3] Implement should_skip_equity_polling() returning (skip: bool, reason: str) in backend/app/services/market_hours.py
- [X] T060 [US3] Handle timezone conversion (UTC ↔ Eastern Time) using pytz in backend/app/services/market_hours.py

#### Poller Integration

- [X] T061 [US3] Inject MarketHoursService into DataPoller.__init__() (instantiate once, not per ticker) in backend/app/services/data_poller.py
- [X] T062 [US3] Add load_watchlist_from_db() method to DataPoller fetching watchlist entries from DB in backend/app/services/data_poller.py
- [X] T063 [US3] Call load_watchlist_from_db() on startup in backend/app/main.py, remove hard-coded symbols list (NOTE: crypto polling like BTC-USD remains separate, out of scope for 009)
- [X] T064 [US3] Call load_watchlist_from_db() at top of each while-loop iteration in backend/app/services/data_poller.py
- [X] T065 [US3] Add market-hours gating to equity polling loop (gate DB watchlist symbols via should_skip_equity_polling()) in backend/app/services/data_poller.py
- [X] T066 [US3] Preserve 24/7 polling for crypto assets - no market-hours gating for non-equity tickers in backend/app/services/data_poller.py

#### Poller Retry Logic

- [X] T067 [US3] Ensure poller uses existing YFinanceProvider.fetch_candles() which already has tenacity retry (NOTE: do NOT add duplicate retry logic in data_poller.py) in backend/app/services/data_poller.py

#### Poller Logging

- [X] T068 [US3] Add logging for market-hours gating decisions (skipped_equity_polling: reason) in backend/app/services/data_poller.py
- [X] T069 [US3] Add logging for poller picking up new tickers from watchlist in backend/app/services/data_poller.py
- [X] T070 [US3] Add logging for rate limit retries with final outcome in backend/app/services/data_poller.py

**Checkpoint**: All user stories should now be independently functional - poller dynamically loads watchlist and respects market hours

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Documentation

- [X] T071 [P] Update quickstart.md with actual walkthrough of search/add flow in /specs/009-watchlist-search-add/quickstart.md
- [X] T072 [P] Add JSDoc comments to new API functions in frontend/src/api/watchlist.ts
- [X] T073 [P] Add docstrings to new API endpoints in backend/app/api/v1/watchlist.py
- [X] T074 [P] Add docstrings to new API endpoints in backend/app/api/v1/symbols.py

### Validation & Testing

- [X] T075 Run quickstart.md validation checklist from /specs/009-watchlist-search-add/quickstart.md
- [X] T076 [P] Verify all acceptance scenarios from spec.md for each user story
- [X] T077 [P] Run full test suite (pytest backend, vitest frontend) and fix any failures
- [X] T078 [P] Verify SC-002: Search completes within 2 seconds
- [X] T079 [P] Verify SC-010: Backfill timeout enforced at 60 seconds
- [X] T080 [P] Verify SC-009: Market-hours gating working (check logs for skipped polls on weekends/holidays)

### Code Quality

- [X] T081 [P] Run backend linting (ruff check backend/app) and fix issues
- [X] T082 [P] Run backend type checking (mypy backend/app) and fix issues
- [X] T083 [P] Run frontend type checking (npx tsc --noEmit in frontend/) and fix issues

### Performance

- [X] T084 Verify poller cycle time with 100+ tickers is acceptable
- [X] T085 Verify watchlist list query performance with 100+ entries

### Integration Verification

- [X] T086 Verify all imports use backend.app.* structure (not relative imports) in new backend files
- [X] T087 Verify WatchlistDataProvider.tsx correctly receives symbols array from parent (no changes needed if already correct)
- [X] T088 Verify useWatchlistData remains price-only hook (does not fetch watchlist membership)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T006) - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion (T007-T011)
  - User Story 1 (P1 - Phase 3): Core MVP - Search and Add
  - User Story 2 (P1 - Phase 4): Completes US1 with transactional verification
  - User Story 3 (P2 - Phase 5): Independent - Poller integration
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Extends US1 backfill logic - Should complete after US1 T020 (BackfillService created)
- **User Story 3 (P2)**: Independent of US1/US2 - Can start after Foundational (Phase 2)

### Within Each User Story

- Tests (T012-T018 for US1) MUST be written and FAIL before implementation (T019-T040)
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

#### Setup Phase (T001-T006)
```bash
# Run in parallel (different files):
Task T001: Add pandas_market_calendars to requirements.txt
Task T002: Add beautifulsoup4 to requirements.txt
Task T003: Add pytz to requirements.txt
# T004-T005: Migrations must run sequentially
```

#### Foundational Phase (T007-T011)
```bash
# Run in parallel (different files):
Task T007: Create TickerUniverse model
Task T008: Create WatchlistEntry model
Task T009: Add models to __init__.py
# T010-T011: Seed script depends on T007
```

#### User Story 1 Tests (T012-T019)
```bash
# Run in parallel (different test files):
Task T012: Unit test SearchService
Task T013: Unit test BackfillService
Task T014: Unit test YFRateLimitError retry handling
Task T015: Unit test WatchlistService
Task T016: Integration test POST watchlist
Task T017: Integration test GET symbols/search
Task T018: Frontend test WatchlistSearch
Task T019: Frontend test useWatchlist
```

#### User Story 1 Services (T020-T022)
```bash
# Run in parallel (different service files):
Task T020: Create SearchService
Task T021: Create BackfillService (uses providers.py retry)
Task T022: Create WatchlistService
```

#### User Story 1 Endpoints (T023-T026)
```bash
# Run in parallel (different endpoints/files):
Task T023: GET /api/v1/symbols/search
Task T024: GET /api/v1/watchlist
Task T025: POST /api/v1/watchlist
Task T026: DELETE /api/v1/watchlist/{symbol}
```

#### User Story 1 Frontend (T035-T040)
```bash
# Run in parallel (different files):
Task T035: WatchlistSearch component
Task T036: WatchlistAdd component
Task T037: useWatchlist hook
Task T038: watchlist API client
# T039-T040: Integration depends on above
```

#### User Story 2 Tests (T042-T045)
```bash
# Run in parallel:
Task T042: Unit test idempotency
Task T043: Integration test rollback
Task T044: Integration test timeout
Task T045: Frontend component test
```

#### User Story 3 Tests (T052-T056)
```bash
# Run in parallel:
Task T052: Unit test is_market_open
Task T053: Unit test is_market_day
Task T054: Unit test should_skip_equity_polling
Task T055: Integration test poller load from DB
Task T056: Integration test market-hours gating
```

#### Polish Phase (T071-T088)
```bash
# Run in parallel:
Task T071: Update quickstart.md
Task T072: Add JSDoc to API client
Task T073: Add docstrings to watchlist endpoints
Task T074: Add docstrings to symbols endpoints
Task T076: Verify acceptance scenarios
Task T077: Run test suite
Task T078: Verify SC-002 search latency
Task T079: Verify SC-010 timeout
Task T080: Verify SC-009 market-hours
Task T081: Run ruff linting
Task T082: Run mypy type checking
Task T083: Run tsc type checking
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only - P1 Priority)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T011) - CRITICAL
3. Complete Phase 3: User Story 1 (T012-T040)
4. Complete Phase 4: User Story 2 (T042-T051)
5. **STOP and VALIDATE**: Test search, add, backfill independently
6. Deploy/demo MVP (full watchlist search and add with transactional backfill)

### Incremental Delivery (Add Poller Optimization)

1. Complete MVP above (Phases 1-4)
2. Complete Phase 5: User Story 3 (T052-T070) - Poller integration
3. Test poller loads from watchlist and respects market hours
4. Deploy full feature

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T011)
2. Once Foundational is done:
   - Developer A: User Story 1 (T012-T040) - Search and Add
   - Developer B: User Story 3 (T052-T070) - Poller (can run in parallel!)
3. After US1 complete:
   - Developer A: User Story 2 (T042-T051) - Transactional backfill
4. Polish together (T071-T088)

---

## Summary

**Total Tasks**: 88
**Tasks per User Story**:
- User Story 1 (P1): 30 tasks (8 tests + 22 implementation)
- User Story 2 (P1): 10 tasks (4 tests + 6 implementation)
- User Story 3 (P2): 19 tasks (5 tests + 14 implementation)
- Setup + Foundational + Polish: 29 tasks

**Parallel Opportunities Identified**: 50+ tasks marked [P] across all phases

**Independent Test Criteria per Story**:
- **US1**: Type "AAPL" → Search returns dropdown → Click "+" → Loading state → Ticker appears with historical data
- **US2**: Add ticker → Verify candles in DB AND watchlist entry only after backfill completes (frontend verifies no local insertion until POST completes)
- **US3**: Add ticker → Verify poller picks it up → Verify polling skipped on weekend with logged reason (log contains "skipped_equity_polling: ticker=... reason=...")

**Suggested MVP Scope**: User Stories 1 + 2 (Search/Add + Transactional Backfill) delivers complete watchlist management with data integrity

**Fastest Delivery**: Phase 1-2 + US1 + US2 → Add US3 (Poller) last

**Format Validation**: ALL tasks follow checklist format with checkbox, ID, labels, and file paths

**Key Technical Decisions Applied**:
- Global shared watchlist (no authentication per clarifications)
- 60-second backfill timeout (asyncio.wait_for)
- **Retry logic consolidated in existing providers.py (tenacity) - do NOT duplicate** (avoids double retries)
- Rate limit detection via YFRateLimitError (not HTTP 429)
- pandas_market_calendars (NYSE) for market hours
- Ticker universe seeded from Wikipedia S&P 500
- shadcn/ui Command component with 300ms debounce
- Idempotent candle storage via existing unique constraint
