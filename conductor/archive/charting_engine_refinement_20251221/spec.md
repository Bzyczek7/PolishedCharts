# Specification: Charting Engine Enhancement (Indicators & Layout Parity)

## 1. Overview
This track elevates the charting and indicator rendering capabilities of TradingAlert to professional standards. It focuses on responsive vertical scaling, metadata-driven multi-series rendering (bands/signals), one-way visible range synchronization, and improved data integrity for oscillators.

## 2. Functional Requirements

### 2.1. Responsive Chart & Pane Sizing
- **Unified ResizeObserver:** Implement a centralized observer in `App.tsx` that monitors the viewport container and updates dimensions for the main chart and all indicator panes simultaneously.
- **Dynamic Height & Flex Layout:** 
    - Remove the hardcoded 400px height and the `max-h-[40%]` cap from the indicator stack.
    - Implement a "Flex Pane" system where the main chart area and indicator panes collectively fill 100% of the available vertical space.
    - Default distribution: Main Chart (60-70%), Indicator Stack (30-40% shared among active panes).

### 2.2. Advanced Indicator Rendering (Metadata-Driven)
- **Metadata Schema Extension (snake_case):** Expand `IndicatorMetadata` to include:
    - `series_metadata`: A list defining `field` (maps to data key e.g. 'crsi'), `role` (`main`, `signal`, `band`), `label`, `line_color`, `line_style` (solid/dashed), and `line_width`.
    - `reference_levels`: A list of constant values (e.g., 30, 70) with associated `line_color` and `line_label`.
- **Scaling Logic:** Wire `metadata.scale_ranges` (min/max) directly into the pane's vertical price scale logic using the chart's price-scale API on every resize or data update to ensure oscillators stay bounded correctly.
- **Multi-Series Support:** Update `IndicatorPane` to dynamically iterate through the metadata and render all defined series (e.g., cRSI line + upper/lower bands, TDFI histogram + signal).
- **Data Integrity:** Refactor `formatDataForChart` to omit `null` or `undefined` values instead of zero-filling, ensuring oscillators and bands do not "spike" incorrectly.

### 2.3. Visible Range Synchronization
- **One-Way Sync:** Panning or zooming the **main chart** must automatically update the `visibleRange` of all active indicator panes to maintain time-alignment.
- **Cleanup:** All `visibleRange` subscriptions must be explicitly unsubscribed on component unmount or when an indicator is toggled off to prevent memory leaks and duplicate listeners.
- **Feedback Loop Prevention:** Ensure syncing logic only flows from main chart to panes to avoid performance issues or UI jitter.

## 3. Non-Functional Requirements
- **Visual Palette:** Reference levels and bands must use the high-contrast slate/blue/rose palette defined in `product-guidelines.md`.
- **Transitions:** Layout adjustments (e.g., when sidebar toggles) should be handled gracefully by the unified `ResizeObserver`.

## 4. Acceptance Criteria
- [ ] Main chart and indicator panes collectively fill 100% of the vertical viewport.
- [ ] **cRSI Pane:** Renders the main line, `upper_band`, `lower_band`, and dashed reference lines at 30 and 70.
- [ ] **TDFI Pane:** Renders the histogram, `tdfi_signal` line, and reference levels at 0.05 and -0.05.
- [ ] Panning the main chart causes all indicator panes to follow in perfect time-alignment.
- [ ] Visible-range listeners are properly cleaned up on pane removal.
- [ ] Oscillators no longer show spikes to 0 when data is missing.
- [ ] Chart and Indicator panes resize correctly when the sidebar width changes (driven by container observer).

## 5. Out of Scope
- Interactive drawing tools.
- Bi-directional syncing (Panes driving the Main Chart).
- Manual "drag-to-resize" for individual pane borders.
