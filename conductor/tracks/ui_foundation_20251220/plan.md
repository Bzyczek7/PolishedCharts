# Plan: TradingView-style UI/UX Foundation

## Phase 1: Layout Shell & Sidebar Foundation [checkpoint: b2f6431]
- [x] Task: Install and configure Shadcn/UI and required dependencies (Radix UI, Lucide React, cmdk for Command). 2f60ede
- [x] Task: Write failing tests for sidebar rendering and initial collapsed/expanded state (Red Phase). b2f6431
- [x] Task: Create the main responsive layout shell with a collapsible right sidebar component structure to pass rendering tests (Green Phase). f9c08ff
- [x] Task: Write failing tests for sidebar state transitions and keyboard shortcuts (Red Phase). b2f6431
- [x] Task: Implement sidebar collapse/expand logic with `Ctrl+B` shortcut and 300ms transitions (Green Phase). d45ee65
- [x] Task: Write failing tests for localStorage persistence of sidebar state (Red Phase). b2f6431
- [x] Task: Implement localStorage persistence for sidebar state (width, collapsed state, active tab) (Green Phase). b58aaff
- [x] Task: Conductor - User Manual Verification 'Layout Shell & Sidebar Foundation' (Protocol in workflow.md)

## Phase 2: Top Toolbar & Command Palettes [checkpoint: 80fdf97]

- [x] Task: Write failing tests for Top Toolbar component rendering (Red Phase). b2f6431

- [x] Task: Create the Top Toolbar component with placeholders for all selectors (Green Phase). 42d2ab8

- [x] Task: Write failing tests for Symbol Search Command Palette trigger and modal opening (Red Phase). b2f6431

- [x] Task: Implement Symbol Search Command Palette (`Ctrl+K`) using Shadcn `Command` component (Green Phase). 0b16a59

- [x] Task: Write failing tests for fuzzy search filtering and keyboard navigation (Red Phase). 0b16a59

- [x] Task: Implement fuzzy search logic with mock symbol data and keyboard navigation (Green Phase). 0b16a59

- [x] Task: Write failing tests for Indicators Command Palette trigger and categorization (Red Phase). b2f6431

- [x] Task: Implement Indicators Selector Command Palette (`Ctrl+I`) with categorization (Green Phase). 5bbb7e8

- [x] Task: Write failing tests for Timeframe selector state and Chart Style dropdown (Red Phase). 80fdf97

- [x] Task: Implement Timeframe and Chart Style selectors (Dropdowns) (Green Phase). 80fdf97

- [x] Task: Conductor - User Manual Verification 'Top Toolbar & Command Palettes'

 (Protocol in workflow.md)

## Phase 3: Watchlist Management & Real-time Visuals [checkpoint: 6e28e8b]
- [x] Task: Write failing tests for Watchlist container rendering and "+ Add Symbol" button (Red Phase). b2f6431
- [x] Task: Implement the Watchlist container with "+ Add Symbol" integration (Green Phase). ac8fe3f
- [x] Task: Write failing tests for Watchlist empty state display (Red Phase). ac8fe3f
- [x] Task: Implement "Add your first symbol" empty state (Green Phase). ac8fe3f
- [x] Task: Write failing tests for Watchlist Item component with price flash animations (Red Phase). ac8fe3f
- [x] Task: Develop Watchlist Item component with price flash animations (Green/Red) and connection status dots (Green Phase). ac8fe3f
- [x] Task: Write failing tests for Drag-and-Drop reordering and localStorage persistence (Red Phase). ac8fe3f
- [x] Task: Integrate Drag-and-Drop reordering for the watchlist with `localStorage` persistence (Green Phase). ac8fe3f
- [x] Task: Write failing tests for Right-click Context Menu actions (Red Phase). ac8fe3f
- [x] Task: Implement the Right-click Context Menu for Watchlist items (Green Phase). ac8fe3f
- [x] Task: Write failing tests for Batch Selection mode and bulk removal (Red Phase). ac8fe3f
- [x] Task: Add Batch Selection mode and bulk removal functionality (Green Phase). 808ec77
- [x] Task: Write failing tests for sorting functionality (Symbol, Price %, Volume) (Red Phase). 808ec77
- [x] Task: Implement sorting logic and verify tests pass (Green Phase). 3ccc87a
- [x] Task: Write failing tests for Watchlist keyboard navigation (Arrow keys, Enter, Delete) (Red Phase). 6e28e8b
- [x] Task: Implement keyboard navigation for Watchlist (Green Phase). 6e28e8b
- [x] Task: Conductor - User Manual Verification 'Watchlist Management & Real-time Visuals'

## Phase 4: Alerts Monitoring & Chart Interaction [checkpoint: 331edb6]
- [x] Task: Write failing tests for Alerts list component with status filtering and search (Red Phase). b2f6431
- [x] Task: Create the Alerts list component with status filtering (Active, Triggered, etc.) and search (Green Phase). 331edb6
- [x] Task: Write failing tests for Alerts empty state display (Red Phase). 331edb6
- [x] Task: Implement "No alerts yet" empty state with CTA button (Green Phase). 331edb6
- [x] Task: Write failing tests for expandable alert rows and statistics display (Red Phase). 331edb6
- [x] Task: Implement expandable alert rows showing trigger history and status statistics (Green Phase). 331edb6
- [x] Task: Write failing tests for alert-to-chart linking and timestamp synchronization (Red Phase). 331edb6
- [x] Task: Implement "Linking" logic: clicking an alert updates the chart symbol and timestamp (Green Phase). 331edb6
- [x] Task: Write failing tests for inline management actions (Mute, Reset, Edit, Delete) (Red Phase). 331edb6
- [x] Task: Implement inline management quick-action buttons (Green Phase). 331edb6
- [x] Task: Write failing tests for notification badges and pulse animations (Red Phase). 331edb6
- [x] Task: Add notification badges to sidebar icons and pulse animations for new triggers (Green Phase). 331edb6
- [x] Task: Write failing tests for Alert keyboard shortcuts (M, E, Del) (Red Phase). 331edb6
- [x] Task: Implement keyboard shortcuts for alert management (Green Phase). 331edb6
- [x] Task: Conductor - User Manual Verification 'Alerts Monitoring & Chart Interaction'

## Phase 5: Chart Refinement & Fullscreen API [checkpoint: 7132355]
- [x] Task: Write failing tests for ChartComponent responsiveness to sidebar width changes (Red Phase). 7132355
- [x] Task: Enhance `ChartComponent` to respond to sidebar width changes and occupy maximum space (Green Phase). 7132355
- [x] Task: Write failing tests for Fullscreen Toggle functionality (Red Phase). 7132355
- [x] Task: Implement Fullscreen Toggle using the browser Fullscreen API (Green Phase). 7132355
- [x] Task: Implement advanced indicator visualizations (signal lines, reference bands) and handle null data points correctly (Green Phase). 7132355
- [x] Task: Write failing tests for hover tooltips on watchlist items (Red Phase). 7132355
- [x] Task: Finalize visual palette (high-contrast dark mode) and add hover tooltips for all data points (Green Phase). 7132355
- [x] Task: Verify overall test coverage meets >80% requirement. 7132355
- [x] Task: Run full integration test suite across all phases. 7132355
- [x] Task: Conductor - User Manual Verification 'Chart Refinement & Fullscreen API' (Protocol in workflow.md)
