# Feature Specification: Indicator API Performance Optimization

**Feature Branch**: `014-indicator-cache-optimization`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "Optimize indicator API performance by implementing caching and query optimizations. Current bottleneck: Database query for candles takes ~300ms on every indicator request. Indicator calculation is now fast (~3ms). Need: (1) Add indicator result caching to avoid recalculation, (2) Optimize candle database query with in-memory cache, (3) Batch indicator calculations API, (4) Add database indexes for faster queries."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast Indicator Loading (Priority: P1)

As a trader, I want indicator data to load instantly when I add or change indicators on my chart so that I can analyze market conditions without waiting.

**Why this priority**: This is the primary user-facing pain point. Currently, users experience a noticeable delay (~325ms) each time they add an indicator, which disrupts their workflow and makes the application feel sluggish. Fast indicator loading directly impacts user satisfaction and perceived application performance.

**Independent Test**: Can be fully tested by measuring the time from when a user clicks "Add Indicator" to when the indicator appears on the chart. Success is when this completes in under 100ms (instant feel).

**Acceptance Scenarios**:

1. **Given** a user is viewing a chart with candle data loaded, **When** they add a new indicator (e.g., cRSI), **Then** the indicator appears on the chart within 100ms
2. **Given** a user changes an indicator parameter (e.g., adjusts period from 14 to 20), **When** the parameter is updated, **Then** the recalculated indicator displays within 100ms
3. **Given** a user adds the same indicator twice (same symbol, interval, and parameters), **When** they add it the second time, **Then** the indicator loads within 50ms (cached result)
4. **Given** a user switches between different symbols, **When** they return to a previously viewed symbol, **Then** indicators load within 100ms

---

### User Story 2 - Batch Indicator Loading (Priority: P2)

As a trader, I want to add multiple indicators at once and have them all load efficiently so that I can set up my preferred chart configuration quickly.

**Why this priority**: Power users often add 3-5 indicators to their charts. Without batch optimization, loading each indicator separately compounds the delay (e.g., 3 indicators × 300ms = 900ms). Batch loading provides a better experience for multi-indicator workflows.

**Independent Test**: Can be fully tested by adding multiple indicators simultaneously and measuring the total time. Success is when loading 3 indicators takes less than 200ms total (not 3× individual time).

**Acceptance Scenarios**:

1. **Given** a user adds 3 different indicators at once, **When** the batch request completes, **Then** all 3 indicators display within 200ms total
2. **Given** a user requests multiple indicators for the same symbol but different parameters, **When** the batch request processes, **Then** each indicator is calculated independently and results returned together
3. **Given** a batch request includes one indicator that fails calculation, **When** the error occurs, **Then** the other indicators in the batch still return successfully with clear error messaging for the failed one

---

### User Story 3 - High-Volume Concurrent Access (Priority: P3)

As a system, I want to support multiple traders loading indicators simultaneously without performance degradation so that the platform scales to handle peak usage.

**Why this priority**: Important for platform growth and supporting professional trading teams. Lower priority because single-user performance must be optimized first. This becomes critical as user base grows.

**Independent Test**: Can be tested by simulating concurrent indicator requests from multiple users. Success is when 50 concurrent indicator requests complete within 2 seconds each.

**Acceptance Scenarios**:

1. **Given** 50 users simultaneously request indicator calculations, **When** all requests process, **Then** each request completes within 2 seconds
2. **Given** the cache system is under heavy load, **When** cache entries expire or are evicted, **Then** the system gracefully falls back to database queries without errors
3. **Given** multiple users request the same indicator simultaneously, **When** the requests process, **Then** they share cached results rather than recalculating for each user

---

### Edge Cases

- What happens when the cache server becomes unavailable? System should gracefully fall back to direct database queries with appropriate logging
- What happens when candle data is updated (new candles arrive)? Cached indicator results should invalidate and recalculate on next request
- What happens when a user requests an indicator with invalid parameters? Return clear error message without caching the error result
- What happens when database query times out? Return user-friendly error and log the failure for monitoring
- What happens when memory cache is full? Implement appropriate eviction policy (LRU) and log cache evictions for monitoring
- What happens when batch request includes duplicate indicators? Recognize duplicates and return same result for both positions (results[i] maps to requests[i]) to avoid redundant calculation, preserving client-side indexing simplicity

## Clarifications

### Session 2026-01-02

- **Q**: How should the batch API handle duplicate indicator requests (identical symbol, interval, indicator, and params appearing multiple times in the requests array)?
  **A**: Return same result for both duplicate positions (results[i] maps to requests[i]). This maintains array correspondence for client simplicity while avoiding redundant calculation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST cache indicator calculation results to avoid redundant database queries and recalculations
- **FR-002**: System MUST cache candle data in memory to reduce database query overhead for frequently accessed symbols
- **FR-003**: System MUST invalidate cached indicator results when underlying candle data is updated
- **FR-004**: System MUST provide a batch API endpoint that accepts multiple indicator requests and returns all results in a single response
- **FR-005**: System MUST use cache keys that include symbol, interval, indicator name, and all parameters to ensure correctness
- **FR-006**: System MUST set appropriate cache expiration times based on candle interval (e.g., 1 hour for daily candles, 5 minutes for intraday)
- **FR-007**: System MUST log cache hit/miss metrics for monitoring and optimization
- **FR-008**: System MUST return cached results within 100ms (90th percentile), targeting 50ms for median performance
- **FR-009**: System MUST complete uncached indicator requests (database query + calculation) within 500ms
- **FR-010**: System MUST support batch requests of up to 10 indicators in a single API call
- **FR-011**: System MUST maintain backward compatibility with existing single-indicator API endpoints
- **FR-012**: System MUST handle cache failures gracefully by falling back to database queries
- **FR-013**: System MUST utilize database indexes on candle table columns (symbol_id, interval, timestamp) for optimized queries
- **FR-014**: System MUST limit batch request processing time to 5 seconds maximum to prevent long-running requests

### Key Entities

- **Indicator Cache Entry**: Stores calculated indicator results with key composed of symbol, interval, indicator name, parameters, and candle timestamp hash. Includes calculated data, timestamp, and TTL.
- **Candle Cache Entry**: Stores candle data for a symbol and interval. Includes OHLCV data, timestamp range, and last update time.
- **Cache Metadata**: Tracks cache performance metrics including hit rate, miss rate, eviction count, and average response time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Indicator requests complete within 100ms for cached results (90th percentile)
- **SC-002**: Indicator requests complete within 500ms for uncached results (90th percentile)
- **SC-003**: Batch requests for 3 indicators complete within 200ms total (90th percentile)
- **SC-004**: Cache hit rate exceeds 70% for frequently used indicators (same symbol/interval/params)
- **SC-005**: System supports 50 concurrent indicator requests without response time degradation beyond 2 seconds
- **SC-006**: Memory cache evictions remain below 10% of total cache operations per hour
- **SC-007**: Database query time for candles reduces from 300ms to under 100ms through indexing and query optimization
- **SC-008**: User-perceived latency for adding an indicator improves from 325ms to under 150ms on average

## Assumptions & Dependencies

### Assumptions

- Users primarily view indicators for a limited set of symbols (enables effective caching)
- Candle data is updated at predictable intervals (daily for daily candles, intraday for smaller intervals)
- Indicator calculation is deterministic (same inputs always produce same outputs)
- Sufficient memory is available for caching frequently accessed data
- Database connection pooling is properly configured for concurrent queries
- Existing indicator calculation code is thread-safe for concurrent execution

### Dependencies

- Existing database schema with candle table (already indexed on symbol_id, interval, timestamp)
- Existing indicator calculation services (already optimized to 3ms)
- Existing API infrastructure for adding new endpoints
- Cache layer (in-memory or Redis) available in the deployment environment

## Out of Scope

- Implementing real-time streaming of indicator updates (scheduled updates are sufficient)
- Cache warmup/preloading strategies (cache builds on-demand)
- Distributed caching across multiple server instances (single-server caching is acceptable for MVP)
- User-specific cache preferences or manual cache invalidation controls
- Historical indicator value storage or time-series database for indicator history
- Advanced cache analytics beyond basic hit/miss metrics
