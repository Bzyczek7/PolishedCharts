# Feature Specification: Alarm Notification System

**Feature Branch**: `013-alarm-notifications`
**Created**: 2025-12-31
**Status**: Draft
**Input**: User description: "Build three type of notifications for alarms: on-screen toast notifications, sound notifications, and Telegram messages. Users should be able to configure Telegram credentials to enable telegram notifications. I forgot to add a feature where we can modify current active alert to be able to change if we want to turn on or off one of the notifications."

## Clarifications

### Session 2025-12-31

- Q: Toast notification mechanism - in-app toasts only, browser Notification API only, or hybrid approach? → A: Hybrid approach - in-app toast notifications (react-hot-toast) for active tab, browser Notification API for background tab
- Q: Telegram credential encryption approach? → A: AES-256-GCM encryption with key stored in environment variable
- Q: AlertNotification entity relationship to AlertTrigger? → A: FK to AlertTrigger (1:N) - one AlertTrigger can have multiple AlertNotifications for different notification types
- Q: Accessibility requirements for notification UI? → A: WCAG 2.1 AA compliance for all interactive notification elements
- Q: Guest user notification capabilities? → A: Limited capabilities - only toast and sound notifications for guests (no Telegram, which requires authenticated backend storage)
- Q: Can existing alerts have their notification settings modified? → A: Yes, users can edit any active alert to enable/disable specific notification types at any time

## User Scenarios & Testing

### User Story 1 - Toast Notifications (Priority: P1)

As a user, I want to receive on-screen notifications when my alerts trigger so that I can be immediately aware of market movements even if I'm not actively watching the chart.

**Why this priority**: Toast notifications are the primary visual feedback mechanism for alerts. Without them, users have no immediate indication that an alert has triggered. This is the most visible and accessible notification method.

**Independent Test**: Trigger an alert and verify a toast notification appears on screen with alert details. The notification should be dismissible and not require page refresh.

**Acceptance Scenarios**:

1. **Given** a user has created an alert with price threshold, **When** the price reaches the threshold and alert triggers, **Then** a toast notification appears displaying the alert name, symbol, and trigger condition.

2. **Given** a toast notification is displayed, **When** the user clicks the dismiss button or the notification times out, **Then** the notification closes without affecting the chart or other UI elements.

3. **Given** multiple alerts trigger in quick succession, **When** notifications are triggered, **Then** each alert shows a separate notification and they queue appropriately without overlapping.

4. **Given** the browser tab is active, **When** an alert triggers, **Then** the toast notification appears within 2 seconds of the trigger.

---

### User Story 2 - Sound Notifications (Priority: P1)

As a user, I want to hear an audio notification when my alerts trigger so that I can be notified even when I'm looking away from the screen.

**Why this priority**: Sound notifications provide hands-free awareness of alerts, especially useful when users are multitasking or have multiple monitors. Combined with toast notifications, this creates a robust multi-modal alert system.

**Independent Test**: Enable sound notifications, trigger an alert, and verify an audio sound plays. The test should confirm sound plays without requiring user interaction within the last 30 seconds (browser autoplay policy).

**Acceptance Scenarios**:

1. **Given** a user has enabled sound notifications in settings, **When** an alert triggers, **Then** a notification sound plays through the device speakers.

2. **Given** a user has configured a specific sound, **When** different alert types trigger, **Then** the appropriate sound plays for each alert type.

3. **Given** the user has disabled sounds in browser/system settings, **When** an alert triggers, **Then** the system handles gracefully without errors.

4. **Given** multiple alerts trigger simultaneously, **When** sounds are enabled, **Then** at most one sound plays to avoid audio chaos.

---

### User Story 3 - Telegram Notifications (Priority: P2)

As a user, I want to receive alert notifications on Telegram so that I can stay informed about market movements even when I'm away from the application.

**Why this priority**: Telegram notifications enable users to monitor markets remotely. This is essential for users who want 24/7 awareness without staying logged into the application. It's a secondary notification channel for accessibility.

**Independent Test**: Configure Telegram credentials, trigger an alert, and verify a message is delivered to the configured Telegram chat.

**Acceptance Scenarios**:

1. **Given** a user has configured valid Telegram bot token and chat ID, **When** an alert triggers, **Then** a Telegram message is sent to the configured chat with alert details.

2. **Given** the user has entered invalid Telegram credentials, **When** attempting to save configuration, **Then** the system shows an error message and does not save invalid credentials.

3. **Given** Telegram service is temporarily unavailable, **When** an alert triggers, **Then** the failure is logged and the alert is still considered triggered (toast and sound still work).

4. **Given** the user has disabled Telegram notifications, **When** an alert triggers, **Then** no Telegram message is sent but toast and sound (if enabled) still work.

---

### User Story 4 - Notification Preferences (Priority: P2)

As a user, I want to configure which notification methods are used for each alert so that I can customize my notification experience based on my needs.

**Why this priority**: Different alerts may require different notification strategies. A critical alert might need all three notification methods, while a routine indicator cross might only need a toast. User control over notification preferences enhances the user experience.

**Independent Test**: Create an alert and configure notification methods (toast, sound, Telegram), then trigger the alert and verify only configured methods activate.

**Acceptance Scenarios**:

1. **Given** a user is creating an alert, **When** configuring notification options, **Then** they can independently enable/disable toast, sound, and Telegram notifications.

2. **Given** a user has set global notification preferences, **When** creating a new alert, **Then** the alert defaults to using the global preferences.

3. **Given** an alert has custom notification settings, **When** the alert triggers, **Then** only the alert's custom settings are used (not global settings).

---

### User Story 5 - Notification History (Priority: P3)

As a user, I want to see a history of notifications that were sent so that I can review alerts that triggered while I was away.

**Why this priority**: This is a quality-of-life feature that provides visibility into past notifications. It helps users who miss notifications due to being away from their device to understand what alerts have triggered.

**Independent Test**: View notification history panel and verify it shows recent notifications with details including type (toast/sound/Telegram), timestamp, and alert information.

**Acceptance Scenarios**:

1. **Given** notifications have been sent, **When** the user opens the notification history panel, **Then** they see a list of recent notifications sorted by timestamp.

2. **Given** a notification was sent via Telegram, **When** viewing history, **Then** the message content matches what was sent to Telegram.

3. **Given** the notification history has more than 50 entries, **When** viewing history, **Then** older entries can be accessed through pagination or "load more".

---

### User Story 6 - Modify Alert Notification Settings (Priority: P1)

As a user, I want to modify an existing active alert to enable or disable specific notification types so that I can adjust how I'm notified without recreating the alert.

**Why this priority**: This is essential functionality for managing alert notifications after creation. Users need to fine-tune their notification preferences as their needs change without having to delete and recreate alerts.

**Independent Test**: Open an existing alert's edit dialog, change notification settings (e.g., disable sound, enable Telegram), save the changes, trigger the alert, and verify only the enabled notification types are delivered.

**Acceptance Scenarios**:

1. **Given** a user has an existing active alert with all notification types enabled, **When** the user opens the alert edit dialog and disables "sound" notifications, **Then** the alert is saved with sound disabled and future triggers only send toast and Telegram notifications.

2. **Given** a user has an existing alert with only toast notifications enabled, **When** the user opens the edit dialog and enables Telegram notifications, **Then** the alert is saved with both toast and Telegram enabled, and future triggers send notifications via both methods.

3. **Given** a user modifies an alert's notification settings, **When** the save completes successfully, **Then** the notification settings persist and are reflected immediately for the next trigger.

4. **Given** a user has not configured Telegram credentials globally, **When** attempting to enable Telegram notifications on an alert, **Then** the system prompts the user to configure Telegram in settings first.

---

### User Story 7 - Bulk Notification Toggles (Priority: P2)

As a user with multiple alerts, I want to quickly toggle notification types across several alerts at once so that I can efficiently manage my notification preferences during high-market-activity periods.

**Why this priority**: Users with many alerts need efficient batch operations. This reduces the time cost of managing notification preferences during events like earnings season or market volatility.

**Independent Test**: Select multiple alerts from the alerts list, toggle a notification type (e.g., disable all sounds), and verify the change is applied to all selected alerts.

**Acceptance Scenarios**:

1. **Given** a user has selected multiple alerts (via checkboxes), **When** clicking "Disable Sound" from a bulk action menu, **Then** sound notifications are disabled for all selected alerts.

2. **Given** a user has applied bulk notification changes, **When** the operation completes, **Then** each affected alert's notification settings are updated individually and the results show success/failure counts.

---

### Edge Cases

- **Multiple rapid triggers**: How does the system handle alerts that trigger multiple times in rapid succession (price moving quickly through a threshold)?
  - *Assumption*: Consecutive triggers within 5 seconds show one notification with a "triggered N times" indicator.

- **Sound playback blocked**: How does the system handle browsers that block autoplaying sounds?
  - *Assumption*: System requests user permission to play sounds on first interaction, then stores the preference.

- **Telegram delivery failures**: What happens if Telegram message delivery fails?
  - *Assumption*: Failed deliveries are logged but do not prevent toast/sound notifications. Retry logic not required for MVP.

- **Notification during inactive tab**: How do notifications work when the browser tab is in the background?
  - *Assumption*: Toast notifications still appear via browser Notification API. Sound plays if tab is active or was recently active.

- **Alert with no notifications enabled**: What happens when a user disables all notification types for an alert?
  - *Assumption*: Alert still triggers internally but sends no notifications. History shows the trigger occurred but was "silent."

- **Alert triggers during edit**: What happens if an alert triggers while the user is modifying its notification settings?
  - *Assumption*: Trigger uses the old settings; the new settings apply to the next trigger after save completes.

- **Bulk operation failure**: What happens if a bulk update partially fails?
  - *Assumption*: Successful alerts are updated; failed alerts are reported with error details for retry.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a toast notification within 2 seconds when any alert triggers, showing alert name, symbol, and trigger condition.

- **FR-002**: System MUST provide a dismiss button on each toast notification that allows users to close it manually.

- **FR-003**: System MUST play a notification sound when an alert triggers and the user has enabled sound notifications.

- **FR-004**: System MUST allow users to select from at least 3 different notification sounds.

- **FR-005**: System MUST allow users to configure Telegram bot token and chat ID for receiving notifications.

- **FR-006**: System MUST validate Telegram credentials when saved and show error message for invalid credentials.

- **FR-007**: System MUST send a Telegram message with alert details when an alert triggers and Telegram is configured and enabled.

- **FR-008**: System MUST allow users to independently enable/disable toast, sound, and Telegram notifications for each alert.

- **FR-009**: System MUST persist notification preferences and Telegram credentials securely using AES-256-GCM encryption with key from environment variable.

- **FR-010**: System MUST show a notification history panel displaying the last 50 notifications.

- **FR-011**: System MUST gracefully handle cases where sound playback is blocked by browser policy.

- **FR-012**: System MUST log Telegram delivery failures without blocking alert processing.

- **FR-013**: System MUST provide WCAG 2.1 AA compliant accessibility for all notification UI elements including keyboard navigation, ARIA labels, and screen reader support.

- **FR-014**: System MUST provide visual alternatives to sound notifications for hearing-impaired users.

- **FR-015**: System MUST ensure toast notifications are dismissible via keyboard (Escape key).

- **FR-016**: System MUST allow users to modify notification settings (toast, sound, Telegram) for any existing active alert.

- **FR-017**: System MUST persist modified notification settings immediately upon save and apply them to the next alert trigger.

- **FR-018**: System MUST provide a bulk operation interface for selecting multiple alerts and applying notification changes.

- **FR-019**: System MUST display notification status indicators on the alerts list showing which notification types are enabled for each alert.

- **FR-020**: System MUST disable Telegram notification toggle in the edit dialog when Telegram credentials are not configured.

### Key Entities

- **NotificationPreference**: Global user notification preferences (toast enabled, sound enabled, sound type, Telegram enabled, encrypted credentials). One-to-one with User.

- **AlertNotificationSettings**: Per-alert notification overrides. When set, these override global NotificationPreference for a specific alert. One-to-zero/one with Alert.

- **NotificationDelivery**: Record of a notification that was sent, including type, timestamp, FK to AlertTrigger (1:N), FK to Alert (denormalized), and delivery status. Multiple NotificationDeliveries can exist per AlertTrigger (one per notification type: toast, sound, Telegram).

- **TelegramCredentials**: Bot token and chat ID for Telegram integration, stored securely with AES-256-GCM encryption (internal storage format).

- **NotificationSettingsSnapshot**: Point-in-time record of notification settings when an alert triggers. Captures which notification methods were enabled at trigger time for audit purposes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Toast notifications appear within 2 seconds of alert trigger (95th percentile).

- **SC-002**: 100% of users can successfully configure and receive Telegram notifications on first attempt with valid credentials.

- **SC-003**: Sound notifications play within 1 second of trigger when enabled and browser permits autoplay.

- **SC-004**: Zero unhandled errors when sound playback is blocked by browser policy.

- **SC-005**: Notification preferences are saved and restored correctly across sessions.

- **SC-006**: Users can review at least 50 recent notifications in the history panel.

- **SC-007**: Users can successfully modify notification settings for any existing alert in under 30 seconds.

- **SC-008**: 100% of notification setting modifications are persisted correctly and applied to the next trigger.

- **SC-009**: Users can perform bulk notification updates on up to 50 alerts simultaneously within 5 seconds.

---

## Assumptions

1. **Hybrid Toast Notifications**:
   - Active tab: react-hot-toast (in-app toast UI)
   - Background tab: Browser Notification API (system-level notification)
   - Tab must be open (not closed) to receive background notifications
   - No push when tab is closed (push notifications are out of scope - requires PWA)
   - Permission flow: Request Notification permission on first user interaction, store in localStorage
   - Graceful degradation: If permission denied, only show in-app toasts (active tab only)

2. Standard notification sounds (bell, alert, chime) are sufficient - custom sound upload not required for MVP.

3. Telegram Bot API is the delivery mechanism - no webhook configuration needed, just bot token and chat ID.

4. **Guest User Restrictions**:
   - Guests receive toast and sound notifications only
   - Telegram setup UI is hidden/not accessible to guests
   - Telegram API endpoints return 401 for unauthenticated requests
   - Telegram credentials require authenticated backend storage for persistence
   - Centralized guest check: `useAuth().isAuthenticated` determines feature access

5. Sound files are bundled with the application, no external sound hosting required.

6. **Encryption Key Management**:
   - AES-256-GCM with `TELEGRAM_ENCRYPTION_KEY` env var (32 bytes)
   - MVP: No automatic key rotation
   - Key change consequence: Old encrypted credentials become unrecoverable (users must re-enter)

## Dependencies

- Existing alert system (003-advanced-indicators or later) must be functional.

- Backend must have Telegram bot sending capability (Python Telegram Bot library or HTTP requests).

- Frontend must have audio playback capability (HTML5 Audio API).

## Out of Scope

- Push notifications to mobile devices (requires service worker and PWA).
- Email notifications (separate feature).
- Custom sound file upload (use bundled sounds only).
- Group chat notifications beyond single chat ID.
- Notification scheduling or quiet hours (may be added in future feature).
- Do-not-disturb / quiet hours mode.
- Mobile-specific touch gestures for notifications.
- Multi-monitor notification display or cross-window deduplication.
- Notification preference export/import.
- Notification batching during high-frequency alerts.
- Sound preview functionality in settings.
- Emergency "disable all" quick toggle.

## MVP Standard Behaviors (Centralized)

These rules apply globally across all notification features and must not be re-implemented per endpoint/component:

### Authorization (AuthZ)

- **FR-AUTHZ-001**: Users can only access, modify, or delete their own notification preferences, settings, and history.
- **FR-AUTHZ-002**: All API endpoints for notification settings, Telegram credentials, and history MUST verify ownership before any operation.
- **FR-AUTHZ-003**: Unauthorized access attempts return 403 (for authenticated users trying to access others' data), distinct from 401 (guests).

### Encryption Failure Handling

- **FR-ENC-001**: When decryption fails (bad key, corrupted ciphertext, or invalid format), treat as "no Telegram configured."
- **FR-ENC-002**: Do not crash or expose error details to users; silently require re-entry of credentials.
- **FR-ENC-003**: Log sanitized errors only (never raw ciphertext, nonce, or plaintext); include error type but no sensitive data.

### AES-256-GCM Encryption Parameters (Authoritative)

All encryption operations MUST use these exact parameters:

| Parameter | Value | Notes |
|-----------|-------|-------|
| Algorithm | AES-256-GCM | NIST-approved authenticated encryption |
| Key Length | 256 bits (32 bytes) | From TELEGRAM_ENCRYPTION_KEY env var |
| Nonce Length | 96 bits (12 bytes) | GCM standard recommendation |
| Tag Length | 128 bits (16 bytes) | Full GCM authentication tag appended to ciphertext |
| Key Derivation | None (raw key) | MVP: key used directly, no KDF |
| Nonce Generation | cryptographically random per encryption | Must never be reused with same key |
| Output Encoding | base64 | Format: `base64(nonce || ciphertext || tag)` |
| Decryption Input | base64 string | Parse to recover nonce, ciphertext, tag |

**Encryption Flow**:
```
1. Generate 12-byte random nonce (os.urandom(12))
2. Encrypt plaintext with AES-256-GCM(key, nonce) → ciphertext + auth_tag
3. Concatenate: nonce || ciphertext || auth_tag
4. base64 encode the concatenated bytes
5. Store result in database
```

**Decryption Flow**:
```
1. base64 decode the stored string
2. Split: first 12 bytes = nonce, last 16 bytes = tag, middle = ciphertext
3. Decrypt with AES-256-GCM(key, nonce, ciphertext, auth_tag)
4. Verify authentication tag before returning plaintext
5. On failure: return error, do not crash, log sanitized message
```

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
- Dismiss order: oldest first (FIFO).
- Text truncation: max 100 characters with ellipsis; hover or expand on click for full content.
- Keyboard dismiss: Escape key closes active toast; focus returns to previous element.
- Duration: 5 seconds for all toast notifications. (Note: Telegram messages are sent to Telegram only; in-app toasts for Telegram events use the same 5-second duration as all other toasts.)

**Sound Behavior**:
- Play at most one sound per alert trigger (deduplicate concurrent alerts).
- Default volume: 70% of system volume.
- If autoplay blocked, queue sound for next user interaction.

**Telegram UX**:
- Credentials masked in UI (token: `****abcd`, chat_id: `****1234`).
- Test notification sent on save; success/failure feedback within 5 seconds.
- Disconnect removes credentials and clears encrypted storage.

### Edit Conflict Handling

- **FR-EDIT-001**: Last save wins for concurrent edits to the same alert.

- **FR-EDIT-002**: No automatic merge conflict resolution for notification settings.

### Bulk Operations

- **FR-BULK-001**: Bulk updates process at most 50 alerts per batch.

- **FR-BULK-002**: Bulk operations show progress indicator and completion summary.

- **FR-BULK-003**: Partial failures in bulk operations report success/failure counts for retry.
