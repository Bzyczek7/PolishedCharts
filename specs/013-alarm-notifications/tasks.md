# Tasks: Alarm Notification System

**Input**: Design documents from `/specs/013-alarm-notifications/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Feature Branch**: `013-alarm-notifications`

## Feature Summary

Implement three notification channels for alerts: on-screen toast notifications, sound notifications, and Telegram messages. Toast and sound are frontend-only; Telegram requires backend integration with the Telegram Bot API.

**Tech Stack**: Python 3.11+ (backend), TypeScript 5.9+ (frontend), react-hot-toast (frontend), Telegram Bot API (backend)

## Key Entities (Renamed 2026-01-01)

| Old Name | New Name | Purpose |
|----------|----------|---------|
| AlertNotification | NotificationDelivery | History record of sent notifications (FK to AlertTrigger) |
| NotificationConfig | NotificationPreference | Global user notification settings |
| Per-Alert Settings | AlertNotificationSettings | Per-alert notification overrides |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and resource preparation

- [X] T001 Install react-hot-toast dependency in frontend/package.json
- [X] T002 Create sound files directory at frontend/src/assets/sounds/
- [X] T003 [P] Add bundled notification sound files (bell.mp3, alert.mp3, chime.mp3) to frontend/src/assets/sounds/
- [X] T004 Add TELEGRAM_ENCRYPTION_KEY configuration to backend/.env.example (32-byte key guidance)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data models, schemas, and encryption utilities required by all notification features

**CRITICAL**: This phase MUST complete before any user story implementation

### Backend Encryption & Schemas

- [X] T005 Create AES-256-GCM encryption utilities in backend/app/core/encryption.py
  - Must document: Key source (TELEGRAM_ENCRYPTION_KEY env), No rotation (MVP), Key change = unrecoverable
  - **FR-ENC compliant**: Implement decrypt failure handling per FR-ENC-001/002/003 (treat as no config, no crash, sanitized logs)
  - Return Result[T, EncryptionError] type for callers to handle failures consistently
- [X] T006 Create Pydantic schemas for NotificationPreference in backend/app/schemas/notification.py
- [X] T007 Create Pydantic schemas for AlertNotificationSettings in backend/app/schemas/notification.py
- [X] T008 Create Pydantic schemas for NotificationDelivery in backend/app/schemas/notification.py (must include alert_trigger_id FK)
- [ ] T009 [P] Add validation to ensure Telegram credentials are encrypted before storage

### Centralized Security Behaviors

- [X] T009a Create notification_audit_log utility in backend/app/services/audit.py
  - **FR-AUDIT compliant**: Implement logging per FR-AUDIT-001/002/005/006
  - Provide `log_credential_change(user_id, action)`, `log_history_access(user_id, range)`, `log_notification_failure(alert_id, type, error)`
  - NEVER accept or log credential values, decrypted data, or raw API responses
- [X] T009b Create notification_authz dependency in backend/app/api/dependencies.py
  - **FR-AUTHZ compliant**: Implement ownership verification per FR-AUTHZ-001/002/003
  - Provide `get_notification_preference_or_403()`, `get_history_or_403()`, `get_telegram_config_or_403()`
  - Returns 401 for guests, 403 for authenticated users accessing others' data

### Backend SQLAlchemy Models (Future Phase)

> Note: Database models created in migration phase, not here

### Frontend Types

- [X] T010 Define TypeScript types for NotificationPreference in frontend/src/types/notification.ts
- [X] T011 [P] Define TypeScript types for AlertNotificationSettings in frontend/src/types/notification.ts
- [X] T012 Define TypeScript types for NotificationDelivery in frontend/src/types/notification.ts

### Frontend Hybrid Toast Foundation

- [X] T013 Create Browser Notification API permission hook in frontend/src/hooks/useNotificationPermission.ts
  - **UX MVP compliant**: Request on user gesture only, no auto-reprompt, store in localStorage
  - Provide isSupported, isGranted, isDenied getters
- [X] T014 Create notification permission UI component (subtle "Enable notifications" link in settings)

---

## Phase 3: User Story 1 - Toast Notifications (Priority: P1) 🎯 MVP

**Goal**: Display on-screen toast notifications when alerts trigger (hybrid: in-app + system)

**Independent Test**: Trigger an alert and verify:
1. Toast notification appears on screen (active tab) within 2 seconds
2. System notification appears (background tab) if permission granted
3. Notification shows alert name, symbol, and trigger condition

**Acceptance Criteria**:
- [ ] Hybrid approach: react-hot-toast for active tab, Browser Notification API for background
- [ ] Permission gating: Only show system notifications if permission granted
- [ ] Permission denial handling: Graceful fallback to in-app toasts only
- [ ] Keyboard dismissible (Escape key)
- [ ] WCAG 2.1 AA compliant (ARIA labels, screen reader support)

### Frontend Implementation

- [X] T015 Create toast queue manager in frontend/src/lib/toastManager.ts
  - **UX MVP compliant**: Max 5 concurrent, FIFO dismiss, 100-char truncation, Escape key dismiss
- [X] T016 Create ToastNotification component in frontend/src/components/ToastNotification.tsx
- [X] T017 [P] Implement hybrid toast logic:
  - Detect tab visibility (document.hidden)
  - Use react-hot-toast for active tab (5s duration for standard, 8s for Telegram)
  - Use Notification API for background tab (tab must be open)
  - No push when tab is closed (push/PWA out of scope)
  - Fallback gracefully if permission denied
- [X] T018 Create useNotifications orchestration hook in frontend/src/hooks/useNotifications.ts
- [X] T019 Integrate hybrid toast trigger in useNotifications hook (alert → showToast)
- [X] T020 Add react-hot-toast provider to frontend/src/main.tsx

### Integration

- [X] T021 Connect useNotifications hook to alert system in frontend/src/hooks/useAlertTriggerListener.ts

**Checkpoint**: Toast notifications work in both active and background tab modes

---

## Phase 4: User Story 2 - Sound Notifications (Priority: P1)

**Goal**: Play audio notification when alerts trigger

**Independent Test**: Enable sound notifications, trigger an alert, and verify an audio sound plays within 1 second.

**Acceptance Criteria**:
- [ ] Sound plays within 1 second of trigger (if browser permits autoplay)
- [ ] Sound type selection (bell, alert, chime)
- [ ] Browser autoplay policy handling (permission request on first interaction)
- [ ] Graceful handling when sound playback blocked (no errors)

### Frontend Implementation

- [X] T022 Create sound manager in frontend/src/lib/soundManager.ts
  - **UX MVP compliant**: Play at most 1 sound per trigger, 70% default volume, queue if autoplay blocked
- [X] T023 [P] Implement sound playback with browser autoplay policy handling
- [ ] T024 Add sound selection UI in NotificationSettings component (deferred to US4)
- [X] T025 Integrate sound playback in useNotifications hook (alert → playSound)

**Checkpoint**: Sound notifications play when alerts trigger and sound is enabled

---

## Phase 5: User Story 3 - Telegram Notifications (Priority: P2)

**Goal**: Send alert notifications to Telegram when configured

**Independent Test**: Configure Telegram credentials, trigger an alert, and verify a message is delivered to the configured Telegram chat.

**Acceptance Criteria**:
- [x] Telegram credentials validated before saving
- [x] Credentials encrypted with AES-256-GCM before storage
- [ ] Telegram messages sent within 5 seconds of trigger
- [ ] Delivery failures logged but don't block toast/sound
- [x] 401 returned for unauthenticated requests (guests blocked)

### Backend Implementation

- [x] T026 Create Telegram bot service in backend/app/services/telegram.py
- [x] T027 [P] Implement send_message method with Telegram Bot API HTTP calls
- [x] T028 Create validation endpoint for Telegram credentials (POST /api/v1/notifications/telegram/validate)
  - **FR-AUTHZ/FR-AUDIT compliant**: Use `notification_authz`, log credential access
  - Must require authentication (401 for guests)
  - Must encrypt credentials before any storage
- [x] T029 Create test endpoint for Telegram configuration (POST /api/v1/notifications/telegram/test)
  - **FR-AUTHZ/FR-AUDIT compliant**: Use `notification_authz`, log test notification
  - Must require authentication
- [x] T030 Create send alert notification endpoint (POST /api/v1/notifications/telegram/send)
  - **FR-AUTHZ/FR-AUDIT compliant**: Use `notification_authz`, log delivery
  - Must require authentication
  - Must log NotificationDelivery record with alert_trigger_id

### Frontend Implementation

- [x] T031 Create Telegram configuration form in NotificationSettings component
  - **UX MVP compliant**: Credentials masked (****abcd), test notification on save, disconnect clears storage
  - Must check `useAuth().isAuthenticated` before rendering
  - Hidden/not accessible for guests
- [x] T032 [P] Integrate Telegram API calls in frontend/src/api/notifications.ts
- [ ] T033 Add Telegram notification trigger in useNotifications hook (alert → sendTelegram)

### Guest Gate (Centralized)

- [x] T034 Use `notification_authz` dependency to return 401 for guests on all Telegram endpoints
- [x] T035 Add frontend guard to hide Telegram settings from guest users (single check, not per-screen)

**Checkpoint**: Telegram notifications sent when configured and enabled (authenticated users only)

---

## Phase 6: User Story 4 - Notification Preferences (Priority: P2)

**Goal**: Allow users to configure notification methods per alert and globally

**Independent Test**: Configure notification preferences (global and per-alert), then trigger alerts and verify only configured methods activate.

**Acceptance Criteria**:
- [ ] Global notification preferences saved to NotificationPreference entity
- [ ] Per-alert overrides saved to AlertNotificationSettings entity
- [ ] Per-alert settings override global when set (null fields use global)
- [ ] Preferences persist across sessions
- [ ] Guest preferences stored in localStorage (toast/sound only)

### Backend API

- [x] T036 Create settings endpoint (GET /api/v1/notifications/settings)
  - **FR-AUTHZ/FR-AUDIT compliant**: Use `get_notification_preference_or_403()`, log settings access/update
  - Returns NotificationPreference for authenticated users
  - Returns 401 for guests (Telegram not available)
- [x] T037 [P] Create settings update endpoint (PATCH /api/v1/notifications/settings)
  - **FR-ENC/FR-AUDIT compliant**: Validate/encrypt credentials, log credential change
  - Validates and encrypts Telegram credentials
  - Creates NotificationPreference if not exists
- [x] T038 Add AlertNotificationSettings to Alert schema in backend/app/schemas/alert.py

### Frontend Implementation

- [x] T039 Create NotificationSettings component in frontend/src/components/NotificationSettings.tsx
  - Must check `useAuth().isAuthenticated` before showing Telegram section
- [x] T040 Add notification preferences to AlertForm in frontend/src/components/AlertForm.tsx
- [ ] T041 [P] Implement global vs per-alert settings override logic in useNotifications hook
- [ ] T042 Save preferences to localStorage for guests in useNotifications hook

**Checkpoint**: Users can configure notification preferences globally and per alert

---

## Phase 7: User Story 5 - Notification History (Priority: P3)

**Goal**: Display history of notifications that were sent

**Independent Test**: View notification history panel and verify it shows recent notifications with details including type, timestamp, and alert information.

**Acceptance Criteria**:
- [ ] History shows at least 50 recent notifications
- [ ] Each record includes notification_type, status, triggered_at, message
- [ ] FK to AlertTrigger visible in history records
- [ ] Pagination or "load more" for large histories

### Backend Implementation

- [x] T043 Create history endpoint (GET /api/v1/notifications/history)
  - **FR-AUTHZ/FR-AUDIT compliant**: Use `get_history_or_403()`, log history access
  - Returns NotificationDelivery records ordered by triggered_at desc
- [ ] T044 [P] Add NotificationDelivery logging when notifications are sent in backend/app/services/alert_engine.py
  - **FR-AUDIT compliant**: Use `notification_audit_log` utility, log notification failures
  - Must include alert_trigger_id FK

### Frontend Implementation

- [x] T045 Create NotificationHistory component in frontend/src/components/NotificationHistory.tsx
- [x] T046 Add history API integration in frontend/src/api/notifications.ts
- [ ] T047 Connect notification history to useNotifications hook for logging

**Checkpoint**: Notification history panel displays recent notifications with AlertTrigger linkage

---

## Phase 8: User Story 6 - Modify Alert Notification Settings (Priority: P1)

**Goal**: Allow users to modify notification settings on existing active alerts in under 30 seconds

**Independent Test**: Open existing alert edit dialog, change notification settings, save, trigger alert, verify only enabled notifications fire.

**Acceptance Criteria**:
- [x] Alert edit dialog includes notification settings controls
- [ ] Modified settings persist immediately and apply to next trigger
- [ ] Settings modify completes in under 30 seconds
- [ ] Telegram toggle disabled when credentials not configured
- [ ] Prompt shown when enabling Telegram without credentials

### Backend Implementation

- [x] T056 [P] Add PATCH /api/v1/alerts/{alert_id}/notification-settings endpoint in backend/app/api/v1/alerts.py
  - **FR-AUTHZ compliant**: Verify alert ownership before update
  - Updates or creates AlertNotificationSettings record
- [x] T057 Create bulk update endpoint POST /api/v1/alerts/bulk/notification-settings in backend/app/api/v1/alerts.py
  - **FR-BULK compliant**: Process max 50 alerts per batch, return success/failure counts
  - **FR-AUTHZ compliant**: Verify ownership of all alerts before any update

### Frontend Implementation

- [x] T058 Add notification settings section to AlertForm in frontend/src/components/AlertForm.tsx
- [x] T059 Add notification status indicators in frontend/src/components/AlertsList.tsx
- [x] T060 Create useAlertNotificationSettings hook in frontend/src/hooks/useAlertNotificationSettings.ts
- [ ] T061 Add Telegram configuration prompt when enabling without credentials

**Checkpoint**: Users can modify notification settings on existing alerts

---

## Phase 9: User Story 7 - Bulk Notification Toggles (Priority: P2)

**Goal**: Allow batch updates to notification settings across multiple alerts within 5 seconds (50 alerts)

**Independent Test**: Select multiple alerts, toggle notification type, verify changes applied to all selected alerts.

**Acceptance Criteria**:
- [ ] Alerts list supports multi-select via checkboxes
- [ ] Bulk action menu appears when alerts selected
- [ ] Bulk updates complete in under 5 seconds (50 alerts)
- [ ] Progress indicator shown during bulk operation
- [ ] Success/failure counts displayed after completion
- [ ] Partial failures can be retried

### Frontend Implementation

- [-] T062 Add bulk selection UI to AlertsList in frontend/src/components/AlertsList.tsx
  (Removed per UX feedback - using right-click context menu instead)
- [x] T063 Create BulkNotificationActions component in frontend/src/components/BulkNotificationActions.tsx
- [x] T064 Implement bulk update API integration in frontend/src/api/alerts.ts
- [x] T065 Add progress indicator and completion summary UI

**Checkpoint**: Users can batch update notification settings across multiple alerts

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Quality improvements across all notification features

- [ ] T048 Add accessibility attributes (ARIA labels, keyboard navigation) to all notification UI components
- [ ] T049 [P] Add unit tests for soundManager in frontend/tests/lib/test_soundManager.test.ts
- [ ] T050 Add unit tests for toastManager/hybrid toast in frontend/tests/lib/test_toastManager.test.ts
- [ ] T051 Add integration tests for notification flow in backend/tests/integration/test_notifications.py
- [ ] T052 Performance validation: Verify toast < 2s, sound < 1s, Telegram < 5s per success criteria
- [ ] T053 Update README with notification system documentation

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Blocks |
|-------|------------|--------|
| Setup (1) | None | Foundational |
| Foundational (2) | Setup | All User Stories |
| User Story 1 (3) | Foundational | US1 complete |
| User Story 2 (4) | Foundational | US2 complete |
| User Story 3 (5) | Foundational | US3 complete |
| User Story 4 (6) | Foundational | US4 complete |
| User Story 5 (7) | Foundational | US5 complete |
| User Story 6 (8) | Foundational | US6 complete |
| User Story 7 (9) | Foundational | US7 complete |
| Polish (10) | All desired stories | Feature complete |

### User Story Dependencies

- **User Story 1 (Toast)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (Sound)**: Can start after Foundational (Phase 2) - Can run in parallel with US1
- **User Story 3 (Telegram)**: Can start after Foundational (Phase 2) - Can run in parallel with US1, US2
- **User Story 4 (Preferences)**: Can start after Foundational (Phase 2) - Can run in parallel with US1-US3
- **User Story 5 (History)**: Can start after Foundational (Phase 2) - Can run in parallel with US1-US4
- **User Story 6 (Modify Settings)**: Can start after Foundational (Phase 2) - Can run in parallel with US1-US5
- **User Story 7 (Bulk Toggles)**: Can start after Foundational (Phase 2) - Can run in parallel with US1-US6

### Within Each User Story

1. Encryption/schemas before services
2. Services before API endpoints
3. API endpoints before frontend integration
4. Core implementation before UI polish
5. Story complete before moving to next priority

---

## Parallel Execution Examples

### Within User Story 1 (Toast)
```bash
Task: "Create ToastNotification component"
Task: "Create hybrid toast logic (visibility detection)"
```
Can run in parallel since they affect different files.

### Within User Story 3 (Telegram)
```bash
Task: "Create Telegram bot service"
Task: "Create validation endpoint for Telegram credentials"
```
Can run in parallel since they affect different files.

### Across User Stories
```bash
Developer A: User Story 1 (Toast)
Developer B: User Story 2 (Sound)
Developer C: User Story 3 (Telegram)
```
All stories can proceed in parallel after Foundational phase.

---

## Implementation Strategy

### MVP First (Toast + Sound + Modify Settings)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (including hybrid toast foundation - T013, T014)
3. Complete Phase 3: User Story 1 (Toast)
4. Complete Phase 4: User Story 2 (Sound)
5. Complete Phase 8: User Story 6 (Modify Settings)
6. **STOP and VALIDATE**: Test notification system with toast, sound, and modification capabilities
7. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Toast MVP!
3. Add User Story 2 → Test independently → Sound added
4. Add User Story 6 → Test independently → Modify settings added
5. Add User Story 3 → Test independently → Telegram added (auth-gated)
6. Add User Story 4 → Test independently → Preferences added
7. Add User Story 7 → Test independently → Bulk toggles added
8. Add User Story 5 → Test independently → History added
9. Polish phase → Feature complete

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Toast)
   - Developer B: User Story 2 (Sound)
   - Developer C: User Story 6 (Modify Settings)
   - Developer D: User Story 3 (Telegram)
3. Stories complete and integrate independently

---

## Task Summary

| Phase | Task Count | Description |
|-------|------------|-------------|
| Phase 1: Setup | 4 | Dependencies, sounds, env config |
| Phase 2: Foundational | 12 | Encryption, schemas, types, hybrid toast foundation, centralized security |
| Phase 3: US1 Toast | 7 | Hybrid toast implementation (in-app + system) |
| Phase 4: US2 Sound | 4 | Sound manager and playback |
| Phase 5: US3 Telegram | 10 | Bot API service + 4 endpoints + guest gate |
| Phase 6: US4 Preferences | 7 | Settings UI + API endpoints + AlertNotificationSettings |
| Phase 7: US5 History | 5 | History component + NotificationDelivery logging |
| Phase 8: US6 Modify Settings | 6 | Alert edit dialog + notification settings controls |
| Phase 9: US7 Bulk Toggles | 4 | Bulk selection UI + batch update operations |
| Phase 10: Polish | 6 | Tests, accessibility, documentation |
| **Total** | **65** | |

---

## Success Criteria Validation

- [ ] SC-001: Toast notifications appear within 2 seconds (95th percentile)
- [ ] SC-002: 100% of authenticated users can configure and receive Telegram notifications
- [ ] SC-003: Sound notifications play within 1 second when enabled
- [ ] SC-004: Zero unhandled errors when sound playback blocked
- [ ] SC-005: Notification preferences persist across sessions
- [ ] SC-006: At least 50 recent notifications in history panel
- [ ] SC-007: Alert notification settings modify in under 30 seconds
- [ ] SC-008: 100% of notification setting modifications persist correctly
- [ ] SC-009: Bulk notification updates complete in under 5 seconds (50 alerts)

---

## Guest Restriction Summary

| Feature | Guest Access | Notes |
|---------|--------------|-------|
| Toast | Yes | react-hot-toast (active tab) |
| Sound | Yes | HTML5 Audio |
| System Notifications | Yes (with permission) | Browser Notification API |
| Telegram | **NO** | 401 on API, hidden UI |
| History | Limited | localStorage only |

**Centralized Check**: `useAuth().isAuthenticated` determines Telegram feature access in both frontend (UI gating) and backend (API 401).

---

## Encryption Key Management

| Aspect | Value |
|--------|-------|
| Algorithm | AES-256-GCM |
| Key Source | TELEGRAM_ENCRYPTION_KEY env var (32 bytes) |
| MVP Rotation | None (manual key change only) |
| Key Change Impact | Old credentials unrecoverable |
| Nonce | 12 bytes per encryption |
| Format | base64(nonce \|\| ciphertext) |

---

## MVP Standard Behaviors Reference

### Authorization (AuthZ)
- **FR-AUTHZ-001**: Users can only access, modify, or delete their own notification preferences, settings, and history.
- **FR-AUTHZ-002**: All API endpoints for notification settings, Telegram credentials, and history MUST verify ownership before any operation.
- **FR-AUTHZ-003**: Unauthorized access attempts return 403 (for authenticated users trying to access others' data), distinct from 401 (guests).

### Encryption Failure Handling
- **FR-ENC-001**: When decryption fails (bad key, corrupted ciphertext, or invalid format), treat as "no Telegram configured."
- **FR-ENC-002**: Do not crash or expose error details to users; silently require re-entry of credentials.
- **FR-ENC-003**: Log sanitized errors only (never raw ciphertext, nonce, or plaintext); include error type but no sensitive data.

### Audit Logging & Retention
- **FR-AUDIT-001**: Log all credential modifications with user_id, timestamp, and action type (create/update/delete).
- **FR-AUDIT-002**: Log notification history access with user_id, timestamp, and requested history range.
- **FR-AUDIT-003**: Notification history records are retained for 90 days, then automatically purged.
- **FR-AUDIT-004**: Audit logs (credential changes) are retained for 365 days for compliance.
- **FR-AUDIT-005**: NEVER log credential values, decrypted data, or raw API responses from Telegram.
- **FR-AUDIT-006**: Failed notification deliveries log only: alert_id, trigger_id, notification_type, error_type (no sensitive content).

### UX MVP Standard
**Permission UX**:
- Request notification permission only after explicit user gesture (button click).
- If permission denied, do not auto-reprompt; show a subtle "Enable notifications" link in settings.
- Store permission state in localStorage; re-verify on session start.

**Toast Behavior**:
- Maximum 5 concurrent toasts visible; queue additional notifications.
- Dismiss order: oldest first (FIFO) or user-selected.
- Text truncation: max 100 characters with ellipsis; hover or expand on click for full content.
- Keyboard dismiss: Escape key closes active toast; focus returns to previous element.
- Duration: 5 seconds for standard alerts; 8 seconds for Telegram/in-app hybrid.

**Sound Behavior**:
- Play at most one sound per alert trigger (deduplicate concurrent alerts).
- Default volume: 70% of system volume.
- If autoplay blocked, queue sound for next user interaction.

**Telegram UX**:
- Credentials masked in UI (token: `****abcd`, chat_id: `****1234`).
- Test notification sent on save; success/failure feedback within 5 seconds.
- Disconnect removes credentials and clears encrypted storage.

---

## Notes

- Tasks marked [P] can execute in parallel with other [P] tasks
- [US1], [US2], [US3], [US4], [US5], [US6], [US7] labels map tasks to specific user stories
- Each user story should be independently testable
- Verify tests fail before implementing (TDD optional)
- Stop at any checkpoint to validate story independently
- Guest restrictions enforced at both frontend (UI) and backend (API) layers
