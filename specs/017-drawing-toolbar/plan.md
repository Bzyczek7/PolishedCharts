# Implementation Plan: Drawing Toolbar Enhancement

**Branch**: `017-drawing-toolbar` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-drawing-toolbar/spec.md`

## Summary

Implement a comprehensive left vertical drawing toolbar for the TradingAlert charting application, matching TradingView's canonical drawing tools organization. The toolbar includes 29 drawing tools + 3 action buttons (Lock/Unlock, Show/Hide All, Delete All) = 32 total toolbar items, accessible through primary buttons and flyout menus (Lines, Channels, Pitchforks, Projections). All tools will be implemented as SVG overlays on top of lightweight-charts, with localStorage persistence per symbol.

**Technical Approach**: Extend the existing DrawingStateContext and DrawingStorage infrastructure. Implement drawing tools as React components that render SVG elements over the lightweight-charts canvas. Use Radix UI Dropdown for flyout menus. Maintain tool selection state in context to persist through component lifecycle.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2
**Primary Dependencies**:
- lightweight-charts 5.1.0 (charting library)
- Radix UI (@radix-ui/react-dropdown-menu, @radix-ui/react-tooltip, @radix-ui/react-popover)
- Lucide React 0.562.0 (icons)
- shadcn/ui (component library built on Radix UI)
- React 19.2.0 (UI framework)

**Storage**: Browser localStorage (key: `drawings-{SYMBOL}`), drawings persist per symbol per browser only
**Testing**: Vitest + React Testing Library (frontend), existing test infrastructure
**Target Platform**: Web browser (Chrome, Firefox, Safari, Edge - last 2 versions)
**Project Type**: Web application (frontend + backend structure)

**Color Specifications**:
- Background (default): `#1e222d` (from existing dark theme)
- Border: `#2a2e39`
- Icon (inactive): `#94a3b8` (slate-400)
- Icon (active): `#ffffff` (white)
- Active state background: `#26a69a` (teal accent) with 20% opacity → `rgba(38, 166, 154, 0.2)` or hex `#26a69a33`
- Hover state background: `#2a2e39` (same as border color) with 100% opacity
- Hover state background (on active button): `#26a69a` with 30% opacity → `rgba(38, 166, 154, 0.3)` or hex `#26a69a4d`
- Separator line: `#2a2e39`

**Contrast Verification**:
- Active icon (#ffffff on #26a69a33): ~12:1 contrast ratio (WCAG AAA, exceeds 3:1 requirement)
- Hover icon (#94a3b8 on #2a2e39): ~4.5:1 contrast ratio (WCAG AA, exceeds 3:1 requirement)
- Test method: Use axe-core or Chroma Contrast Analyzer in CI

**Performance Goals**:
- Tooltip display: <200ms (SC-002)
- Flyout open/close: <100ms (SC-005)
- 60fps UI responsiveness during drawing interactions
- No impact on chart panning performance (60fps requirement from constitution)

**Constraints**:
- Must work as SVG overlay on lightweight-charts (no native drawing support)
- localStorage has ~5-10MB limit; drawings must be stored efficiently
- Drawing tools must not interfere with existing chart interactions (zoom, pan, crosshair)
- Accessibility: minimum 44x44px touch targets, 3:1 contrast ratio, ARIA labels, keyboard navigation

**Scale/Scope**:
- 29 drawing tools + 3 action buttons = 32 total toolbar items
- 5 primary toolbar buttons (Cursor, Trend Line, Horizontal Line, Crosshair, Lines flyout)
- 4 flyout menus (Lines: 7 tools, Channels: 4 tools, Pitchforks: 4 tools, Projections: 3 tools)
- 3 annotation tools (Brush, Text, Rectangle)
- 3 action buttons (Lock/Unlock, Show/Hide, Delete All)

**Existing Infrastructure to Extend**:
- `/frontend/src/contexts/DrawingStateContext.tsx` - State management
- `/frontend/src/components/drawings/DrawingStorage.tsx` - localStorage persistence
- `/frontend/src/components/types/drawings.ts` - Type definitions (4 drawing types, needs expansion to 29)
- `/frontend/src/components/toolbar/DrawingToolbar.tsx` - Toolbar component (4 tools, needs expansion)
- `/frontend/src/utils/drawingUtils.ts` - Drawing utilities (hit detection, bounds calculation)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] **Chart interactions (zoom/pan/crosshair) match TradingView behavior**: Drawing tools are SVG overlays and do not modify lightweight-charts core interactions. Existing chart zoom/pan/crosshair behavior preserved.
- [x] **UI changes include before/after verification**: Visual changes (toolbar, flyout menus) require machine-readable parity evidence per Constitution Section IX:
  - Automated tests validating layout metrics (button positions, spacing, colors as hex values)
  - Parity Report (JSON/Markdown) with fixture ID, reproduction steps, and test output
  - Screenshots/recordings optional for human review but NOT acceptance proof
- [x] **Performance budgets: 60fps panning, 3s initial load**: Drawing operations are independent of chart data loading. SVG rendering is GPU-accelerated. Will add performance tests for drawing rendering with 100+ drawings.

**Status**: PASS - Drawing tools as overlays preserve existing chart interactions.

### Correctness Over Cleverness

- [x] **Timestamp handling: UTC normalization documented**: Drawings store timestamps as Unix milliseconds (UTC). Existing candle data uses UTC; drawings align with same time scale.
- [x] **Deduplication strategy**: Not applicable - drawings are user-created, not fetched from external sources.
- [x] **Alert semantics**: Not applicable - this feature is drawing tools only, no alert logic.
- [x] **Gap handling**: Drawings reference time indices; if candles are missing, drawings still render at correct time position.

**Status**: PASS - No data correctness issues; drawings are user annotations.

### Unlimited Alerts Philosophy

- [x] **No application-level hard caps on alert count**: Not applicable - this feature is drawing tools, not alerts.
- [x] **Alert evaluation performance budgeted**: Not applicable.
- [x] **Graceful degradation defined**: localStorage quota handling defined (edge case: drawings exist in session only).

**Status**: N/A - Feature is drawing tools, not alerts.

### Local-First and Offline-Tolerant

- [x] **Caching strategy**: Drawings stored in localStorage per symbol. No external API calls for drawing operations.
- [x] **Offline behavior**: Drawing tools work fully offline. No network dependency for drawing creation/editing/deletion.
- [x] **Provider error handling**: Not applicable - drawing tools are local-only.

**Status**: PASS - Drawing tools are inherently local-first.

### Testing and Quality Gates

- [x] **Core logic uses TDD**: Drawing tool hit detection, coordinate transformation, and state management will be test-driven.
- [x] **Bug fixes include regression tests**: Will add regression tests for any drawing interaction bugs.
- [x] **CI includes**: Existing CI includes lint, typecheck, unit tests. Will add drawing tool tests.

**Status**: PASS - Will follow TDD for drawing logic (hit testing, coordinate mapping, state transitions).

### Performance Budgets

- [x] **Initial chart load**: 3 seconds - Drawing tools load after chart, no impact on initial load time.
- [x] **Price update latency**: 2 seconds - Drawing operations are independent of price updates.
- [x] **Alert evaluation**: 500ms - Not applicable (drawing tools).
- [x] **UI panning**: 60fps - SVG overlay must not degrade panning performance. Will test with 100+ drawings.
- [x] **Memory**: 500MB - Drawings are lightweight JSON objects in localStorage. Minimal memory impact.

**Status**: PASS - Need to verify 60fps panning with 100+ drawings in performance tests.

### Architecture for Extensibility

- [x] **Indicators use plugin registry**: Not applicable - drawing tools use different pattern.
- [x] **Data providers implement common interface**: Not applicable - drawing tools are local.
- [x] **Provider-specific logic isolated**: Not applicable.

**Drawing Tool Extensibility** (architecture-specific):
- Drawing tools will use a registry pattern: `DrawingToolRegistry` maps `toolId` to component/renderer
- New tools can be added by registering in the registry without modifying core toolbar code
- Each tool implements `DrawingTool` interface: `render()`, `hitTest()`, `getHandles()`, `toJSON()`, `fromJSON()`

**Status**: PASS - Registry pattern enables extensibility.

### Security & Privacy

- [x] **No telemetry or data upload without consent**: Drawings stored locally in localStorage. No telemetry.
- [x] **API keys stored securely**: Not applicable - drawing tools use no external APIs.
- [x] **Local data treated as sensitive**: Drawings are user annotations, stored locally only. No sync to cloud.

**Status**: PASS - Drawing tools are privacy-preserving.

### Governance

- [x] **If any principle violated**: None violated.
- [x] **Constitution supersedes spec/plan conflicts**: No conflicts.

**Status**: PASS - No constitution violations.

**Overall Constitution Check**: ✅ **PASS** - May proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/017-drawing-toolbar/
├── plan.md              # This file
├── research.md          # Phase 0 output (drawing tool patterns, SVG overlay strategies)
├── data-model.md        # Phase 1 output (Drawing entity, DrawingTool registry, state machine)
├── quickstart.md        # Phase 1 output (developer quickstart for adding new tools)
├── contracts/           # Phase 1 output (DrawingTool interface, TypeScript types)
└── tasks.md             # Phase 2 output (NOT created by this command)
```

### Source Code (repository root)

```text
frontend/                              # React TypeScript frontend
├── src/
│   ├── components/
│   │   ├── chart/
│   │   │   └── ChartComponent.tsx    # Existing: lightweight-charts integration
│   │   ├── drawings/                 # Drawing tools implementation
│   │   │   ├── tools/                # NEW: Individual tool components
│   │   │   │   ├── TrendlineTool.tsx
│   │   │   │   ├── HorizontalLineTool.tsx
│   │   │   │   ├── RayTool.tsx
│   │   │   │   ├── VerticalLineTool.tsx
│   │   │   │   ├── RectangleTool.tsx
│   │   │   │   ├── TextTool.tsx
│   │   │   │   ├── BrushTool.tsx
│   │   │   │   ├── ParallelChannelTool.tsx
│   │   │   │   ├── PitchforkTool.tsx
│   │   │   │   ├── FibRetracementTool.tsx
│   │   │   │   └── index.ts           # Tool registry
│   │   │   ├── renderers/             # NEW: SVG rendering logic
│   │   │   │   ├── LineRenderer.tsx
│   │   │   │   ├── RectangleRenderer.tsx
│   │   │   │   ├── TextRenderer.tsx
│   │   │   │   └── FibRenderer.tsx
│   │   │   ├── DrawingsOverlay.tsx   # Existing placeholder: SVG container over chart
│   │   │   ├── DrawingStorage.tsx    # Existing: localStorage persistence
│   │   │   └── DrawingContextMenu.tsx # Existing: right-click menu
│   │   ├── toolbar/
│   │   │   ├── DrawingToolbar.tsx    # Existing: 4 tools, expand to 29
│   │   │   ├── ToolButton.tsx        # NEW: Reusable toolbar button
│   │   │   ├── FlyoutMenu.tsx        # NEW: Radix UI dropdown wrapper
│   │   │   └── ToolSeparator.tsx     # NEW: Visual separator between groups
│   │   └── ui/                       # Existing: shadcn/ui components
│   ├── contexts/
│   │   └── DrawingStateContext.tsx   # Existing: expand ToolType, add flyout state
│   ├── hooks/
│   │   ├── useDrawings.ts            # Existing: convenience hook
│   │   └── useDrawingTool.ts         # NEW: hook for tool-specific logic
│   ├── types/
│   │   └── drawings.ts               # Existing: expand DrawingType, ToolType
│   ├── utils/
│   │   ├── drawingUtils.ts           # Existing: hit detection, bounds
│   │   └── coordinateUtils.ts        # NEW: chart coordinate transforms
│   └── constants/
│       └── drawingTools.ts           # NEW: tool config registry
└── tests/
    ├── unit/
    │   ├── components/
    │   │   ├── drawings/
    │   │   │   ├── tools/
    │   │   │   └── renderers/
    │   │   └── toolbar/
    │   └── utils/
    │       └── drawingUtils.test.ts
    └── integration/
        └── drawing-workflow.test.tsx

backend/                               # Python FastAPI backend
└── (no changes for this feature - drawing tools are frontend-only)
```

**Structure Decision**: Web application structure (Option 2) with frontend-only changes. The drawing tools feature is purely a UI enhancement; no backend API changes are required since all drawing data is stored in browser localStorage.

## Complexity Tracking

> **No constitution violations** - this section is intentionally empty.

No violations that require justification. The feature aligns with all constitutional principles:
- Drawing tools as overlays preserve existing chart interactions (UX Parity)
- Local-only storage with no external dependencies (Local-First)
- Registry pattern enables extensibility without architectural changes (Extensibility)
- Privacy-preserving with no data exfiltration (Security & Privacy)

## Phase 0: Research & Technical Decisions

### Research Tasks

1. **SVG Overlay Strategy for lightweight-charts**
   - Question: How to position SVG elements accurately over a lightweight-charts canvas?
   - Research: lightweight-charts API for coordinate transformation (time/price to x/y pixels)
   - Deliverable: `coordinateUtils.ts` implementation with `timeToX()`, `priceToY()` functions

2. **Drawing Tool Hit Detection**
   - Question: How to detect clicks/touches on diagonal lines, rectangles, text?
   - Research: Existing `drawingUtils.ts` hit detection functions, extend to new tool types
   - Deliverable: Expanded `hitTestDrawing()` function supporting all 29 tool types

3. **Flyout Menu UX Patterns**
   - Question: Should flyout open on click or long-press? How to handle both mouse and touch?
   - Research: TradingView behavior, Radix UI Dropdown Menu patterns
   - Deliverable: `FlyoutMenu.tsx` component with click + 500ms long-press support

4. **Tool State Persistence**
   - Question: How to persist selected tool across chart remounts?
   - Research: React Context + localStorage for tool selection state
   - Deliverable: `DrawingStateContext` updates with tool selection persistence

5. **Performance with 100+ Drawings**
   - Question: How to maintain 60fps when rendering many SVG elements?
   - Research: SVG rendering optimization, React.memo, virtualization if needed
   - Deliverable: Performance tests with 100, 500, 1000 drawings; benchmark results

6. **Fibonacci Tool Calculation**
   - Question: How to calculate Fib retracement/extension levels?
   - Research: Standard Fib ratios (0.236, 0.382, 0.5, 0.618, etc.), price projection formulas
   - Deliverable: `fibUtils.ts` with Fib level calculation functions

7. **Channel & Pitchfork Geometry**
   - Question: How to calculate parallel lines and pitchfork tines from 3 control points?
   - Research: Geometric formulas for parallel channels, Andrews pitchfork mathematics
   - Deliverable: `geometryUtils.ts` with channel/pitchfork calculation functions

### Research Artifacts

**Output**: `/specs/017-drawing-toolbar/research.md`

Research findings will be consolidated into a single document with:
- Decision: What approach was chosen
- Rationale: Why chosen (trade-offs considered)
- Alternatives considered: What else was evaluated
- Code examples: Proof-of-concept snippets where applicable

## Phase 1: Design & Contracts

### 1.1 Data Model (`data-model.md`)

**Drawing Entity** (expanded from existing):

```typescript
interface Drawing {
  id: string;                  // UUID
  toolId: string;              // From Tool Identifier Mapping table (e.g., 'trend_line', 'fib_retracement')
  symbol: string;              // Stock symbol (e.g., 'AAPL')
  points: DrawingPoint[];      // Variable: 1-5 points depending on tool type
  style: DrawingStyle;         // Color, line width, fill opacity
  state: 'draft' | 'complete'; // Whether user is still creating it
  createdAt: number;           // Unix timestamp
  updatedAt: number;           // Unix timestamp
}

interface DrawingPoint {
  time?: number | null;        // Unix timestamp (ms) or null for price-only tools
  price?: number | null;       // Price or null for time-only tools
}

interface DrawingStyle {
  color: string;               // Hex color (default: #ffff00)
  lineWidth: number;           // 1-4px
  lineStyle?: 'solid' | 'dotted' | 'dashed'; // For Ray, Extended Line
  fillOpacity?: number;        // 0-100 for rectangles, channels
  fontSize?: number;           // For text
}

// Tool-specific data extensions
interface FibRetracementData extends Drawing {
  levels: FibLevel[];          // Custom Fib levels if not using defaults
}

interface FibLevel {
  ratio: number;               // e.g., 0.236, 0.382, 0.5, 0.618
  price: number;               // Calculated price at this level
  label: string;               // e.g., "23.6%", "38.2%"
}
```

**DrawingTool Registry** (new):

```typescript
interface DrawingToolConfig {
  id: string;                  // toolId from spec
  label: string;               // Display name
  category: 'basic' | 'lines' | 'annotation' | 'channels' | 'pitchforks' | 'projections';
  icon: React.ReactNode;       // Lucide icon
  cursor: string;              // CSS cursor for this tool
  keyboardShortcut?: string;   // e.g., 'Alt+T'
  minPoints: number;           // Minimum clicks to create (1-5)
  maxPoints: number;           // Maximum control points (1-5)
  renderer: DrawingToolRenderer; // React component
  hitTester: (drawing: Drawing, point: Point) => boolean;
  flyout?: string;             // Parent flyout menu ID (if applicable)
}
```

**State Machine** (tool selection):

```
States: cursor → drawing_tool → creating → complete
Transitions:
  - Any tool → cursor: ESC key, click Cursor button
  - cursor → tool: Click tool button, keyboard shortcut
  - tool → creating: First click on chart
  - creating → complete: Min points reached + Enter/Escape/timeout
  - creating → cursor: ESC during creation (cancel)
  - complete → creating: Click existing drawing (edit mode)
  - complete → cursor: Click empty space
```

### 1.2 API Contracts (`contracts/`)

**DrawingTool Interface**:

```typescript
// contracts/DrawingTool.ts
export interface DrawingTool {
  // Render the drawing as SVG
  render(drawing: Drawing, chartApi: ChartApi, isSelected: boolean): React.ReactNode;

  // Hit test for selection
  hitTest(drawing: Drawing, point: Point, chartApi: ChartApi): boolean;

  // Get drag handles for resizing/moving
  getHandles(drawing: Drawing, chartApi: ChartApi): Handle[];

  // Calculate points for Fib/channels/pitchforks
  calculatePoints?(drawing: Drawing): CalculatedPoint[];

  // Validate user input during creation
  validatePoint(drawing: Drawing, newPoint: Point): boolean;

  // Get default style for this tool type
  getDefaultStyle(): DrawingStyle;
}

export interface ChartApi {
  // Coordinate transforms
  timeToX(time: number): number;
  priceToY(price: number): number;
  xToTime(x: number): number;
  yToPrice(y: number): number;

  // Chart bounds
  getVisibleRange(): { from: number; to: number };
  getPriceRange(): { min: number; max: number };
}
```

**TypeScript Types** (expanded):

```typescript
// contracts/types.ts
export type ToolId =
  // Basic (5)
  | 'cursor' | 'trend_line' | 'horizontal_line' | 'crosshair'
  // Lines (7)
  | 'ray' | 'info_line' | 'extended_line' | 'trend_angle'
  | 'horizontal_ray' | 'vertical_line' | 'cross_line'
  // Annotations (3)
  | 'brush' | 'text' | 'rectangle'
  // Channels (4)
  | 'parallel_channel' | 'regression_trend' | 'flat_top_bottom' | 'disjoint_channel'
  // Pitchforks (4)
  | 'pitchfork' | 'schiff_pitchfork' | 'modified_schiff_pitchfork' | 'inside_pitchfork'
  // Projections (3)
  | 'fib_retracement' | 'fib_extension' | 'trend_based_fib_extension'
  // Advanced (1)
  | 'measurement'
  // Actions (3)
  | 'lock_unlock' | 'show_hide_all' | 'delete_all';

export type DrawingType = ToolId; // Alias for compatibility

export type ToolCategory =
  | 'basic'      // Cursor, Crosshair
  | 'lines'      // All line tools
  | 'annotation' // Brush, Text, Rectangle
  | 'channels'   // Channel tools
  | 'pitchforks' // Pitchfork tools
  | 'projections' // Fib tools
  | 'advanced'   // Measurement
  | 'actions';   // Lock/Unlock, Show/Hide, Delete
```

### 1.3 Developer Quickstart (`quickstart.md`)

Quick start guide for adding a new drawing tool:
1. Define tool config in `constants/drawingTools.ts`
2. Create renderer component in `components/drawings/renderers/`
3. Implement `DrawingTool` interface
4. Register in `components/drawings/tools/index.ts`
5. Add to toolbar or flyout menu
6. Write tests for hit detection and rendering

## Phase 2: Implementation

> **Note**: Phase 2 task breakdown is generated by `/speckit.tasks` command, not this plan.

The implementation will follow this priority order:
1. **P1**: Core toolbar + basic tools (Cursor, Trend Line, Horizontal Line, Crosshair, Lines flyout with 7 tools)
2. **P2**: Annotation tools (Brush, Text, Rectangle) + drawing selection/edit/delete
3. **P3**: Advanced flyouts (Channels, Pitchforks, Projections)

Key implementation tasks (detailed in `tasks.md`):
- Expand `DrawingStateContext` with new tool types and flyout state
- Update `DrawingToolbar.tsx` with 15 primary buttons + flyout menus
- Implement `ToolButton.tsx` and `FlyoutMenu.tsx` components
- Create SVG renderer components for each tool type
- Implement coordinate transformation utilities
- Add keyboard shortcuts (Alt+T, Alt+H, Alt+V, Alt+C, Alt+J)
- Add accessibility (ARIA labels, keyboard navigation, 44x44px touch targets)
- Write tests for hit detection, state management, and rendering
- Performance benchmarking with 100+ drawings

## Success Criteria Mapping

From spec.md SC-001 through SC-013:

| SC | Requirement | Verification |
|----|-------------|--------------|
| SC-001 | Select tool and draw within 1 click | Integration test: click tool → chart interaction |
| SC-002 | Tooltips within 200ms | Performance test: hover → tooltip render time |
| SC-003 | 3:1 contrast for active/hover | Automated contrast check via axe-core |
| SC-004 | All buttons visible on 1366x768 | Screenshot test + pixel height measurement |
| SC-005 | Flyout open/close within 100ms | Performance test: flyout render time |
| SC-006 | Switch tools in ≤2 clicks | Integration test: tool switching flow |
| SC-007 | Layout matches mockup within 5% | Screenshot comparison test |
| SC-008 | First-time user completes workflow | User test with mockup screenshots as reference |
| SC-009 | Functional at 200% zoom | Visual regression test at 200% zoom |
| SC-010 | Drawings persist per symbol | Integration test: switch symbols → drawings load |
| SC-011 | Access all tools via flyouts | Smoke test: click each flyout → all options visible |
| SC-012 | Keyboard shortcuts work | Integration test: Alt+T/H/V/C/J |
| SC-013 | Tool state persists after remount | Integration test: navigate away → back → tool selected |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| lightweight-charts coordinate API changes | High - breaks positioning | Use version-pinned lightweight-charts 5.1.0; abstract coordinate transforms in utility class |
| Performance degradation with 100+ SVG elements | Medium - violates 60fps budget | Benchmark early; use React.memo for drawing items; consider canvas rendering for performance-critical paths |
| Touch interaction conflicts (long-press vs scroll) | Medium - poor UX on mobile | Test on real devices; use 500ms threshold for long-press; show visual feedback during long-press |
| localStorage quota exceeded | Low - drawings lost | Implement graceful degradation; monitor quota usage; warn user at 80% capacity |
| Fib/pitchfork calculation errors | Medium - incorrect drawings | TDD for calculation functions; unit tests with known TradingView outputs as reference |

## Open Questions (for Phase 0 Research)

1. **Coordinate sync**: Does lightweight-charts fire events when chart is resized/zoomed? Need to subscribe to update SVG positions.
2. **Fib level customization**: Should users be able to add custom Fib levels, or stick to standard ratios?
3. **Drawing lock behavior**: When drawings are "locked", can they still be selected? Or completely immutable?
4. **Measurement tool display**: How to show price/time distance? Tooltip? Label on chart?
5. **Brush tool persistence**: Freehand drawing creates many points. How to compress/smooth for storage?

These will be resolved in Phase 0 research and documented in `research.md`.
