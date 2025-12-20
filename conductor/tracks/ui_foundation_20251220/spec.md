# Specification: TradingView-style UI/UX Foundation

## 1. Overview
This track implements the foundational user interface and experience for TradingAlert. The goal is to establish a professional, high-performance trading dashboard that mimics the aesthetics and usability of TradingView. This includes a responsive layout with collapsible panels, a command-palette-driven toolbar, and advanced management systems for watchlists and alerts.

## 2. Functional Requirements

### 2.1. Layout & Theme
- **Global Theme:** Professional Dark Mode by default, using a dark slate background and high-contrast elements per `product-guidelines.md`.
- **Responsive Shell:** A main chart area that occupies the maximum available viewport (~80%+ when sidebar is collapsed).
- **Collapsible Right Sidebar:** 
    - Transitions between "Expanded" and a "Narrow Icon Strip" state.
    - **Widths:** Collapsed: 56px, Expanded: 320px - 380px.
    - **Persistence:** Sidebar state (expanded/collapsed, active tab) persists to `localStorage`.
    - **Navigation:** Persistent icons for "Watchlist" and "Alerts" in the icon strip. Notification badges visible on collapsed icons for unread alerts.
    - **Keyboard Shortcut:** `Ctrl+B` to toggle sidebar visibility.

### 2.2. Top Toolbar Components
- **Symbol Search:** Command Palette (Modal) triggered by clicking the symbol or `Ctrl+K`. 
    - Displays recent symbols and groups results by exchange/market.
    - Shows symbol, name, last price, and % change in results.
    - Supports fuzzy search and keyboard navigation.
- **Timeframe Selector:** Quick-access buttons for standard intervals (1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W).
- **Indicators Selector:** Command Palette (Modal) triggered by `Ctrl+I`.
    - Categorized by: Trend, Momentum, Volatility, Volume.
    - Shows indicator name, brief description, and a "Recently Used" section.
- **Chart Style Selector:** Dropdown to switch between Candlestick, Line, and Heikin-Ashi.
- **Fullscreen Toggle:** Button to expand the chart area to fill the entire browser viewport.

### 2.3. Watchlist Tab (Sidebar)
- **Symbol Management:** 
    - "+ Add Symbol" button opening the Symbol Search Command Palette.
    - Drag-and-drop reordering with persistent state (`localStorage`).
    - Right-click context menu for removal, quick alert creation, and copying symbol.
    - **Batch Actions:** Multi-select with checkboxes for bulk removal operations.
- **Visual Feedback:**
    - Real-time price display with "Flash" animations (Green #22c55e for up, Red #ef4444 for down).
    - Absolute and percentage change display with directional arrows (↑↓).
    - Status dot indicator (Green/Yellow/Red) for data connection freshness.
    - Hover tooltips showing day high/low, volume stats, and market cap.
- **Organization:** Sorting by Symbol, Price Change%, or Volume. Toggle between Compact and Expanded (mini-sparkline) views.
- **Keyboard Navigation:** Arrow keys to navigate the list, `Enter` to load symbol, `Delete` to remove selected.
- **Empty State:** Prominent "Add your first symbol" CTA when the watchlist is empty.

### 2.4. Alerts Tab (Sidebar)
- **Alert Monitoring:**
    - List view of all alerts with status filtering (Active, Triggered, Paused, Expired).
    - Search bar for filtering by name, symbol, or condition.
    - Visual count badges for each status category.
- **Alert Display:**
    - Expandable alert entries showing full condition logic and trigger history.
    - **Color-coded status:** Blue border (Active), Green highlight (Recently Triggered), Gray/50% opacity (Paused).
    - **Alert Statistics:** Show trigger count (24h/7d/30d) and "last triggered" relative timestamp per alert.
- **Interactive Linking:** Clicking an alert switches the chart to the target symbol. For triggered alerts, the chart jumps to the trigger timestamp and adds a vertical marker.
- **Inline Management:** Quick-action icons (Mute, Reset, Edit, Delete) visible on hover.
- **Notification System:** Badge on the sidebar icon for unread triggers and pulse animations on the tab.
- **Empty State:** "No alerts yet" message with "+ Create Alert" button when empty.
- **Keyboard Shortcuts:** `M` (mute), `E` (edit), `Del` (delete) when an alert is selected.

## 3. Non-Functional Requirements
- **Performance:** 
    - Debounced search and throttled price updates (max 1Hz).
    - Virtualized lists for Watchlist and Alerts if count > 50.
- **Accessibility:** Keyboard-first navigation for command palettes and sidebar tabs.
- **Visual Palette:** 
    - Green (#22c55e) for bullish/positive.
    - Red (#ef4444) for bearish/negative.
    - Blue (#3b82f6) for informational elements.
    - Smooth 300ms animations for layout transitions.

## 4. Acceptance Criteria
- [ ] Sidebar collapses/expands smoothly (300ms animation) and state persists to `localStorage`.
- [ ] Clicking a Watchlist symbol successfully updates the `ChartComponent` symbol.
- [ ] Timeframe buttons visually reflect the active state and update the chart.
- [ ] Command Palettes (`Ctrl+K`, `Ctrl+I`) handle fuzzy search and keyboard navigation correctly.
- [ ] Price change flash animations trigger with correct colors on data updates.
- [ ] Right-click context menu appears on watchlist items with working actions.
- [ ] Drag-and-drop reordering in Watchlist works and persists.
- [ ] Notification badges and pulse animations update correctly when alerts trigger.
- [ ] Alert linking correctly centers the chart on the trigger timestamp.
- [ ] Empty states display correctly for both Watchlist and Alerts tabs.
- [ ] Keyboard shortcuts work correctly (`Ctrl+K`, `Ctrl+I`, `Ctrl+B`, arrow keys, `M`, `E`, `Del`).

## 5. Out of Scope
- Actual indicator mathematical calculations (using mock/random data).
- Real-time WebSocket integration (using short-polling for now).
- User authentication and multi-user database persistence.
- Complex alert creation logic (UI shells only for this track).

## 6. Technical Implementation Notes
- **UI Component Library:** Shadcn/UI with Radix primitives and Tailwind CSS.
- **Key Components:** Command, Tabs, Collapsible, DropdownMenu, ContextMenu, Badge, Button, Table, Tooltip.
- **Data Management:** Mock price data with simulated updates; `localStorage` for watchlist/sidebar state.
- **Chart Library:** Lightweight Charts v5 (existing from `tech-stack.md`).
