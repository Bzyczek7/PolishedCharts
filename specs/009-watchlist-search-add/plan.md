# Implementation Plan: Watchlist Search, Add, and Historical Data Backfill

**Branch**: `009-watchlist-search-add` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-watchlist-search-add/spec.md`

## Summary

Enable users to search for US stock tickers via a dropdown interface and add them to a global shared watchlist. Each add operation atomically validates the ticker, backfills full historical daily OHLCV data from Yahoo Finance via yfinance, and only creates a watchlist entry upon successful backfill. The data poller dynamically loads tickers from the database watchlist and gates equity polling to US market regular session hours (9:30 AM - 4:00 PM ET, Monday-Friday, excluding holidays) using pandas_market_calendars.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9+ (frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.104+, SQLAlchemy 2.0+, asyncpg, yfinance, pandas_market_calendars
- Frontend: React 19, lightweight-charts 5.1.0
**Storage**: PostgreSQL (candles, symbols, watchlist, ticker_universe)
**Testing**: pytest (backend), vitest (frontend)
**Target Platform**: Linux server (backend), modern browsers (frontend)
**Project Type**: Web application (backend + frontend)
**Performance Goals**:
- Search response: <2 seconds (SC-002)
- Backfill timeout: 60 seconds maximum (clarification)
- Watchlist add to poller pickup: <30 seconds (SC-005)
**Constraints**:
- No user authentication for watchlist (global shared watchlist)
- Synchronous backfill during add (blocks until complete or timeout)
- Market-hours gating only for equities (crypto 24/7 unchanged)
**Scale/Scope**:
- ~8,000 US equity symbols in ticker_universe
- Support 100+ tickers in watchlist
- Daily OHLCV backfill (5+ years for established stocks)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [ ] Chart interactions (zoom/pan/crosshair) match TradingView behavior
  - **Not applicable**: This feature does not modify chart interactions
- [ ] UI changes include before/after verification
  - **To be verified**: Watchlist search dropdown and add button UI
- [ ] Performance budgets: 60fps panning, 3s initial load
  - **To be verified**: Search dropdown performance, backfill loading state UX

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented
  - **Plan**: All timestamps normalized to UTC before database storage; existing candle model already enforces this
- [x] Deduplication strategy: database constraints or idempotent inserts
  - **Plan**: Unique constraint on (symbol, interval, timestamp) for candles; upsert operations for watchlist entries
- [ ] Alert semantics: above/below/crosses defined with edge cases tested
  - **Not applicable**: This feature does not modify alert semantics
- [x] Gap handling: explicit marking and backfill strategy
  - **Plan**: Backfill fetches "max" available history; gaps are natural Yahoo data limitations, surfaced via error messages

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count
  - **Not applicable**: Watchlist is separate from alerts; no caps planned
- [ ] Alert evaluation performance budgeted (500ms)
  - **Not applicable**: This feature does not modify alert evaluation
- [ ] Graceful degradation defined for high alert volumes
  - **Not applicable**: N/A for this feature

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally
  - **Plan**: Historical data stored in PostgreSQL; existing local cache pattern continues
- [x] Offline behavior: charts, alerts, history remain accessible
  - **Plan**: Existing cached data remains accessible offline; new ticker adds require network
- [x] Provider error handling: graceful degradation with user feedback
  - **Plan**: Exponential backoff retry (1s, 2s, 4s) for rate limits; clear error messages on failure

### Testing and Quality Gates

- [x] Core logic uses TDD (alert engine, indicators, candle normalization)
  - **Plan**: TDD for backfill service, search service, market-hours gating logic
- [x] Bug fixes include regression tests
  - **Plan**: All bug fixes will include regression tests
- [x] CI includes: lint, typecheck, unit, integration tests
  - **Plan**: Existing CI pipeline; new tests added for watchlist/backfill/search

### Performance Budgets

- [ ] Initial chart load: 3 seconds
  - **Not applicable**: This feature does not modify initial chart load
- [ ] Price update latency: 2 seconds
  - **To be verified**: Poller reads from DB instead of config; latency should not change
- [ ] Alert evaluation: 500ms
  - **Not applicable**: This feature does not modify alert evaluation
- [ ] UI panning: 60fps
  - **Not applicable**: This feature does not modify chart panning
- [ ] Memory: 500MB for 5 symbols / 20 alerts
  - **To be verified**: Larger watchlists may increase memory usage; monitor in testing

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern
  - **Not applicable**: This feature does not modify indicators
- [x] Data providers implement common interface
  - **Plan**: yfinance integration continues existing provider pattern; new TickerUniverse provider for search
- [x] Provider-specific logic isolated from UI
  - **Plan**: Backfill service encapsulates yfinance; UI only sees success/failure responses

### Security & Privacy

- [x] No telemetry or data upload without consent
  - **Plan**: No telemetry added; all data stored locally
- [x] API keys stored securely (not in repo)
  - **Plan**: yfinance does not require API keys; no new secrets
- [x] Local data treated as sensitive
  - **Plan**: Watchlist is stored in PostgreSQL; no external data transmission

### Governance

- [x] If any principle violated: justification in Complexity Tracking
  - **No violations**: Feature is aligned with constitution
- [x] Constitution supersedes spec/plan conflicts
  - **Verified**: No conflicts identified

**Constitution Check Status**: ✅ PASS - No violations. Ready for Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/009-watchlist-search-add/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── watchlist.yaml   # OpenAPI spec for watchlist endpoints
│   └── search.yaml      # OpenAPI spec for search endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── models/
│   │   ├── watchlist.py         # New: WatchlistEntry model
│   │   └── ticker_universe.py   # New: TickerUniverse model
│   ├── services/
│   │   ├── watchlist.py         # New: Watchlist CRUD service
│   │   ├── backfill.py          # New: Historical data backfill service
│   │   ├── search.py            # New: Ticker search service
│   │   └── market_hours.py      # New: Market-hours gating logic
│   ├── api/
│   │   └── v1/
│   │       ├── watchlist.py     # New: Watchlist endpoints
│   │       └── symbols.py       # New: Search endpoint (or extend existing)
│   └── scripts/
│       └── seed_ticker_universe.py  # New: One-time seed script
└── tests/
    ├── services/
    │   ├── test_watchlist.py    # New
    │   ├── test_backfill.py     # New
    │   ├── test_search.py       # New
    │   └── test_market_hours.py # New
    └── api/
        └── v1/
            └── test_watchlist.py # New

frontend/
├── src/
│   ├── components/
│   │   ├── WatchlistSearch.tsx  # New: Search dropdown component
│   │   └── WatchlistAdd.tsx     # New: Add button with loading state
│   ├── api/
│   │   └── watchlist.ts         # New: Watchlist API client
│   └── hooks/
│       └── useWatchlist.ts      # New: Watchlist state hook
└── tests/
    └── components/
        └── WatchlistSearch.test.tsx # New
```

**Structure Decision**: Web application structure (backend + frontend) is the established pattern for this project. All new watchlist, search, and backfill functionality follows the existing service/API/model separation.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | No constitution violations | N/A |

---

## Phase 0: Research & Technology Decisions

### Research Tasks

1. **PostgreSQL unique constraints for deduplication**
   - Question: Best pattern for candle deduplication (symbol, interval, timestamp)?
   - Impact: FR-015, FR-016 (idempotent candle storage)
   - Deliverable: Recommended constraint/index pattern

2. **yfinance rate limiting and error handling**
   - Question: What HTTP status codes does yfinance return for rate limits? How to detect?
   - Impact: FR-019, FR-025 (exponential backoff retry logic)
   - Deliverable: Retry pattern with specific error codes

3. **pandas_market_calendars NYSE calendar usage**
   - Question: How to check if a given datetime is a US market holiday?
   - Impact: FR-023, FR-024 (market-hours gating)
   - Deliverable: Code pattern for holiday checking

4. **FastAPI timeout configuration**
   - Question: How to enforce 60-second timeout for yfinance calls?
   - Impact: FR-013, FR-018 (backfill timeout)
   - Deliverable: Timeout pattern (asyncio.timeout, httpx timeout, or signal)

5. **Ticker universe data source**
   - Question: Best source for ~8,000 US equity symbols? Yahoo Finance listing?
   - Impact: FR-006, SC-011 (ticker_universe population)
   - Deliverable: Seed script data source and fetch pattern

6. **React search dropdown best practices**
   - Question: Debounce timing, keyboard navigation, accessibility
   - Impact: AC-001, AC-004 (search UX)
   - Deliverable: Component pattern recommendations

7. **Alembic migration pattern for new tables**
   - Question: How to structure watchlist and ticker_universe migrations?
   - Impact: FR-014, FR-015 (new database tables)
   - Deliverable: Migration structure

### Unknowns Requiring Clarification

None - all clarifications completed in `/speckit.clarify` session.

## Phase 1: Design Artifacts

### Data Model (data-model.md)

**Entities to design**:

1. **TickerUniverse** (new table)
   - Fields: symbol (PK), display_name, asset_class, created_at
   - Indexes: symbol, display_name (for search)
   - ~8,000 rows (US equities)

2. **WatchlistEntry** (new table)
   - Fields: id (PK), symbol (FK → Symbol), added_at
   - Unique constraint on symbol
   - Audit: created_at timestamp

3. **Candle** (existing, verify constraints)
   - Verify unique constraint on (symbol_id, interval, timestamp)
   - May need to add if not present

4. **Symbol** (existing, verify relationship)
   - Verify WatchlistEntry.symbol FK relationship
   - May need to add if not present

**Relationships**:
- TickerUniverse --(1:N)--> WatchlistEntry (via symbol)
- WatchlistEntry --(N:1)--> Symbol
- Symbol --(1:N)--> Candle

### API Contracts (contracts/)

**Endpoints to design**:

1. `GET /api/v1/symbols/search?q={query}` - Search ticker universe
   - Query params: q (1-5 chars)
   - Response: 200 with [{symbol, display_name}, ...]
   - Validation: 400 for invalid query length

2. `POST /api/v1/watchlist` - Add ticker to watchlist
   - Request: {symbol: string}
   - Response: 201 {status: "added"} or 200 {status: "already_present"}
   - Error: 400 with message for validation/backfill failures

3. `GET /api/v1/watchlist` - List watchlist entries
   - Response: 200 [{symbol, added_at}, ...]

4. `DELETE /api/v1/watchlist/{symbol}` - Remove from watchlist
   - Response: 204 on success

### Quickstart Guide (quickstart.md)

**Sections**:
1. Prerequisites (Python 3.11, Node.js, PostgreSQL)
2. Backend setup (dependencies, migrations, seed script)
3. Frontend setup (dependencies, API client)
4. Running the application
5. Testing the feature (manual test steps)

## Phase 2: Task Generation

**To be generated by `/speckit.tasks` command** - will create dependency-ordered tasks from research, data-model, and contracts.

---

## Next Steps

1. Run Phase 0 research tasks → generate `research.md`
2. Generate design artifacts → `data-model.md`, `contracts/*.yaml`, `quickstart.md`
3. Update agent context via `.specify/scripts/bash/update-agent-context.sh`
4. Re-run Constitution Check with design details
5. Execute `/speckit.tasks` to generate implementation tasks
