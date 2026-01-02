# Implementation Plan: Indicator-based Alerts (cRSI only)

**Branch**: `001-indicator-alerts` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-indicator-alerts/spec.md`

## Summary

Move alert creation out of the Monitoring panel and into indicator UI (starting with cRSI), so there is one cRSI alert definition that can emit different messages per trigger (buy/sell), TradingView-style. Monitoring becomes alert management + history/log only (list, mute, delete, view trigger history), with no "Set Alert" form.

Key changes:
1. Remove AlertForm from AlertsView/Monitoring panel
2. Add "Add alert..." action to cRSI indicator context menu
3. Create Edit/Create Alert modal with Settings, Message, and Notifications tabs
4. Implement configurable conditions (upper/lower/both) and messages (buy/sell)
5. Store trigger messages with AlertTrigger for per-event direction context
6. Add Log tab to Monitoring for global trigger history

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.9 (frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.104+, SQLAlchemy 2.0+, pandas 2.1+, numpy 1.26+
- Frontend: React 19, Lightweight Charts 5.1.0, Radix UI, shadcn/ui
**Storage**: PostgreSQL (alerts, triggers via SQLAlchemy with asyncpg driver)
**Testing**:
- Backend: pytest, pytest-asyncio
- Frontend: Vitest, React Testing Library
**Target Platform**: Web browser (local-first with optional backend)
**Project Type**: Web application (frontend + backend)
**Performance Goals**:
- Alert evaluation: 500ms per price update (Constitution budget)
- Initial chart load: 3 seconds
- UI panning: 60fps with 10k+ candles
**Constraints**:
- Cross detection requires current + previous candle values
- No application-level hard caps on alert count (Constitution: Unlimited Alerts)
- Alert creation requires backend connectivity (backend is source of truth)
- Trigger history is viewable offline (cached in frontend localStorage)
**Scale/Scope**:
- Starting with cRSI indicator only (extensible to other indicators later)
- Single alert definition can produce multiple trigger events over time
- Trigger history is append-only (no overwrites)

### Current Architecture

**Frontend Components**:
- `AlertsView.tsx`: Container combining AlertsList + AlertForm
- `AlertForm.tsx`: Current alert creation form (price + indicator alerts)
- `AlertsList.tsx`: Alert list with expandable history
- `IndicatorPane.tsx`: Indicator pane with hover-based context menu
- `IndicatorContextMenu.tsx`: Reusable hover context menu component

**Backend Components**:
- `Alert` model: Alert definition with indicator_name, indicator_field, indicator_params
- `AlertTrigger` model: Trigger events with observed_price, indicator_value, triggered_at
- `AlertEngine`: Evaluates alerts on price updates, supports indicator conditions
- `cRSIIndicator`: Indicator with upper/lower bands, alert_templates for band-cross conditions

**Current Alert Creation Flow**:
1. User fills AlertForm in Monitoring panel
2. Form calls `POST /api/v1/alerts/` to create alert
3. Backend validates and stores Alert in database
4. Frontend stores alerts in localStorage (disconnected from backend)

**Issues to Address**:
1. Frontend localStorage alerts not synced with backend API alerts
2. No direction-specific trigger messages (all triggers use same message)
3. AlertForm in Monitoring panel (should be removed)
4. No global Log view for all triggers
5. Hardcoded cRSI band-cross condition in alert_engine.py (lines 138-153)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design - all items PASS.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) match TradingView behavior
  - **Not applicable**: This feature adds alert UI, doesn't modify chart interactions
- [x] UI changes include before/after verification
  - **Required**: Alert modal, Log tab, and context menu changes need parity verification
- [x] Performance budgets: 60fps panning, 3s initial load
  - **Not affected**: No rendering performance impact expected

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented
  - **Already in place**: AlertTrigger.triggered_at uses DateTime(timezone=True)
- [x] Deduplication strategy: database constraints or idempotent inserts
  - **Already in place**: AlertTrigger has database primary key constraint
- [x] Alert semantics: above/below/crosses defined with edge cases tested
  - **Required**: Implement cross detection semantics for cRSI bands:
    - Lower band cross: `current < lower_band AND previous >= lower_band`
    - Upper band cross: `current > upper_band AND previous <= upper_band`
  - **Edge cases to test**:
    - Both bands crossed in single candle (should trigger both events)
    - Rapid oscillation across band (should trigger each cross)
    - Gap data (missing candles between evaluations)
- [x] Gap handling: explicit marking and backfill strategy
  - **Already in place**: Existing gap handling in candle data system applies

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count
  - **Not affected**: This feature removes creation UI, doesn't add caps
- [x] Alert evaluation performance budgeted (500ms)
  - **Required**: Ensure new cRSI band-cross logic doesn't exceed budget
- [x] Graceful degradation defined for high alert volumes
  - **Already in place**: AlertEngine has batch evaluation for >1000 alerts

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally
  - **Already in place**: Existing candle cache applies
- [x] Offline behavior: charts, alerts, history remain accessible
  - **Note**: Alert creation requires backend connectivity (backend is source of truth)
  - **Required**: Trigger history must be viewable offline (cached in frontend localStorage)
- [x] Provider error handling: graceful degradation with user feedback
  - **Already in place**: Existing error handling applies

### Testing and Quality Gates

- [x] Core logic uses TDD (alert engine, indicators, candle normalization)
  - **Required**: cRSI band-cross evaluation logic MUST be test-driven
- [x] Bug fixes include regression tests
  - **Required**: Any bugs found in trigger detection must have regression tests
- [x] CI includes: lint, typecheck, unit, integration tests
  - **Already in place**: Existing CI pipeline applies

### Performance Budgets

- [x] Initial chart load: 3 seconds
  - **Not affected**: No impact on chart loading
- [x] Price update latency: 2 seconds
  - **Not affected**: No change to data fetching
- [x] Alert evaluation: 500ms
  - **Required**: Benchmark cRSI band-cross evaluation with existing alerts
- [x] UI panning: 60fps
  - **Not affected**: No rendering changes during panning
- [x] Memory: 500MB for 5 symbols / 20 alerts
  - **Not affected**: Minimal memory impact for new UI components

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern
  - **Already in place**: cRSI is registered in indicator_registry
  - **Required**: Design alert creation pattern to be extensible to other indicators
- [x] Data providers implement common interface
  - **Not affected**: No provider changes needed
- [x] Provider-specific logic isolated from UI
  - **Not affected**: No provider changes needed

### Security & Privacy

- [x] No telemetry or data upload without consent
  - **Not affected**: No telemetry changes
- [x] API keys stored securely (not in repo)
  - **Not affected**: No API key changes
- [x] Local data treated as sensitive
  - **Already in place**: Alerts and triggers stored locally

### Governance

- [x] If any principle violated: justification in Complexity Tracking
  - **No violations**: This feature aligns with all constitution principles
- [x] Constitution supersedes spec/plan conflicts
  - **No conflicts**: Spec and plan are constitution-compliant

## Project Structure

### Documentation (this feature)

```text
specs/001-indicator-alerts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
│   ├── alerts-api.yaml  # OpenAPI spec for alert endpoints
│   └── triggers-api.yaml # OpenAPI spec for trigger endpoints
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/src/
├── components/
│   ├── AlertsView.tsx           # Modified: Remove AlertForm
│   ├── AlertForm.tsx            # Deprecated: Keep for reference, remove usage
│   ├── AlertsList.tsx           # Modified: Add Log tab support
│   ├── IndicatorPane.tsx        # Modified: Add "Add alert..." action
│   ├── IndicatorContextMenu.tsx # Modified: Add alert action type
│   ├── IndicatorAlertModal.tsx  # New: Alert creation/editing modal
│   └── LogTab.tsx               # New: Global trigger log view
├── types/
│   └── indicators.ts            # Modified: Add message config to Alert type
└── api/
    └── alerts.ts                # Modified: Add trigger message field

backend/app/
├── models/
│   ├── alert.py                 # Modified: Add message fields
│   └── alert_trigger.py         # Modified: Add trigger_message field
├── services/
│   ├── alert_engine.py          # Modified: cRSI band-cross with messages
│   └── indicator_registry/
│       └── registry.py          # Modified: cRSI alert templates
└── schemas/
    └── indicator.py             # Modified: Alert schemas with messages
```

**Structure Decision**: Web application with separate frontend (React) and backend (FastAPI) directories. Frontend uses localStorage for offline-first behavior, backend uses PostgreSQL for persistence.

## Complexity Tracking

> **No constitution violations requiring justification**

This feature aligns with all constitution principles:
- Removes alert creation UI from Monitoring (UX improvement)
- Extends existing alert system (no architectural changes)
- Maintains unlimited alerts philosophy
- Preserves local-first behavior
- Uses TDD for new trigger detection logic

## Implementation Phases

### Phase 0: Research & Decisions

**Status**: ✅ Complete (see `research.md`)

**Goal**: Resolve all NEEDS CLARIFICATION items and make technical decisions.

**Research Tasks**:

1. **Alert Message Storage Pattern**
   - Decision: Two string columns on Alert model + JSONB enabled_conditions
   - Options: JSONB column on Alert, separate AlertMessage table, computed at evaluation time
   - Research best practices for configurable alert messages in financial applications

2. **Frontend-Backend Alert Sync**
   - Decision: Pure backend with frontend caching
   - Current issue: Frontend localStorage alerts disconnected from backend API alerts
   - Research local-first patterns for financial alert systems

3. **Context Menu Alert Action Pattern**
   - Decision: Symbol + indicator type + parameters tuple
   - Research TradingView's alert-to-indicator association pattern

4. **Log Tab Performance**
   - Decision: 500 entry limit, pagination for future
   - Research performance of rendering 1000+ trigger entries

5. **Multi-Trigger Per Evaluation**
   - Decision: Separate AlertTrigger records per condition
   - Research best practices for compound alert conditions

6. **API Filtering Consistency** (Added during Phase 1)
   - Decision: Support `symbol: string` parameter alongside `symbol_id: integer`
   - Rationale: Reduces frontend complexity, eliminates need for symbol→id mapping

7. **Alert Label Display** (Added during Phase 1)
   - Decision: Computed `alert_label` field (not stored, generated from indicator params + enabled conditions)
   - Rationale: Single alert can have multiple trigger directions; label should describe alert, not individual triggers

8. **Trigger Type Field** (Added during Phase 1)
   - Decision: Add `trigger_type: "upper" | "lower"` field to AlertTrigger
   - Rationale: Distinguishes which condition fired when single alert has both upper and lower enabled

**Output**: `research.md` with decisions and rationales

### Phase 1: Design & Contracts

**Status**: ✅ Complete

**Prerequisites**: Phase 0 research complete (decisions documented in `research.md`)

**Tasks**:

1. **Data Model Design** (`data-model.md`)
   - Define Alert model extensions:
     - `message_upper: String` (default: "It's time to sell!")
     - `message_lower: String` (default: "It's time to buy!")
     - `enabled_conditions: JSONB` (e.g., `{"upper": true, "lower": true}`)
   - Define AlertTrigger model extensions:
     - `trigger_message: String` (direction-specific message at trigger time)
     - `trigger_type: String` ("upper" or "lower" - which condition fired)
   - Define computed `alert_label` field (generated from indicator params + enabled conditions)
   - Define state transitions for alerts (active <-> muted, active -> triggered -> active)
   - Define validation rules (non-empty messages, at least one condition enabled)

2. **API Contracts** (`contracts/alerts-api.yaml`, `contracts/triggers-api.yaml`)
   - Add `symbol: string` parameter to list endpoints (alongside deprecated `symbol_id`)
   - Extend `POST /api/v1/alerts/` request body with message fields and enabled_conditions
   - Extend `GET /api/v1/alerts/` response to include `alert_label`, message configuration
   - Extend `PUT /api/v1/alerts/{id}` to support message/condition updates
   - Extend `GET /api/v1/alerts/{id}/triggers` to include trigger_message, trigger_type
   - Add `GET /api/v1/alerts/triggers/recent` for global log with explicit ordering documentation
   - Document that results are ordered by `triggered_at` descending (newest first)

3. **Quickstart Guide** (`quickstart.md`)
   - How to create a cRSI alert from indicator context menu
   - How to configure upper/lower band conditions and messages
   - How to view trigger history in Log tab
   - How to mute/unmute/delete alerts from Monitoring panel

4. **Update Agent Context**
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
   - Add new Alert model fields with message configuration
   - Add AlertTrigger.trigger_message field
   - Add IndicatorAlertModal component description

**Output**: `data-model.md`, `contracts/*.yaml`, `quickstart.md`

### Phase 2: Task Generation

**Prerequisites**: Phase 1 design complete

**Tasks**: (Generated by `/speckit.tasks` command - NOT created by this plan)

**Output**: `tasks.md`

## Acceptance Gates

1. **Monitoring panel has no "Set Alert" form**
   - AlertForm is not rendered in AlertsView
   - No alert creation button or form in Monitoring panel
   - Only AlertsList and Log tab are visible

2. **Alert creation only from indicator UI**
   - cRSI oscillator pane shows "Add alert on cRSI(20)..." in context menu
   - Clicking opens IndicatorAlertModal with Settings, Message, Notifications tabs
   - Saving creates exactly one alert entry in AlertsList
   - No other way to create alerts in the UI

3. **Single alert, multiple trigger messages**
   - Creating cRSI alert results in one Alert record with message_upper and message_lower
   - When cRSI crosses lower band, AlertTrigger has trigger_message = message_lower ("It's time to buy!")
   - When cRSI crosses upper band, AlertTrigger has trigger_message = message_upper ("It's time to sell!")
   - Alert remains one entry in AlertsList across multiple triggers

4. **Append-only trigger history**
   - Each trigger creates a new AlertTrigger record (not overwriting previous)
   - Expanding an alert in AlertsList shows all triggers in chronological order
   - Log tab shows all triggers from all alerts in reverse chronological order
   - Trigger events persist across page reloads and application restarts

5. **Configurable conditions and messages**
   - Settings tab allows enabling/disabling upper and lower band conditions independently
   - Message tab allows customizing messages for upper and lower triggers
   - Default messages: "It's time to sell!" (upper), "It's time to buy!" (lower)
   - Both conditions can be enabled, or just one

6. **Alert lifecycle management**
   - Muted alerts do not create trigger events even if conditions are met
   - Unmuting an alert resumes trigger evaluation
   - Deleting an alert removes the Alert record and all associated AlertTrigger records
   - Alert status updates (active/muted) are persisted

7. **Cooldown behavior**
   - After any trigger event, a minimum 5-second cooldown is enforced
   - During cooldown, no additional triggers are created for any enabled condition
   - Cooldown applies to the alert (not per condition), preventing both upper and lower triggers if cooldown is active
   - User can configure longer cooldown period (minimum enforced by backend)

8. **Performance budgets met**
   - Alert evaluation completes within 500ms per price update
   - Log tab renders 1000+ trigger entries without lag
   - Modal opens within 100ms of context menu click

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Frontend/backend alert sync complexity | High | Reuse existing backend API, make frontend localStorage a cache layer |
| Multi-trigger per evaluation confusion | Medium | Document edge case clearly, add test for both-bands-cross scenario |
| Log performance degradation | Medium | Implement pagination or virtualization if needed (deferred to future if not critical) |
| Alert message configuration complexity | Low | Use sensible defaults, make configuration optional |
| Context menu usability on mobile | Low | Desktop-first for MVP, mobile UX improvement deferred |

## Dependencies

**Blocking**: None (this feature can be implemented independently)

**Dependent Features**:
- Future: Extend alert creation to other indicators (TDFI, VTX, etc.)
- Future: Notification delivery (email, webhook, push - Notifications tab placeholder)
- Future: Alert editing from Monitoring panel (currently only from indicator context menu)

## Key Decisions (Phase 0 & Phase 1)

### Storage & Sync
1. **Backend as source of truth**: Alerts stored in PostgreSQL, frontend is cache/view layer
2. **Alert creation requires backend**: No offline creation; show "Backend unavailable" message if disconnected
3. **Trigger history cached**: Viewable offline via frontend localStorage cache

### API Design
4. **Symbol filtering**: Use `symbol: string` parameter (not `symbol_id: integer`) to reduce frontend complexity
5. **Alert labels**: Computed `alert_label` field generated from indicator params + enabled conditions (e.g., "cRSI(20) band cross")
6. **Trigger type**: `trigger_type: "upper" | "lower"` field distinguishes which condition fired
7. **Log ordering**: Explicitly documented as `triggered_at DESC` (newest first)

### Data Model
8. **Message storage**: Two string columns (`message_upper`, `message_lower`) + JSONB `enabled_conditions`
9. **Trigger direction**: `trigger_type` stored with each trigger event to distinguish upper vs lower crosses
10. **Indicator association**: Alert tied to `(symbol, indicator_name, indicator_params)` tuple

### Behavior
11. **Multi-trigger per evaluation**: If both bands crossed, create two AlertTrigger records with different trigger_type values
12. **Cooldown semantics**: 5-second minimum cooldown applies to alert (not per condition), preventing all triggers during cooldown
13. **Indicator parameter changes**: Alert keeps original params; user must delete/recreate to change parameters

