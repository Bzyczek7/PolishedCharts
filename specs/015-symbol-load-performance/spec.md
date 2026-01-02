# Feature Specification: Symbol Load Performance Optimization

**Feature Branch**: `015-symbol-load-performance`
**Created**: 2025-01-02
**Status**: Draft
**Input**: User description: "Plan: One-At-A-Time Performance Optimization - Optimize symbol load time from ~5900ms to <500ms using a methodical, one-fix-at-a-time approach with isolated, measurable fixes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast Symbol Switching (Priority: P1)

As a trader actively analyzing multiple symbols, I want to switch between charts instantly so that I can quickly compare technical indicators across different stocks without waiting.

**Why this priority**: This is the core user experience issue. Traders frequently switch between 5-20 symbols during analysis sessions. Current 5-6 second wait times disrupt workflow and cause users to lose focus or abandon comparisons.

**Independent Test**: Can be tested by clicking different symbols in the watchlist and measuring the time from click to chart fully rendering with all indicators. Delivers immediate value by reducing friction in the primary trading workflow.

**Acceptance Scenarios**:

1. **Given** a user viewing a chart for symbol "O", **When** they click on symbol "AMZN" in the watchlist, **Then** the chart should render completely with all indicators in ~2100-2400ms
2. **Given** a user rapidly clicking 5 different symbols, **When** each symbol is clicked, **Then** each chart should render within the target time (~2100-2400ms) without lag or freezing
3. **Given** a user viewing a chart with 3 indicators loaded, **When** they switch symbols, **Then** all 3 indicators should appear on the new symbol's chart within the target time

---

### User Story 2 - Eliminate Duplicate Data Fetching (Priority: P2)

As a user, I want the system to fetch indicator data efficiently (only once per symbol) so that my bandwidth is used productively and load times are minimized.

**Why this priority**: This directly addresses the wasted 1000-1500ms from duplicate indicator fetching. It's a clear technical fix with measurable user impact, making it the second priority after the overall experience improvement.

**Independent Test**: Can be tested by monitoring network requests in browser DevTools when switching symbols. Should see exactly one indicator API call per symbol after candles are loaded. Delivers value by removing unnecessary network traffic and reducing wait time.

**Acceptance Scenarios**:

1. **Given** a user switches to a new symbol, **When** the candle data arrives, **Then** exactly one indicator fetch should occur (not two)
2. **Given** a user switches symbols multiple times, **When** monitoring network activity, **Then** no indicator fetch should occur before candle data is received
3. **Given** a user loads a symbol for the first time, **When** candles finish loading, **Then** indicators should be fetched and display on chart

---

### User Story 3 - Reduced Debounce Timer (Priority: P3)

As a user, I want the chart to become interactive as soon as data is ready, without artificial delays, so that I can immediately begin my analysis.

**Why this priority**: After eliminating duplicate fetches, the 2000ms debounce timer becomes the bottleneck. Reducing it to 200ms saves 1800ms and makes the app feel more responsive. This is P3 because it depends on P2 being complete first.

**Independent Test**: Can be tested by measuring the time from "indicators fetched" message to when the chart becomes interactive. Delivers value by removing unnecessary waiting after data is loaded.

**Acceptance Scenarios**:

1. **Given** indicators have finished fetching, **When** 200ms passes without additional indicator activity, **Then** the chart should become interactive immediately
2. **Given** a user loads a symbol, **When** all data arrives, **Then** the total time to interactivity should be ~2100-2400ms (after optimizations)
3. **Given** a user switches symbols rapidly, **When** they stop on a symbol, **Then** the chart should become interactive within 200ms of the last indicator fetch completing

---

### Edge Cases

- **Rapid symbol switching**: When user switches symbols before indicators finish loading, system MUST cancel pending indicator fetches for the previous symbol using AbortController. All retries for the cancelled fetch MUST terminate immediately. Only the latest symbol receives new fetches.

- **Candle data fetch fails**: System MUST show user-friendly error and MUST NOT attempt indicator fetch (indicators depend on candles). Chart remains interactive with cached data if available.

- **Indicator API is slow (>200ms response time)**: Debounce timer extends automatically - chart becomes interactive 200ms after LAST indicator fetch completes. Slow responses do not block interactivity.

- **No indicators configured**: Chart becomes interactive immediately after candles load; debounce timer is NOT set when indicators array is empty.

- **Poor network conditions**: System uses FR-011 standardized retry policy:
  - Network errors (5xx, timeout): Retry with exponential backoff (100ms, 200ms, 400ms), max 2 retries
  - Client errors (4xx): No retries, show error immediately
  - Symbol switch during retry: AbortSignal terminates all retry attempts immediately
  - Total fetch timeout per indicator: 500ms maximum (includes retries)
  - Error messages displayed to user after all retries exhausted

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST eliminate duplicate indicator data fetches when switching symbols
- **FR-002**: System MUST only fetch indicators after candle data has been received and processed
- **FR-003**: System MUST cancel pending indicator fetches when user switches to a new symbol before previous fetch completes
- **FR-004**: System MUST reduce the debounce timer from 2000ms to 200ms after duplicate fetches are eliminated
- **FR-005**: System MUST measure and report total symbol load time from user action to chart interactivity
- **FR-006**: System MUST show user-friendly error messages when indicator fetches fail, implemented through the centralized fetch wrapper (FR-011) with standardized error taxonomy and Retry action
- **FR-007**: System MUST become interactive immediately after candles load when no indicators are configured
- **FR-008**: System MUST log each optimization phase (before/after metrics) for validation
- **FR-009**: System MUST support rapid symbol switching without freezing or lag
- **FR-010**: System MUST implement optimizations as isolated, independently testable changes
- **FR-011**: All indicator fetches MUST use a centralized fetch wrapper that enforces standardized cancellation and retry policies:
  - Each fetch call MUST accept an AbortSignal from the symbol-load context
  - Retries MUST be bounded per symbol-load event (max 2 retries per indicator)
  - Retry attempts MUST NOT exceed 500ms total timeout per indicator
  - AbortSignal MUST immediately terminate all retries for that fetch
  - Network errors MUST trigger retry with exponential backoff (100ms, 200ms, 400ms)
  - 4xx errors MUST NOT be retried (client error, not transient)
  - Error taxonomy: "Network timeout", "Server error (5xx)", "Client error (4xx)", "Cancelled"
  - UI: Toast notification with error type + Retry button after all retries exhausted
  - Retry button re-runs fetch with same FR-011 policy

### Key Entities

- **Symbol Load Event**: Represents a user-initiated symbol switch, includes timestamp, symbol identifier, and completion time
- **Indicator Fetch**: Represents a request for indicator calculations, includes symbol, interval, date range, and whether it was duplicate
- **Candle Data**: Represents historical OHLCV data for a symbol, required before indicators can be fetched
- **Debounce Timer**: Represents the wait period after indicator activity before marking chart as interactive

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Symbol load time reduces from ~5900ms to ~2100-2400ms (60% improvement) after frontend optimizations
- **SC-002**: Only ONE indicator fetch occurs per symbol switch (verified via network monitoring)
- **SC-003**: No indicator fetch occurs before candle data arrives (verified via timing logs)
- **SC-004**: Time from last indicator fetch to interactive chart is 200ms (reduced from 2000ms)
- **SC-005**: Each optimization is independently measurable and validated before proceeding to next
- **SC-006**: Rapid symbol switching (5 symbols in 10 seconds) works without freezing or errors
- **SC-007**: 100% of indicator fetches occur after candle data arrives (no premature fetches)
- **SC-008**: Chart becomes interactive within 2500ms for 95% of symbol switches

### Extended Optimization Targets (Future Work)

| Phase | Description | Target Improvement | Validation Method |
|-------|-------------|-------------------|-------------------|
| 1 | Eliminate duplicate fetches | -1000 to -1500ms | Network DevTools monitoring |
| 2 | Reduce debounce timer | -1800ms | Console timing logs |
| 3 | Batch/parallel API calls | -200 to -500ms | API response timing |
| **A** | Client-side caching (future) | -1000 to -1500ms | Cache hit rate monitoring |
| **B** | Backend optimization (future) | -500 to -1000ms | API response time analysis |
| **C** | <500ms stretch goal | Requires Phases A+B | Cross-app optimization |

**Note**: The <500ms target is achievable only after completing extended optimizations (A+B) in future features. This feature (Phases 1-3) delivers ~60% improvement to ~2100-2400ms.

## Assumptions

1. Users have indicators configured (ADXVMA, CRSI, TDFI based on current implementation)
2. Candle data fetch time remains relatively stable (~500-1000ms)
3. Backend indicator calculation time is not the bottleneck
4. Network latency between frontend and backend is <100ms
5. Target of <500ms is achievable after all three optimizations
6. Each optimization can be implemented and tested independently
7. Baseline measurements (~5900ms) are accurate and representative
8. Users primarily experience slow load times when switching symbols, not on initial app load

## Out of Scope

- Backend indicator calculation optimization (separate feature)
- Database query optimization (covered in Feature 014)
- Initial application load time (only focusing on symbol switching)
- Mobile app performance (web only for this feature)
- Indicator algorithm efficiency
- WebSocket message optimization
- Chart rendering performance beyond the triple requestAnimationFrame wait

---

## Clarifications

### Session 2025-01-02

- Q: User Story scenarios conflict with updated SC-001 (~2100-2400ms vs <500ms targets) - which should take precedence? → A: Updated US1 AC1/AC2 and US3 AC2 to specify ~2100-2400ms, matching SC-001 achievable target. The <500ms goal moved to Extended Optimization Targets for future work.
- Q: FR-006 "user-friendly error messages" undefined - what format/placement? → A: Implemented through centralized fetch wrapper (FR-011) with standardized error taxonomy ("Network timeout", "Server error (5xx)", "Client error (4xx)", "Cancelled") + Toast notification with error type + Retry button. Retry re-runs fetch with same FR-011 policy.
