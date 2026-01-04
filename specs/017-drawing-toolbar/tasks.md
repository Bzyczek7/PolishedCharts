# Tasks: Drawing Toolbar Enhancement

**Input**: Design documents from `/specs/017-drawing-toolbar/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: The spec requires TDD for core logic (hit detection, coordinate mapping, state transitions). Test tasks are included for drawing logic.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `frontend/src/`
- **Frontend Tests**: `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create directory structure for drawing tools in frontend/src/components/drawings/tools/
- [ ] T002 Create directory structure for renderers in frontend/src/components/drawings/renderers/
- [ ] T003 Create directory structure for utilities in frontend/src/utils/drawings/
- [ ] T004 [P] Copy contract types to frontend/src/types/drawings.ts from contracts/types.ts
- [ ] T005 [P] Copy DrawingTool interface to frontend/src/contracts/DrawingTool.ts from contracts/DrawingTool.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Implement ChartApi coordinate transformation in frontend/src/utils/coordinateUtils.ts
- [ ] T007 [P] Implement pointToLineDistance function in frontend/src/utils/drawingUtils.ts
- [ ] T008 [P] Implement pointInRectangle function in frontend/src/utils/drawingUtils.ts
- [ ] T009 [P] Implement distance function for point-to-point measurement in frontend/src/utils/drawingUtils.ts
- [ ] T010 Create drawing tool config registry in frontend/src/constants/drawingTools.ts
- [ ] T011 Create tool constants for all 29 tools + 3 actions in frontend/src/constants/drawingTools.ts
- [ ] T012 Implement flyout menu configs in frontend/src/constants/flyoutMenus.ts
- [ ] T013 Expand ToolId type in frontend/src/types/drawings.ts to include all 29 tools
- [ ] T014 Expand Drawing type in frontend/src/types/drawings.ts with new fields (locked, hidden, extension)
- [ ] T015 Expand DrawingStateContext in frontend/src/contexts/DrawingStateContext.tsx with new state
- [ ] T016 Add tool selection persistence to localStorage in frontend/src/contexts/DrawingStateContext.tsx
- [ ] T017 Create base ToolButton component in frontend/src/components/toolbar/ToolButton.tsx
- [ ] T018 Create base FlyoutMenu component using Radix UI in frontend/src/components/toolbar/FlyoutMenu.tsx
- [ ] T019 Create ToolSeparator component in frontend/src/components/toolbar/ToolSeparator.tsx
- [ ] T020a [US1] Add 44x44px touch target sizing for mobile in frontend/src/components/toolbar/ToolButton.tsx
- [ ] T020b [P] Add accessibility - keyboard navigation through toolbar buttons in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T020c [P] Add accessibility - Tab navigation support in frontend/src/components/toolbar/FlyoutMenu.tsx
- [ ] T020d [P] Add accessibility - ARIA labels for all buttons in frontend/src/components/toolbar/ToolButton.tsx
- [ ] T020 Create DrawingsOverlay SVG container in frontend/src/components/drawings/DrawingsOverlay.tsx
- [ ] T021 Update DrawingStorage in frontend/src/components/drawings/DrawingStorage.tsx for new schema
- [ ] T022 [P] Write unit test for coordinate transforms in frontend/tests/unit/utils/coordinateUtils.test.ts
- [ ] T023 [P] Write unit test for pointToLineDistance in frontend/tests/unit/utils/drawingUtils.test.ts
- [ ] T024 [P] Write unit test for pointInRectangle in frontend/tests/unit/utils/drawingUtils.test.ts
- [ ] T024a [P] Verify symbol-based drawing isolation in frontend/tests/integration/symbol-isolation.test.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Core Drawing Tools (Priority: P1) 🎯 MVP

**Goal**: Enable traders to quickly access essential drawing tools (Cursor, Trend Line, Horizontal Line, Crosshair, Lines flyout with 7 tools) to annotate trendlines and support/resistance levels.

**Independent Test**: Can be fully tested by opening the chart, clicking each drawing tool button, verifying the active state changes, confirming tooltips appear on hover, and verifying tool state persists after component remount.

### Tests for User Story 1 (TDD for Core Drawing Logic)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T025 [P] [US1] Write hit detection test for trendline in frontend/tests/unit/utils/drawings/hitTest/trendline.test.ts
- [ ] T026 [P] [US1] Write hit detection test for horizontal line in frontend/tests/unit/utils/drawings/hitTest/horizontalLine.test.ts
- [ ] T027 [P] [US1] Write hit detection test for vertical line in frontend/tests/unit/utils/drawings/hitTest/verticalLine.test.ts
- [ ] T028 [P] [US1] Write hit detection test for ray in frontend/tests/unit/utils/drawings/hitTest/ray.test.ts
- [ ] T029 [US1] Write integration test for tool selection workflow in frontend/tests/integration/tool-selection.test.tsx

### Implementation for User Story 1

- [ ] T030 [P] [US1] Create TrendlineTool renderer in frontend/src/components/drawings/renderers/TrendlineRenderer.tsx
- [ ] T031 [P] [US1] Create HorizontalLineTool renderer in frontend/src/components/drawings/renderers/HorizontalLineRenderer.tsx
- [ ] T032 [P] [US1] Create VerticalLineTool renderer in frontend/src/components/drawings/renderers/VerticalLineRenderer.tsx
- [ ] T033 [P] [US1] Create Ray renderer in frontend/src/components/drawings/renderers/RayRenderer.tsx
- [ ] T034 [P] [US1] Create InfoLine renderer in frontend/src/components/drawings/renderers/InfoLineRenderer.tsx
- [ ] T035 [P] [US1] Create ExtendedLine renderer in frontend/src/components/drawings/renderers/ExtendedLineRenderer.tsx
- [ ] T036 [P] [US1] Create TrendAngle renderer in frontend/src/components/drawings/renderers/TrendAngleRenderer.tsx
- [ ] T037 [P] [US1] Create HorizontalRay renderer in frontend/src/components/drawings/renderers/HorizontalRayRenderer.tsx
- [ ] T038 [P] [US1] Create CrossLine renderer in frontend/src/components/drawings/renderers/CrossLineRenderer.tsx
- [ ] T039 [P] [US1] Create Crosshair renderer in frontend/src/components/drawings/renderers/CrosshairRenderer.tsx
- [ ] T040 [P] [US1] Implement TrendlineTool in frontend/src/components/drawings/tools/TrendlineTool.tsx
- [ ] T041 [P] [US1] Implement HorizontalLineTool in frontend/src/components/drawings/tools/HorizontalLineTool.tsx
- [ ] T042 [P] [US1] Implement VerticalLineTool in frontend/src/components/drawings/tools/VerticalLineTool.tsx
- [ ] T043 [P] [US1] Implement RayTool in frontend/src/components/drawings/tools/RayTool.tsx
- [ ] T044 [P] [US1] Implement InfoLineTool in frontend/src/components/drawings/tools/InfoLineTool.tsx
- [ ] T045 [P] [US1] Implement ExtendedLineTool in frontend/src/components/drawings/tools/ExtendedLineTool.tsx
- [ ] T046 [P] [US1] Implement TrendAngleTool in frontend/src/components/drawings/tools/TrendAngleTool.tsx
- [ ] T047 [P] [US1] Implement HorizontalRayTool in frontend/src/components/drawings/tools/HorizontalRayTool.tsx
- [ ] T048 [P] [US1] Implement CrossLineTool in frontend/src/components/drawings/tools/CrossLineTool.tsx
- [ ] T049 [P] [US1] Implement CrosshairTool in frontend/src/components/drawings/tools/CrosshairTool.tsx
- [ ] T050 [P] [US1] Implement hit test functions for line tools in frontend/src/utils/drawings/hitTest/lines.ts
- [ ] T051 [US1] Create tool registry index in frontend/src/components/drawings/tools/index.ts
- [ ] T052 [US1] Register all line tools in frontend/src/components/drawings/tools/index.ts
- [ ] T053 [US1] Update DrawingToolbar with Group 1 tools (Cursor, Trend Line, Horizontal Line, Crosshair, Lines flyout) in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T054 [US1] Configure Lines flyout menu in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T055 [US1] Add keyboard shortcuts (Alt+T, Alt+H, Alt+V, Alt+C, Alt+J) in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T056 [US1] Add tooltips to all tool buttons in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T057 [US1] Implement active/hover states with 3:1 contrast ratio in frontend/src/components/toolbar/ToolButton.tsx
- [ ] T058 [US1] Implement flyout open/close behavior in frontend/src/components/toolbar/FlyoutMenu.tsx
- [ ] T058a [US1] Implement keyboard shortcut display in flyout menu items (Alt+T, Alt+H, Alt+V, Alt+C, Alt+J) in frontend/src/components/toolbar/FlyoutMenu.tsx
- [ ] T059 [US1] Integrate toolbar with ChartComponent in frontend/src/components/chart/ChartComponent.tsx
- [ ] T061a [US1] Generate parity report for toolbar layout (JSON with button positions, spacing, color values, fixture ID) in frontend/tests/visual/toolbar-parity.test.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Users can select core drawing tools, draw on chart, and tool state persists.

---

## Phase 4: User Story 2 - Shape and Annotation Tools (Priority: P2)

**Goal**: Enable traders to add rectangles, text annotations, and measurements to charts to highlight key price patterns and communicate trading ideas.

**Independent Test**: Can be fully tested by selecting Rectangle or Text tool, drawing on the chart, and verifying the shape/text appears correctly. Can also test drawing selection and deletion.

### Tests for User Story 2 (TDD for Annotation Logic)

- [ ] T062 [P] [US2] Write hit detection test for rectangle in frontend/tests/unit/utils/drawings/hitTest/rectangle.test.ts
- [ ] T063 [P] [US2] Write hit detection test for text in frontend/tests/unit/utils/drawings/hitTest/text.test.ts
- [ ] T064 [P] [US2] Write hit detection test for brush in frontend/tests/unit/utils/drawings/hitTest/brush.test.ts
- [ ] T065 [US2] Write integration test for drawing selection and deletion in frontend/tests/integration/drawing-selection.test.tsx

### Implementation for User Story 2

- [ ] T066 [P] [US2] Create Rectangle renderer in frontend/src/components/drawings/renderers/RectangleRenderer.tsx
- [ ] T067 [P] [US2] Create Text renderer in frontend/src/components/drawings/renderers/TextRenderer.tsx
- [ ] T068 [P] [US2] Create Brush renderer in frontend/src/components/drawings/renderers/BrushRenderer.tsx
- [ ] T069 [P] [US2] Create Measurement renderer in frontend/src/components/drawings/renderers/MeasurementRenderer.tsx
- [ ] T070 [P] [US2] Implement RectangleTool in frontend/src/components/drawings/tools/RectangleTool.tsx
- [ ] T071 [P] [US2] Implement TextTool in frontend/src/components/drawings/tools/TextTool.tsx
- [ ] T072 [P] [US2] Implement BrushTool in frontend/src/components/drawings/tools/BrushTool.tsx
- [ ] T073 [P] [US2] Implement MeasurementTool in frontend/src/components/drawings/tools/MeasurementTool.tsx
- [ ] T074 [P] [US2] Implement hit test for rectangle in frontend/src/utils/drawings/hitTest/rectangle.ts
- [ ] T075 [P] [US2] Implement hit test for text in frontend/src/utils/drawings/hitTest/text.ts
- [ ] T076 [P] [US2] Implement hit test for brush in frontend/src/utils/drawings/hitTest/brush.ts
- [ ] T077 [P] [US2] Implement Douglas-Peucker simplification for brush points in frontend/src/utils/drawings/brushUtils.ts
- [ ] T078 [US2] Register annotation tools in frontend/src/components/drawings/tools/index.ts
- [ ] T079 [US2] Update DrawingToolbar with Group 2 tools (Brush, Text, Rectangle, Measurement) in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T080 [US2] Implement drawing selection state in frontend/src/contexts/DrawingStateContext.tsx
- [ ] T081 [US2] Implement drawing deletion (Delete key, Trash button) in frontend/src/contexts/DrawingStateContext.tsx
- [ ] T082 [US2] Add drag handles for selected drawings in frontend/src/components/drawings/DrawingsOverlay.tsx
- [ ] T083 [US2] Implement handle dragging logic in frontend/src/components/drawings/DrawingsOverlay.tsx
- [ ] T084 [US2] Create DrawingContextMenu in frontend/src/components/drawings/DrawingContextMenu.tsx
- [ ] T085 [US2] Integrate annotation tools with ChartComponent in frontend/src/components/chart/ChartComponent.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Users can annotate charts with shapes, text, and measurements.

---

## Phase 5: User Story 3 - Advanced Drawing Tools with Flyouts (Priority: P3)

**Goal**: Enable power users to access specialized drawing variations (Channels, Pitchforks, Projections) for Elliott Wave analysis and Fibonacci retracements.

**Independent Test**: Can be fully tested by long-pressing or clicking on flyout-enabled buttons, verifying the sub-menu appears, and selecting alternate tool options.

### Tests for User Story 3 (TDD for Advanced Drawing Logic)

- [ ] T086 [P] [US3] Write test for parallel channel calculation in frontend/tests/unit/utils/geometry/parallelChannel.test.ts
- [ ] T087 [P] [US3] Write test for pitchfork calculation in frontend/tests/unit/utils/geometry/pitchfork.test.ts
- [ ] T088 [P] [US3] Write test for Schiff pitchfork calculation in frontend/tests/unit/utils/geometry/schiffPitchfork.test.ts
- [ ] T089 [P] [US3] Write test for Fib retracement calculation in frontend/tests/unit/utils/fib/fibRetracement.test.ts
- [ ] T090 [P] [US3] Write test for Fib extension calculation in frontend/tests/unit/utils/fib/fibExtension.test.ts
- [ ] T091 [US3] Write integration test for flyout menu workflow in frontend/tests/integration/flyout-workflow.test.tsx

### Implementation for User Story 3

- [ ] T092 [P] [US3] Create FibRetracement renderer in frontend/src/components/drawings/renderers/FibRetracementRenderer.tsx
- [ ] T093 [P] [US3] Create FibExtension renderer in frontend/src/components/drawings/renderers/FibExtensionRenderer.tsx
- [ ] T094 [P] [US3] Create TrendBasedFibExtension renderer in frontend/src/components/drawings/renderers/TrendBasedFibExtensionRenderer.tsx
- [ ] T095 [P] [US3] Create ParallelChannel renderer in frontend/src/components/drawings/renderers/ParallelChannelRenderer.tsx
- [ ] T096 [P] [US3] Create RegressionTrend renderer in frontend/src/components/drawings/renderers/RegressionTrendRenderer.tsx
- [ ] T097 [P] [US3] Create FlatTopBottom renderer in frontend/src/components/drawings/renderers/FlatTopBottomRenderer.tsx
- [ ] T098 [P] [US3] Create DisjointChannel renderer in frontend/src/components/drawings/renderers/DisjointChannelRenderer.tsx
- [ ] T099 [P] [US3] Create Pitchfork renderer in frontend/src/components/drawings/renderers/PitchforkRenderer.tsx
- [ ] T100 [P] [US3] Create SchiffPitchfork renderer in frontend/src/components/drawings/renderers/SchiffPitchforkRenderer.tsx
- [ ] T101 [P] [US3] Create ModifiedSchiffPitchfork renderer in frontend/src/components/drawings/renderers/ModifiedSchiffPitchforkRenderer.tsx
- [ ] T102 [P] [US3] Create InsidePitchfork renderer in frontend/src/components/drawings/renderers/InsidePitchforkRenderer.tsx
- [ ] T103 [P] [US3] Implement FibRetracementTool in frontend/src/components/drawings/tools/FibRetracementTool.tsx
- [ ] T104 [P] [US3] Implement FibExtensionTool in frontend/src/components/drawings/tools/FibExtensionTool.tsx
- [ ] T105 [P] [US3] Implement TrendBasedFibExtensionTool in frontend/src/components/drawings/tools/TrendBasedFibExtensionTool.tsx
- [ ] T106 [P] [US3] Implement ParallelChannelTool in frontend/src/components/drawings/tools/ParallelChannelTool.tsx
- [ ] T107 [P] [US3] Implement RegressionTrendTool in frontend/src/components/drawings/tools/RegressionTrendTool.tsx
- [ ] T108 [P] [US3] Implement FlatTopBottomTool in frontend/src/components/drawings/tools/FlatTopBottomTool.tsx
- [ ] T109 [P] [US3] Implement DisjointChannelTool in frontend/src/components/drawings/tools/DisjointChannelTool.tsx
- [ ] T110 [P] [US3] Implement PitchforkTool in frontend/src/components/drawings/tools/PitchforkTool.tsx
- [ ] T111 [P] [US3] Implement SchiffPitchforkTool in frontend/src/components/drawings/tools/SchiffPitchforkTool.tsx
- [ ] T112 [P] [US3] Implement ModifiedSchiffPitchforkTool in frontend/src/components/drawings/tools/ModifiedSchiffPitchforkTool.tsx
- [ ] T113 [P] [US3] Implement InsidePitchforkTool in frontend/src/components/drawings/tools/InsidePitchforkTool.tsx
- [ ] T114 [P] [US3] Implement Fib level calculation utilities in frontend/src/utils/drawings/fibUtils.ts
- [ ] T115 [P] [US3] Implement channel geometry utilities in frontend/src/utils/drawings/geometryUtils.ts
- [ ] T116 [P] [US3] Implement pitchfork geometry utilities in frontend/src/utils/drawings/geometryUtils.ts
- [ ] T117 [P] [US3] Implement hit test functions for channels in frontend/src/utils/drawings/hitTest/channels.ts
- [ ] T118 [P] [US3] Implement hit test functions for pitchforks in frontend/src/utils/drawings/hitTest/pitchforks.ts
- [ ] T119 [P] [US3] Implement hit test functions for Fib tools in frontend/src/utils/drawings/hitTest/fib.ts
- [ ] T120 [US3] Register all advanced tools in frontend/src/components/drawings/tools/index.ts
- [ ] T121 [US3] Update DrawingToolbar with Group 3 tools and all flyouts (Channels, Pitchforks, Projections) in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T122 [US3] Configure Channels flyout menu in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T123 [US3] Configure Pitchforks flyout menu in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T124 [US3] Configure Projections flyout menu in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T125 [US3] Add flyout chevron indicators to buttons in frontend/src/components/toolbar/ToolButton.tsx
- [ ] T126 [US3] Implement flyout icon update on selection in frontend/src/components/toolbar/FlyoutMenu.tsx
- [ ] T127 [US3] Add long-press support for flyouts (500ms threshold) in frontend/src/components/toolbar/FlyoutMenu.tsx
- [ ] T128 [US3] Integrate advanced tools with ChartComponent in frontend/src/components/chart/ChartComponent.tsx

**Checkpoint**: All user stories should now be independently functional. All 29 drawing tools + 3 actions are available.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T129 [P] Add performance optimization - React.memo for drawing renderers in frontend/src/components/drawings/renderers/
- [ ] T130 [P] Add performance optimization - viewport culling in frontend/src/components/drawings/DrawingsOverlay.tsx
- [ ] T131 [P] Add performance optimization - CSS transforms for position updates in frontend/src/components/drawings/renderers/
- [ ] T132 Write performance test for 100+ drawings in frontend/tests/performance/drawing-performance.test.tsx
- [ ] T136 [P] Add Lock/Unlock all drawings button in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T137 [P] Add Show/Hide all drawings button in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T138 [P] Add Delete all drawings button in frontend/src/components/toolbar/DrawingToolbar.tsx
- [ ] T139 Implement lock functionality in frontend/src/contexts/DrawingStateContext.tsx
- [ ] T140 Implement show/hide functionality in frontend/src/contexts/DrawingStateContext.tsx
- [ ] T141 Implement delete all functionality in frontend/src/contexts/DrawingStateContext.tsx
- [ ] T142 Add visual regression tests for toolbar layout in frontend/tests/visual/toolbar-layout.test.tsx
- [ ] T143 Add contrast ratio verification tests in frontend/tests/visual/contrast.test.tsx
- [ ] T144 Test zoom at 200% in frontend/tests/visual/zoom.test.tsx
- [ ] T145 Verify all 29 tools are accessible via flyouts in frontend/tests/integration/flyout-accessibility.test.tsx
- [ ] T146 Verify tool state persists after component remount in frontend/tests/integration/state-persistence.test.tsx
- [ ] T147 Verify localStorage quota graceful degradation in frontend/tests/integration/localstorage-quota.test.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends drawing selection from US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Extends flyout system from US1 but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD approach)
- Renderers can be created in parallel (marked [P])
- Tool implementations can be created in parallel (marked [P])
- Hit test functions can be created in parallel (marked [P])
- Tool registration and toolbar integration depend on renderers and tools being complete
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 2 (Foundational)**:
- T007, T008, T009: All drawing utility functions
- T004, T005: Contract type copies
- T022, T023, T024: Unit tests for utilities

**Phase 3 (User Story 1)**:
- T025-T029: All hit detection tests
- T030-T039: All line renderers (10 parallel)
- T040-T049: All line tool implementations (10 parallel)
- T050: Hit test functions (combined)

**Phase 4 (User Story 2)**:
- T062-T064: All hit detection tests
- T066-T069: All annotation renderers (4 parallel)
- T070-T073: All annotation tool implementations (4 parallel)
- T074-T076: Hit test implementations (3 parallel)

**Phase 5 (User Story 3)**:
- T086-T091: All calculation tests
- T092-T102: All advanced tool renderers (11 parallel)
- T103-T113: All advanced tool implementations (11 parallel)
- T114-T119: All utility functions (6 parallel)

**Phase 6 (Polish)**:
- T129-T131: Performance optimizations
- T133-T138: UI enhancements
- T136-T138: Action buttons (3 parallel)

---

## Parallel Example: User Story 1 Renderers

```bash
# Launch all line renderer tasks together:
Task T030: Create TrendlineTool renderer in frontend/src/components/drawings/renderers/TrendlineRenderer.tsx
Task T031: Create HorizontalLineTool renderer in frontend/src/components/drawings/renderers/HorizontalLineRenderer.tsx
Task T032: Create VerticalLineTool renderer in frontend/src/components/drawings/renderers/VerticalLineRenderer.tsx
Task T033: Create Ray renderer in frontend/src/components/drawings/renderers/RayRenderer.tsx
Task T034: Create InfoLine renderer in frontend/src/components/drawings/renderers/InfoLineRenderer.tsx
Task T035: Create ExtendedLine renderer in frontend/src/components/drawings/renderers/ExtendedLineRenderer.tsx
Task T036: Create TrendAngle renderer in frontend/src/components/drawings/renderers/TrendAngleRenderer.tsx
Task T037: Create HorizontalRay renderer in frontend/src/components/drawings/renderers/HorizontalRayRenderer.tsx
Task T038: Create CrossLine renderer in frontend/src/components/drawings/renderers/CrossLineRenderer.tsx
Task T039: Create Crosshair renderer in frontend/src/components/drawings/renderers/CrosshairRenderer.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T024) - CRITICAL
3. Complete Phase 3: User Story 1 (T025-T061)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

**MVP delivers**: Core drawing tools (Cursor, Trend Line, Horizontal Line, Crosshair, Lines flyout with 7 tools) - total 12 primary tools accessible.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

**Delivery milestones**:
- **After US1**: 12 tools (basic + lines), basic drawing functionality
- **After US2**: +4 tools (annotations), selection/edit/delete workflows
- **After US3**: +14 tools (channels, pitchforks, projections), complete feature with 29 tools

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (T025-T061)
   - Developer B: User Story 2 (T062-T085)
   - Developer C: User Story 3 (T086-T128)
3. Stories complete and integrate independently

---

## Summary

**Total Tasks**: 148
- **Setup**: 5 tasks
- **Foundational**: 19 tasks (including 3 tests)
- **User Story 1**: 37 tasks (including 5 tests)
- **User Story 2**: 24 tasks (including 4 tests)
- **User Story 3**: 43 tasks (including 6 tests)
- **Polish**: 20 tasks

**Parallel Opportunities**: 78 tasks marked [P] can run in parallel within their phases

**Task Count by User Story**:
- US1 (Core Tools): 37 tasks
- US2 (Annotations): 24 tasks
- US3 (Advanced Tools): 43 tasks

**Independent Test Criteria**:
- US1: Click tool buttons → active state changes → tooltips appear → draw on chart
- US2: Select Rectangle/Text → draw shape → select drawing → delete drawing
- US3: Click flyout button → menu opens → select sub-tool → draw advanced tool

**Suggested MVP Scope**: User Story 1 only (T001-T061) - delivers 12 core drawing tools with full CRUD and persistence.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Follow TDD: Write tests first, verify they fail, then implement
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All drawing tools follow the registry pattern from quickstart.md
- Use Radix UI components for accessibility out of the box
- localStorage key format: `drawings-{SYMBOL}` for per-symbol persistence
- Tool selection persisted in `selected-tool` localStorage key
