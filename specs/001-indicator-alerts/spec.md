# Feature Specification: Indicator-based Alerts (cRSI only)

**Feature Branch**: `001-indicator-alerts`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "Paste the following into /speckit:specify as the description (alerts only, cRSI only, TradingView-style 'one alert + log entries per trigger').

Spec: Indicator-based Alerts (cRSI only)
Objective
Implement TradingView-style alerts for the RSI cyclic smoothed indicator (shorttitle: cRSI) where alerts are created from the indicator UI, not from the Monitoring panel, and a single alert can generate different messages per trigger (buy/sell) while remaining a single alert entry.

In scope
Create alerts only from the indicator context menu (starting with the cRSI oscillator pane).
Support one cRSI alert type equivalent to 'Any alert() function call':

On cross below lower band -> trigger message 'It's time to buy!'
On cross above upper band -> trigger message 'It's time to sell!'

Persist and display every trigger occurrence in a Log (append-only), and also show per-alert history (multiple entries across days).
Alert management in Monitoring: list alerts, mute/unmute, delete, view history; no alert creation UI in Monitoring.

Out of scope (for now)
Notification delivery behaviors (email, webhook, push, sound settings, etc.) - but the alert modal must include a Notifications tab placeholder so it can be implemented later.

UX requirements
Remove 'Set Alert' from Monitoring
The Monitoring/Alerts panel must not show the current 'Set Alert' form (currently implemented via AlertForm).
Monitoring becomes a management view only (alerts list + trigger history + log).

Create alert from indicator
User opens cRSI pane context menu and selects 'Add alert on cRSI(20)...'.
This opens an 'Edit/Create Alert' modal with tabs:
Settings (enabled)
Message (enabled)
Notifications (placeholder/disabled content)
Saving creates exactly one alert entry in the Alerts list.

Triggered events and log
Each time the alert triggers, a new trigger event is appended to:
The alert's history[] shown when expanding the alert in the Alerts list.
A global 'Log' tab that lists all trigger events chronologically (newest first).
Triggers must include:
Timestamp (date + time)
Symbol
Alert name
Message ('It's time to buy!' / 'It's time to sell!')
Optional: observed price + cRSI value at trigger time.

Functional requirements
Alert condition for cRSI must trigger on either band cross (upper or lower) using current and previous values (cross detection, not just 'above/below').
Each trigger must store direction (buy vs sell) as a message payload; the alert remains a single alarm definition.
Alerts list must continue to support statuses like active, triggered, muted, and display per-alert history without overwriting prior entries.

Data requirements
Frontend Alert model already includes history?: { timestamp; price?; indicator_value? }[] and must be populated with multiple entries over time.
Backend already persists triggers via AlertTrigger creation during evaluation; extend it (if needed) to also persist the trigger message/direction so the UI can render buy/sell text per trigger.

Acceptance criteria
Monitoring panel has no 'Set Alert' create form and no 'Price Alert' creation path.
A user can create the cRSI alert only from the cRSI indicator UI.
The Alerts list shows one alert entry for cRSI, while the Log shows multiple entries as the alert triggers over multiple days.
The alert trigger message matches the Pine-script intent: buy message for lower-band cross, sell message for upper-band cross."

---

## Clarifications

### Session 2025-12-26

- Q: What should the default cooldown value be (FR-018a specifies minimum 5s but no default)? → A: 60 seconds (user-configurable, minimum enforced by backend)
- Q: Should trigger events use "alert name" or "alert_label" (computed), and should it be stored or computed at query time? → A: Compute `alert_label` at query time from indicator parameters; spec updated to use consistent terminology and added `trigger_type` field
- Q: Should "triggered" be a stored alert status or just a transient state during evaluation? → A: Store only `active`/`muted` statuses; track recency via `last_triggered_at` timestamp instead

---

## User Scenarios & Testing

### User Story 1 - Create cRSI Alert from Indicator UI (Priority: P1)

A trader wants to be notified when the cRSI indicator crosses its upper or lower bands. They open the context menu on the cRSI oscillator pane and select "Add alert on cRSI(20)...". A modal opens with Settings, Message, and Notifications tabs. After configuring the alert, they save it. The alert appears as a single entry in the Alerts list in the Monitoring panel.

**Why this priority**: This is the core value proposition - enabling alerts to be created directly from the indicator without navigating to a separate panel. Without this, the feature cannot deliver its primary benefit.

**Independent Test**: Can be fully tested by right-clicking on the cRSI indicator, creating an alert, and verifying it appears in the Monitoring panel's alerts list. Delivers immediate value: users can create alerts contextually.

**Acceptance Scenarios**:

1. **Given** the cRSI indicator is visible on the chart, **When** the user right-clicks on the cRSI oscillator pane, **Then** a context menu appears with an option "Add alert on cRSI(20)..."
2. **Given** the context menu is open, **When** the user selects "Add alert on cRSI(20)...", **Then** an "Edit/Create Alert" modal opens with three tabs: Settings, Message, and Notifications
3. **Given** the alert modal is open on the Settings tab, **When** the user configures the alert conditions and clicks Save, **Then** exactly one alert entry is created in the Alerts list
4. **Given** the user is in the Monitoring panel, **When** viewing the Alerts list, **Then** the newly created cRSI alert appears with status "active"

---

### User Story 2 - Alert Triggers with Different Messages (Priority: P1)

A trader has created a cRSI alert. When the indicator crosses below the lower band, a trigger event is logged with message "It's time to buy!". Later, when it crosses above the upper band, another trigger is logged with message "It's time to sell!". Both triggers appear in the alert's history and in the global Log, while the alert remains a single entry.

**Why this priority**: This is the core "TradingView-style" behavior - one alert definition that can generate different messages based on trigger direction. Without this, alerts would be less useful.

**Independent Test**: Can be tested by creating an alert and simulating band crosses (using historical data or test fixtures). Delivers immediate value: users get context-aware messages for different signal types.

**Acceptance Scenarios**:

1. **Given** an active cRSI alert exists, **When** the cRSI crosses below the lower band (from above to below), **Then** a trigger event is created with message "It's time to buy!"
2. **Given** an active cRSI alert exists, **When** the cRSI crosses above the upper band (from below to above), **Then** a trigger event is created with message "It's time to sell!"
3. **Given** the alert has triggered multiple times, **When** the user expands the alert in the Alerts list, **Then** all trigger events are shown in chronological order with their respective messages
4. **Given** the alert has triggered, **When** the user switches to the Log tab in Monitoring, **Then** trigger events appear with timestamp, symbol, alert name, and message

---

### User Story 3 - Manage Alerts in Monitoring Panel (Priority: P2)

A trader wants to manage their existing cRSI alerts. They open the Monitoring panel, which shows the alerts list without any creation form. They can mute/unmute alerts, delete alerts, and view trigger history. There is no way to create alerts from this panel - only from the indicator context menu.

**Why this priority**: Alert management is essential for controlling which alerts are active, but the core value (Story 1 and 2) can be tested without management features.

**Independent Test**: Can be fully tested by creating an alert (via Story 1), then using the Monitoring panel to mute, unmute, and delete it. Delivers value: users can control their alerts lifecycle.

**Acceptance Scenarios**:

1. **Given** the user opens the Monitoring panel, **When** viewing the Alerts section, **Then** no "Set Alert" form or "Price Alert" creation button is visible
2. **Given** an active alert exists, **When** the user clicks the mute option, **Then** the alert status changes to "muted" and the alert stops triggering
3. **Given** a muted alert exists, **When** the user clicks the unmute option, **Then** the alert status changes to "active" and the alert resumes triggering
4. **Given** an alert exists, **When** the user clicks the delete option, **Then** the alert is removed from the Alerts list and all its trigger history
5. **Given** an alert with trigger history exists, **When** the user expands the alert entry, **Then** all past trigger events are displayed with timestamps and messages

---

### User Story 4 - View Global Trigger Log (Priority: P3)

A trader wants to see all alert triggers across all alerts in one place, ordered chronologically. They open the Monitoring panel and switch to the Log tab, which shows every trigger event from every alert with timestamp, symbol, alert name, and message.

**Why this priority**: The global log provides convenience and auditability, but the core functionality works without it - users can still see individual alert histories.

**Independent Test**: Can be tested by creating multiple alerts, triggering them, and verifying the Log shows all events. Delivers value: centralized view of all alert activity.

**Acceptance Scenarios**:

1. **Given** multiple alerts have triggered, **When** the user opens the Log tab in the Monitoring panel, **Then** all trigger events are displayed in reverse chronological order (newest first)
2. **Given** the Log is displayed, **When** viewing any trigger event, **Then** it shows: timestamp, symbol, alert name, message, and optionally price and indicator value
3. **Given** a new trigger occurs, **When** the user refreshes the Log, **Then** the new trigger appears at the top of the list

---

### Edge Cases

- What happens when cRSI crosses both bands within a single candle update? (Should trigger both upper and lower band events if both conditions are met; cooldown applies after all triggers are created)
- What happens when the alert is muted and a trigger condition occurs? (Should not create a trigger event)
- What happens when the same alert triggers multiple times in quick succession? (Should create separate trigger events for each occurrence, subject to minimum 5-second cooldown period)
- What happens when historical trigger log becomes very large (thousands of entries)? (Log should remain performant; initial implementation uses 500-entry limit with pagination deferred)
- What happens when the indicator is removed from the chart but the alert still exists? (Alert continues to exist and can trigger; indicator context menu option becomes unavailable)
- What happens when a user tries to edit an existing alert from the context menu? (Opens the same modal with pre-filled values; saves updates the existing alert)
- What happens when alert conditions cannot be evaluated (missing data)? (Alert remains in active state but no trigger is created until data is available)

## Requirements

### Functional Requirements

**Alert Creation**

- **FR-001**: The system MUST provide a context menu option on the cRSI oscillator pane labeled "Add alert on cRSI([period])..." where [period] is the indicator's current period setting
- **FR-002**: The system MUST display an "Edit/Create Alert" modal when the user selects the alert context menu option
- **FR-003**: The alert modal MUST include three tabs: "Settings", "Message", and "Notifications"
- **FR-004**: The Settings tab MUST allow configuration of alert conditions (upper band cross, lower band cross, or both)
- **FR-005**: The Message tab MUST allow configuration of trigger messages for upper band cross and lower band cross separately
- **FR-006**: The Notifications tab MUST display placeholder content indicating notifications will be available in a future update
- **FR-007**: Saving the alert MUST create exactly one alert entry in the Alerts list

**Trigger Detection**

- **FR-008**: The system MUST detect cRSI value crossing below the lower band when the current value is below the band AND the previous value was above or equal to the band
- **FR-009**: The system MUST detect cRSI value crossing above the upper band when the current value is above the band AND the previous value was below or equal to the band
- **FR-010**: The system MUST use the current candle's cRSI value and the immediately preceding candle's cRSI value for cross detection
- **FR-011**: When a lower band cross is detected, the system MUST create a trigger event with the configured lower band message (default: "It's time to buy!")
- **FR-012**: When an upper band cross is detected, the system MUST create a trigger event with the configured upper band message (default: "It's time to sell!")

**Alert Status and Management**

- **FR-013**: The system MUST support alert statuses: active and muted. The system MUST track last_triggered_at timestamp to indicate when an alert most recently fired (transient "triggered" state during evaluation auto-resets to active after cooldown).
- **FR-014**: The system MUST prevent muted alerts from creating trigger events
- **FR-015**: The system MUST allow users to toggle an alert between active and muted status
- **FR-016**: The system MUST allow users to delete an alert, which removes the alert and all its trigger history
- **FR-017**: The system MUST remove the "Set Alert" creation form from the Monitoring/Alerts panel
- **FR-018**: The system MUST NOT provide any alert creation interface within the Monitoring panel
- **FR-018a**: The system MUST enforce a minimum cooldown period of 5 seconds after any trigger, during which the alert will not create additional trigger events for any enabled condition. The default cooldown is 60 seconds (user-configurable, minimum enforced by backend).

**Trigger History and Logging**

- **FR-019**: Each trigger event MUST be stored with the following attributes: timestamp (date + time), symbol, alert_label (computed from indicator parameters), trigger_type ("upper" or "lower"), trigger message, and optionally observed price and cRSI value
- **FR-020**: The system MUST append each trigger event to the alert's history without overwriting previous entries
- **FR-021**: The system MUST display trigger history when a user expands an alert in the Alerts list
- **FR-022**: The system MUST maintain a global Log of all trigger events from all alerts
- **FR-023**: The global Log MUST display trigger events in reverse chronological order (newest first)
- **FR-024**: The Monitoring panel MUST include a Log tab that displays the global trigger log

**Alert Updates**

- **FR-025**: When a user edits an existing alert via the indicator context menu, the system MUST pre-populate the modal with the alert's current configuration
- **FR-026**: Saving changes to an edited alert MUST update the existing alert entry rather than creating a new one

### Key Entities

**Alert**
- Represents a single alert definition for an indicator
- Attributes: alert name, symbol, indicator type (cRSI), trigger conditions (upper band, lower band), messages for each trigger direction, status (active/muted), creation timestamp, last_triggered_at timestamp
- Relationships: has many TriggerEvents

**TriggerEvent**
- Represents a single occurrence of an alert condition being met
- Attributes: timestamp, symbol, alert_label (computed from Alert's indicator parameters), trigger_type ("upper" or "lower"), trigger message (direction-specific), observed price (optional), indicator value at trigger time (optional)
- Relationships: belongs to one Alert

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can create a cRSI alert in under 10 seconds from the indicator context menu (3 clicks: right-click, select option, click save)
- **SC-002**: Alert trigger detection completes within 1 second of new candle data arrival for the monitored symbol
- **SC-003**: 100% of band cross events are detected and logged when the alert is active (no missed triggers due to detection logic)
- **SC-004**: The Monitoring panel displays no alert creation UI (forms or buttons) - verified by UI inspection
- **SC-005**: All trigger events persist for the lifetime of an alert (historical data retained until alert deletion)
- **SC-006**: Users can successfully mute/unmute/delete alerts with a single action each
- **SC-007**: The global Log displays all triggers across all alerts in reverse chronological order
- **SC-008**: 95% of users can successfully create and manage cRSI alerts without referring to documentation (measured via user testing)

## Assumptions

1. The cRSI indicator is already implemented with upper and lower band calculations
2. The Monitoring panel already exists with an Alerts section
3. An AlertForm component currently exists for creating price alerts and will be removed as part of this feature
4. The frontend Alert model includes a history array that can store multiple trigger events
5. The backend persists triggers via AlertTrigger creation during evaluation
6. The context menu infrastructure already exists for indicator panes
7. Default trigger messages ("It's time to buy!" and "It's time to sell!") are acceptable for the initial release
8. The Log does not need pagination or pruning for the initial release (performance testing will determine if this is needed)
9. Optional fields (observed price, cRSI value at trigger time) will be included if available without significant complexity
10. Alert editing is considered in-scope (using the same modal as creation)
