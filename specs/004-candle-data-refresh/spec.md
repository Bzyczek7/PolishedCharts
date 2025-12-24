# Feature Specification: Candle Data and Refresh

**Feature Branch**: `004-candle-data-refresh`
**Created**: 2025-12-24
**Status**: Draft
**Input**: User description: "004-candle-data-and-refresh - Design how candles and watchlist prices are fetched from the backend (yfinance-based), how initial history and backfill work, and how periodic polling keeps the main chart and watchlist reasonably up to date for different intervals, without WebSockets."

## Clarifications

### Session 2025-12-24

- Q: What are the specific refresh frequencies for each time interval? → A: Balanced approach - 5 seconds for 1m/5m intervals, 15 seconds for 15m/1h intervals, 1 minute for 1d intervals, 5 minutes for 1w intervals
- Q: How long should cached data be valid before invalidation? → A: Session-based caching - invalidates on manual refresh, symbol switch, 30-minute idle timeout, or interval-specific minimums (10 candles for 1m/5m, 4 candles for 15m/1h, daily for 1d+)
- Q: What is the retry behavior when data fetch fails? → A: Exponential backoff with 3 retries (1s, 2s, 4s delays)
- Q: What is the watchlist refresh frequency? → A: 60 seconds - conservative approach minimizing API usage
- Q: What is the rate limiting threshold? → A: No hard limit - respect provider's returned headers (429 responses) and back off accordingly

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Historical Candle Data (Priority: P1)

A user opens the application and views a stock's candle chart. The system displays historical price data (open, high, low, close, volume) for the selected time interval, showing enough past data to provide meaningful context for analysis.

**Why this priority**: This is the core functionality of the application. Without historical candle data, users cannot perform any technical analysis or make trading decisions.

**Independent Test**: Can be fully tested by selecting a stock and verifying that historical candles appear on the chart with correct OHLCV data. Delivers immediate value by enabling users to view and analyze price history.

**Acceptance Scenarios**:

1. **Given** a user opens the application, **When** they select a stock symbol, **Then** the chart displays historical candles for the default time interval
2. **Given** a user is viewing a chart, **When** they change the time interval (e.g., from 1-day to 1-hour), **Then** the chart refreshes to show appropriate candle data for the new interval
3. **Given** a user is viewing a chart, **When** the initial data load completes, **Then** at least 100-200 historical candles are visible (depending on interval)

---

### User Story 2 - Real-Time Candle Updates (Priority: P2)

A user keeps the chart open. The system periodically fetches new price data and updates the chart with the latest candle information, keeping the display reasonably current without requiring manual refresh.

**Why this priority**: Real-time updates are essential for active trading, but users can still derive value from historical data alone. This enhances the core experience rather than enabling it.

**Independent Test**: Can be tested by opening a chart, waiting for the refresh interval, and verifying that new/updated candles appear. Delivers value by keeping traders informed of recent price movements.

**Acceptance Scenarios**:

1. **Given** a user has a chart open, **When** the refresh interval elapses, **Then** the system fetches and displays updated candle data
2. **Given** new price data is available, **When** the update occurs, **Then** the current candle updates in place (for the forming candle) or a new candle appears (for completed intervals)
3. **Given** the user switches between intervals, **When** viewing different intervals, **Then** each interval uses an appropriate refresh frequency (faster for shorter intervals, slower for longer intervals)

---

### User Story 3 - Watchlist Price Updates (Priority: P3)

A user has a watchlist of multiple stocks. The system periodically updates the current price and basic price information (last price, change, change percentage) for each stock in the watchlist, allowing users to monitor multiple symbols simultaneously.

**Why this priority**: Watchlist monitoring is a convenience feature that improves workflow efficiency. Users can still monitor individual stocks without it, making it lower priority than core chart functionality.

**Independent Test**: Can be tested by adding multiple stocks to a watchlist and verifying that prices update periodically. Delivers value by enabling efficient multi-symbol monitoring.

**Acceptance Scenarios**:

1. **Given** a user has stocks in their watchlist, **When** the refresh interval elapses, **Then** current prices update for all watchlist entries
2. **Given** a price changes, **When** the watchlist updates, **Then** the change amount and percentage are recalculated and displayed
3. **Given** the watchlist is open, **When** prices update, **Then** visual indicators show direction (up/down) and magnitude of change

---

### User Story 4 - Historical Backfill (Priority: P4)

When a user scrolls back in time on the chart, the system automatically fetches additional historical data beyond the initially loaded range, allowing users to view older price history without manual intervention.

**Why this priority**: Backfill is an enhancement that improves user experience for deep historical analysis. Most users primarily focus on recent data, making this a convenience feature rather than a core requirement.

**Independent Test**: Can be tested by scrolling left on the chart and verifying that older candles appear. Delivers value by enabling seamless historical exploration.

**Acceptance Scenarios**:

1. **Given** a user is viewing a chart, **When** they scroll back beyond the initially loaded data, **Then** the system fetches and displays older historical candles
2. **Given** a user scrolls back quickly, **When** multiple backfill requests are needed, **Then** data loads smoothly without duplicate or missing candles
3. **Given** backfill data arrives, **When** it is added to the chart, **Then** the chart view adjusts appropriately to show the requested time range

---

### Edge Cases

- What happens when the external data source (market data provider) is unavailable or returns errors?
- How does the system handle market closures (weekends, holidays) when fetching real-time data?
- What happens when a user requests data for a delisted or invalid stock symbol?
- How does the system behave when internet connectivity is lost or intermittent?
- What happens when a user rapidly switches between intervals or symbols?
- How does the system handle pre-market and after-hours trading data?
- What happens during the transition between trading sessions (e.g., from regular to after-hours)?
- How does the system handle very short intervals (seconds/minutes) vs very long intervals (months/years)?
- What happens when the watchlist contains a large number of symbols (50+)?
- How does the system handle symbols with sparse or incomplete historical data?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST fetch historical candle data (Open, High, Low, Close, Volume) for any requested stock symbol and time interval
- **FR-002**: System MUST load an initial set of historical data (minimum 100 candles) when a chart is first opened
- **FR-003**: System MUST support multiple time intervals (e.g., 1m, 5m, 15m, 1h, 1d, 1w)
- **FR-004**: System MUST automatically refresh candle data at regular intervals without user intervention
- **FR-005**: System MUST use appropriate refresh frequencies for different intervals (shorter intervals refresh more frequently)
- **FR-006**: System MUST fetch and display current price information for stocks in a user's watchlist
- **FR-007**: System MUST calculate and display price change and percentage change for watchlist entries
- **FR-008**: System MUST automatically fetch additional historical data when a user scrolls beyond the currently loaded range
- **FR-009**: System MUST handle data fetch failures gracefully with exponential backoff retry (3 attempts with 1s, 2s, 4s delays), respect 429 (Too Many Requests) responses by backing off per provider headers, and display appropriate user feedback upon final failure
- **FR-010**: System MUST implement dynamic rate limiting that adapts to provider constraints rather than using hard-coded request limits
- **FR-011**: System MUST avoid making excessive redundant requests for the same data
- **FR-012**: System MUST display loading indicators when data is being fetched
- **FR-013**: System MUST update the "current forming candle" in real-time as new price data arrives
- **FR-014**: System MUST distinguish between completed candles and the currently forming candle
- **FR-015**: System MUST handle market schedule awareness (don't poll excessively during market closures)
- **FR-016**: System MUST validate stock symbols before attempting to fetch data
- **FR-017**: System MUST cache recently fetched data using session-based caching with invalidation on: manual refresh, symbol switch, 30-minute idle timeout, or interval-specific minimum passage (10 candles for 1m/5m intervals, 4 candles for 15m/1h intervals, daily for 1d+ intervals)
- **FR-018**: System MUST allow users to manually trigger a refresh if desired
- **FR-019**: System MUST display the last update timestamp for data shown on charts and watchlist

### Key Entities

- **Candle**: Represents a single time period's price data containing timestamp, open price, high price, low price, close price, and volume
- **Time Interval**: Defines the duration of each candle (e.g., 1 minute, 1 hour, 1 day)
- **Watchlist Entry**: Represents a user-tracked stock symbol with current price, change amount, change percentage, and last update time; refreshes every 60 seconds
- **Data Refresh Policy**: Defines how often data should be fetched for a given interval type. Specific frequencies: 5 seconds for 1m/5m intervals, 15 seconds for 15m/1h intervals, 1 minute for 1d intervals, 5 minutes for 1w intervals
- **Data Range**: Represents a contiguous span of time for which candle data is available or requested

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users see initial chart data load within 3 seconds of selecting a stock symbol
- **SC-002**: Chart updates with new price data within 5 seconds of the data becoming available from the source
- **SC-003**: Watchlist prices update every 60 seconds during market hours for actively monitored symbols
- **SC-004**: Users can scroll back through at least 6 months of daily candle data without experiencing loading delays longer than 2 seconds per scroll action
- **SC-005**: System handles at least 50 watchlist symbols with update frequencies under 10 seconds for the entire list
- **SC-006**: Less than 5% of data fetch requests fail or timeout during normal market hours with adequate internet connectivity
- **SC-007**: Users can switch between time intervals and see correctly formatted data within 3 seconds
- **SC-008**: System reduces redundant data requests by at least 80% through intelligent caching
- **SC-009**: 95% of users report that the displayed data feels "current enough" for their analysis needs (within the constraints of polling-based refresh)

## Assumptions

1. Market data will be sourced from a free/yfinance-style provider with standard rate limits and availability
2. Real-time in this context means "reasonably current" via polling, not instantaneous WebSocket updates
3. Users understand that data may have delays of several seconds to minutes depending on the interval
4. The application is primarily for retail trading analysis, not high-frequency trading
5. Standard US market hours apply unless otherwise specified (pre-market and after-hours are optional enhancements)
6. Historical data availability depends on the data source (typically 1-5 years for daily intervals)
7. Users have internet connectivity for data fetching; offline mode is not supported
8. The system implements dynamic rate limiting by respecting provider's returned headers and backing off on 429 (Too Many Requests) responses, rather than using hard-coded request limits
9. Watchlist refresh occurs every 60 seconds (conservative approach to minimize API usage)
10. Backfill data will be fetched in chunks rather than all at once to optimize performance

## Dependencies

- External market data provider (yfinance or similar) must be accessible and responsive
- User's device must maintain internet connectivity for data updates
- Stock symbols must be valid and supported by the data provider
- System time must be reasonably accurate for proper candle timestamping
