# Implementation Plan: TradingView Supercharts Dark Theme UI

**Branch**: `002-supercharts-visuals` | **Date**: 2025-12-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-supercharts-visuals/spec.md`

## Summary

Implement a TradingView Supercharts-style dark theme UI for the TradingAlert application. The feature creates a visually identical chart interface with:

- Main candlestick chart with volume overlay
- Synchronized multi-pane indicator display
- Interactive crosshair with OHLCV readout
- Zoom/pan navigation matching TradingView behavior
- Top toolbar (symbol, intervals, indicators, settings) and left drawing toolbar
- Drawing tools (trendline, horizontal line, rectangle) with localStorage persistence
- Appearance settings for dark theme customization

## Technical Context

**Language/Version**: TypeScript 5.9+ (frontend), React 19
**Primary Dependencies**: lightweight-charts ^5.1.0, Radix UI components, Lucide React icons
**Storage**: Browser localStorage (drawings, theme settings)
**Testing**: Vitest (frontend), React Testing Library
**Target Platform**: Desktop web browsers (Chrome, Firefox, Safari, Edge) - 1024px+ width
**Project Type**: web (frontend-focused, depends on existing backend API)
**Performance Goals**: 60fps zoom/pan with 10,000+ candles, <16ms crosshair lag, 2s initial chart load (100 candles)
**Constraints**: Must visually match TradingView Supercharts dark theme (90% similarity), no paid libraries, desktop only (MVP)
**Scale/Scope**: Single chart page, 4 toolbar tools, 3 drawing tools, 60 functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) match TradingView behavior - Spec FR-016 through FR-020 define exact behavior
- [x] UI changes include before/after verification - SC-008 requires 90% visual similarity verification
- [x] Performance budgets: 60fps panning, 3s initial load - Specified in FR-016, FR-017, SC-005

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented - FR-013 specifies format, existing backend already handles UTC
- [x] Deduplication strategy: database constraints or idempotent inserts - Backend from 001-initial-setup has unique constraint on (symbol_id, timestamp, interval)
- [x] Alert semantics: above/below/crosses defined with edge cases tested - N/A for this UI-only feature (alerts handled in 001-initial-setup)
- [x] Gap handling: explicit marking and backfill strategy - Edge cases covered, gap detector service exists from 001-initial-setup

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count - N/A for this UI-only feature
- [x] Alert evaluation performance budgeted (500ms) - N/A for this UI-only feature
- [x] Graceful degradation defined for high alert volumes - N/A for this UI-only feature

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally - Backend from 001-initial-setup caches candles in SQLite
- [x] Offline behavior: charts, alerts, history remain accessible - Drawings persisted in localStorage (FR-048, FR-049)
- [x] Provider error handling: graceful degradation with user feedback - Edge cases defined for no data, network errors

### Testing and Quality Gates

- [x] Core logic uses TDD (alert engine, indicators, candle normalization) - UI state management hooks tested via TDD (T016-T025 in tasks.md)
- [x] Bug fixes include regression tests - Will apply for any bugs found
- [x] CI includes: lint, typecheck, unit, integration tests - Existing CI from 001-initial-setup

### Performance Budgets

- [x] Initial chart load: 3 seconds - SC-005 specifies 2 seconds for 100 candles
- [x] Price update latency: 2 seconds - N/A (handled by backend)
- [x] Alert evaluation: 500ms - N/A (handled by backend)
- [x] UI panning: 60fps - FR-016, FR-017 specify smooth animation targeting 60fps
- [x] Memory: 500MB for 5 symbols / 20 alerts - N/A (frontend only, localStorage minimal)

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern - FR-021, FR-022 separate oscillator vs overlay, existing IndicatorRegistry from 001-initial-setup
- [x] Data providers implement common interface - Existing YFinanceProvider, AlphaVantageProvider from 001-initial-setup
- [x] Provider-specific logic isolated from UI - UI calls backend API, provider logic in backend

### Security & Privacy

- [x] No telemetry or data upload without consent - All data stored locally in browser
- [x] API keys stored securely (not in repo) - Backend .env handles this
- [x] Local data treated as sensitive - Drawings and settings stored only in browser localStorage

### Governance

- [x] If any principle violated: justification in Complexity Tracking - No violations
- [x] Constitution supersedes spec/plan conflicts - No conflicts

## Project Structure

### Documentation (this feature)

```text
specs/002-supercharts-visuals/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── contracts/           # Phase 1 output (/speckit.plan command)
```

### Source Code (repository root)

```text
backend/                    # Python FastAPI (from 001-initial-setup)
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── candles.py      # Existing candles API
│   │       ├── indicators.py   # Existing indicators API
│   │       └── alerts.py       # Existing alerts API
│   ├── models/
│   │   ├── candle.py          # Candle model
│   │   ├── alert.py           # Alert model
│   │   └── alert_trigger.py   # AlertTrigger model
│   └── services/
│       ├── indicators/       # Indicator registry and calculations
│       ├── providers.py       # YFinance and AlphaVantage providers
│       └── orchestrator.py    # Data orchestration service
└── tests/

frontend/                   # React + TypeScript + Vite
├── src/
│   ├── components/
│   │   ├── chart/
│   │   │   ├── ChartContainer.tsx      # Main chart container component
│   │   │   ├── MainPane.tsx             # Main candle + volume chart
│   │   │   ├── IndicatorPane.tsx        # Indicator pane wrapper
│   │   │   ├── Crosshair.tsx             # Crosshair overlay component
│   │   │   ├── PriceScale.tsx           # Right-side price scale
│   │   │   └── TimeScale.tsx            # Bottom time scale
│   │   ├── toolbar/
│   │   │   ├── TopToolbar.tsx           # Top toolbar (symbol, intervals, etc.)
│   │   │   ├── DrawingToolbar.tsx       # Left drawing toolbar
│   │   │   ├── SymbolSelector.tsx       # Symbol input/search
│   │   │   ├── IntervalSelector.tsx     # Interval buttons (1m, 5m, 15m, 1h, 1D)
│   │   │   └── SettingsButton.tsx        # Settings gear icon button
│   │   ├── indicators/
│   │   │   ├── IndicatorDialog.tsx      # Add indicator modal
│   │   │   └── IndicatorPaneHeader.tsx   # Pane header with focus/close
│   │   ├── drawings/
│   │   │   ├── DrawingTools.tsx         # Drawing tool state and logic
│   │   │   ├── TrendlineTool.tsx         # Two-click trendline drawing
│   │   │   ├── HorizontalLineTool.tsx    # Single-click horizontal line
│   │   │   ├── RectangleTool.tsx         # Click-drag rectangle drawing
│   │   │   ├── DrawingContextMenu.tsx    # Right-click context menu
│   │   │   └── DrawingStorage.tsx        # localStorage persistence
│   │   ├── settings/
│   │   │   ├── SettingsDialog.tsx         # Settings modal dialog
│   │   │   ├── AppearanceTab.tsx          # Appearance settings (dark only)
│   │   │   └── ScalesTab.tsx              # Scale visibility settings
│   │   └── types/
│   │       ├── chart.ts                 # Chart-related TypeScript types
│   │       ├── indicators.ts            # Indicator-related types
│   │       ├── drawings.ts              # Drawing-related types
│   │       └── theme.ts                 # Theme color types
│   ├── hooks/
│   │   ├── useChartState.ts             # Chart state management hook
│   │   ├── useCrosshair.ts              # Crosshair state and synchronization
│   │   ├── useDrawings.ts               # Drawing CRUD operations
│   │   ├── useIndicatorPanes.ts         # Indicator pane management
│   │   └── useThemeSettings.ts          # Theme settings persistence
│   ├── utils/
│   │   ├── chartColors.ts               # Theme color constants
│   │   ├── drawingUtils.ts              # Drawing geometry utilities
│   │   └── localStorage.ts              # localStorage wrapper
│   └── App.tsx                           # Main app entry point
└── tests/
    ├── components/
    │   ├── chart/
    │   ├── toolbar/
    │   ├── drawings/
    │   └── settings/
    └── hooks/
```

**Structure Decision**: Web application structure (Option 2). This feature is primarily frontend-focused, extending the existing React + TypeScript frontend from 001-initial-setup. The backend API is already functional from the previous feature.

## Complexity Tracking

> **No constitution violations** - All principles are satisfied by the specification and existing architecture.

## Phase 0: Research & Technology Decisions

### Research Tasks

1. **lightweight-charts multi-pane architecture**
   - Decision: Use lightweight-charts with multiple chart instances synchronized via time scale
   - Rationale: lightweight-charts doesn't natively support multi-pane layouts. Each pane gets its own IChartingLibraryApi instance, sharing time-scale data for synchronization.
   - Alternatives considered: Single chart with custom rendering (too complex), other libraries (TradingView Charting Library requires license)

2. **Drawing overlay implementation**
   - Decision: Use lightweight-charts price/time coordinate APIs + SVG overlay for drawings
   - Rationale: Lightweight-charts provides `timeScaleGetCoordinate()` and `priceScaleGetPrice()` methods to convert chart coordinates to screen positions. SVG overlay enables custom rendering without library modifications.
   - Alternatives considered: Canvas drawing (requires manual hit detection), HTML elements (limited positioning)

3. **localStorage schema for drawings**
   - Decision: Store as JSON with key `drawings-{symbol}`, structure: `[{id, type, time1, price1, time2, price2, color, ...}]`
   - Rationale: Simple, queryable per symbol, maintains chart coordinates (time/price indices) that survive zoom changes
   - Alternatives considered: IndexedDB (overkill), backend sync (violates local-first principle for MVP)

4. **Crosshair pane synchronization**
   - Decision: Single React context `CrosshairProvider` that broadcasts time position to all panes
   - Rationale: Centralized state management ensures all panes update simultaneously without prop drilling
   - Alternatives considered: Event bus (complex), Redux/ Zustand (unnecessary for this scope)

5. **Settings persistence**
   - Decision: Store theme settings in localStorage with key `chart-theme-settings`, structure: `{backgroundBrightness, gridOpacity, gridVisible, candleColors, scaleSettings}`
   - Rationale: Simple, fast load on page refresh, no backend dependency
   - Alternatives considered: Backend sync (adds complexity), URL params (limited capacity)

### Research Output

See [research.md](./research.md) for detailed findings on:
- Multi-pane lightweight-charts implementation patterns
- SVG overlay for drawings with hit detection
- localStorage schema design
- Crosshair synchronization architecture
- Settings persistence strategy

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md) for entity definitions:

**Frontend Entities** (TypeScript interfaces):
- `ChartTheme`: Background color, grid color/opacity, candle colors (up/down body/wick), text color, last price colors
- `Drawing`: Type (cursor/trendline/horizontal/rectangle/text), time/price coordinates, color, line width, fill opacity, z-index
- `IndicatorPane`: Indicator type, display settings, pane position, scale range, visibility, focus state
- `ChartState`: Symbol, interval, zoom level, scroll position, visible ranges, active tool, theme, focused pane
- `DrawingState`: Selected tool, active drawing, drawings array, hovered drawing
- `ThemeSettings`: Background brightness, grid visibility, grid opacity, candle colors, scale toggles

**Backend Entities** (from 001-initial-setup):
- `Candle`: Existing model with id, symbol_id, timestamp, interval, open, high, low, close, volume
- `Indicator`: Existing registry with calculate() interface
- Provider APIs: Existing `/api/v1/candles/{symbol}`, `/api/v1/indicators/{symbol}/{name}`

### API Contracts

See [contracts/](./contracts/) for TypeScript interfaces and API schemas:

**Frontend-internal contracts**:
- `IChartContainer`: Props for main chart wrapper
- `IIndicatorPane`: Props for indicator panes
- `IDrawingTool`: Interface for drawing tool implementations
- `IThemeSettings`: Theme settings interface

**Backend API contracts** (existing, from 001-initial-setup):
- `GET /api/v1/candles/{symbol}?interval={}&local_only={}` - Returns Candle[]
- `GET /api/v1/indicators/{symbol}/{indicator_name}?interval={}` - Returns indicator data with metadata

### Quickstart Guide

See [quickstart.md](./quickstart.md) for:
- Development setup instructions
- Running the chart UI locally
- Testing drawing tools
- Verifying multi-pane indicator synchronization

### Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh claude` after Phase 1 to update the agent-specific context file with new technologies:
- lightweight-charts (already documented)
- Radix UI Dialog, Tabs, Context Menu (already documented)
- Lucide React icons (already documented)

## Phase 2: Implementation Planning

The implementation plan is organized by user story priority (P1 → P2 → P3):

**P1 (Core Chart Visualization):**
1. ChartContainer with lightweight-charts integration
2. MainPane with candles + volume rendering
3. Crosshair with synchronized multi-pane support
4. Zoom and pan interactions (scroll wheel, drag, double-click reset)
5. Price scale and time scale with labels

**P2 (UI Toolbars & Indicators):**
6. TopToolbar with symbol input, interval buttons, indicators/settings buttons
7. DrawingToolbar (left) with cursor/trendline/horizontal/rectangle tools
8. IndicatorPane component for oscillator indicators
9. IndicatorDialog for adding indicators
10. Drawing storage (localStorage) and context menu

**P3 (Appearance Settings):**
11. SettingsDialog with Appearance/Scales tabs
12. Theme customization (background brightness, grid, candle colors)
13. Drawing tool refinement (drag handles, color palette, thickness options)

**Cross-cutting:**
- Theme color constants and utilities
- TypeScript type definitions
- Unit tests for each component
- Integration tests for full chart interaction flows
