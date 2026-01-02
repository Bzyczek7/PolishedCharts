# Tasks: Indicator-based Alerts (cRSI only)

**Input**: Design documents from `/specs/001-indicator-alerts/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Core alert engine logic (band cross detection, cooldown) SHOULD be test-driven per Constitution. Test tasks are included in Phase 7 as polish.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/` (Python FastAPI)
- **Frontend**: `frontend/src/` (React TypeScript)
- Paths below follow the web app structure from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes to support new alert features

- [X] T001 Create Alembic migration to add message fields to Alert model in backend/alembic/versions/
- [X] T002 Create Alembic migration to add trigger_message and trigger_type to AlertTrigger model in backend/alembic/versions/
- [X] T003 Run database migrations to apply schema changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Update Alert SQLAlchemy model in backend/app/models/alert.py to add message_upper, message_lower, enabled_conditions fields
- [X] T005 Update AlertTrigger SQLAlchemy model in backend/app/models/alert_trigger.py to add trigger_message and trigger_type fields
- [X] T006 Create helper function to generate alert_label from indicator params in backend/app/models/alert.py
- [X] T007 Update AlertCreate Pydantic schema in backend/app/schemas/indicator.py to include new message fields
- [X] T008 Update AlertResponse Pydantic schema in backend/app/schemas/indicator.py to include alert_label, message fields, enabled_conditions
- [X] T009 Update TriggerResponse Pydantic schema in backend/app/schemas/indicator.py to include alert_label, trigger_type fields
- [X] T010 Add computed alert_label property to Alert model in backend/app/models/alert.py
- [X] T011 Verify trigger_type is serialized in GET /api/v1/alerts/{id}/triggers and GET /api/v1/alerts/triggers/recent endpoints in backend/app/api/v1/alerts.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Create cRSI Alert from Indicator UI (Priority: P1) MVP

**Goal**: Enable users to create cRSI alerts directly from the indicator context menu with configurable conditions and messages

**Independent Test**: Right-click on cRSI indicator → "Add alert on cRSI(20)..." → Configure alert → Save → Alert appears in Monitoring panel's Alerts list

### Implementation for User Story 1

- [X] T012 [P] [US1] Extend IndicatorAction type to include 'alert' action in frontend/src/components/IndicatorContextMenu.tsx
- [X] T013 [P] [US1] Add 'alert' action to context menu items in frontend/src/components/IndicatorContextMenu.tsx
- [X] T014 [P] [US1] Create IndicatorAlertModal component with Settings, Message, Notifications tabs in frontend/src/components/IndicatorAlertModal.tsx
- [X] T015 [P] [US1] Create Settings tab UI with condition checkboxes (upper/lower) and cooldown input in frontend/src/components/IndicatorAlertModal.tsx
- [X] T016 [P] [US1] Create Message tab UI with message inputs for upper and lower triggers in frontend/src/components/IndicatorAlertModal.tsx
- [X] T017 [P] [US1] Create Notifications tab placeholder UI in frontend/src/components/IndicatorAlertModal.tsx
- [X] T018 [P] [US1] Add IndicatorAlertFormData type definition in frontend/src/types/indicators.ts
- [X] T019 [P] [US1] Add alert_label field to Alert type definition in frontend/src/types/indicators.ts
- [X] T020 [US1] Implement createAlert API client function in frontend/src/api/alerts.ts
- [X] T021 [US1] Implement listAlerts API client function in frontend/src/api/alerts.ts
- [X] T022 [US1] Wire alert modal Save button to createAlert API call in frontend/src/components/IndicatorAlertModal.tsx
- [X] T023 [US1] Refresh alerts list from backend after successful create in frontend/src/components/IndicatorAlertModal.tsx
- [X] T024 [US1] Add POST /api/v1/alerts/ endpoint handler in backend/app/api/v1/alerts.py to accept symbol, indicator_name, indicator_params, enabled_conditions, message_upper, message_lower, cooldown
- [X] T025 [US1] Add GET /api/v1/alerts/ endpoint handler with symbol filtering in backend/app/api/v1/alerts.py
- [X] T026 [US1] Add alert creation validation (at least one condition enabled, messages non-empty for enabled conditions) in backend/app/api/v1/alerts.py
- [X] T027 [US1] Store alert in database with computed label and return AlertResponse in backend/app/api/v1/alerts.py
- [X] T028 [US1] Update AlertsView to remove AlertForm component in frontend/src/components/AlertsView.tsx
- [X] T029 [US1] Ensure AlertsList displays newly created alerts in frontend/src/components/AlertsList.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - users can create cRSI alerts from indicator context menu

---

## Phase 4: User Story 2 - Alert Triggers with Different Messages (Priority: P1)

**Goal**: cRSI alerts trigger with direction-specific messages (buy for lower band cross, sell for upper band cross) stored with each trigger event

**Independent Test**: Create cRSI alert → Simulate band crosses → Verify trigger events created with correct messages in alert history and Log

### Implementation for User Story 2

- [X] T030 [P] [US2] Add trigger_type field to TriggerEvent type definition in frontend/src/types/indicators.ts
- [X] T031 [P] [US2] Add alert_label field to TriggerEvent type definition in frontend/src/types/indicators.ts
- [X] T032 [US2] Implement cRSI band cross detection logic using current + previous values in backend/app/services/alert_engine.py
- [X] T033 [US2] Create trigger events for both upper and lower crosses when conditions met in backend/app/services/alert_engine.py
- [X] T034 [US2] Store trigger_type ("upper" or "lower") with each AlertTrigger in backend/app/services/alert_engine.py
- [X] T035 [US2] Store trigger_message (direction-specific message) with each AlertTrigger in backend/app/services/alert_engine.py
- [X] T036 [US2] Implement alert cooldown logic (5-second minimum, applies to alert not per condition) in backend/app/services/alert_engine.py
- [X] T037 [US2] Handle multi-trigger edge case (both bands crossed) by creating separate AlertTrigger records in backend/app/services/alert_engine.py
- [X] T038 [US2] Update AlertsList to display trigger history with trigger_type and trigger_message in frontend/src/components/AlertsList.tsx
- [X] T039 [US2] Fetch and display trigger events when alert is expanded in frontend/src/components/AlertsList.tsx
- [X] T040 [US2] Store trigger events in frontend localStorage cache for offline viewing in frontend/src/hooks/useIndicatorData.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can create alerts and they trigger with correct messages

---

## Phase 5: User Story 3 - Manage Alerts in Monitoring Panel (Priority: P2)

**Goal**: Users can manage alerts (mute/unmute, delete, view history) from Monitoring panel which has NO alert creation UI

**Independent Test**: Create alert via US1 → Use Monitoring panel to mute/unmute/delete → Verify behavior

### Implementation for User Story 3

- [X] T041 [P] [US3] Add POST /api/v1/alerts/{alert_id}/mute endpoint in backend/app/api/v1/alerts.py to set alert.is_active = false
- [X] T042 [P] [US3] Add POST /api/v1/alerts/{alert_id}/unmute endpoint in backend/app/api/v1/alerts.py to set alert.is_active = true
- [X] T043 [P] [US3] Add PUT /api/v1/alerts/{alert_id} endpoint in backend/app/api/v1/alerts.py to update enabled_conditions, message_upper, message_lower, cooldown
- [X] T044 [P] [US3] Add DELETE /api/v1/alerts/{alert_id} endpoint in backend/app/api/v1/alerts.py to delete alert and cascade delete triggers
- [X] T045 [P] [US3] Add GET /api/v1/alerts/{alert_id}/triggers endpoint in backend/app/api/v1/alerts.py to return per-alert trigger history
- [X] T046 [P] [US3] Implement muteAlert API client function in frontend/src/api/alerts.ts
- [X] T047 [P] [US3] Implement unmuteAlert API client function in frontend/src/api/alerts.ts
- [X] T048 [P] [US3] Implement deleteAlert API client function in frontend/src/api/alerts.ts
- [X] T049 [P] [US3] Implement updateAlert API client function in frontend/src/api/alerts.ts
- [X] T050 [P] [US3] Implement getAlertTriggers API client function in frontend/src/api/alerts.ts
- [X] T051 [US3] Add mute/unmute buttons to alert items in AlertsList in frontend/src/components/AlertsList.tsx
- [X] T052 [US3] Add delete button/context menu to alert items in AlertsList in frontend/src/components/AlertsList.tsx
- [X] T053 [US3] Wire mute/unmute/delete buttons to API calls in frontend/src/components/AlertsList.tsx
- [X] T054 [US3] Prevent muted alerts from triggering in backend/app/services/alert_engine.py
- [X] T055 [US3] Verify AlertForm is NOT rendered in AlertsView in frontend/src/components/AlertsView.tsx
- [X] T056 [US3] Ensure no "Set Alert" button exists in Monitoring panel in frontend/src/components/AlertsView.tsx
- [X] T057 [US3] Add "Edit alert..." context menu action for existing alerts in frontend/src/components/IndicatorContextMenu.tsx
- [X] T058 [US3] Wire "Edit alert..." action to pre-populate modal with existing alert data in frontend/src/components/IndicatorAlertModal.tsx

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work - complete alert management lifecycle

---

## Phase 6: User Story 4 - View Global Trigger Log (Priority: P3)

**Goal**: Users can view all trigger events across all alerts in a global Log tab (newest first)

**Independent Test**: Create multiple alerts → Trigger them → Open Log tab → Verify all triggers shown chronologically

### Implementation for User Story 4

- [X] T059 [P] [US4] Add GET /api/v1/alerts/triggers/recent endpoint in backend/app/api/v1/alerts.py with symbol filter, limit, offset parameters
- [X] T060 [US4] Query AlertTrigger with alert join, order by triggered_at DESC, limit/offset pagination in backend/app/api/v1/alerts.py
- [X] T061 [US4] Support symbol: string filter parameter (not just symbol_id) for frontend simplicity in backend/app/api/v1/alerts.py
- [X] T062 [P] [US4] Implement getRecentTriggers API client function in frontend/src/api/alerts.ts
- [X] T063 [P] [US4] Create LogTab component with table/list view in frontend/src/components/LogTab.tsx
- [X] T064 [P] [US4] Display trigger events with columns: timestamp, symbol, alert_label, trigger_type, trigger_message, price, indicator_value in frontend/src/components/LogTab.tsx
- [X] T065 [US4] Wire LogTab to getRecentTriggers API with 500 entry limit in frontend/src/components/LogTab.tsx
- [X] T066 [US4] Add Log tab to Monitoring panel (tabs: Alerts List, Log) in frontend/src/components/AlertsView.tsx
- [X] T067 [US4] Implement auto-refresh or manual refresh for Log tab to show new triggers in frontend/src/components/LogTab.tsx
- [X] T068 [US4] Cache trigger events in localStorage for offline viewing in frontend/src/hooks/useIndicatorData.ts

**Checkpoint**: All user stories should now be independently functional - complete TradingView-style alert system

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T069 [P] Add error handling for "Backend unavailable" when creating alerts in frontend/src/components/IndicatorAlertModal.tsx
- [X] T070 [P] Add loading states for API calls in alert modal in frontend/src/components/IndicatorAlertModal.tsx
- [X] T071 [P] Add form validation (messages non-empty for enabled conditions, at least one condition enabled) in frontend/src/components/IndicatorAlertModal.tsx
- [X] T072 [P] Add success/error toast notifications for alert CRUD operations in frontend/src/components/IndicatorAlertModal.tsx
- [X] T073 [P] Add unit tests for cRSI band cross detection logic in backend/tests/services/test_alert_engine.py
- [X] T074 [P] Add unit tests for alert cooldown logic in backend/tests/services/test_alert_engine.py
- [X] T075 [P] Add integration test for multi-trigger edge case (both bands crossed) in backend/tests/integration/test_alert_integration.py
- [X] T076 [P] Add integration test for mute preventing triggers in backend/tests/integration/test_alert_integration.py
- [X] T077 Update quickstart.md with actual screenshots or detailed walkthrough once UI is implemented
- [X] T078 Add JSDoc comments to new API functions in frontend/src/api/alerts.ts
- [X] T079 Add docstrings to new API endpoints in backend/app/api/v1/alerts.py
- [X] T080 Verify quickstart.md scenarios work as documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - database migrations can run immediately
- **Foundational (Phase 2)**: Depends on Setup migrations - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both Priority P1 and can be done in parallel after Foundational
  - US3 (P2) can be done in parallel with US1/US2 or after
  - US4 (P3) can be done in parallel with US1-US3 or after
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Create alert from indicator UI - No dependencies on other stories
- **User Story 2 (P1)**: Alert triggers with messages - Integrates with US1 alerts, independently testable with mock alerts
- **User Story 3 (P2)**: Manage alerts in Monitoring - Integrates with US1 alerts, independently testable
- **User Story 4 (P3)**: Global trigger log - Integrates with US1-US3 trigger data, independently testable with mock triggers

### Within Each User Story

- Type definitions before components
- Backend API before frontend client functions
- Core implementation before validation/error handling
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 2**: T004, T005, T007, T008, T009, T010 (different files) can run in parallel
- **US1 Phase**: T012, T013, T014, T015, T016, T017, T018, T019 can run in parallel (different files)
- **US2 Phase**: T030, T031 can run in parallel
- **US3 Phase**: T041, T042, T043, T044, T045, T046, T047, T048, T049, T050 can run in parallel (different API endpoints)
- **US4 Phase**: T059, T062, T063, T064 can run in parallel
- **User Stories**: US1 and US2 can be developed in parallel by different developers (frontend for US1, backend for US2, then integrate)
- **Phase 7**: T069-T076 (tests and polish) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch frontend component development in parallel:
Task: "Extend IndicatorAction type in IndicatorContextMenu.tsx"
Task: "Create IndicatorAlertModal component in IndicatorAlertModal.tsx"

# Launch type definition updates in parallel:
Task: "Add IndicatorAlertFormData type in types/indicators.ts"
Task: "Add alert_label field to Alert type in types/indicators.ts"

# Launch API client functions in parallel:
Task: "Implement createAlert in api/alerts.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (database migrations)
2. Complete Phase 2: Foundational (model/schema updates)
3. Complete Phase 3: User Story 1 (Create alert from indicator UI)
4. Complete Phase 4: User Story 2 (Alert triggers with messages)
5. **STOP and VALIDATE**: Test US1 + US2 together as core MVP
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Database schema ready
2. Add User Story 1 → Users can create alerts from indicator UI
3. Add User Story 2 → Alerts trigger with correct messages
4. **MVP CHECKPOINT**: Core TradingView-style alert functionality complete
5. Add User Story 3 → Users can manage alerts (mute/unmute/delete)
6. Add User Story 4 → Users can view global trigger log
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (frontend indicator context menu + modal)
   - Developer B: User Story 2 (backend trigger detection logic)
3. After US1 + US2:
   - Developer A: User Story 4 (Log tab UI + endpoint)
   - Developer B: User Story 3 (management endpoints + UI)
4. Stories complete and integrate

---

## Summary

**Total Tasks**: 80
**Tasks per User Story**:
- User Story 1 (P1): 18 tasks
- User Story 2 (P1): 11 tasks
- User Story 3 (P2): 18 tasks
- User Story 4 (P3): 10 tasks
- Setup + Foundational + Polish: 23 tasks

**Parallel Opportunities Identified**: 40+ tasks marked [P] across all phases

**Independent Test Criteria per Story**:
- **US1**: Right-click cRSI → Create alert → Appears in Monitoring panel
- **US2**: Create alert → Simulate band crosses → Verify trigger messages in history
- **US3**: Create alert → Mute/unmute/delete from Monitoring → Verify behavior
- **US4**: Create multiple alerts → Trigger them → Log shows all chronologically

**Suggested MVP Scope**: User Stories 1 + 2 (Create alerts + Trigger detection) delivers core TradingView-style alert functionality

**Fastest Delivery**: Phase 1-2 + US1 + US2 + minimal US3 (mute/unmute only: T041, T042, T046, T047, T051, T053, T054) → Add US4 (Log) last

**Format Validation**: All tasks follow checklist format with checkbox, ID, labels, and file paths
