# TradingAlert Constitution

<!--
Sync Impact Report:
- Version change: (none) → 1.0.0 (initial ratification)
- Modified principles: (initial creation)
- Added sections: All 9 core principles, Performance Budgets, Development Standards, Governance
- Removed sections: None
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md (Constitution Check section - updated below)
  ✅ .specify/templates/spec-template.md (already aligned)
  ✅ .specify/templates/tasks-template.md (already aligned with TDD principles)
- Follow-up TODOs: None
-->

## Core Principles

### I. UX Parity with TradingView

**NON-NEGOTIABLE**: Prioritize pixel-level visual fidelity and interaction fidelity over adding new features.

Chart interactions MUST feel "TradingView-native":
- Smooth zoom and pan behavior on both time and price scales
- Crosshair behavior: precise value readouts, time/price axis tracking, visible across panes
- Consistent indicator panes with synchronized time scrolling
- Predictable keyboard and mouse gestures (scroll wheel, drag, pinch-to-zoom)

**Rationale**: The primary value proposition is a local TradingView alternative. Any deviation from TradingView's interaction model creates friction for users familiar with that platform.

**Requirements**:
- UI changes require before/after screenshots or short clips and explicit acceptance criteria
- Zoom/pan animations must run at 60fps minimum
- Candle rendering must match TradingView's visual style (wick, body, colors, spacing)
- Grid lines, price labels, and time axis must align with TradingView conventions

---

### II. Correctness Over Cleverness

**NON-NEGOTIABLE**: Market data handling must be deterministic and auditable.

**Data integrity rules**:
- Timestamps MUST be normalized to a consistent timezone (UTC) before storage
- Candles MUST be ordered chronologically; out-of-order updates MUST be rejected or merged deterministically
- Duplicate candles (same symbol, interval, timestamp) MUST be deduplicated using database constraints or idempotent insert logic
- Gap handling MUST be explicit: mark gaps, attempt backfill, and surface unresolved gaps to the user

**Alert correctness rules**:
- Alerts MUST never trigger incorrectly
- Define precise semantics for conditions:
  - `above`: current price > target AND previous price <= target
  - `below`: current price < target AND previous price >= target
  - `crosses-up`: previous price < target AND current price >= target
  - `crosses-down`: previous price > target AND current price <= target
- Alert semantics MUST be tested with edge cases (exact target price, rapid oscillations, gaps)

**Rationale**: Incorrect financial data or alert triggers lead to bad trading decisions. Determinism enables debugging and auditing.

---

### III. Unlimited Alerts Philosophy

**NON-NEGOTIABLE**: No application-level hard cap on alerts.

**Rules**:
- The code MUST NOT impose arbitrary limits (e.g., "max 100 alerts")
- Limits are only practical: CPU, memory, storage, or provider rate limits
- Alert evaluation MUST degrade gracefully under load:
  - Batch evaluation when alert count exceeds single-thread capacity
  - Prioritize real-time alerts over historical backfill alerts
  - Surface performance degradation to the user (e.g., "1000+ alerts - evaluation delayed")

**Performance requirements**:
- Alert evaluation time MUST be measured and have enforced budgets
- Add benchmark tests for alert evaluation at scale (100, 1000, 10000 alerts)
- If evaluation exceeds budget, add optimization tasks to backlog

**Rationale**: The project's primary differentiator is unlimited alerts. Artificial caps negate this advantage.

---

### IV. Local-First and Offline-Tolerant

**NON-NEGOTIABLE**: The application MUST remain useful without internet connectivity.

**Requirements**:
- Cache all fetched market data locally (SQLite or similar)
- Cached data MUST be viewable offline (charts render from cache)
- Alert management MUST work offline (create, edit, delete alerts)
- Alert history MUST be viewable offline

**Provider error handling**:
- External providers are best-effort; provider errors MUST be handled gracefully
- Network errors MUST surface clear UX feedback (e.g., "Provider unavailable - showing cached data")
- Rate limit responses MUST trigger backoff and retry with exponential delay
- Invalid or malformed provider responses MUST NOT crash the application

**Rationale**: Traders need reliable access to their charts and alerts regardless of network conditions. Local caching also respects provider rate limits.

---

### V. Testing and Quality Gates

**NON-NEGOTIABLE**: TDD for core logic; automated regression tests for all bug fixes.

**TDD requirements**:
- Core logic MUST be test-driven: alert engine, indicator calculations, candle normalization
- Test MUST be written first, MUST fail, and only then implementation proceeds

**Regression test requirements**:
- Every bug fix MUST include an automated regression test
- Regression test MUST fail against the buggy code and pass against the fix

**CI requirements**:
- CI MUST run on every pull request
- CI MUST include: lint, typecheck, unit tests, integration tests
- Minimal e2e smoke tests are required if applicable

**Rationale**: Financial software correctness is critical. Tests prevent regressions and document expected behavior.

---

### VI. Performance Budgets

**NON-NEGOTIABLE**: Set measurable budgets for critical operations; treat regressions as bugs.

**Required budgets**:
- Initial chart load: MUST complete within 3 seconds on typical broadband
- Price update latency: New data visible within 2 seconds of provider update
- Alert evaluation: MUST complete within 500ms per price update under expected load
- UI panning: MUST maintain 60fps with 10,000+ candles in memory

**Measurement requirements**:
- Add benchmark tests where feasible
- Performance tests MUST run in CI and fail on regression
- Profile before optimizing; measure after

**Rationale**: Performance directly impacts user experience. Budgets ensure the app feels responsive and professional.

---

### VII. Architecture for Extensibility

**NON-NEGOTIABLE**: New indicators and data providers MUST be addable via stable interfaces.

**Indicator requirements**:
- Indicators MUST use a plugin-like registry pattern
- Indicator interface: `calculate(candles: Candle[], params: IndicatorParams): IndicatorSeries[]`
- New indicators MUST NOT require changes to core charting code

**Data provider requirements**:
- Providers MUST implement a common interface: `DataProvider`
- Provider interface methods: `fetchCandles()`, `subscribeUpdates()`, `getRateLimitPolicy()`
- Provider-specific logic MUST NOT leak into UI or business logic
- Swapping providers MUST NOT require changes outside provider implementation

**Rationale**: Extensibility enables the project to grow without architectural rewrites. Stable interfaces allow contributors to add features safely.

---

### VIII. Security & Privacy

**NON-NEGOTIABLE**: Treat all local data as sensitive; never exfiltrate without explicit user action.

**Requirements**:
- All local data (alerts, history, cached candles, settings) is sensitive
- No telemetry, analytics, or data upload without explicit user consent
- API keys and secrets MUST be stored securely (environment variables, encrypted storage)
- Secrets MUST NEVER be committed to version control

**Rationale**: Traders' strategies, alerts, and watched symbols are sensitive information. Privacy is a core expectation for a local-first application.

---

### IX. Governance and Decision Making

**NON-NEGOTIABLE**: Certain changes require explicit ADRs and specification/test updates.

**Changes requiring ADR**:
- UX parity changes (chart interaction behavior)
- Alert semantic changes (condition logic, trigger behavior)
- Data correctness changes (timestamp handling, ordering, deduplication)
- Storage format changes (schema migrations)

**Compliance hierarchy**:
1. Constitution
2. ADRs (Architecture Decision Records)
3. Feature specifications
4. Implementation plans

If the constitution conflicts with a spec or plan, the constitution wins until explicitly amended.

**Rationale**: This project's value depends on correctness, UX quality, and unlimited alerts. Governance prevents erosion of these core principles.

---

## Performance Budgets

| Metric | Budget | Measurement |
|--------|--------|-------------|
| Initial chart load | 3 seconds | Time from symbol selection to visible candles |
| Price update latency | 2 seconds | Time from provider data to chart update |
| Alert evaluation | 500ms | Time from new candle to all alerts evaluated |
| UI panning frame rate | 60fps | Frames per second while panning 10k candles |
| Memory footprint | 500MB | Maximum memory with 5 symbols, 20 alerts each |

**Failure handling**: If budgets are exceeded, the issue MUST be treated as a bug and addressed before merge.

---

## Development Standards

### Code Quality

- All code MUST pass linting and type checking
- Functions MUST be small and focused (single responsibility)
- Complex logic MUST include explanatory comments

### Documentation

- Public interfaces MUST have documentation (parameters, return values, behavior)
- Architectural decisions MUST be recorded as ADRs
- User-facing changes MUST be documented in changelog

### Review Process

- All changes MUST pass CI checks
- Changes affecting core principles require explicit review against constitution
- UI changes require visual verification (screenshots or recordings)

---

## Governance

### Amendment Process

1. Propose amendment with rationale and impact analysis
2. Check for conflicts with existing principles
3. Update version number:
   - MAJOR: Backward-incompatible changes (principle removal/redefinition)
   - MINOR: New principle or material expansion
   - PATCH: Clarifications, wording fixes
4. Update all dependent templates and documentation
5. Require approval from project maintainer

### Compliance Review

- All PRs MUST be checked against constitution
- Violations MUST be explicitly justified in Complexity Tracking (plan.md)
- If constitution and spec conflict, constitution wins

### Project Defaults

The following defaults apply to all features unless revised via ADR:

- Initial market focus: US equities
- Notifications: in-app only (desktop notifications deferred)
- Packaging: pure local web app (desktop wrapper deferred)

---

**Version**: 1.0.0 | **Ratified**: 2025-12-23 | **Last Amended**: 2025-12-23
