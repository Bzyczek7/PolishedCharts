# Feature Specification: Overlay Indicator Rendering & Configuration UI

**Feature Branch**: `008-overlay-indicator-rendering`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "# Specification: Overlay Indicator Rendering & Configuration UI

**Feature ID**: 008-overlay-indicator-rendering
**Branch**: 008-overlay-indicator-rendering
**Date**: 2025-12-26
**Status**: Specification Phase

## Vision

Enable users to see overlay indicators (SMA, EMA, TDFI) rendered on the chart AND provide a rich configuration UI for managing indicator parameters (inputs), visual styling (colors, line types), and visibility settings.

## Problem Statement

Currently:
- Overlay indicators are calculated but NOT displayed on the chart
- Users cannot customize indicator visual properties (colors, line styles)
- No UI to discover or change indicator parameters at runtime
- No way to hide individual indicators
- No source code inspection for indicator calculations

Users expect:
- See SMA/EMA/TDFI lines on the chart alongside price
- Hover over indicator name to access controls (hide, settings, source, remove)
- Configure parameters dynamically via "Inputs" tab
- Customize colors and line styles via "Style" tab
- Toggle visibility without removing the indicator

..."

## Clarifications

### Session 2025-12-26

- Q: How should indicator instance configurations be stored in localStorage to support the required functionality (parameters, styles, visibility, persistence across sessions)? → A: Store separate keys per indicator with individual objects plus a list key (i.e., `indicator_instance:${id}` for each indicator instance object, and `indicator_list:${symbol}` for the ordered array of instance IDs, where `${id}` and `${symbol}` are template variable placeholders)
- Q: Should there be a specific quantitative performance target for indicator calculation/rendering when adding or updating indicators? → A: Yes - Indicator calculation and rendering completes within 100ms for any single indicator update
- Q: What color input format should the system support for indicator color customization? → A: Hex color codes (e.g., "#FF5733") using native browser `<input type="color">`
- Q: What format should indicator instance identifiers use? → A: UUID v4 (random) e.g., "a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d"
- Q: At what point should the system display a performance warning for too many indicators? → A: Warn when attempting to add the 11th indicator (one beyond documented limit)

## User Scenarios & Testing

### User Story 1 - Display Overlay Indicators on Price Chart (Priority: P1)

When a trader adds an overlay indicator (such as SMA, EMA, or TDFI) to their chart, they expect to see the calculated indicator values rendered as a line directly on the price chart. This visual representation allows traders to quickly identify trends, support/resistance levels, and potential entry/exit points by comparing indicator movements with price action.

**Why this priority**: This is the core value proposition - without visual rendering, indicators provide no analytical benefit. Traders cannot make decisions based on indicator values they cannot see. This is the foundation upon which all other features (styling, configuration) build.

**Independent Test**: Can be fully tested by adding an overlay indicator and verifying that a line appears on the chart displaying the correct calculated values at the correct time points. Delivers immediate analytical value to the user.

**Acceptance Scenarios**:

1. **Given** a user is viewing a price chart, **When** they add an SMA indicator with period 20, **Then** a line appears on the chart displaying the 20-period SMA values aligned with the correct timestamps
2. **Given** a user has added an overlay indicator, **When** new price data arrives, **Then** the indicator line updates to show the new calculated value
3. **Given** a user is viewing a chart with an overlay indicator, **When** they zoom or pan the chart, **Then** the indicator line remains correctly aligned with price data
4. **Given** a user has added an overlay indicator, **When** they remove the indicator, **Then** the indicator line disappears from the chart

---

### User Story 2 - Customize Indicator Visual Appearance (Priority: P2)

Traders often work with multiple indicators simultaneously and need clear visual distinction between them. A user wants to customize the color, line style (solid, dashed, dotted), and line width of each indicator to match their preferences and improve chart readability.

**Why this priority**: Visual customization is important for usability when working with multiple indicators, but users can still derive value from default colors. This enhances the experience without blocking core functionality.

**Independent Test**: Can be tested by adding an indicator, opening the style settings, changing the color, and verifying the line color updates on the chart. Delivers improved clarity and personalization.

**Acceptance Scenarios**:

1. **Given** a user has an overlay indicator on their chart, **When** they open indicator settings and change the line color, **Then** the indicator line on the chart immediately reflects the new color
2. **Given** a user is customizing an indicator, **When** they view the line style options, **Then** solid line style is applied (dashed/dotted options are placeholder for future implementation)
3. **Given** a user has configured custom indicator styles, **When** they refresh the page, **Then** their style preferences are restored and applied
4. **Given** a user is viewing multiple indicators, **When** they apply different colors to each, **Then** all indicators are visually distinct on the chart

---

### User Story 3 - Configure Indicator Parameters via UI (Priority: P2)

A trader wants to adjust indicator parameters (such as SMA period from 20 to 50) without removing and re-adding the indicator. They need an interface to view current parameter values, edit them within valid ranges, and see the chart update in real-time.

**Why this priority**: Parameter adjustment is a common workflow, but users can initially work with default values. This feature improves efficiency but doesn't block initial indicator usage.

**Independent Test**: Can be tested by adding an indicator, opening the parameter settings, changing a period value, and verifying the indicator recalculates and displays correctly. Delivers workflow efficiency.

**Acceptance Scenarios**:

1. **Given** a user has an SMA(20) indicator on their chart, **When** they open settings and change the period to 50, **Then** the indicator recalculates and displays the 50-period SMA on the chart
2. **Given** a user is editing a parameter, **When** they enter a value outside the valid range, **Then** an error message displays and the value is not applied
3. **Given** a user is viewing indicator settings, **When** they look at the parameters tab, **Then** they see the parameter name, current value, default value, and min/max range for each parameter
4. **Given** a user has configured custom parameters, **When** they refresh the page, **Then** the custom parameters are preserved

---

### User Story 4 - Toggle Indicator Visibility (Priority: P3)

Traders sometimes want to temporarily hide an indicator without removing it, allowing them to focus on specific indicators or compare scenarios. A user needs a way to hide and show indicators while keeping their configuration intact.

**Why this priority**: Hide/show is a convenience feature that improves workflow but doesn't block core functionality. Users can achieve similar results by removing and re-adding indicators (albeit less conveniently).

**Independent Test**: Can be tested by adding an indicator, hiding it via the context menu, verifying the line disappears but the indicator remains in the list, then showing it again. Delivers workflow convenience.

**Acceptance Scenarios**:

1. **Given** a user has multiple overlay indicators, **When** they hover over an indicator name and click "Hide", **Then** the indicator line disappears but the indicator remains in the list with a grayed-out appearance
2. **Given** a user has hidden an indicator, **When** they click "Show" (or hover and click the visibility toggle), **Then** the indicator line reappears on the chart
3. **Given** a user has hidden indicators, **When** they refresh the page, **Then** the hidden state is preserved
4. **Given** a user is comparing two scenarios, **When** they hide one indicator and show another, **Then** only the visible indicators render on the chart

---

### User Story 5 - Access Context Menu Actions on Indicators (Priority: P3)

A user wants quick access to indicator management actions (hide, settings, source code, remove) by hovering over the indicator name in the legend. This provides efficient access to common actions without navigating through menus.

**Why this priority**: The context menu improves discoverability and efficiency but users can access the same actions through other means (settings panel). This is a UX enhancement rather than a blocker.

**Independent Test**: Can be tested by hovering over an indicator name and verifying a menu appears with the four action buttons, each triggering the correct behavior. Delivers improved UX and action discoverability.

**Acceptance Scenarios**:

1. **Given** a user has an overlay indicator on their chart, **When** they hover over the indicator name in the legend, **Then** a context menu appears with Hide, Settings, Source Code, and Remove buttons
2. **Given** a context menu is visible, **When** the user moves their cursor away, **Then** the menu disappears
3. **Given** a context menu is displayed, **When** they click the Settings button, **Then** the indicator settings dialog opens
4. **Given** a context menu is displayed, **When** they click the Remove button, **Then** the indicator is removed from the chart and list

---

### User Story 6 - View Indicator Source Code (Priority: P4)

Advanced traders and auditors want to inspect the Pine Script source code for an indicator to understand exactly how it calculates values. This provides transparency and helps users validate indicator correctness.

**Why this priority**: Source code inspection is valuable for transparency and trust, but most users will not need this feature frequently. It's a nice-to-have for power users and auditors.

**Independent Test**: Can be tested by clicking "Source Code" from the context menu and verifying a modal displays the indicator's Pine Script with syntax highlighting. Delivers transparency and trust.

**Acceptance Scenarios**:

1. **Given** a user has an overlay indicator, **When** they click "Source Code" from the context menu, **Then** a modal displays the indicator's Pine Script source code with syntax highlighting
2. **Given** the source code modal is open, **When** they click the close button, **Then** the modal closes
3. **Given** a user is viewing source code, **When** they look at the code, **Then** they see variable definitions, calculation logic, and plot statements

---

### Edge Cases

- What happens when a user adds more than 10 overlay indicators to a single chart?
  - System displays a warning when attempting to add the 11th indicator about potential performance degradation but allows the action
  - Chart rendering may slow down with many indicators
- How does the system handle invalid parameter values entered by users?
  - Validation prevents submission with clear error messages
  - Input fields show min/max ranges and default values
- What happens when an indicator calculation returns no data (all null values)?
  - Indicator line does not appear on chart
  - User sees a message indicating no data available
- What happens when localStorage is full or unavailable?
  - System gracefully degrades: changes apply for current session but are not persisted
  - User is notified that preferences cannot be saved
- How does the system behave when the chart displays a very short time range?
  - Indicator lines render based on available data points
  - Lines may appear shorter than price series if indicator requires warmup period
- What happens when a user changes parameters on a hidden indicator?
  - Parameter changes are applied but line remains hidden
  - Changes become visible when indicator is shown
- What happens when source code is not available for an indicator?
  - System displays a placeholder message: "Source code not available for this indicator"
  - No error or crash; the Source Code action remains available but shows placeholder

## Requirements

### Functional Requirements

- **FR-001**: System MUST render overlay indicator values as lines on the price chart when an indicator is added
- **FR-002**: System MUST display each overlay indicator using the default color specified in the indicator metadata
- **FR-003**: System MUST update indicator lines in real-time when new price data arrives
- **FR-004**: System MUST allow users to open a settings dialog for any overlay indicator via hover context menu
- **FR-005**: System MUST display indicator settings dialog with three tabs: Inputs, Style, and Visibility
- **FR-006**: System MUST show all configurable parameters in the Inputs tab with name, current value, default value, and valid range
- **FR-007**: System MUST validate parameter values against min/max ranges before applying changes
- **FR-008**: System MUST provide a native browser color picker (`<input type="color">`) accepting hex color codes (e.g., "#FF5733") for each color channel defined in the indicator metadata
- **FR-009**: System MUST provide line style selection options (solid for MVP; dashed and dotted options are deferred to future enhancement pending Lightweight Charts support or custom rendering implementation)
- **FR-010**: System MUST apply visual style changes immediately to the chart without requiring confirmation
- **FR-011**: System MUST allow users to toggle indicator visibility without removing the indicator
- **FR-012**: System MUST visually distinguish hidden indicators (grayed out appearance)
- **FR-013**: System MUST allow users to permanently remove an indicator from the chart
- **FR-014**: System MUST display a context menu when hovering over an indicator name in the legend
- **FR-015**: System MUST provide actions in the context menu: Hide, Settings, Source Code, Remove
- **FR-016**: System MUST display indicator source code in a read-only modal with syntax highlighting when available from backend IndicatorInfo metadata; otherwise, display a clear placeholder message indicating source code is not available
- **FR-017**: System MUST persist all indicator configurations (parameters, styles, visibility) to local storage
- **FR-018**: System MUST restore saved indicator configurations when the user returns to the chart
- **FR-019**: System MUST generate a unique identifier for each indicator instance using UUID v4 (random) format, e.g., "a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d"
- **FR-020**: System MUST prevent parameter values outside valid ranges from being submitted
- **FR-021**: System MUST display error messages when validation fails
- **FR-022**: System MUST apply parameter changes and recalculate indicator values immediately
- **FR-023**: System MUST support up to 10 concurrent overlay indicators per chart with acceptable performance
- **FR-024**: System MUST position context menu near the indicator name without obscuring chart data

### Key Entities

- **Indicator Instance**: Represents a single overlay indicator added to a chart, including unique identifier, symbol, indicator type, calculated data points, current parameters, visual style configuration, and visibility state. Stored in localStorage as `indicator_instance:${id}` where `${id}` is the UUID v4 identifier (e.g., `indicator_instance:ind-1735198400000-abc123`), with structure: `{id, symbol, indicatorType, params: {...}, style: {...}, visible: true, addedAt}`
- **Indicator List**: Maintains an ordered array of all indicator instance IDs for the current chart. Stored in localStorage as `indicator_list:${symbol}` where `${symbol}` is the chart symbol (e.g., `indicator_list:AAPL`): `["id1", "id2", ...]`
- **Indicator Style**: Defines visual properties for an indicator instance, including color settings (primary, secondary, tertiary), line style (solid/dashed/dotted), line width, display precision, and visibility flags for labels, status line, and legend
- **Indicator Metadata**: Descriptive information about an indicator type, including name, description, Pine Script source code, parameter definitions with constraints, default color scheme, and default visual style
- **Parameter Definition**: Defines a single configurable parameter for an indicator, including name, data type, default value, minimum allowed value, maximum allowed value, and human-readable description

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can add an overlay indicator and see it rendered on the chart within 500 milliseconds
- **SC-002**: Chart redraws complete within 100 milliseconds when an indicator is added or parameters change
- **SC-003**: Users can change indicator visual properties (color, line style) and see changes applied immediately without delays perceptible to human users
- **SC-004**: Users can successfully complete parameter editing for any indicator with no more than 3 clicks from the chart view
- **SC-005**: 95% of users can hide and show indicators without referring to documentation
- **SC-006**: Users can access source code for any indicator in 2 or fewer clicks
- **SC-007**: All indicator configurations persist across browser sessions with 100% reliability when local storage is available
- **SC-008**: System supports 10 concurrent overlay indicators with chart interactions remaining smooth (60 frames per second scrolling/zooming)
- **SC-009**: Indicator calculation and rendering completes within 100ms for any single indicator update (add, parameter change, or visibility toggle)
- **SC-010**: Context menu appears within 200 milliseconds of hovering over an indicator name
- **SC-011**: Parameter validation prevents invalid values with 100% accuracy and provides clear feedback
