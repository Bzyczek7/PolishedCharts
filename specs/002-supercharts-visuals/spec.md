# Feature Specification: TradingView Supercharts Dark Theme UI

**Feature Branch**: `002-supercharts-visuals`
**Created**: 2025-12-23
**Status**: Draft
**Input**: User description: "002-supercharts-visuals Make the chart UI visually mimic TradingView Supercharts (dark theme): main candles + volume, indicator panes, crosshair sync, zoom/pan, minimal top toolbar and left drawing toolbar, appearance settings. Programmer must be able to build this without seeing TradingView"

## Clarifications

### Session 2025-12-23

- Q: Drawing persistence and data model - Should drawings persist across sessions and how do they relate to underlying data? → A: Drawings persist per symbol, fixed to chart coordinates (time/price), stored in localStorage

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Main Chart Display with Candles and Volume (Priority: P1)

A trader views a financial chart showing price candles overlaid with volume bars, using a dark color scheme similar to professional trading platforms. The chart fills the available screen space with minimal chrome.

**Why this priority**: This is the core visualization - without a properly rendered main chart, no other features matter. Users need to see price action and volume to make trading decisions.

**Independent Test**: Can be fully tested by viewing a chart with candle data and verifying candles appear correctly colored (green/red or up/down), volume bars display below candles, and the entire chart area uses a dark background with high contrast for visibility.

**Acceptance Scenarios**:

1. **Given** a symbol has been selected, **When** the chart loads, **Then** candlesticks display with open, high, low, close prices visible as candle bodies and wicks
2. **Given** volume data exists, **When** viewing the chart, **Then** volume bars appear at the bottom of the main chart pane (10-20% of pane height) with colors matching the corresponding candle (up candle = green volume bar, down candle = red volume bar)
3. **Given** the chart is displayed, **When** viewing the layout, **Then** the background uses a dark color (hex #131722 or similar deep blue-gray) with candles using high-contrast colors (green: #26a69a, red: #ef5350)

---

### User Story 2 - Crosshair with Synchronized Data Display (Priority: P1)

A trader moves their mouse across the chart and a crosshair appears, showing precise price and time values at the cursor position, with labels displayed along the price axis (right side) and time axis (bottom).

**Why this priority**: Traders need to inspect exact price levels and timestamps to make decisions. The crosshair provides precision reading of chart data. This is a fundamental interaction pattern for financial charts.

**Independent Test**: Can be tested by moving the mouse over the chart and verifying: (1) vertical and horizontal lines appear following the cursor, (2) price label shows on the right axis at the horizontal line position, (3) time label shows on the bottom axis at the vertical line position, (4) both labels update in real-time as the cursor moves.

**Acceptance Scenarios**:

1. **Given** the mouse is over the chart area, **When** the cursor moves, **Then** a dashed or solid vertical line appears from the cursor to the time axis and a horizontal line appears from the cursor to the price axis
2. **Given** the crosshair is active, **When** the mouse hovers over a candle, **Then** the price label on the right axis displays the exact price value (e.g., "150.25") and the OHLC values (open, high, low, close) are displayed in a floating info box
3. **Given** multiple chart panes are visible (main + indicators), **When** the crosshair moves in the main pane, **Then** a synchronized vertical line appears in all indicator panes at the same time position

---

### User Story 3 - Zoom and Pan Interactions (Priority: P1)

A trader zooms in to see detail on recent price action and zooms out to see broader context, then pans left/right to view historical data and up/down to adjust the visible price range.

**Why this priority**: Navigation is essential for analyzing different time horizons. Traders need to examine both micro structure (recent candles) and macro trends (months of data).

**Independent Test**: Can be tested by using mouse scroll wheel to zoom (hovering over chart center zooms both axes, hovering over price axis zooms only price, hovering over time axis zooms only time) and clicking/dragging to pan the chart, verifying smooth animation throughout.

**Acceptance Scenarios**:

1. **Given** the mouse is over the chart area, **When** the user scrolls the wheel forward (up), **Then** the chart zooms in centered on the cursor position, showing fewer candles with more detail
2. **Given** the mouse is over the chart area, **When** the user scrolls the wheel backward (down), **Then** the chart zooms out showing more historical data with less detail
3. **Given** the chart is zoomed in, **When** the user clicks and drags on the chart area, **Then** the chart pans in the direction of the drag with the chart following the mouse movement
4. **Given** the chart is at any zoom level, **When** the user double-clicks on the time scale, **Then** the chart resets to a default zoom level showing approximately the last 150 candles

---

### User Story 4 - Indicator Panes (Priority: P2)

A trader adds a technical indicator (like RSI or MACD) which appears in a separate pane below the main chart, with the indicator values scaled to fit the pane and a separator line between panes.

**Why this priority**: Technical indicators are essential for analysis. While the main chart provides primary data, indicators offer additional insights. This is lower priority than basic chart viewing because users can initially trade with just price and volume.

**Independent Test**: Can be tested by adding an indicator through the UI and verifying: (1) a new pane appears below the main chart, (2) the indicator line/drawing renders correctly, (3) the pane has its own price scale on the right side, (4) a horizontal separator line visually distinguishes the pane from the main chart.

**Acceptance Scenarios**:

1. **Given** an oscillator indicator is added (e.g., RSI), **When** the indicator pane renders, **Then** it appears directly below the main chart pane with a horizontal separator line between them
2. **Given** multiple indicators are added, **When** they display, **Then** each indicator occupies its own pane stacked vertically below the main chart (main chart → indicator 1 → indicator 2, etc.)
3. **Given** an indicator pane exists, **When** the user hovers the mouse, **Then** the crosshair vertical line syncs across all panes at the same time position
4. **Given** an indicator has a different scale range (e.g., RSI 0-100 vs price 150-160), **When** the indicator renders, **Then** the pane auto-scales to fit the indicator values with 5-10% padding so lines don't touch the pane edges

---

### User Story 5 - Minimal Top Toolbar (Priority: P2)

A compact toolbar at the top of the chart provides quick access to common functions like symbol search, interval selection, chart type toggles, and indicator menu, using icons rather than text to save space.

**Why this priority**: The toolbar provides primary navigation and configuration. It's P2 because users can initially work with default settings, but quickly need these controls to customize their view.

**Independent Test**: Can be tested by verifying the toolbar appears at the top of the chart with specific clickable elements and that each button performs its intended function when clicked.

**Acceptance Scenarios**:

1. **Given** the chart is loaded, **When** viewing the top edge, **Then** a horizontal toolbar (approximately 40-50px tall) spans the full width of the chart area
2. **Given** the toolbar is visible, **When** counting the elements from left to right, **Then** it includes at minimum: symbol selector (shows current ticker like "AAPL"), interval selector (shows current timeframe like "1D" or "1H"), chart type label (read-only displaying "Candles"), an "Indicators" button, and a "Settings" (gear icon) button
3. **Given** the toolbar elements, **When** clicked, **Then** each button opens its respective menu or dialog (symbol selector opens search, interval selector shows dropdown with options 1m, 5m, 15m, 1h, 1D, indicators opens a list of available indicators, settings opens appearance/scales dialog)
4. **Given** the toolbar is visible, **When** comparing to the chart area, **Then** the toolbar uses a slightly lighter or darker shade than the main background to create subtle visual separation (e.g., background #1e222d if main is #131722)

---

### User Story 6 - Left Drawing Toolbar (Priority: P3)

A vertical toolbar on the left edge of the chart provides drawing tools like trendlines, horizontal lines, rectangles, and text annotations, allowing users to mark up the chart for analysis.

**Why this priority**: Drawing tools are valuable for technical analysis but not essential for basic chart viewing. Traders can analyze using just price action and indicators. Marked P3 because it's an enhancement rather than core functionality.

**Independent Test**: Can be tested by clicking a drawing tool button and then clicking/dragging on the chart to draw, verifying the selected shape renders correctly and persists.

**Acceptance Scenarios**:

1. **Given** the chart is displayed, **When** viewing the left edge, **Then** a vertical toolbar (approximately 40-50px wide) runs from the top of the chart area to the bottom
2. **Given** the drawing toolbar is visible, **When** examining its contents, **Then** it displays icon buttons for at minimum: cursor (default crosshair mode), trendline (diagonal line tool), horizontal line (price level marker), and rectangle (selection box)
3. **Given** the trendline tool is selected, **When** the user clicks once to set anchor point 1 and clicks again to set anchor point 2, **Then** a straight yellow line (2px thick) is drawn between the two points with draggable circular handles at each endpoint
4. **Given** the horizontal line tool is selected, **When** the user clicks at a price level, **Then** a full-width horizontal dashed yellow line appears at that price level
5. **Given** the rectangle tool is selected, **When** the user clicks and drags to define corners, **Then** a rectangle appears with a thin outline and semi-transparent yellow fill (30% opacity)
6. **Given** any drawing exists on the chart, **When** the user right-clicks on it, **Then** a context menu appears with options: "Delete", "Change color" (predefined palette), "Change thickness" (thin/medium/thick)

---

### User Story 7 - Appearance Settings (Priority: P3)

A trader accesses a settings menu to customize visual aspects like color themes (dark only for MVP), grid line visibility, and candle colors, allowing personalization of the chart appearance.

**Why this priority**: Visual customization is nice-to-have but not essential. The default dark theme should be carefully chosen to work well for most users. Marked P3 because it's an enhancement that doesn't block core functionality.

**Independent Test**: Can be tested by opening the settings dialog, changing values, and verifying the chart updates immediately to reflect the new settings.

**Acceptance Scenarios**:

1. **Given** the settings gear icon button is clicked in the top toolbar, **When** the dialog opens, **Then** a modal appears with tabs including "Appearance" and "Scales" (other tabs like "Trading" and "Events" are disabled/greyed out for MVP)
2. **Given** the Appearance tab is active, **When** adjusting the "Background brightness" slider, **Then** the chart background shifts between shades of dark (default to darker)
3. **Given** the Appearance tab is active, **When** toggling "Show grid lines" off, **Then** horizontal and vertical grid lines disappear from all panes
4. **Given** the Appearance tab is active, **When** changing the "Grid opacity" slider, **Then** grid line transparency adjusts from 0% (invisible) to 100% (fully opaque white)
5. **Given** the Appearance tab is active, **When** using color pickers for "Up candle" and "Down candle", **Then** candle colors update immediately in the chart
6. **Given** the Scales tab is active, **When** toggling "Show last price line" or "Show last price label" off, **Then** the corresponding visual elements disappear from the main chart
7. **Given** custom settings are applied, **When** the page is refreshed, **Then** the settings persist and the chart loads with the saved preferences

---

### Edge Cases

- What happens when the chart has no data for the selected symbol and interval?
  - Display a "No data available" message in the center of the chart area with guidance to try a different interval or symbol

- What happens when candle data has gaps (missing time periods)?
  - Render the gap as empty space (no candles) with optionally a visual marker or dotted line indicating data discontinuity

- What happens when the user zooms in beyond available data resolution?
  - Show the most granular data available and prevent further zoom in beyond that point

- What happens when the chart window is resized to very small dimensions?
  - Hide or collapse non-essential UI elements (toolbars may become icon-only or use dropdown menus), maintain chart interactivity

- What happens when crosshair extends beyond visible data range?
  - Clamp the crosshair labels to the visible price/time range, still show the crosshair lines but display "N/A" or hide labels for out-of-range values

- What happens when there are too many indicator panes to fit on screen?
  - Enable vertical scrolling of panes or provide a mechanism to collapse/hide panes, show a visual indicator that more panes exist below

- What happens when the user tries to draw on a chart with no visible candles?
  - Allow drawing but shapes won't be visible until data is loaded; show a tooltip message indicating "No data visible"

- What happens to drawings when switching between symbols?
  - Each symbol maintains its own set of drawings stored separately. When switching to a different symbol, that symbol's saved drawings are loaded and displayed. When returning to a previous symbol, its drawings are restored from localStorage.

- What happens to drawings when the page is reloaded?
  - All drawings persist and are restored from localStorage when the page reloads, maintaining their exact chart coordinates (time/price positions).

## Requirements *(mandatory)*

### Functional Requirements

**Main Chart Display:**

- **FR-001**: System MUST render candlestick charts showing open, high, low, close prices as candle bodies (open to close range) with wicks (high to low range)
- **FR-002**: System MUST color candles based on price direction with default colors: up candles use #26a69a (teal/green), down candles use #ef5350 (red/salmon)
- **FR-003**: System MUST render candle outlines (borders) in a slightly darker shade than the body color to maintain visibility when zoomed out
- **FR-004**: System MUST display volume bars at the bottom of the main chart pane (10-20% of pane height), with each volume bar aligned to its corresponding candle's time position
- **FR-005**: System MUST color volume bars to match their corresponding candle (green if candle close >= open, red if close < open)
- **FR-006**: System MUST use a dark theme background color of hex #131722 (deep blue-grey) for the main chart area and all indicator panes
- **FR-007**: System MUST render horizontal and vertical grid lines across each pane with 20-30% opacity white color (#ffffff with reduced alpha)

**Price Scale and Last Price:**

- **FR-008**: System MUST display a vertical price scale on the right side of the main chart pane with white text labels
- **FR-009**: System MUST display a last price label as bold white text on a small rounded rectangle, colored green (#26a69a) if the last candle closed up or red (#ef5350) if it closed down
- **FR-010**: System MUST display a last price horizontal dashed line across the entire main chart pane, using the same color as the last price label background

**Crosshair:**

- **FR-011**: System MUST display a crosshair (vertical and horizontal lines) when the mouse hovers over any chart pane, with lines extending from the cursor position to the pane edges
- **FR-012**: System MUST display price labels on the right-side price axis at the horizontal crosshair line position, showing the exact price value
- **FR-013**: System MUST display time labels on the bottom time axis at the vertical crosshair line position, showing date and/or time formatted as "Wed 27 Aug '25" for daily intervals or appropriate format for other intervals
- **FR-014**: System MUST synchronize crosshair vertical line across all visible panes (main chart + all indicator panes) so they align at the same time position
- **FR-015**: System MUST display OHLCV data (open, high, low, close, volume) and indicator values in a floating info box near the cursor or in a fixed position when the crosshair is active

**Zoom and Pan:**

- **FR-016**: System MUST support zoom in via mouse scroll wheel forward, centered on the cursor position, with smooth animation targeting 60fps
- **FR-017**: System MUST support zoom out via mouse scroll wheel backward, centered on the cursor position, with smooth animation
- **FR-018**: System MUST support click-and-drag panning in any direction (up, down, left, right) to navigate the chart
- **FR-019**: System MUST support axis-specific zoom when the mouse is positioned over the price axis (zooms only vertically) or time axis (zooms only horizontally)
- **FR-020**: System MUST reset zoom to show approximately the last 150 candles when the user double-clicks on the time scale

**Indicator Panes:**

- **FR-021**: System MUST display oscillator-type indicators (RSI, cRSI, TDFI, etc.) in separate panes stacked vertically below the main chart pane
- **FR-022**: System MUST display overlay-type indicators (SMA, EMA, Volume) directly in the main chart pane without creating a new pane
- **FR-023**: System MUST render a horizontal separator line (1px solid or small gap) between each pane to visually distinguish them
- **FR-024**: System MUST auto-scale each indicator pane to fit the indicator's value range with 5-10% padding on top and bottom so lines don't touch pane edges
- **FR-025**: System MUST display a value scale on the right side of each indicator pane with white labels
- **FR-026**: System MUST highlight the border of the currently focused pane (where the user last clicked) to indicate active state

**Oscillator Visuals:**

- **FR-027**: System MUST render oscillator indicator lines (e.g., RSI, cRSI) in bright, distinct colors (e.g., magenta #e040fb) with thicker line width than grid lines to stand out
- **FR-028**: System MUST render overbought/oversold reference levels for oscillators as dashed horizontal lines at fixed y values (e.g., 70 and 30 for RSI) in muted white/grey color with labels right-aligned near the value scale
- **FR-029**: System MUST render histogram/energy indicators (e.g., TDFI) with a center horizontal "zero" line (dashed), bars above zero in green (#26a69a), and bars below zero in red (#ef5350)
- **FR-030**: System MUST render optional dotted horizontal reference lines for histogram indicators at threshold values (e.g., +0.05 and -0.05 for TDFI)

**Toolbars:**

- **FR-031**: System MUST display a horizontal top toolbar spanning the full chart width, approximately 40-50 pixels tall
- **FR-032**: System MUST display toolbar elements from left to right in this order: symbol input (text field showing "AAPL"), interval selector (buttons: 1m, 5m, 15m, 1h, 1D), chart type label (read-only, displays "Candles" for MVP), "Indicators" button, and "Settings" (gear icon) button
- **FR-033**: System MUST display a vertical left drawing toolbar spanning the chart height, approximately 40-50 pixels wide
- **FR-034**: System MUST display drawing tools from top to bottom in this order (MVP subset): cursor tool (default), trend line, horizontal line, rectangle
- **FR-035**: System MUST use icon-based buttons (not text labels) in both toolbars to minimize space usage
- **FR-036**: System MUST highlight or visually indicate the currently active tool (drawing tool or selected interval) with a border or background color change

**Top Toolbar Behavior:**

- **FR-037**: System MUST load a new symbol's data into all panes when the user types a symbol (e.g., "AAPL") in the symbol input and presses Enter
- **FR-038**: System MUST reload the candle series at the selected interval when the user clicks an interval button (1m, 5m, 15m, 1h, 1D), preserving the current zoom level as much as possible
- **FR-039**: System MUST open an "Indicators" modal dialog when the "Indicators" button is clicked, showing a list of built-in indicators (SMA, EMA, RSI, MACD, Volume) on the left side and selected indicator's parameters on the right side
- **FR-040**: System MUST add overlay-type indicators (SMA, EMA, Volume) to the main chart pane when the user clicks "Add to chart"
- **FR-041**: System MUST create a new indicator pane for oscillator-type indicators (RSI, MACD, etc.) when the user clicks "Add to chart"

**Drawing Tools:**

- **FR-042**: System MUST activate cursor tool (default crosshair mode) when clicked, restoring normal hover behavior
- **FR-043**: System MUST allow drawing trendlines by requiring two clicks: first click sets anchor point 1, second click sets anchor point 2, then render a straight line between anchors in yellow color with 2px thickness and draggable circular handles at each endpoint
- **FR-044**: System MUST allow drawing horizontal lines with a single click at the desired price level, creating a full-width horizontal dashed yellow line
- **FR-045**: System MUST allow drawing rectangles by click-and-drag to define top-left and bottom-right corners, rendering with thin outline and semi-transparent yellow fill (30% opacity)
- **FR-046**: System MUST display a context menu (right-click) on any drawing with options: "Delete", "Change color" (predefined palette), "Change thickness" (thin/medium/thick)
- **FR-047**: System MUST allow dragging drawing endpoints/positions to adjust the drawing after creation
- **FR-048**: System MUST persist all drawings per symbol in browser localStorage, storing drawings with their chart coordinates (time and price positions)
- **FR-049**: System MUST restore all saved drawings for a symbol when that symbol is selected or when the page is reloaded, maintaining their exact chart coordinates

**Appearance Settings:**

- **FR-050**: System MUST provide a settings dialog accessed via the gear icon button in the top toolbar, containing tabs: "Appearance", "Scales", "Trading", "Events"
- **FR-051**: For MVP, only "Appearance" and "Scales" tabs must be functional; "Trading" and "Events" tabs must be disabled/greyed out
- **FR-052**: System MUST support background brightness adjustment via a slider in the Appearance tab with options ranging from "Dark" to "Darker" (no light theme for MVP)
- **FR-053**: System MUST allow toggling grid line visibility via a "Show grid lines" checkbox in the Appearance tab
- **FR-054**: System MUST allow adjusting grid line opacity via a slider from 0-100% in the Appearance tab
- **FR-055**: System MUST allow customizing candle colors via color pickers for "Up candle" (body and wick) and "Down candle" (body and wick) in the Appearance tab
- **FR-056**: System MUST allow toggling "Show last price line" and "Show last price label" via checkboxes in the Scales tab
- **FR-057**: System MUST allow toggling "Show time labels" via a checkbox in the Scales tab
- **FR-058**: System MUST persist all appearance settings (background brightness, grid visibility, colors, toggles) and reload them when the chart is displayed again

**Pane Focus:**

- **FR-059**: System MUST set focus to a pane when the user clicks on it, highlighting its border slightly
- **FR-060**: System MUST apply indicator parameter changes from the UI to indicators in the currently focused pane

### Key Entities

- **ChartTheme**: Represents a color scheme for the chart. Contains background color, grid color and opacity, candle up/down colors (body, wick, outline), text color, last price line colors.
- **Drawing**: A user-created annotation on the chart that persists across sessions. Attributes include type (cursor, trendline, horizontal line, rectangle, text), chart coordinates (time/price positions), color, line width, fill opacity, z-index (rendering order). Drawings are stored per symbol in browser localStorage and remain fixed to their original chart coordinates (not moving with candle data).
- **IndicatorPane**: A separate chart area below the main chart displaying a technical indicator. Attributes include indicator type (RSI, cRSI, TDFI, MACD, SMA, EMA), display settings (line color, thickness), pane position in stack, scale range (min/max), visibility state, isFocused flag.
- **ChartState**: The current view configuration. Attributes include visible symbol, interval, zoom level (horizontal and vertical), scroll position (time offset, price offset), visible time range (start, end), visible price range (min, max), enabled drawing tool, active theme, focused pane ID.
- **Interval**: A time aggregation for candles. Attributes include label (1m, 5m, 15m, 1h, 1D), duration in milliseconds, display name.
- **ToolbarState**: The current state of toolbar interactions. Attributes include selected interval, selected drawing tool, open menus/panels, modal dialog state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can zoom from viewing 200 candles to viewing 20 candles (10x zoom) and back using the mouse scroll wheel in under 3 seconds
- **SC-002**: Crosshair position updates smoothly with mouse movement, maintaining at least 30 frames per second of visual responsiveness (measured by frame timing tools)
- **SC-003**: Users can add 5 indicator panes without the chart becoming unusable (panes remain individually identifiable and scrollable if needed)
- **SC-004**: All UI elements (toolbars, buttons, labels) remain readable and accessible on screens as small as 1024x768 resolution
- **SC-005**: Chart renders initial display of 100 candles within 2 seconds of selecting a symbol
- **SC-006**: 90% of test users can successfully complete core chart interactions (zoom, pan, add indicator, use crosshair) within 5 minutes of first use without consulting documentation
- **SC-007**: Dark theme colors provide sufficient contrast that price levels and text labels are readable without eye strain in typical indoor lighting conditions (measured by WCAG AA contrast ratio of at least 4.5:1 for text)
- **SC-008**: Visual layout matches TradingView Supercharts dark theme with 90% similarity as judged by a side-by-side comparison screenshot review (measured by counting matching visual elements: layout zones, toolbar positions, color scheme, pane structure)

## Non-Functional Requirements *(optional)*

### Performance

- Chart must maintain 60fps animation during zoom and pan operations (measured by performance profiling tools)
- Crosshair must track mouse position with no perceivable lag (<16ms delay from mouse move to visual update)
- Chart must support displaying up to 10,000 candles without frame rate dropping below 30fps during pan/zoom

### Visual Fidelity

- Layout must match TradingView Supercharts dark theme with 90% visual similarity as judged by side-by-side screenshot comparison
- Candle colors, grid lines, and UI chrome must use the same or very similar colors to TradingView (within 10% color distance in Lab color space)
- Spacing and proportions of UI elements (toolbar heights 40-50px, button sizes, pane separators) must match TradingView within 15% variance
- Font sizes and weights must match TradingView's typography (typically 11-13px for labels, 12-14px for toolbar text)

### Accessibility

- All toolbar buttons must be keyboard accessible via Tab navigation
- All interactive elements must have focus indicators visible
- Color themes must provide sufficient contrast ratio (minimum 4.5:1 for text) per WCAG 2.1 AA standards
- Keyboard shortcuts must exist for common actions (zoom in/out, reset zoom, toggle crosshair, escape drawing mode)

### Browser Compatibility

- Chart must function correctly on Chrome, Firefox, Safari, and Edge browsers released within the last 2 years
- Chart must render correctly on screens with resolution from 1024x768 to 4K (3840x2160)

## Assumptions *(optional)*

1. The existing charting infrastructure (from 001-initial-setup) provides candle data and basic rendering capabilities via the lightweight-charts library that can be extended with this UI
2. The lightweight-charts library supports the visual features needed (crosshair, multiple panes, zoom/pan) or can be augmented with custom rendering overlays
3. Users view the chart on desktop or laptop screens (1024px width minimum), not mobile devices (mobile responsiveness is out of scope for MVP)
4. The target audience is familiar with financial chart conventions (candlesticks, volume, OHLC) and doesn't need educational tooltips for basic chart elements
5. "TradingView Supercharts" refers to the TradingView web interface's chart layout as of 2024-2025, specifically the dark theme with toolbar and pane layout
6. The programmer cannot see TradingView during development and must rely solely on this specification and provided screenshots/docs/screenshots/002/* directory for visual reference
7. For each visual element implemented, a screenshot comparison will be committed to the feature branch for visual review

## Constraints & Dependencies *(optional)*

### Constraints

- Must build this without referencing TradingView directly during development (no copying while coding), relying solely on this specification and provided reference materials
- Must maintain compatibility with the existing React + TypeScript + Vite frontend from 001-initial-setup
- Must not require any paid or licensed charting libraries beyond what's already in use (lightweight-charts is free)
- For MVP, chart type is limited to candlesticks only (no bars, line, area charts)
- For MVP, only dark theme is supported (light theme is deferred to future work)
- For MVP, only cursor, trendline, horizontal line, and rectangle drawing tools are implemented (additional drawing tools deferred)

### Dependencies

- Depends on 001-initial-setup being complete (chart data retrieval, candle storage, basic chart display with lightweight-charts)
- Requires icon library for toolbar buttons (Lucide React or similar lightweight icon set, already available in project)
- Requires UI component library for dialogs and menus (Radix UI is already available)
- May require additional state management for chart settings (can use existing React state or add Zustand/Jotai if needed)
- Reference screenshots must be provided in docs/screenshots/002/ directory before development begins

### Out of Scope for MVP

- Light color theme (only dark theme for MVP)
- Bar chart, line chart, area chart types (only candlesticks for MVP)
- Additional drawing tools beyond trendline, horizontal line, rectangle (fibonacci, pitchfork, etc. deferred)
- Multi-chart layouts (only single chart with indicator panes for MVP)
- Social features (sharing charts, publishing ideas, etc.)
- Alert creation from chart (clicking to set alert price)
- Chart replay/playback of historical data
- Strategy backtesting visualization
- Mobile responsive design (desktop only for MVP)
