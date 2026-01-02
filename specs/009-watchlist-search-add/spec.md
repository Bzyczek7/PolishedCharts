# Feature Specification: Watchlist Search, Add, and Historical Data Backfill

**Feature Branch**: `009-watchlist-search-add`
**Created**: 2025-12-27
**Status**: Draft
**Input**: User description: "009 Watchlist: enable ticker search + add button, and backfill full 1d history via yfinance on add."

## Clarifications

### Session 2025-12-27
- Q: Is the watchlist per-user (requires authentication) or globally shared across all users? → A: Global shared watchlist - Single application-wide watchlist shared by all users; no authentication required for watchlist operations.
- Q: What is the maximum acceptable timeout for synchronous historical data backfill during watchlist add? → A: 60 seconds - Generous timeout to accommodate slow connections and long histories.
- Q: What retry strategy should be used when Yahoo Finance rate limits requests during backfill or polling? → A: Exponential backoff with 3 retry attempts (wait 1s, 2s, 4s between retries).
- Q: Which library or API should be used to determine US market holidays for market-hours gating? → A: pandas_market_calendars library (NYSE calendar).
- Q: How should the ticker_universe table be populated and maintained for search functionality? → A: One-time seed script for initial population, with optional periodic refresh via cron job.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search and Add Tickers to Watchlist (Priority: P1)

As a trader, I want to search for stock tickers by typing in the search bar and add them to my watchlist, so that I can track multiple symbols without manually entering data.

**Why this priority**: This is the core user-facing functionality that unlocks the entire watchlist feature. Without search and add, users are limited to pre-configured symbols only.

**Independent Test**: Can be fully tested by opening the watchlist page, typing a ticker like "AAPL", selecting from results, clicking "+", and verifying the ticker appears in the watchlist with complete historical data.

**Acceptance Scenarios**:

1. **Given** the watchlist page is loaded, **When** the user types "AAPL" in the search bar, **Then** a dropdown appears showing "AAPL - Apple Inc." and other matching results
2. **Given** search results are displayed, **When** the user selects a valid ticker and clicks the "+" button, **Then** the UI shows a loading state while the system validates the ticker, downloads historical data, creates a watchlist entry, and only then inserts the ticker into the watchlist display
3. **Given** a ticker is already in the watchlist, **When** the user attempts to add it again, **Then** the system indicates it's already present and does not create a duplicate
4. **Given** the user types an invalid ticker or a ticker with no available historical data, **When** the user clicks "+", **Then** the system rejects the request with a clear error message and no watchlist entry is created
5. **Given** the user selects a ticker but historical data backfill fails, **When** the add operation executes, **Then** the entire add transaction is rejected with a clear error message and no partial watchlist entry is created

---

### User Story 2 - Transactional Historical Data Backfill (Priority: P1)

As a trader, I want the system to validate that historical data exists and download it atomically before creating a watchlist entry, so that I only see tickers in my watchlist that have complete historical data available.

**Why this priority**: Without transactional add behavior, users could have watchlist entries with no data, causing confusion and broken charts. This ensures data integrity.

**Independent Test**: Can be fully tested by adding a new ticker via the watchlist and verifying that (a) historical daily OHLCV candles have been stored AND (b) the watchlist entry only appears after successful backfill completion.

**Acceptance Scenarios**:

1. **Given** a user attempts to add a valid ticker, **When** the add operation executes, **Then** the system validates the ticker, attempts full historical backfill, and only creates a watchlist entry after backfill succeeds
2. **Given** historical data backfill completes successfully, **When** the user views the chart for that ticker, **Then** complete historical price data is visible going back to the earliest available date
3. **Given** the user attempts to add a ticker where yfinance returns no data, **When** the backfill executes, **Then** the add request is rejected with a clear error message and no watchlist entry is created
4. **Given** historical data backfill is interrupted (network failure, server restart), **When** the user retries adding the same ticker, **Then** the system resumes or completes the backfill without creating duplicate candle records

---

### User Story 3 - Dynamic Poller with Market-Hours Gating (Priority: P2)

As a system operator, I want the data poller to automatically pick up tickers from the watchlist and only fetch equity prices during market hours, so that we avoid wasted API calls during off-hours.

**Why this priority**: This is an operational improvement that reduces unnecessary load and costs. It doesn't block initial value delivery but optimizes system behavior.

**Independent Test**: Can be fully tested by (a) adding a ticker to the watchlist and verifying the poller picks it up, and (b) verifying that equity polling is skipped on weekends/holidays.

**Acceptance Scenarios**:

1. **Given** the application starts, **When** the poller initializes, **Then** it loads the list of tickers from the database watchlist instead of a hard-coded configuration
2. **Given** the poller is running during US equity market hours (9:30 AM - 4:00 PM ET, Monday-Friday, excluding holidays), **When** a polling cycle occurs, **Then** the system fetches price updates for all equity tickers in the watchlist
3. **Given** the poller is running outside US equity market hours (weekends, holidays, pre-market, after-hours), **When** a polling cycle occurs, **Then** the system skips fetching for equity tickers and logs the skip reason
4. **Given** the poller is running on a US market holiday (e.g., July 4th) during regular business hours, **When** a polling cycle occurs, **Then** the system skips fetching for equity tickers and logs the holiday skip reason
5. **Given** a new equity ticker is added to the watchlist, **When** the next polling cycle during market hours occurs, **Then** the poller fetches price updates for that ticker
6. **Given** a ticker is removed from the watchlist, **When** the next poll cycle runs, **Then** the poller stops fetching updates for that ticker

---

### Edge Cases

- What happens when the user types a partial ticker symbol (e.g., "APP" instead of "AAPL")?
  - System should return fuzzy-matched results (e.g., "APP" matches "APP", "APP.F", "AAPL" if supported)
- What happens when yfinance returns no data for a valid-looking ticker?
  - The add request is rejected with a clear error message, and no watchlist entry is created
- What happens when the same ticker is added simultaneously from two browser tabs?
  - Second add should return "already_present" status without creating duplicates
- What happens when historical data backfill is interrupted (network failure, server restart)?
  - System should resume or retry the backfill on next add attempt, using idempotent candle storage to avoid duplicates
- What happens when a ticker symbol format varies (e.g., "AAPL", "aapl", "aapl.US")?
  - System should normalize to a standard format (uppercase, trim whitespace) and handle common Yahoo Finance suffixes
- How does the system handle tickers from different exchanges (e.g., "AAPL" vs "AAPL.TO" for Toronto)?
  - MVP assumes basic Yahoo Finance format validation; full multi-exchange support is out of scope
- What happens when the watchlist grows very large (100+ tickers)?
  - Poller should continue functioning during market hours only; backfill operations should queue without blocking UI
- What happens during extended hours trading (pre-market 4:00-9:30 AM ET, after-hours 4:00-8:00 PM ET)?
  - Equity polling is skipped; only regular session (9:30 AM-4:00 PM ET) triggers equity data fetching
- What happens when yfinance doesn't support a particular crypto asset?
  - The add request fails like any other unsupported ticker; watchlist add/backfill applies to tickers supported by yfinance

## Requirements *(mandatory)*

### Functional Requirements

#### Search and Discovery
- **FR-001**: System MUST allow users to search for ticker symbols by typing a query string of 1-5 characters
- **FR-002**: System MUST return search results limited to US equities for the MVP
- **FR-003**: System MUST display search results that include ticker symbol and display name (company name or description)
- **FR-004**: System MUST display search results in a dropdown or list format for selection
- **FR-005**: System MUST handle partial ticker matches (e.g., "GOO" matches "GOOGL", "GOOG")
- **FR-006**: System MUST query the ticker_universe database table for search results, which is populated via a one-time seed script with optional periodic refresh

#### Search Acceptance Criteria (Machine-Verifiable)
- **AC-001**: Search input debounces user input at 300ms before calling GET /api/v1/symbols/search
- **AC-002**: Search dropdown displays ticker symbol and company name in two-column format
- **AC-003**: Partial query "GOO" returns both "GOOGL" and "GOOG" if both exist in ticker_universe table
- **AC-004**: Selecting a result populates the search input with the exact ticker symbol and closes dropdown
- **AC-005**: Empty query (0 chars) or invalid query (>5 chars) prevents search API call and shows inline validation error

#### Watchlist Management (Transactional Add Flow)
- **FR-007**: System MUST allow users to add a selected ticker to their watchlist via a "+" button
- **FR-008**: System MUST normalize ticker input (trim whitespace, convert to uppercase) before processing
- **FR-009**: System MUST prevent duplicate watchlist entries for the same ticker
- **FR-010**: System MUST execute add operations as a transaction: validate ticker → backfill historical data → create watchlist entry (reject entirely if backfill fails)
- **FR-011**: System MUST return status "added" on successful completion or "already_present" if ticker exists in watchlist
- **FR-012**: System MUST return an error response (not a "failed" status) if the ticker cannot be added due to validation or backfill failure
- **FR-013**: System MUST display a loading state to the user during the synchronous backfill operation and time out after 60 seconds with a clear error message

#### Historical Data Backfill
- **FR-014**: System MUST automatically download daily OHLCV (Open, High, Low, Close, Volume) data for the maximum available period before creating a watchlist entry
- **FR-015**: System MUST store historical candles in the database associated with the correct ticker
- **FR-016**: System MUST use idempotent storage operations to avoid creating duplicate candle entries for the same ticker, date, and interval
- **FR-017**: System MUST execute backfill operations synchronously as part of the add transaction (ticker is not added to watchlist until backfill completes)
- **FR-018**: System MUST return a clear error message if backfill fails (invalid ticker, no data available, network error, timeout after 60 seconds) and reject the add request
- **FR-019**: When Yahoo Finance raises rate limit exceptions (YFRateLimitError) during backfill, system MUST retry with exponential backoff (1s, 2s, 4s delays) up to 3 attempts before failing
- **FR-020**: Watchlist add and backfill functionality applies to US equities only. Attempts to add crypto-style tickers (*-USD, */USD format) via POST /api/v1/watchlist are rejected with HTTP 400 error "Only US equities supported in watchlist add/backfill. Crypto tickers are not supported in watchlist." Existing crypto polling configuration remains unchanged and is outside the scope of this feature.

#### Real-Time Data Integration with Market-Hours Gating
- **FR-021**: System MUST load the current watchlist from the database when the data poller starts
- **FR-022**: System MUST re-read the watchlist from the database on each polling cycle to pick up newly added tickers
- **FR-023**: System MUST fetch and store current price data for equity tickers only during US market regular session (9:30 AM - 4:00 PM ET, Monday-Friday, excluding holidays)
- **FR-024**: System MUST skip equity polling outside regular session hours (pre-market, after-hours, weekends, holidays)
- **FR-025**: When Yahoo Finance raises rate limit exceptions (YFRateLimitError) during polling, system MUST retry with exponential backoff (1s, 2s, 4s delays) up to 3 attempts before logging the failure and skipping the current cycle

#### Error Handling and Observability
- **FR-026**: System MUST return a clear error message when an invalid ticker is submitted
- **FR-027**: System MUST return a clear error message and reject the add request when backfill fails
- **FR-028**: System MUST log all watchlist operations (add_attempt, add_success, add_rejected)
- **FR-029**: System MUST log all backfill operations (started, completed, failed, rate_limited_with_retry)
- **FR-030**: System MUST log poller market-hours gating decisions (skipped_equity_polling: reason including holiday or weekend)
- **FR-031**: System MUST log polling rate limit events with retry counts and final outcome (success or skip_cycle)

### Key Entities

- **Ticker Symbol**: A tradable asset identifier available through Yahoo Finance (e.g., "AAPL" for Apple Inc., "BTC-USD" for Bitcoin), includes the symbol code, display name, and asset class (equity vs 24/7)
- **Ticker Universe**: Database table containing searchable US equity ticker symbols and company names, populated via a one-time seed script with optional periodic refresh
- **Watchlist Entry**: Represents a successfully added US equity ticker in the application-wide global watchlist (shared by all users), only created after historical data backfill completes successfully. No user association required.
- **Candle**: Historical price data point containing timestamp, open price, high price, low price, close price, and volume for a specific ticker and interval
- **Market Session**: Time period during which equity polling is active (US regular session: 9:30 AM - 4:00 PM ET, Monday-Friday, excluding holidays)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully add any valid US stock ticker with complete historical data to their watchlist
- **SC-002**: 95% of ticker search attempts (querying 1-5 characters) return at least one result from ticker_universe within 2 seconds, provided matching tickers exist in the database (e.g., "AAPL" query returns AAPL if present)
- **SC-003**: 100% of ticker add requests result in either a successful watchlist entry with complete data OR a clear error rejection (no partial/failed entries)
- **SC-004**: Backfilled data includes at least 5 years of daily candles for established US stocks (or maximum available if less)
- **SC-005**: Newly added tickers appear in the data poller within 30 seconds of watchlist addition
- **SC-006**: Zero duplicate watchlist entries are created when the same ticker is added multiple times
- **SC-007**: Zero duplicate candle records are created when backfill is retried after interruption
- **SC-008**: 100% of failed add operations return clear, actionable error messages with no watchlist entry created
- **SC-009**: Equity polling occurs only during US market regular session hours (verified by log analysis showing skipped polls on weekends/holidays)
- **SC-010**: Backfill operations that exceed 60 seconds timeout are rejected with clear error message and no watchlist entry created
- **SC-011**: Ticker universe table is pre-populated with searchable US equity symbols via seed script before application deployment

## In Scope *(include if relevant)*

- Ticker universe database table populated via one-time seed script with optional periodic refresh via cron job
- Search for US stock tickers by symbol or company name (search universe: US equities only for MVP)
- Add tickers to a persistent user watchlist using transactional flow (validate → backfill → commit)
- Watchlist add and backfill applies to US equities only (other assets are polling-only)
- Automatic backfill of historical daily OHLCV data as a precondition to adding ticker
- Rejection of add requests when backfill fails (no partial watchlist entries)
- Prevention of duplicate watchlist entries and candle data through idempotent operations
- Integration with existing data poller with dynamic watchlist loading
- Poller re-reads watchlist from database each cycle to pick up additions
- Market-hours gating for equity polling (regular session only: 9:30 AM - 4:00 PM ET)
- Basic error handling with clear error messages for rejected add requests
- Loading state displayed to users during synchronous backfill operation

## Out of Scope *(include if relevant)*

- Perfect symbol discovery across all global exchanges (MVP focuses on US equities only)
- Extended hours polling (pre-market 4:00-9:30 AM ET, after-hours 4:00-8:00 PM ET) — regular session only
- Intraday historical data backfill (1-minute, 5-minute intervals) — daily only
- Real-time streaming data (continues to use polling mechanism)
- User authentication and per-user watchlists (global shared watchlist only)
- Watchlist organization (folders, tags, categories)
- Bulk ticker import (e.g., from CSV file)
- Advanced search filters (sector, market cap, exchange)
- Watchlist add/backfill for non-equity asset classes (crypto polling-only, data assumed from other sources)
- Customizable backfill periods (defaults to "max" available)
- Partial watchlist entries (entries without complete historical data)
- Watchlist entries with "failed" or "queued" backfill status
- Modifications to existing crypto polling configuration (crypto remains polling-only, changes are outside scope)
- Watchlist add/backfill functionality for crypto assets
- Forex currency pairs (forex has weekend close and different session hours; out of scope for MVP)

## Assumptions *(include if relevant)*

- Yahoo Finance via yfinance library provides sufficient data quality for US equities and selected crypto assets
- US equity market regular session is 9:30 AM - 4:00 PM Eastern Time, Monday-Friday, excluding holidays observed by NYSE/NASDAQ
- pandas_market_calendars library (NYSE calendar) accurately represents US equity market holidays and trading hours
- Existing poller includes 24/7 assets (e.g., BTC-USD) that must not be subject to market-hours gating
- Existing Candle and Symbol database models can be extended without breaking changes
- The data poller can be modified to read from the database instead of a configuration file
- Users have basic familiarity with stock ticker symbols
- Network connectivity to Yahoo Finance is reliable enough for backfill operations
- Daily data volume per ticker is manageable within current database constraints
- Frontend is a single-page application capable of displaying loading states and error responses
- CORS configuration allows the frontend to communicate with the backend API
- Crypto assets available through Yahoo Finance trade 24/7 (no market-hours gating needed)

## Dependencies *(include if relevant)*

- Existing Candle and Symbol database models and tables
- Existing data poller infrastructure with hard-coded symbol list
- Yahoo Finance data accessibility via yfinance Python library (supports US equities and select crypto)
- pandas_market_calendars library for determining US equity market holidays and trading hours (NYSE calendar)
- Ticker universe seed script for initial database population (fetches from Yahoo Finance or static source)
- Optional cron job or scheduled task for periodic ticker universe refresh
- Backend API framework (FastAPI) with CORS enabled for frontend
- Frontend watchlist component with search input and add button UI elements (currently non-functional)
- Database access layer supporting upsert operations to prevent candle duplicates

## Risks *(include if relevant)*

- Yahoo Finance may rate-limit or block automated data access, requiring backoff strategies
- Historical data download may be slow for tickers with very long histories (decades), increasing add latency and user wait time
- Invalid ticker formats may cause confusing errors if not properly validated
- Transactional add flow may result in longer wait times for users (UI must show loading state during backfill)
- Concurrent watchlist modifications may race with poller updates
- Large watchlists (100+ tickers) may slow down the poller cycle time during market hours
- Market holiday calendar may be incomplete or inaccurate, leading to unnecessary polling attempts
- Time zone handling for market hours (Eastern Time) may cause confusion if not properly configured
- 24/7 asset detection logic may incorrectly classify some assets as equities or vice versa
- Yahoo Finance crypto support may be limited or change without notice
