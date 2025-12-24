# Feature Specification: Advanced Indicators and Indicator-Driven Alerts

**Feature Branch**: `003-advanced-indicators`
**Created**: 2025-12-24
**Status**: Draft
**Input**: User description: "Add full support for advanced indicators (cRSI, TDFI, ADXVMA, EMAs/SMAs) with a clean backend→frontend contract and TradingView‑style behavior. The backend must expose indicator outputs and rich metadata: main numeric series, optional bands/levels and histograms, overlay vs pane display_type, color schemes (including exact TradingView‑matching colors for lines/bands), scale ranges, and discrete alertable signals or regimes (e.g., -1/0/1, "bullish/bearish/transition"). The frontend must render these indicators in the new Supercharts UI (panes or overlays), sharing crosshair and zoom/pan with price, and allow per‑symbol indicator toggles, using generic helpers (formatDataForChart, splitSeriesByThresholds, splitSeriesByTrend) instead of per‑indicator custom code. Implement indicator‑driven alerts such as "cRSI crosses upper band", "TDFI turns positive", and "ADXVMA slope changes", integrated into the existing alert engine and alert history. Aim for TradingView‑like parity for these three flagship indicators while keeping the system generic so that adding a new indicator (or a limited Pine‑style import) is mostly: implement its math, fill an output + metadata object, and register alert templates—without touching chart rendering logic."

## Clarifications

### Session 2025-12-24

- Q: What happens if alert delivery mechanism fails (notification service down, network issue)? → A: Store failed alerts for retry with exponential backoff, cap retry attempts at 5

## User Scenarios & Testing

### User Story 1 - Generic Indicator Metadata Contract (Priority: P1)

Traders want to view any technical indicator on their charts without waiting for custom frontend code for each new indicator. When the backend adds a new indicator with standardized metadata, users should immediately see it rendered correctly in the chart with appropriate colors, bands, and display type (overlay or separate pane).

**Why this priority**: This is the foundational infrastructure that enables all other indicators. Without a generic metadata contract, each new indicator requires custom frontend code, slowing down feature delivery.

**Independent Test**: Can be tested by adding a new indicator type to the backend with only metadata configuration (no frontend changes) and verifying it appears in the indicator selector and renders correctly on the chart.

**Acceptance Scenarios**:

1. **Given** the backend exposes an indicator with metadata specifying display_type="pane", color_scheme with TradingView colors, and reference_levels, **When** a user adds this indicator to their chart, **Then** the indicator appears in a separate pane below the price chart with the specified colors and reference lines drawn at the specified levels
2. **Given** the backend exposes an indicator with metadata specifying display_type="overlay", **When** a user adds this indicator to their chart, **Then** the indicator renders directly on the price chart (same pane as candles)
3. **Given** indicator metadata includes thresholds for bullish/bearish zones, **When** the indicator values cross these thresholds, **Then** the line colors change according to the color_scheme rules

---

### User Story 2 - Per-Symbol Indicator Toggles and Persistence (Priority: P1)

Traders want to customize their chart layout per symbol - some indicators work better for certain stocks or market conditions. Users need to quickly toggle indicators on/off for each symbol and have these preferences remembered when they return to that symbol.

**Why this priority**: This is core usability. Without per-symbol persistence, users would need to reconfigure indicators every time they switch symbols, which is frustrating and inefficient.

**Independent Test**: Can be tested by adding indicators for one symbol (e.g., AAPL), switching to another symbol (e.g., TSLA) with different indicators, then switching back to AAPL and verifying the original indicators are restored.

**Acceptance Scenarios**:

1. **Given** a user has added cRSI and TDFI indicators for symbol AAPL, **When** they switch to symbol TSLA, **Then** the chart shows only TSLA price data with no indicators (or TSLA's previously saved indicators)
2. **Given** a user has configured indicators for symbol AAPL and saved the layout, **When** they navigate away and later return to AAPL, **Then** all previously enabled indicators and their settings are restored automatically
3. **Given** a user is viewing symbol AAPL with active indicators, **When** they toggle an indicator off using the indicator visibility control, **Then** that indicator is immediately hidden from the chart but remains in the saved layout for AAPL

---

### User Story 3 - Generic Frontend Rendering Helpers (Priority: P1)

Developers want to add new indicators without writing custom chart rendering code. The frontend should provide generic helper functions that transform indicator data into chart-compatible format, handle color changes based on thresholds, and split series for trend visualization.

**Why this priority**: This enables the extensibility goal. Without generic helpers, every new indicator requires custom frontend code, defeating the purpose of the metadata contract.

**Independent Test**: Can be tested by adding a new indicator type that uses the generic helpers (formatDataForChart, splitSeriesByThresholds, splitSeriesByTrend) and verifying it renders correctly without indicator-specific rendering logic.

**Acceptance Scenarios**:

1. **Given** an indicator output includes timestamps and numeric values, **When** processed through formatDataForChart, **Then** the output is converted to the chart library's expected time/value format
2. **Given** an indicator includes a "signal" series with values -1, 0, 1 (bearish/neutral/bullish), **When** processed through splitSeriesByThresholds, **Then** the data is split into separate series for each signal state with appropriate colors
3. **Given** an indicator specifies color_mode="threshold" with high/low thresholds, **When** rendered on the chart, **Then** line segments above the threshold use one color and segments below use another color

---

### User Story 4 - Three Flagship Indicators with TradingView Parity (Priority: P1)

Traders want access to the three core indicators (cRSI, TDFI, ADXVMA) that match TradingView's behavior and appearance exactly, including colors, bands, signal interpretation, and visual styling.

**Why this priority**: These are the primary indicators users have requested. They serve as proof that the generic system works and provide immediate value.

**Independent Test**: Can be tested by opening TradingView side-by-side with our application for the same symbol and interval, adding each indicator, and visually confirming the shapes, colors, bands, and values match.

**Acceptance Scenarios**:

1. **Given** a user adds cRSI indicator to their chart, **When** viewing the indicator pane, **Then** they see the main cRSI line in cyan (#00bcd4), upper/lower bands in light cyan (#b2ebf2), and the line oscillates between 0-100 with default reference lines at 70/30
2. **Given** a user adds TDFI indicator to their chart, **When** viewing the indicator pane, **Then** they see the main TDFI line colored by threshold (green when positive, red when negative), with reference lines at 0.05 and -0.05, and the histogram showing bullish/bearish momentum
3. **Given** a user adds ADXVMA indicator to their chart, **When** viewing the price chart, **Then** they see the ADXVMA line overlaid on price in blue (#2962ff), changing color when slope direction changes, with the line adjusting smoothly based on trend strength

---

### User Story 5 - Indicator-Driven Alerts (Priority: P2)

Traders want to receive alerts when indicators generate specific signals (e.g., cRSI crosses upper band, TDFI turns positive, ADXVMA slope changes). These alerts should integrate seamlessly with the existing alert system and history.

**Why this priority**: This builds on the existing alert infrastructure and adds significant value by automating monitoring of indicator conditions.

**Independent Test**: Can be tested by creating an alert rule for "cRSI crosses above 70", waiting for market data to trigger this condition, and verifying the alert appears in the alert history with the correct timestamp and message.

**Acceptance Scenarios**:

1. **Given** a user creates an alert for "cRSI crosses upper band", **When** cRSI value crosses from below 70 to above 70, **Then** an alert is triggered with message "cRSI crossed above upper band (70)" and added to alert history
2. **Given** a user creates an alert for "TDFI turns positive", **When** TDFI value crosses from negative to positive (above 0.05), **Then** an alert is triggered with message "TDFI turned bullish" and the alert shows the exact value at trigger time
3. **Given** a user creates an alert for "ADXVMA slope changes", **When** the slope of ADXVMA changes from rising to falling or vice versa, **Then** an alert is triggered indicating the new direction (bullish/bearish slope)

---

### User Story 6 - Moving Average Indicators (EMA/SMA) (Priority: P2)

Traders want access to basic moving average indicators (Exponential Moving Average and Simple Moving Average) with configurable periods, displayed as overlays on the price chart.

**Why this priority**: These are foundational indicators that many traders use as building blocks for more complex strategies. They're simpler than the flagship indicators but still important.

**Independent Test**: Can be tested by adding EMA with period 20 and SMA with period 50 to a chart, verifying both lines appear on price with different colors, and the values match standard calculations.

**Acceptance Scenarios**:

1. **Given** a user adds an EMA indicator with period 20, **When** viewing the price chart, **Then** a line overlaid on price shows the 20-period exponential moving average with the specified color
2. **Given** a user adds an SMA indicator with period 50, **When** viewing the price chart, **Then** a line overlaid on price shows the 50-period simple moving average with a different color than the EMA for distinction
3. **Given** a user has both EMA(20) and SMA(50) on their chart, **When** price bars are displayed, **Then** users can clearly see the relationship between price and both moving averages

---

### User Story 7 - Extensibility for New Indicators (Priority: P3)

Developers want to add new indicators without modifying chart rendering logic. The system should allow adding a new indicator by implementing its math calculation, defining its metadata, and registering alert templates.

**Why this priority**: This demonstrates the system's extensibility but isn't critical for initial rollout since the flagship indicators provide the core value.

**Independent Test**: Can be tested by adding a completely new indicator (not cRSI/TDFI/ADXVMA) through the backend only, verifying it appears in the UI and renders correctly, and creating alerts for it without any frontend code changes.

**Acceptance Scenarios**:

1. **Given** a developer implements a new indicator with metadata in the backend, **When** the frontend fetches indicators, **Then** the new indicator appears in the indicator selector dropdown
2. **Given** a developer registers alert templates for the new indicator, **When** a user creates alerts, **Then** the alert condition options include the new indicator's specific conditions
3. **Given** a new indicator is added with display_type="pane", **When** a user adds it to their chart, **Then** it renders in a new pane with the correct colors and reference levels as specified in metadata

---

### Edge Cases

- What happens when an indicator calculation returns NaN or null values for early periods (insufficient data)?
- How does the system handle indicators with different time ranges than the price data (e.g., indicator needs 200 periods but only 50 are available)?
- What happens when a user creates an alert for an indicator that is later disabled or removed from their chart?
- How does the system handle rapid signal changes (e.g., TDFI oscillating around the threshold multiple times in seconds)?
- What happens when switching between symbols with different indicator configurations while alerts are active?
- How does the system display indicators when the chart is zoomed out to show very long time ranges (performance)?
- What happens when indicator metadata specifies conflicting or invalid values (e.g., min scale > max scale)?
- What happens if alert delivery fails (notification service unavailable, network error)? The system stores failed alerts and retries with exponential backoff, capped at 5 retry attempts

## Requirements

### Functional Requirements

**Backend Indicator Metadata Contract:**

- **FR-001**: The backend MUST expose indicator metadata that includes: display_type (overlay or pane), color_mode (single/threshold/gradient), color_schemes object mapping states to hex colors, thresholds with high/low values, scale_ranges with min/max values, series_metadata describing each series (field, role, label, line_color, line_style, line_width, display_type), and reference_levels with value/line_color/line_label
- **FR-002**: The backend MUST return indicator data with a consistent structure: timestamps array, main series array(s), optional band series arrays, optional signal array, and metadata object
- **FR-003**: For cRSI indicator, the backend MUST provide: crsi main series (0-100 range), upper_band series (default 70), lower_band series (default 30), metadata specifying display_type="pane", color_mode="single", cyan line color (#00bcd4), light cyan band colors (#b2ebf2), scale_ranges min=0 max=100, and reference_levels at 70 and 30
- **FR-004**: For TDFI indicator, the backend MUST provide: tdfi main series (-1 to 1 range), tdfi_signal series (-1/0/1 for bearish/neutral/bullish), metadata specifying display_type="pane", color_mode="threshold" with threshold values 0.05 and -0.05, green color for positive (#26a69a), red color for negative (#ef5350), scale_ranges min=-1 max=1, and reference_levels at 0.05 and -0.05
- **FR-005**: For ADXVMA indicator, the backend MUST provide: adxvma main series (price scale), metadata specifying display_type="overlay", color_mode="single", blue line color (#2962ff), line_width=2, and slope-based signal classification
- **FR-006**: For EMA indicators, the backend MUST provide: ema main series (price scale), metadata specifying display_type="overlay", configurable period parameter, and unique color per period
- **FR-007**: For SMA indicators, the backend MUST provide: sma main series (price scale), metadata specifying display_type="overlay", configurable period parameter, and unique color per period
- **FR-008**: The backend MUST support discrete signal output for indicators: -1 (bearish), 0 (neutral), 1 (bullish), or string-based regimes ("bullish", "bearish", "transition")
- **FR-009**: The backend MUST include alertable condition templates for each indicator: cRSI (crosses_upper, crosses_lower, crosses_mid), TDFI (turns_positive, turns_negative, enters_overbought, enters_oversold), ADXVMA (slope_bullish, slope_bearish, price_above, price_below)

**Frontend Generic Rendering:**

- **FR-010**: The frontend MUST provide a generic formatDataForChart helper that converts indicator output (timestamps array, values array) to the chart library's expected time/value coordinate format
- **FR-011**: The frontend MUST provide a generic splitSeriesByThresholds helper that converts a single series with signal values into multiple series based on threshold crossings, with each series colored according to metadata color_schemes
- **FR-012**: The frontend MUST provide a generic splitSeriesByTrend helper that detects trend changes in a series and creates separate series for each trend segment with appropriate colors
- **FR-013**: The frontend MUST render indicators in panes when display_type="pane" by creating a new chart pane below the main price chart
- **FR-014**: The frontend MUST render indicators as overlays when display_type="overlay" by adding series to the main price chart pane
- **FR-015**: The frontend MUST apply colors from indicator metadata color_schemes to series lines, bands, and histograms
- **FR-016**: The frontend MUST draw reference_levels as horizontal dashed lines with labels at the specified values and colors
- **FR-017**: The frontend MUST use scale_ranges from metadata to set the Y-axis scale for pane indicators (min/max values)
- **FR-018**: The frontend MUST share crosshair and zoom/pan state between all indicator panes and the main price chart
- **FR-019**: The frontend MUST support histogram display_type by rendering vertical bars from a zero baseline for each timestamp

**Per-Symbol Persistence:**

- **FR-020**: The frontend MUST store per-symbol enabled indicators list in local storage, keyed by symbol
- **FR-021**: The frontend MUST restore indicator configuration when switching back to a previously viewed symbol
- **FR-022**: The frontend MUST clear indicators from the chart when switching to a new symbol, then load and render the new symbol's saved indicators
- **FR-023**: The frontend MUST persist indicator-specific parameters (e.g., periods for EMA/SMA, threshold levels) per symbol

**Indicator Toggle Controls:**

- **FR-024**: The frontend MUST provide visibility toggle controls in the indicator toolbar for each active indicator
- **FR-025**: The frontend MUST show indicator visibility status (visible/hidden) in the toolbar or settings panel
- **FR-026**: The frontend MUST allow users to temporarily hide an indicator without removing it from their saved layout

**Alert Integration:**

- **FR-027**: The backend alert engine MUST support indicator-based conditions: indicator_name + condition_type + threshold value
- **FR-028**: The backend alert engine MUST evaluate indicator conditions on each new data point received
- **FR-029**: The backend MUST prevent duplicate alert triggers within a cooldown period for the same indicator+condition+threshold combination
- **FR-030**: The backend MUST store alert history with timestamp, symbol, indicator_name, condition, threshold, and triggered_value
- **FR-031**: The frontend MUST allow users to create alerts by selecting: indicator, condition type (crosses_above, crosses_below, turns_positive, turns_negative, slope_bullish, slope_bearish), and threshold value
- **FR-032**: The frontend MUST display indicator-driven alerts in the alert history with indicator name, condition description, and value at trigger time
- **FR-033**: The backend MUST calculate slope-based conditions by comparing current indicator value to previous value (e.g., slope positive if current > previous)
- **FR-034**: The backend MUST support signal-based alerts where discrete signal values change (e.g., TDFI signal changes from 0 to 1)
- **FR-035**: The backend MUST store failed alert deliveries and retry with exponential backoff, capped at 5 retry attempts before marking as failed

**Extensibility:**

- **FR-036**: The backend MUST support registering new indicators without code changes to chart rendering logic
- **FR-037**: The backend MUST provide an indicator registry where new indicators can be added with: calculation function, metadata template, and alert condition templates
- **FR-038**: The frontend indicator selector MUST dynamically populate from available indicators returned by the backend API

**Data Quality:**

- **FR-039**: The backend MUST handle null/NaN values in indicator calculations by returning null for those timestamps
- **FR-040**: The frontend MUST skip null values when rendering indicator lines (creating gaps in the chart)
- **FR-041**: The backend MUST ensure all timestamp arrays align with candle data timestamps for proper chart synchronization
- **FR-042**: When an indicator requires more historical data than is available (e.g., needs 200 periods but only 50 exist), the backend MUST return all available data points with null values for the insufficient period prefix, and the frontend MUST render the available portion without error
- **FR-043**: When an indicator signal oscillates rapidly around a threshold (e.g., TDFI crossing 0.05 multiple times within seconds), the alert engine MUST enforce a minimum 5-second cooldown between triggers for the same alert to prevent alert spam

### Key Entities

- **IndicatorMetadata**: Configuration object describing how to display an indicator (display_type, colors, thresholds, scale, series definitions, reference levels)
- **IndicatorOutput**: Data returned from backend containing timestamps, main series values, optional bands/signals, and metadata
- **IndicatorAlertRule**: User-defined alert rule linking an indicator, condition type, and threshold value
- **AlertTrigger**: Record of when an alert condition was met, with timestamp, symbol, indicator details, and value
- **IndicatorState**: Per-symbol user preferences storing which indicators are enabled and their parameters

## Success Criteria

### Measurable Outcomes

- **SC-001**: Developers can add a new indicator with full chart rendering and alert support by implementing only the calculation function and metadata (no frontend rendering code changes)
- **SC-002**: Visual appearance of cRSI, TDFI, and ADXVMA indicators matches TradingView within 95% similarity (colors, shapes, band positions, signal interpretations)
- **SC-003**: Users can switch between symbols and have their indicator configurations restored in under 1 second
- **SC-004**: Indicator-driven alerts trigger within 2 seconds of the condition occurring in market data
- **SC-005**: The system supports at least 10 different indicators with the generic metadata contract without performance degradation
- **SC-006**: Charts with 5 active indicator panes maintain 60fps rendering performance during pan and zoom operations
- **SC-007**: 90% of users can successfully create an indicator-driven alert on their first attempt without documentation

### Assumptions

1. The existing Supercharts UI (feature 002) provides the chart rendering foundation with lightweight-charts
2. The existing alert engine (feature 001) provides the basic alert infrastructure (trigger conditions, cooldown, history)
3. Indicator calculations are performed on the backend using pandas/numpy
4. Colors referenced (cyan #00bcd4, light cyan #b2ebf2, green #26a69a, red #ef5350, blue #2962ff) match TradingView's default color scheme for these indicators
5. Per-symbol indicator preferences are stored in browser local storage (not requiring backend persistence for this phase)
6. Alert evaluation happens on each new candle received (not real-time tick data)
7. Generic rendering helpers (formatDataForChart, splitSeriesByThresholds, splitSeriesByTrend) are implemented in TypeScript in the frontend

### Dependencies

- **Feature 001 - Initial Setup**: Provides the backend infrastructure, database models, and alert engine foundation
- **Feature 002 - Supercharts Visuals**: Provides the chart rendering UI, indicator panes, and crosshair/zoom/pan synchronization

### Parity Acceptance

**Feature 005 - Indicator Parity**: Final acceptance of the flagship indicators (cRSI, TDFI, ADXVMA) requires passing the parity validation checks defined in `005-indicator-parity`. This includes:

- Visual parity against TradingView Supercharts reference screenshots
- Data value validation against frozen fixture data
- Crosshair and zoom/pan synchronization across all panes
- Color and regime rendering matching specified hex codes

The 003 feature is considered complete when indicators are functionally implemented and rendering, but full acceptance requires the parity checks in 005 to pass for the agreed symbols and timeframes.

### Out of Scope for MVP

- Real-time streaming indicator updates (evaluation per candle only)
- Custom indicator formulas created by users through a UI
- Pine Script import functionality (limited extensibility through metadata contract only)
- Backtesting alerts on historical data
- Indicator performance statistics or win rate tracking
- Combining multiple indicators in complex alert conditions (e.g., "cRSI crosses above 70 AND TDFI is positive")
- Custom drawing tools based on indicator signals
- Exporting indicator data to CSV
- Social sharing of indicator configurations
