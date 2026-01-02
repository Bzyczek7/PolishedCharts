# Implementation Plan: Alarm Notification System

**Branch**: `013-alarm-notifications` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-alarm-notifications/spec.md`

## Summary

Implement three notification channels for alerts: on-screen toast notifications, sound notifications, and Telegram messages. Toast and sound notifications are handled frontend-only. Telegram notifications require backend integration with the Telegram Bot API. Additionally, allow users to modify notification settings on existing active alerts and perform bulk notification updates across multiple alerts.

**Technical Approach**:
1. Frontend toast notifications using react-hot-toast or similar lightweight library
2. HTML5 Audio API for sound playback with bundled sound files
3. Backend Telegram bot service for sending messages to configured chats
4. User preferences stored in localStorage (guest) or database (authenticated)
5. Alert edit dialog extended with notification settings controls
6. Bulk operation interface for batch notification updates

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9+ (frontend)
**Primary Dependencies**: react-hot-toast (frontend), Telegram Bot API (backend)
**Storage**: PostgreSQL (existing for alerts), localStorage (guest preferences)
**Testing**: pytest (backend), Vitest (frontend), Playwright (e2e)
**Target Platform**: Web browser (Chrome, Firefox, Edge)
**Project Type**: web (frontend + backend)
**Performance Goals**: Toast < 2s, sound < 1s, Telegram < 5s
**Constraints**: Offline-capable (toast/sound), no external APM
**Scale/Scope**: Standard dataset (20 symbols, 5 indicators each)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) match TradingView behavior - *existing feature maintained*
- [x] UI changes include before/after verification - *toast UI is notification-style, not chart UI*
- [x] Performance budgets: 60fps panning, 3s initial load - *toast/sound don't affect chart performance*

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented - *existing, not modified*
- [x] Deduplication strategy: database constraints or idempotent inserts - *existing, not modified*
- [x] Alert semantics: above/below/crosses defined with edge cases tested - *existing, not modified*
- [x] Gap handling: explicit marking and backfill strategy - *existing, not modified*

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count - *notification system scales with alerts*
- [x] Alert evaluation performance budgeted (500ms) - *existing, monitored*
- [x] Graceful degradation defined for high alert volumes - *toast queue limits apply*

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally - *existing, not modified*
- [x] Offline behavior: charts, alerts, history remain accessible - *existing, not modified*
- [x] Provider error handling: graceful degradation with user feedback - *Telegram failures logged*
- [x] Toast/sound notifications work offline - *no network required*

### Testing and Quality Gates

- [x] Core logic uses TDD (alert engine, indicators, candle normalization) - *notification logic TDD*
- [x] Bug fixes include regression tests - *existing practice continues*
- [x] CI includes: lint, typecheck, unit, integration tests - *existing, not modified*

### Performance Budgets

- [x] Initial chart load: 3 seconds - *existing, monitored*
- [x] Price update latency: 2 seconds - *existing, monitored*
- [x] Alert evaluation: 500ms - *existing, monitored*
- [x] UI panning: 60fps - *existing, verified*
- [x] Memory: 500MB for 5 symbols / 20 alerts - *toast notifications lightweight*

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern - *existing, not modified*
- [x] Data providers implement common interface - *existing, not modified*
- [x] Provider-specific logic isolated from UI - *Telegram logic isolated in service*

### Security & Privacy

- [x] No telemetry or data upload without consent - *Telegram only when configured*
- [x] API keys stored securely (not in repo) - *Telegram tokens not in repo*
- [x] Local data treated as sensitive - *notification history local*

### Governance

- [x] If any principle violated: justification in Complexity Tracking - *no violations*
- [x] Constitution supersedes spec/plan conflicts - *verified, no conflicts*

## Project Structure

### Documentation (this feature)

```text
specs/013-alarm-notifications/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - Research findings
├── data-model.md        # Phase 1 output - Notification data structures
├── quickstart.md        # Phase 1 output - Implementation guide
├── contracts/           # Phase 1 output - API contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created yet)
```

### Source Code (repository root)

```text
# Web application (frontend + backend)
backend/
├── app/
│   ├── services/
│   │   ├── telegram.py              # NEW: Telegram bot service
│   │   └── notification_settings.py # NEW: Alert notification settings service
│   └── models/
│       └── notification.py          # NEW: Notification preference models
└── tests/
    └── services/
        ├── test_telegram.py         # NEW: Telegram service tests
        └── test_notification_settings.py # NEW: Notification settings tests

frontend/
├── src/
│   ├── components/
│   │   ├── ToastNotification.tsx    # NEW: Toast notification component
│   │   ├── NotificationSettings.tsx # NEW: Notification preferences UI
│   │   ├── NotificationHistory.tsx  # NEW: History panel (P3)
│   │   ├── AlertEditDialog.tsx      # MODIFIED: Add notification settings
│   │   └── BulkNotificationActions.tsx # NEW: Bulk operations UI
│   ├── hooks/
│   │   ├── useNotifications.ts      # NEW: Notification orchestration hook
│   │   └── useAlertNotificationSettings.ts # NEW: Alert settings hook
│   ├── lib/
│   │   ├── soundManager.ts          # NEW: Sound playback management
│   │   └── toastManager.ts          # NEW: Toast queue management
│   └── assets/
│       └── sounds/                  # NEW: Bundled notification sounds
└── tests/
    └── components/
        ├── test_notifications.test.ts # NEW: Notification component tests
        └── test_alert_edit.test.ts # NEW: Alert edit with notification settings
```

**Structure Decision**: Web application with existing frontend/backend structure. New files added for notification system without modifying existing core architecture.

## Complexity Tracking

> No constitution violations - this section is empty

## Implementation Phases

### Phase 0: Research (COMPLETE)

**Output**: [research.md](./research.md) - Key findings already captured in spec assumptions

Key decisions:
- react-hot-toast for lightweight toast notifications
- HTML5 Audio API for sound playback
- Telegram Bot API HTTP method for messaging (no python-telegram-bot dependency)
- localStorage for guest preferences, DB for authenticated users

### Phase 1: Design (COMPLETE)

**Outputs**:
- [data-model.md](./data-model.md) - Notification preference and history data structures
- [contracts/performance-api.yaml](./contracts/performance-api.yaml) - API specification
- [quickstart.md](./quickstart.md) - Implementation guide

Design decisions:
- Toast: react-hot-toast (lightweight, customizable, good TypeScript support)
- Sound: HTML5 Audio with bundled MP3 files (bell, alert, chime)
- Telegram: Direct HTTP calls to Bot API (simpler than library dependency)
- Preferences: Per-alert notification settings stored with alert entity

## Dependencies

### Feature Dependencies
- Existing: `001-indicator-alerts` (alert system foundation)
- Existing: `003-advanced-indicators` (alert triggering)

### External Dependencies (to add)
- react-hot-toast (frontend) - Lightweight toast notifications
- No new backend dependencies (HTTP requests to Telegram API)

### Internal Dependencies
- `frontend/src/hooks/useAlerts.ts` - For triggering notifications
- `backend/app/services/alert_engine.py` - For Telegram triggering hook
- `frontend/src/components/AlertForm.tsx` - For alert edit dialog
- `frontend/src/components/AlertsList.tsx` - For bulk operations UI

## Next Steps

1. Run `/speckit.tasks` to generate dependency-ordered task list
2. Implement tasks using `/speckit.implement`
3. Test notification channels independently
4. Verify success criteria: toast < 2s, sound < 1s, Telegram < 5s, alert modification < 30s, bulk update < 5s (50 alerts)
