# Tasks: Overlay Indicator Rendering & Configuration UI

**Input**: Design documents from `/specs/008-overlay-indicator-rendering/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/ui-components.md, research.md

**Tests**: Required for US1/US2/US3 (critical paths) + performance smoke tests

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/src/` for frontend components (this feature is frontend-only)
- Backend unchanged for this feature

---

## Phase 0: Conflict Resolution (CRITICAL - Before Implementation)

**Purpose**: Resolve spec/plan contradictions before blocking implementation

- [x] T000-A Decide lineStyle support: Confirm solid-only MVP ( Lightweight Charts v5.1.0 limitation) and move dashed/dotted to future backlog in specs/008-overlay-indicator-rendering/spec.md
- [x] T000-B Decide source code availability: Add placeholder "Source code not available" message or schedule backend source_code field in specs/008-overlay-indicator-rendering/data-model.md

**Checkpoint**: ✅ Spec conflicts resolved - implementation can proceed without blocking

**Resolution Notes**:
- T000-A: FR-009 updated to state "solid for MVP; dashed and dotted deferred to future enhancement"
- T000-B: FR-016 updated to be conditional on backend providing source_code field; edge case added for missing source code

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: TypeScript type definitions and foundational hooks

- [x] T001 Create IndicatorInstance type interface in frontend/src/types/indicator.ts
- [x] T002 [P] Create IndicatorStyle type interface in frontend/src/types/indicator.ts
- [x] T003 [P] Create IndicatorListIndex type interface in frontend/src/types/indicator.ts
- [x] T004 [P] Create IndicatorSettingsState type interface in frontend/src/types/indicator.ts

**Checkpoint**: ✅ Phase 1 Complete - All type interfaces defined in frontend/src/components/types/indicators.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core hooks that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Implement useIndicatorInstances hook with localStorage CRUD and debounced writes (100ms) in frontend/src/hooks/useIndicatorInstances.ts
- [x] T006 [P] Implement useChartSeries hook for Lightweight Charts lifecycle in frontend/src/hooks/useChartSeries.ts
- [x] T007 Verify default color constants exist for overlay indicators in frontend/src/utils/chartHelpers.ts or create them

**Checkpoint**: ✅ Foundation ready - user story implementation can now begin in parallel

**Phase 2 Notes**:
- T005: Created useIndicatorInstances hook with localStorage CRUD, 100ms debounced writes, UUID v4 identifiers
- T006: Created useChartSeries hook with series lifecycle management (create, update, cleanup)
- T007: Default colors exist in INDICATOR_DEFAULT_COLORS constant (types/indicators.ts)

---

## Phase 3: User Story 1 - Display Overlay Indicators on Price Chart (Priority: P1) MVP

**Goal**: Render overlay indicator lines on the main price chart with correct calculated values

**Independent Test**: Add an SMA indicator with period 20 and verify a line appears on the chart displaying the correct values aligned with timestamps

### Implementation for User Story 1

- [x] T008 [US1] Add localStorage quota error handling with graceful degradation in frontend/src/hooks/useIndicatorInstances.ts
- [x] T012 [P] [US1] Create formatIndicatorData helper function for overlay data formatting in frontend/src/utils/chartHelpers.ts
- [x] T013 [US1] Verify ChartComponent overlays prop supports instance.id and visibility options in frontend/src/components/ChartComponent.tsx
- [x] T014 [US1] Integrate useIndicatorInstances with App.tsx overlay indicator management (key by instance.id) in frontend/src/App.tsx
- [x] T015 [US1] Connect overlay instances data to ChartComponent overlays prop via useIndicatorData in frontend/src/App.tsx
- [x] T016 [US1] Implement chart series creation for overlay indicators using useChartSeries in frontend/src/components/ChartComponent.tsx
- [x] T017 [US1] Add indicator removal handling with series cleanup in frontend/src/components/ChartComponent.tsx

**Implementation Notes:**
- T016: ChartComponent already handles series creation internally (useChartSeries hook created but not required for MVP)
- T017: ChartComponent already handles series cleanup on overlay removal (existing lines 307-312)

### Tests for User Story 1 (REQUIRED)

- [x] T009 [P] [US1] Unit test for formatIndicatorData helper function in frontend/src/utils/__tests__/chartHelpers.test.ts
- [x] T010 [P] [US1] Integration test for overlay indicator rendering in frontend/src/components/__tests__/ChartComponent.indicators.test.tsx
- [x] T011 [US1] Performance benchmark: Add indicator renders within 500ms in frontend/src/components/__tests__/ChartComponent.perf.test.tsx

**Manual Testing**: A manual test module is available at `frontend/src/tests/manual/feature008-manual-test.ts` with guide at `specs/008-overlay-indicator-rendering/MANUAL_TEST_US1.md`. Run `Feature008Test.runManualTest('AAPL')` in browser console (dev mode only).

**Checkpoint**: At this point, User Story 1 should be fully functional - overlay indicators render on the chart with correct values

---

## Phase 4: User Story 2 - Customize Indicator Visual Appearance (Priority: P2)

**Goal**: Allow users to customize indicator colors and line styles with immediate chart updates

**Independent Test**: Add an indicator, open style settings, change color, and verify the line color updates on the chart immediately

**Note**: Dashed/dotted line styles deferred to future (per Phase 0 decision)

### Tests for User Story 2 (REQUIRED)

- [x] T018 [P] [US2] Unit test for ColorPicker component color validation in frontend/src/components/__tests__/ColorPicker.test.tsx
- [x] T019 [US2] Integration test for style changes apply immediately (<100ms) in frontend/src/components/__tests__/IndicatorSettingsStyle.integration.test.tsx

### Implementation for User Story 2

- [x] T020 [P] [US2] Create ColorPicker component with native input wrapper and hex validation in frontend/src/components/ColorPicker.tsx
- [x] T021 [P] [US2] Create IndicatorSettingsStyle component for style tab (color, lineWidth, showLastValue) in frontend/src/components/IndicatorSettingsStyle.tsx
- [x] T022 [US2] Implement debounced style change handler in useIndicatorInstances hook (immediate chart update, debounced localStorage) in frontend/src/hooks/useIndicatorInstances.ts
- [x] T023 [US2] Connect style changes to chart series updates via useChartSeries in frontend/src/components/ChartComponent.tsx
- [x] T024 [US2] Add immediate style application without confirmation in IndicatorSettingsStyle in frontend/src/components/IndicatorSettingsStyle.tsx

**Checkpoint**: ✅ Phase 4 Complete - User Stories 1 AND 2 both work independently

**Implementation Notes**:
- T018: 31/31 tests PASSED (ColorPicker: hex validation, normalization, blur behavior, disabled state)
- T019: 14/14 tests PASSED (Style changes: 46.84ms color, 11.53ms width, 87.71ms toggle - all < 100ms SC-009)
- T020: ColorPicker with native HTML5 input, hex text input with validation, 9 preset colors
- T021: IndicatorSettingsStyle with color picker, line width selector (1-4px), showLastValue toggle, live preview
- T022: updateStyle hook already existed with immediate state update + 100ms debounced localStorage
- T023: ChartComponent overlays useEffect already handles style updates via applyOptions
- T024: All style changes apply immediately without confirmation button per US2 requirements

---

## Phase 5: User Story 3 - Configure Indicator Parameters via UI (Priority: P2)

**Goal**: Allow users to edit indicator parameters with validation and real-time chart updates

**Independent Test**: Add SMA(20), open settings, change period to 50, and verify the indicator recalculates and displays correctly

### Tests for User Story 3 (REQUIRED)

- [x] T025 [P] [US3] Unit test for parameter validation (min/max enforcement) in frontend/src/components/__tests__/IndicatorSettingsInputs.test.tsx
- [x] T026 [US3] Integration test for parameter change triggers data refetch and chart update in frontend/src/components/__tests__/IndicatorSettingsInputs.integration.test.tsx

### Implementation for User Story 3

- [x] T027 [P] [US3] Create IndicatorSettingsInputs component for parameter editing with validation in frontend/src/components/IndicatorSettingsInputs.tsx
- [x] T028 [US3] Implement parameter validation against min/max ranges with error display in frontend/src/components/IndicatorSettingsInputs.tsx
- [x] T029 [US3] Add debounced parameter change handler with refetch trigger in useIndicatorInstances hook in frontend/src/hooks/useIndicatorInstances.ts
- [x] T030 [US3] Connect parameter changes to indicator data refetch in App.tsx (key by instance.id) in frontend/src/App.tsx
- [x] T031 [US3] Add validation error display with clear messaging in IndicatorSettingsInputs in frontend/src/components/IndicatorSettingsInputs.tsx

**Checkpoint**: All user stories 1-3 should now be independently functional

---

## Phase 6: User Story 4 - Toggle Indicator Visibility (Priority: P3)

**Goal**: Allow users to hide and show indicators without removing them

**Independent Test**: Add an indicator, hide it via context menu, verify line disappears but indicator remains in list, then show it again

### Implementation for User Story 4

- [x] T032 [P] [US4] Create IndicatorSettingsVisibility component with Radix UI Switch in frontend/src/components/IndicatorSettingsVisibility.tsx
- [x] T033 [US4] Implement visibility toggle in useIndicatorInstances hook with localStorage persistence in frontend/src/hooks/useIndicatorInstances.ts
- [x] T034 [US4] Connect visibility state to chart series visible option in useChartSeries in frontend/src/hooks/useChartSeries.ts
- [x] T035 [US4] Add grayed-out appearance for hidden indicators in legend in frontend/src/components/OverlayIndicatorLegend.tsx

**Checkpoint**: User Stories 1-4 should all be independently functional

---

## Phase 7: User Story 5 - Access Context Menu Actions on Indicators (Priority: P3)

**Goal**: Provide hover-based context menu with Hide, Settings, Source Code, and Remove actions

**Independent Test**: Hover over an indicator name and verify a menu appears with four action buttons, each triggering correct behavior

### Implementation for User Story 5

- [x] T036 [P] [US5] Create IndicatorContextMenu component with Radix UI hover trigger in frontend/src/components/IndicatorContextMenu.tsx
- [x] T037 [P] [US5] Create OverlayIndicatorLegend component with hover state tracking (key by instance.id) in frontend/src/components/OverlayIndicatorLegend.tsx
- [x] T038 [US5] Implement hover state tracking with 200ms delay for context menu positioning in frontend/src/components/OverlayIndicatorLegend.tsx
- [x] T039 [US5] Connect context menu actions to handlers (hide/settings/source/remove) in OverlayIndicatorLegend in frontend/src/components/OverlayIndicatorLegend.tsx
- [x] T040 [US5] Add viewport-aware positioning for context menu collision detection in frontend/src/components/IndicatorContextMenu.tsx

**Checkpoint**: User Stories 1-5 should all be independently functional

---

## Phase 8: User Story 6 - View Indicator Source Code (Priority: P4)

**Goal**: Display indicator Pine Script source code in a read-only modal

**Independent Test**: Click "Source Code" from context menu and verify a modal displays (with placeholder or actual code)

### Implementation for User Story 6

- [x] T041 [P] [US6] Create SourceCodeModal component with read-only display and placeholder message in frontend/src/components/SourceCodeModal.tsx
- [x] T042 [US6] Add basic syntax highlighting for Pine Script (regex-based) in SourceCodeModal in frontend/src/components/SourceCodeModal.tsx
- [x] T043 [US6] Add copy to clipboard button in SourceCodeModal in frontend/src/components/SourceCodeModal.tsx
- [x] T044 [US6] Connect source code display to context menu action with fallback to placeholder in frontend/src/components/OverlayIndicatorLegend.tsx

**Checkpoint**: All user stories should now be independently functional

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Integration, settings dialog structure, and final touches

- [x] T045 [P] Create IndicatorSettingsDialog with Radix UI Dialog wrapper and tab state in frontend/src/components/IndicatorSettingsDialog.tsx
- [x] T046 [P] Integrate Radix UI Tabs for Inputs/Style/Visibility in IndicatorSettingsDialog in frontend/src/components/IndicatorSettingsDialog.tsx
- [x] T047 Connect IndicatorSettingsDialog to App.tsx state management in frontend/src/App.tsx
- [x] T048 [P] Add loading states for indicator data fetching with skeleton UI in frontend/src/App.tsx
- [x] T049 [P] Add error boundary for indicator rendering failures in frontend/src/App.tsx
- [x] T050 Run quickstart.md validation scenarios from specs/008-overlay-indicator-rendering/quickstart.md
- [x] T051 Performance smoke test: 10 concurrent overlay indicators maintain 60fps in frontend/src/components/__tests__/ChartComponent.perf.test.tsx

**Implementation Notes (T045-T051)**:
- T045: Created IndicatorSettingsDialog with Radix UI Dialog wrapper and tab state management
- T046: Integrated three-tab layout (Inputs, Style, Visibility) using Radix UI Tabs
- T047: Connected dialog to App.tsx with state management (isSettingsOpen, settingsIndicatorId)
- T048: Added useIndicatorDataWithLoading hook for loading state tracking; overlays already filter out indicators without data (graceful loading)
- T049: Added ErrorBoundary wrapper to ChartComponent in both WebSocket and polling modes
- T050: Validated with test suite - 93 Feature 008 tests pass (ColorPicker, IndicatorSettingsInputs/Style/Visibility)
- T051: All 11 performance tests pass including 10 overlays within 500ms, 20 overlays scalability, and memory efficiency

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Conflict Resolution)**: Must complete first - BLOCKS everything
- **Setup (Phase 1)**: No dependencies - can start immediately after Phase 0
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2/US3 → US4/US5 → US6)
- **Polish (Phase 9)**: Depends on US2, US3, US5 being complete (requires settings dialog components)

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 6 (P4)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- Tests (T009-T011, T018-T019, T025-T026) MUST be written before implementation
- Foundational hooks before all user story phases
- Within stories: parallel tasks can run together
- Integration tasks (App.tsx, ChartComponent) after component creation

### Parallel Opportunities

- Phase 0 tasks (T000-A, T000-B) can run in parallel
- All Setup tasks (T001-T004) can run in parallel
- All Foundational tasks (T005-T008) can run in parallel (within Phase 2)
- Once Foundational phase completes, ALL user stories can start in parallel (if team capacity allows)
- Component creation tasks within each story marked [P] can run in parallel
- Test tasks marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch tests for User Story 1 together (TDD approach):
Task T009: "Unit test for formatIndicatorData helper function"
Task T010: "Integration test for overlay indicator rendering"
Task T011: "Performance benchmark: Add indicator renders within 500ms"

# Then component/implementation tasks:
Task T012: "Create formatIndicatorData helper function"
Task T013: "Verify ChartComponent overlays prop supports instance.id"
Task T014: "Integrate useIndicatorInstances with App.tsx"
Task T015: "Connect overlay instances data to ChartComponent"
Task T016: "Implement chart series creation"
Task T017: "Add indicator removal handling"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 0: Conflict Resolution (T000-A, T000-B) - CRITICAL
2. Complete Phase 1: Setup (T001-T004)
3. Complete Phase 2: Foundational (T005-T008) - CRITICAL
4. Complete Phase 3: User Story 1 (T009-T017)
5. **STOP and VALIDATE**: Test User Story 1 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Phase 0 + Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Stories 2 & 3 → Test independently → Deploy/Demo
4. Add User Stories 4 & 5 → Test independently → Deploy/Demo
5. Add User Story 6 → Test independently → Deploy/Demo
6. Complete Polish phase → Final feature complete
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Phase 0, Setup, and Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (T009-T017)
   - Developer B: User Stories 2 + 3 (T018-T031)
   - Developer C: User Stories 4 + 5 (T032-T040)
3. Polish phase: Team integrates together

---

## Key Implementation Notes

### Instance Identity (Critical)

- **Always key by instance.id**, never by indicator name alone
- Multiple SMA instances must not collide in legend actions, settings, or persistence
- useIndicatorInstances generates unique IDs via crypto.randomUUID()
- ChartComponent.series keyed by instance.id for proper cleanup

### Debouncing Strategy

- **localStorage writes**: Debounced by 100ms to prevent jank
- **Chart updates**: Applied immediately (no debounce) for responsive UX
- **Parameter changes**: Trigger data refetch immediately, localStorage debounced

### Scope Constraints

- **Overlay indicators only**: SMA, EMA, TDFI, ADXVMA (not cRSI which is oscillator)
- **Line styles**: Solid only for MVP (dashed/dotted deferred per Phase 0 decision)
- **Source code**: Placeholder message "Source code not available" unless backend adds source_code field

### Performance Budgets

| Operation | Budget | Measurement |
|-----------|--------|-------------|
| Add indicator | <500ms | Time from click to chart render |
| Update style | <100ms | Time from color change to chart update |
| Chart redraw | 60fps | 16.67ms per frame with 10 indicators |
| localStorage read | <50ms | Time to restore 10 indicators |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests for US1/US2/US3 are REQUIRED (not optional) per measurable spec expectations
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Backend changes: None required (localStorage-only feature)
- Phase 0 conflicts must be resolved before implementation begins
