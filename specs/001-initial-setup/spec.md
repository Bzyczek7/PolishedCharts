# Feature Specification: Initial Project Setup

**Feature Branch**: `001-initial-setup`
**Created**: 2025-12-23
**Status**: Draft
**Input**: "TradingView clone - local trading chart application with unlimited alerts"

## Overview

Build a local-first trading chart application that provides core charting and alerting capabilities without subscription costs. This feature establishes the foundation (repo structure, app skeleton, data access layer, persistence, and test harness) needed to incrementally reach a TradingView-like experience with unlimited alerts.

This spec defines the minimum architecture and a thin vertical slice to validate:

- Data ingestion (historical + streaming where available)
- Candlestick rendering
- Alert creation + evaluation + persistence
- Basic indicator pipeline (scaffolding)

## Goals

- Provide a working desktop/local application skeleton that can render a candlestick chart for a selected symbol using real data.
- Enable creating and persisting price alerts and triggering notifications based on incoming price updates.
- Establish stable interfaces (data provider, storage, alert evaluation, indicator computation) to support later features.

## Clarifications

### Session 2025-12-23

- Q: Which initial market will be targeted for the first provider (crypto vs equities vs forex)? → A: US Equities (stocks)
- Q: Do we require desktop notifications in this first slice, or only in-app notifications? → A: In-app only
- Q: What is the intended packaging approach (pure local web app vs desktop wrapper)? → A: Pure local web app
- Q: What is the exact semantic definition for "crosses-up" and "crosses-down" alerts? → A: crosses-up: previous < target AND current >= target; crosses-down: previous > target AND current <= target (inclusive trigger on exact match)
- Q: Which specific US Equities provider should be implemented first? → A: Yahoo Finance (via yfinance)
- Q: What is the expected backoff behavior when rate limits are hit? → A: Exponential backoff starting at 1s, doubling max 30s, with random jitter
- Q: Should candle timestamps be stored in UTC or exchange local time? → A: Store all timestamps in UTC; display in user's local timezone
- Q: For edge cases, what is the expected UX behavior? → A: Show user-friendly error message in UI with clear action (retry, use cached data)

## Non-goals for this feature

- Full drawing tool suite (trendlines, Fibonacci, etc.)
- Multi-user accounts, authentication, cloud sync
- Broker integration, trading execution
- Mobile apps
- Pine Script-like custom scripting
- Full indicator library (beyond initial scaffolding)
- Desktop notifications (in-app notifications only)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View market price charts (Priority: P1)

As a trader, I want to view real-time and historical price charts for any symbol, so that I can analyze market trends and make informed trading decisions.

**Why this priority**: Chart viewing is core; without it the application has no purpose.

**Independent test**: Launch the app, select a symbol, verify OHLCV candles appear and update.

**Acceptance scenarios**:

1. **Given** the application is running, **when** the user opens a symbol chart, **then** historical candlestick data displays in chronological order.
2. **Given** a chart is displayed, **when** new price data arrives, **then** the chart updates automatically.
3. **Given** a chart is displayed, **when** the user changes the interval (for example 1m, 5m, 1h, 1d), **then** candles re-render to reflect the selected interval.
4. **Given** a chart is displayed, **when** the user pans, **then** additional historical data loads without visible gaps.
5. **Given** a chart is displayed, **when** the user zooms, **then** the chart adjusts granularity smoothly.

---

### User Story 2 - Create unlimited price alerts (Priority: P1)

As a trader, I want to create price-based alerts for any symbol, so that I am notified when specific price conditions are met without paying subscription fees.

**Why this priority**: Unlimited alerts are the primary differentiator and key motivation.

**Independent test**: Create many alerts, trigger conditions, verify notifications and persisted history.

**Acceptance scenarios**:

1. **Given** a symbol chart is displayed, **when** the user creates an alert for a price condition, **then** the alert is saved and triggers when the condition is met.
2. **Given** multiple alerts exist, **when** price conditions are met, **then** all matching alerts trigger notifications.
3. **Given** an alert has triggered, **when** the user views alert history, **then** trigger time and price are recorded.
4. **Given** an alert exists, **when** the user deletes it, **then** the alert no longer triggers.
5. **Given** the application restarts, **when** alerts were previously created, **then** all alerts persist and remain active.

---

### User Story 3 - Apply technical indicators (Priority: P2)

As a trader, I want to overlay technical indicators on my charts, so that I can identify trading signals and trends.

**Why this priority**: Indicators are important, but secondary to charting and alerts.

**Independent test**: Add an indicator, verify render and updates with new data.

**Acceptance scenarios**:

1. **Given** a chart is displayed, **when** the user adds a moving average indicator, **then** the indicator overlays the candles.
2. **Given** indicators are displayed, **when** the user adjusts parameters, **then** indicator values update.
3. **Given** multiple indicators exist, **when** the user removes one, **then** only that indicator disappears.
4. **Given** a chart with indicators, **when** new price data arrives, **then** indicators recompute and update.

---

### User Story 4 - Manage multiple symbols (Priority: P2)

As a trader, I want to track multiple symbols simultaneously, so that I can monitor different markets without switching applications.

**Why this priority**: Increases utility but is not required for first deliverable.

**Independent test**: Open multiple charts in tabs/panels and confirm independent state.

**Acceptance scenarios**:

1. **Given** the application is running, **when** the user opens a chart for a different symbol, **then** both charts maintain independent state.
2. **Given** multiple symbols are tracked, **when** alerts trigger, **then** notifications identify which symbol triggered.

---

### Edge cases

- **No data is available for a requested symbol**: Show user-friendly error message "No data available for [SYMBOL]" with option to retry or select different symbol.
- **Data provider is unavailable, rate-limited, or returns malformed payloads**: Show error message with specific issue (e.g., "Rate limit exceeded - retrying in X seconds") and action to use cached data if available.
- **Invalid alert conditions are configured (for example negative price targets)**: Prevent creation with inline validation error "Price target must be positive".
- **Application is offline and alerts would otherwise trigger**: Queue alert triggers for evaluation when connection restored; show indicator that alerts are pending.
- **Thousands of alerts exist for the same symbol**: Show performance warning "1000+ alerts - evaluation may be delayed" but continue processing; use batch evaluation.
- **Historical series contains gaps or duplicated candles**: Gaps are marked visually on chart with explicit "gap" indicator; duplicates are silently ignored via idempotent insert.

## Requirements *(mandatory)*

### Functional requirements

- **FR-001**: The system must display candlestick charts with OHLCV for any supported symbol and interval.
- **FR-002**: The system must support intervals: 1m, 5m, 15m, 1h, 1d.
- **FR-003**: The system must fetch historical market data from at least one external provider.
- **FR-004**: The system must support streaming updates when the selected provider supports it; otherwise it must poll safely.
- **FR-005**: The system must cache historical data locally to reduce repeat API calls.
- **FR-006**: The system must allow price-based alerts with conditions: above, below, crosses-up, crosses-down.
- **FR-007**: The system must not impose an application-level limit on number of alerts.
- **FR-008**: The system must evaluate alert conditions against incoming price updates.
- **FR-009**: The system must persist alerts across restarts.
- **FR-010**: The system must show an in-app notification when an alert triggers.
- **FR-011**: The system must support an indicator pipeline and implement at least SMA as the first indicator.
- **FR-012**: The system must support smooth panning and zooming behavior at the UI level.
- **FR-013**: The system must handle data gaps by attempting backfill and marking unresolved gaps.
- **FR-014**: The system must rate-limit outbound calls to comply with provider limits. When rate limits are hit, the system must implement exponential backoff starting at 1s, doubling to max 30s, with random jitter.
- **FR-015**: The system must allow viewing cached data while offline.

### Non-functional requirements

- **NFR-001**: Initial chart load time must be under 3s on a typical broadband connection.
- **NFR-002**: Price updates should appear within 2s of provider updates (or within polling interval constraints).
- **NFR-003**: Alert evaluation must complete within 500ms per incoming price update under expected load.
- **NFR-004**: UI panning should remain smooth near 60fps with at least 10,000 candles in memory.
- **NFR-005**: Memory usage should remain under 500MB when tracking 5 symbols with 20 alerts each, excluding OS/browser overhead.
- **NFR-006**: The system must provide deterministic, reproducible local dev setup (single command to run).

### Key entities

- **Symbol**: Tradable asset identifier plus metadata (exchange, supported intervals).
- **Candle**: OHLCV + timestamp for a symbol and interval. Timestamps are stored in UTC for consistency; displayed in user's local timezone.
- **Alert**: Rule with symbol, condition type, target price, enabled flag, optional cooldown. Alert condition semantics:
  - `above`: current > target AND previous <= target
  - `below`: current < target AND previous >= target
  - `crosses-up`: previous < target AND current >= target
  - `crosses-down`: previous > target AND current <= target
- **AlertTrigger**: Record of alert firing with alert id, timestamp, and observed price.
- **Indicator**: Type + parameters + computed series aligned to candle timestamps.
- **DataProvider**: Adapter with capabilities (historical, streaming, rate limits, symbol universe).

## Architecture decisions (for initial setup)

### Application shape

- Pure local web app launched via a single command (e.g., `npm run dev`).
- User runs backend and frontend, opens browser tab to access the application.
- Backend provides: data-provider adapters, caching, persistence, alert evaluation, indicator computation.
- Frontend provides: chart rendering, alert CRUD, indicator configuration, in-app notifications.

### Storage

- Use SQLite for persistence (candles cache, alerts, alert triggers, app settings).
- Define migration tooling from day one (even if only one migration exists initially).

### Data provider strategy

- Target market: US Equities (stocks) as the initial provider focus.
- Initial provider: Yahoo Finance via the `yfinance` library (free, no API key required, good coverage).
- Implement a provider interface and ship Yahoo Finance as the first concrete adapter.
- Provider must expose:
  - Fetch candles for a symbol/interval/range
  - Subscribe or poll for latest price updates
  - Rate limit policy
- Note: Free US equity providers typically deliver delayed data (15-20 minute delay) and have rate limits. The MVP accepts these constraints.

## Scope for this feature (what "initial setup" delivers)

### Repository bootstrap

- Standard repo layout (apps/, packages/, specs/, docs/)
- Formatting, linting, type checking
- CI pipeline running tests and linters

### App skeleton

- Launches locally with a basic UI
- Symbol selector + interval selector
- Candlestick chart component wired to backend API

### Backend skeleton

- DataProvider interface + one concrete adapter
- Candle caching into SQLite
- Minimal alert engine:
  - Create/read/update/delete alerts
  - Evaluate alerts on price updates
  - Persist triggers

### Testing harness

- Unit tests for alert evaluation rules (including crosses logic)
- Integration test for persistence (alerts survive restart)
- Basic UI smoke test (app loads, chart renders at least one candle)

## Acceptance criteria (definition of done)

- A developer can run one command to start the full app locally.
- Selecting a symbol and interval shows historical candles from a real provider.
- New updates (stream or poll) update the chart without manual refresh.
- User can create at least 100 alerts; alerts persist after restart and trigger correctly.
- Alert triggers are recorded and viewable in a simple history list.
- CI passes on main branches for lint + tests.
