# Feature Specification: Drawing Toolbar Enhancement

**Feature Branch**: `017-drawing-toolbar`
**Created**: 2026-01-04
**Status**: Draft
**Input**: User description: "Implement the left vertical drawing toolbar shown in docs/mockups/drawing-toolbar.jpg. Create a left vertical toolbar matching the icon order, spacing, hover/active styles, and separators. Each button must have: tooltip, active state, and a click handler. Some buttons open a flyout on click/long-press. Use TradingView canonical drawing names when wiring actions."

**Reference Images**:
- Main toolbar mockup: `docs/drawing-toolbar.jpg`
- Lines tools menu: `docs/Lines.png`
- Projection tools menu: `docs/Projection.png`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Core Drawing Tools (Priority: P1)

A trader analyzing price charts needs to quickly access essential drawing tools to annotate trendlines, support/resistance levels, and price zones directly on the chart without interrupting their analysis workflow.

**Why this priority**: These are the most frequently used drawing tools in technical analysis. Without them, users cannot perform basic chart annotation tasks that are core to the application's value proposition.

**Independent Test**: Can be fully tested by opening the chart, clicking each drawing tool button, verifying the active state changes, and confirming tooltips appear on hover. Delivers value by enabling basic chart annotations.

**Acceptance Scenarios**:

1. **Given** the chart is loaded, **When** user hovers over any drawing tool button, **Then** a tooltip appears showing the tool name within 200ms
2. **Given** no tool is selected, **When** user clicks the "Trend Line" tool button, **Then** the button shows active state (darker background) and cursor changes to indicate drawing mode
3. **Given** the "Horizontal Line" tool is active, **When** user clicks on the chart, **Then** a horizontal line is created at that price level
4. **Given** a drawing tool is active, **When** user clicks the "Cursor" tool, **Then** the active state moves to Cursor and normal chart interaction resumes
5. **Given** the chart displays multiple drawing tools, **When** user views the toolbar, **Then** all tool buttons are visible and properly aligned vertically
6. **Given** user clicks the Lines flyout button, **When** the menu opens, **Then** all 9 line tool options are visible and selectable
7. **Given** user selects "Vertical Line" from the Lines flyout, **When** they click on the chart, **Then** a vertical line is created at the clicked time position
8. **Given** the chart component unmounts and remounts (e.g., user navigates away and back), **When** the chart reappears, **Then** the selected tool persists (does not reset to Cursor unless Cursor was last selected)

---

### User Story 2 - Shape and Annotation Tools (Priority: P2)

A trader preparing analysis reports needs to add rectangles, text annotations, and measurements to charts to highlight key price patterns and communicate trading ideas to others.

**Why this priority**: These tools enhance the communication and documentation aspects of analysis but are not required for basic technical analysis workflows. Secondary to core drawing tools.

**Independent Test**: Can be fully tested by selecting Rectangle or Text tool, drawing on the chart, and verifying the shape/text appears correctly. Delivers value by enabling richer chart annotations for sharing.

**Acceptance Scenarios**:

1. **Given** the Rectangle tool is selected, **When** user clicks and drags on the chart, **Then** a rectangle shape is created spanning the selected area
2. **Given** the Text tool is selected, **When** user clicks on the chart, **Then** a text input field appears at the clicked location
3. **Given** a shape is selected on the chart, **When** user presses the Delete key or clicks the Trash button, **Then** the shape is removed from the chart
4. **Given** multiple shapes exist on the chart, **When** user hovers over any shape, **Then** the shape highlights to indicate it can be selected
5. **Given** user clicks the Projection flyout button, **When** the menu opens, **Then** Fibonacci Retracement, Fibonacci Extension, and Trend-Based Fib Extension tools are visible
6. **Given** user is on a touch device, **When** they long-press (500ms+) on a flyout-enabled button, **Then** the flyout menu opens without activating the primary tool

---

### User Story 3 - Advanced Drawing Tools with Flyouts (Priority: P3)

A power user performing detailed Elliott Wave analysis or Fibonacci retracements needs access to specialized drawing variations (e.g., different line types, channels, pitchforks) that expand beyond basic line and shape tools.

**Why this priority**: Specialized tools serve advanced use cases and power users. The application can deliver core value without these, making them lower priority than basic drawing functionality.

**Independent Test**: Can be fully tested by long-pressing or clicking on flyout-enabled buttons, verifying the sub-menu appears, and selecting alternate tool options. Delivers value by providing advanced drawing capabilities for expert users.

**Acceptance Scenarios**:

1. **Given** the user hovers over a button with a flyout indicator, **When** a small triangle/chevron is visible on the button, **Then** the user can click or long-press to see additional tool options
2. **Given** the Lines flyout is open, **When** user selects "Extended Line" from the options, **Then** the Extended Line tool becomes active and the button icon updates to reflect the selection
3. **Given** a flyout menu is displayed, **When** user clicks anywhere outside the flyout, **Then** the flyout closes and the previously active tool remains selected
4. **Given** user opens the Channels flyout, **When** they select "Parallel Channel", **Then** they can draw a parallel channel on the chart by clicking three points
5. **Given** user opens the Pitchforks flyout, **When** they select "Schiff Pitchfork", **Then** they can draw a Schiff pitchfork on the chart

---

### Edge Cases

- What happens when the toolbar has more buttons than fit in the viewport height?
  - The toolbar becomes scrollable while maintaining the visible buttons
- How does system handle rapid clicking between tools?
  - Only the last clicked tool becomes active; intermediate states are ignored
- What happens when a drawing tool is active and user switches timeframes?
  - The active tool remains selected; drawings persist per symbol
- How does the toolbar behave on mobile/touch devices?
  - Buttons increase touch target size to minimum 44x44 pixels; long-press opens flyout
- What happens when browser zoom is at 200%+?
  - Toolbar remains fully functional and all buttons accessible
- What happens when a tool is active and user presses Escape key?
  - Tool deactivates and returns to Cursor mode
- What happens when user tries to draw while indicator calculation is in progress?
  - Drawing tool responds normally; operations are independent
- What happens when multiple flyouts are opened in quick succession?
  - The previous flyout closes before the new one opens; only one flyout visible at a time
- What happens when the chart component unmounts and remounts?
  - The selected tool state persists in component state and is restored on remount
- What happens when localStorage is full or unavailable?
  - System displays user-visible alert/notification indicating storage quota reached; drawings remain functional in current session but are not persisted to localStorage; on page reload, only previously-saved drawings are restored
- What happens when user switches between different symbols on the same chart?
  - Drawings are stored per symbol; switching symbols loads that symbol's drawings from localStorage
- What happens when user reaches the 100 drawing limit for a symbol?
  - System displays notification indicating limit reached; user must delete existing drawings before creating new ones; drawing creation is blocked until drawings are deleted
- What happens when user views a symbol with no existing drawings?
  - System displays empty state prompt message ("Click a tool to start drawing") centered on chart area; toolbar remains functional and user can begin drawing immediately; prompt disappears once first drawing is created

## Requirements *(mandatory)*

### Functional Requirements

**Toolbar Layout & Organization**
- **FR-001**: System MUST display a vertical toolbar on the left side of the chart with drawing tool buttons arranged top to bottom
- **FR-002**: System MUST group drawing tools into sections separated by visible horizontal divider lines
- **FR-003**: System MUST maintain consistent vertical spacing between buttons in the range of 3-5 pixels

**Tool Buttons**
- **FR-004**: System MUST display each button as a 36x36 pixel clickable area with an icon centered inside
- **FR-005**: System MUST show a tooltip with the tool name on hover with a delay of no more than 200ms
- **FR-006**: System MUST display active state for the currently selected tool with a darker background color (teal accent color: #26a69a), and this active state MUST maintain at least 3:1 contrast ratio against the background per SC-003
- **FR-007**: System MUST display hover state for non-active buttons with subtle background color change, and this hover state MUST maintain at least 3:1 contrast ratio against the background per SC-003
- **FR-008**: System MUST use consistent dark theme colors matching TradingView style (background: #1e222d, border: #2a2e39, icons: slate-400/white)

**Tool Configuration - Primary Toolbar Buttons**

**Group 1: Basic Navigation & Lines (Top Section)**
- **FR-009**: System MUST provide the following primary tools:
  1. Cursor (default mouse pointer)
  2. **Trend Line** (finite diagonal line between two points)
  3. **Horizontal Line** (horizontal price level across chart)
  4. Crosshair (precision cursor for price/time measurement)
  5. **Lines Flyout** (chevron-indicated button opening line variations)

**Lines Flyout Menu** (opened from button #5):
- **FR-010**: System MUST provide these additional line tools in the flyout:
  - Ray (line extending infinitely in one direction from start point)
  - Info Line (line with price/time info displayed)
  - Extended Line (trend line extended beyond both points)
  - Trend Angle (line showing angle of trend)
  - Horizontal Ray (horizontal line extending right from click point)
  - Vertical Line (vertical line at specific time)
  - Cross Line (line extending in both directions from point)

**Group 2: Annotations & Shapes (Middle Section)**
- **FR-011**: System MUST provide the following annotation tools:
  1. Brush (freehand drawing)
  2. Text (text annotation)
  3. Rectangle (rectangle shape for highlighting zones)

**Group 3: Advanced Tools & Actions (Bottom Section)**
- **FR-012**: System MUST provide the following advanced tools:
  1. **Channels Flyout** (channel pattern tools)
  2. **Pitchforks Flyout** (pitchfork drawing tools)
  3. **Projection Flyout** (Fibonacci and projection tools)
  4. Measurement/Distance tool
  5. Lock/Unlock drawings toggle
  6. Show/Hide all drawings toggle
  7. Delete all/Trash

**Channels Flyout Menu**:
- **FR-013**: System MUST provide these channel tools:
  - Parallel Channel (two parallel lines around price action)
  - Regression Trend (linear regression channel)
  - Flat Top/Bottom (horizontal channel)
  - Disjoint Channel (independent parallel lines)

**Pitchforks Flyout Menu**:
- **FR-014**: System MUST provide these pitchfork tools:
  - Pitchfork (standard Andrews pitchfork)
  - Schiff Pitchfork (modified Schiff pitchfork)
  - Modified Schiff Pitchfork
  - Inside Pitchfork

**Projection Flyout Menu**:
- **FR-015**: System MUST provide these projection tools:
  - Fibonacci Retracement (horizontal lines at Fib ratios for pullback analysis)
  - Fibonacci Extension (projects price targets beyond swing)
  - Trend-Based Fib Extension (Fib extension based on trend direction)

**Flyout Menu Behavior**
- **FR-016**: System MUST display a small chevron/triangle indicator on the right side of buttons that have flyout options
- **FR-017**: System MUST open a flyout menu when user clicks or long-presses (500ms+) on a flyout-enabled button
- **FR-018**: System MUST position flyout menus to the right of the toolbar, vertically aligned with the button that opened them
- **FR-019**: System MUST close flyout menu when user selects an option, clicks outside, or switches to another tool
- **FR-020**: System MUST update the button icon to reflect the currently selected flyout option
- **FR-021**: System MUST display keyboard shortcuts in the flyout menu next to each option for the five shortcuts specified in FR-026 (Alt+T, Alt+H, Alt+V, Alt+C, Alt+J)

**Tool Behavior**
- **FR-022**: System MUST switch to Cursor tool when user presses Escape key
- **FR-023**: System MUST maintain the selected tool state when user switches chart timeframes
- **FR-024**: System MUST store drawing data per symbol per browser using localStorage; drawings persist only on the device where created and do not sync across devices or user accounts
- **FR-024a**: System MUST enforce maximum of 100 drawings per symbol; when limit is reached, user is notified and must delete existing drawings before creating new ones
- **FR-025**: System MUST allow user to select and delete individual drawings by clicking on them and pressing Delete or clicking Trash
- **FR-026**: System MUST support the following TradingView keyboard shortcuts when tools are selected:
  - Alt + T: Trend Line
  - Alt + H: Horizontal Line
  - Alt + V: Vertical Line
  - Alt + C: Cross Line
  - Alt + J: Horizontal Ray

**Accessibility & Responsive Design**
- **FR-027**: System MUST ensure all buttons meet minimum touch target size of 44x44 pixels on mobile devices
- **FR-028**: System MUST provide keyboard navigation support (arrow keys to move between tools, Enter to select)
- **FR-029**: System MUST include ARIA labels on all buttons for screen reader compatibility
- **FR-030**: System MUST support Tab navigation through toolbar buttons and flyout menu items

**Security**
- **FR-031**: System MUST sanitize all text input from the Text tool by escaping HTML entities and rejecting any script tags or executable content to prevent XSS attacks
- **FR-032**: System MUST render text annotations as plain text only, never as raw HTML

**Empty States**
- **FR-033**: System MUST display empty state prompt message ("Click a tool to start drawing") when symbol has no existing drawings; prompt must be centered on chart area and dismiss when first drawing is created

### Tool Identifier Mapping

See `data-model.md` for the complete tool identifier mapping table, which maps UI display names to internal `toolId` values used throughout implementation.

### Key Entities

See `data-model.md` for complete entity definitions including:
- **Drawing**: A specific drawing created by a user on the chart
- **DrawingTool**: Tool configuration registry with metadata (ID, display name, icon, category, etc.)
- **DrawingPoint**: Coordinate representation (time/price pairs)
- **DrawingStyle**: Visual properties (color, line width, fill opacity)
- Tool-specific entities: Channel Drawing, Pitchfork Drawing, Projection Drawing

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select a drawing tool from the toolbar and begin drawing on the chart within 1 click
- **SC-002**: Tooltips appear within 200ms of hovering over any button
- **SC-003**: Active tool state is visually distinct from non-active tools with at least 3:1 contrast ratio; hover state also meets 3:1 contrast ratio
- **SC-004**: All primary toolbar buttons are visible without scrolling on standard laptop screens (1366x768 resolution)
- **SC-005**: Flyout menus open within 100ms of click/long-press and close within 100ms of selection or outside click
- **SC-006**: Users can switch between drawing tools with no more than 2 clicks (1 to deselect current, 1 to select new)
- **SC-007**: Toolbar layout and button spacing matches the reference mockup within 5% variance
- **SC-008**: A first-time user can complete the core drawing workflow (select tool, draw on chart, switch to cursor, delete drawing) using only in-app tooltips and visual cues, without referring to external documentation
- **SC-009**: Toolbar remains fully functional and usable when browser zoom is set to 200%
- **SC-010**: All drawing tools persist correctly when switching between different chart symbols (stored per symbol in localStorage)
- **SC-011**: Users can access all 9 line tools, 4 channel tools, 4 pitchfork tools, and 3 projection tools via flyout menus
- **SC-012**: Keyboard shortcuts (Alt+T, Alt+H, Alt+V, Alt+C, Alt+J) activate their respective tools
- **SC-013**: Selected tool state persists when chart component unmounts and remounts (e.g., navigation away and back)

## Assumptions

1. **Icon Library**: Lucide React icons will be used for consistency with existing codebase. Custom icons will be created only when Lucide doesn't have a suitable match.
2. **Chart Library**: lightweight-charts (v5.1.0) is the current chart library. Drawing tools will be implemented as SVG overlays on top of the chart since lightweight-charts has limited built-in drawing support.
3. **Color Scheme**: The TradingView-inspired dark theme already used in the application will be maintained (background: #1e222d, accent: #26a69a, text: slate-400/white).
4. **Storage**: Drawing data will be stored in browser localStorage, keyed by symbol, matching the existing pattern in the codebase. Drawings persist per symbol per browser only; no cross-device sync or cloud storage in this feature.
5. **Priority Implementation**: P1 (core tools), P2 (shapes/text), and primary flyouts (Lines) will be implemented first. Advanced flyouts (Channels, Pitchforks, Projections) can be implemented as follow-ups.
6. **Tool Definitions**: TradingView canonical tool names and behaviors are used as reference for consistency with industry standards. Internal tool IDs follow snake_case convention.
7. **Existing Infrastructure**: The existing DrawingStateContext, DrawingStorage, and types will be extended rather than replaced.
8. **Mockup Reference**: The mockups show the primary toolbar button layout and comprehensive tool menus. Not all tools need to be visible as primary buttons; many are accessed via flyouts.
9. **Browser Support**: Target browsers are Chrome, Firefox, Safari, and Edge (last 2 versions). Internet Explorer is not supported.
10. **Responsive Behavior**: Mobile responsive behavior (collapsing toolbar on <768px screens) is OUT OF SCOPE for this feature. The toolbar will remain fully visible on all screen sizes. Users can scroll if viewport height is insufficient (see Edge Cases). Mobile toolbar optimization is deferred to a future feature.
11. **Keyboard Shortcuts**: TradingView-standard shortcuts (Alt combinations) are supported. These may conflict with browser/OS shortcuts and user should be aware of potential conflicts.
12. **Component Lifecycle**: Tool state is managed at the component level and persists through unmount/remount cycles using React state or context management.
13. **Observability**: Drawing operations run silently with no logging, metrics, or telemetry output to respect user privacy and minimize complexity. Errors are surfaced to users via UI notifications only.

## Clarifications

### Session 2026-01-04

- Q: When localStorage quota is exceeded or unavailable, what is the degradation behavior? → A: Alert user and allow session-only drawings (drawings work but aren't saved)
- Q: What is the maximum number of drawings allowed per symbol? → A: 100 drawings per symbol limit
- Q: How should text tool input be sanitized to prevent XSS attacks? → A: Plain text only (sanitize all input, escape HTML entities)
- Q: What level of logging/observability should be implemented for drawing operations? → A: No logging (silent operation, no diagnostics)
- Q: What should be displayed when a symbol has no existing drawings (empty state)? → A: Empty state with prompt ("Click a tool to start drawing")

---

## Out of Scope

The following items are explicitly out of scope for this feature:

- Multi-touch gesture drawing (mobile-specific advanced interactions)
- Collaborative drawing (sharing drawings between users)
- Drawing templates or presets
- Automatic drawing tools (e.g., auto-trendline detection, auto-pattern recognition)
- Drawing synchronization across multiple browser tabs
- Cross-device drawing synchronization (drawings stay on the device where created)
- Exporting drawings as images or PDF
- Drawing version history or undo/redo beyond basic delete
- Advanced Fibonacci tools beyond the three specified (Retracement, Extension, Trend-Based Extension)
- Annotation layers that can be toggled independently
- Custom drawing tool creation by users
- Drawing tool customization (custom colors, line styles beyond presets)
- Measurement tools beyond basic distance/price difference
- Risk/reward calculation tools
- Time zone tools or session indicators
- Alert integration with drawings (e.g., alert when price crosses a drawn line)
- Cloud-based drawing storage or user account syncing
