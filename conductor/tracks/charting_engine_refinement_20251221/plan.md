# Plan: Charting Engine Enhancement (Indicators & Layout Parity)

## Phase 1: Responsive Layout & Unified Resizing [checkpoint: 38ea677]
- [x] Task: Write failing tests for unified viewport resizing using a mocked `ResizeObserver`, verifying container-driven sizing instead of window events (Red Phase). 1afe023
- [x] Task: Implement centralized `ResizeObserver` in `App.tsx` to drive dimensions for all panes (Green Phase). 1afe023
- [x] Task: Remove per-component `window.resize` handlers in `ChartComponent` and `IndicatorPane` to avoid duplicate logic (Green Phase). 1afe023
- [x] Task: Refactor the main layout to a 100% vertical flex system, removing hardcoded heights and the indicator stack cap (Green Phase). 1afe023
- [x] Task: Conductor - User Manual Verification 'Responsive Layout & Unified Resizing' (Protocol in workflow.md) 38ea677

## Phase 2: Metadata Schema & Data Integrity [checkpoint: 1afe023]
- [x] Task: Extend the `IndicatorMetadata` interface to support snake_case `series_metadata` (with `field` mapping) and `reference_levels` (Green Phase). 1afe023
- [x] Task: Write failing tests for metadata parsing and `formatDataForChart` null-omission behavior (Red Phase). 1afe023
- [x] Task: Move `formatDataForChart` to a pure utility module and refactor it to drop missing values instead of zero-filling (Green Phase). 1afe023
- [x] Task: Backend/API contract update: ensure the indicator service returns `metadata.series_metadata[]` and `metadata.reference_levels[]` for cRSI and TDFI (Green Phase). 1afe023
- [x] Task: Conductor - User Manual Verification 'Metadata Schema & Data Integrity' (Protocol in workflow.md) 1afe023

## Phase 3: Multi-Series Indicator Rendering [checkpoint: 1afe023]
- [x] Task: Write failing tests for `IndicatorPane` multi-series, price line rendering, and scale range binding using mocked `lightweight-charts` APIs (Red Phase). 1afe023
- [x] Task: Enhance `IndicatorPane` to dynamically render multiple line/histogram series based on the new metadata schema (Green Phase). 1afe023
- [x] Task: Implement dashed horizontal levels using the `createPriceLine` API within `IndicatorPane` (Green Phase). 1afe023
- [x] Task: Wire `metadata.scale_ranges` (min/max) into the pane's vertical price scale logic, applying the fixed range via the chart's price-scale API on every update (Green Phase). 1afe023
- [x] Task: Conductor - User Manual Verification 'Multi-Series Indicator Rendering' (Protocol in workflow.md) 1afe023

## Phase 4: Visible Range Synchronization [checkpoint: 38ea677]
- [x] Task: Expose the main chart instance or `timeScale` handle to `App.tsx` via a ref or controller pattern (Green Phase). 38ea677
- [x] Task: Write failing tests for one-way visible range synchronization and proper listener cleanup (Red Phase). 38ea677
- [x] Task: Implement visible range listeners on the main chart to synchronize the x-axis of all active `IndicatorPane` components (Green Phase). 38ea677
- [x] Task: Implement cleanup logic to unsubscribe visible-range listeners on unmount or indicator toggle (Green Phase). 38ea677
- [x] Task: Optimize synchronization performance to ensure smooth, time-aligned panning and zooming (Green Phase). 38ea677
- [x] Task: Conductor - User Manual Verification 'Visible Range Synchronization' (Protocol in workflow.md) 38ea677
