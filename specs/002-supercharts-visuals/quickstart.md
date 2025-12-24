# Quickstart: TradingView Supercharts Dark Theme UI

**Feature**: 002-supercharts-visuals
**Date**: 2025-12-23

## Prerequisites

- Node.js 20+ and npm/yarn/pnpm
- Python 3.11+ with pip
- Git

## Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd TradingAlert

# Checkout the feature branch
git checkout 002-supercharts-visuals

# Install backend dependencies
cd backend
pip install -e .

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start Backend Server

```bash
# From repository root
cd backend

# Start FastAPI server with auto-reload
uvicorn app.main:app --reload --port 8000
```

Backend API will be available at `http://localhost:8000`

### 3. Start Frontend Dev Server

```bash
# From repository root (in a new terminal)
cd frontend

# Start Vite dev server
npm run dev
```

Frontend will be available at `http://localhost:5173`

### 4. Access the Chart UI

Open browser to `http://localhost:5173`

The chart should load with:
- Default symbol (or enter a symbol like "AAPL")
- Candlestick chart with volume overlay
- Dark theme matching TradingView Supercharts

## Testing Drawing Tools

### Draw a Trendline

1. Click the trendline icon on the left toolbar (diagonal line icon)
2. Click once on the chart to set the start point
3. Move mouse to position the endpoint
4. Click again to complete the trendline
5. Yellow line should appear, persisting across page refreshes

### Draw a Horizontal Line

1. Click the horizontal line icon (flat line icon)
2. Click anywhere on the chart to place a horizontal line at that price level
3. Line should extend across the entire chart width

### Draw a Rectangle

1. Click the rectangle icon (square icon)
2. Click and drag to draw a rectangle
3. Rectangle should highlight when hovered

### Delete Drawings

1. Right-click on any drawing
2. Select "Delete" from context menu
3. Drawing is removed from chart and localStorage

## Testing Indicator Panes

### Add RSI Indicator

1. Click "Indicators" button in top toolbar
2. Select "RSI" from the dropdown
3. Set period to 14 (default)
4. Click "Add"
5. New pane appears below main chart showing RSI line
6. RSI pane scales from 0-100 with reference lines at 30 and 70

### Add MACD Indicator

1. Click "Indicators" button
2. Select "MACD"
3. Default parameters: Fast=12, Slow=26, Signal=9
4. Click "Add"
5. New pane appears with MACD histogram and signal lines

### Synchronize Pans

1. Pan the main chart (drag with mouse or scroll wheel)
2. Indicator panes should pan in sync (same time range visible)
3. Zoom in/out on main chart
4. Indicator panes should zoom in sync

### Test Crosshair Synchronization

1. Hover mouse over main chart
2. Vertical crosshair line should appear on all panes at the same time
3. OHLCV readout shows in top-left corner
4. Hover mouse over indicator pane
5. Crosshair should still show on all panes

## Testing Appearance Settings

### Change Background Brightness

1. Click gear icon in top toolbar
2. Go to "Appearance" tab
3. Adjust "Background Brightness" slider
4. Chart background should darken/lighten in real-time

### Adjust Grid Opacity

1. In Settings dialog, "Appearance" tab
2. Adjust "Grid Opacity" slider
3. Grid lines should become more/less visible
4. Set to 0 to hide grid completely

### Toggle Grid Visibility

1. In Settings dialog, uncheck "Show Grid"
2. Grid should disappear
3. Re-check "Show Grid" to restore

### Customize Candle Colors

1. In Settings dialog, "Appearance" tab
2. Click color picker for "Up candles" (green)
3. Select a different color
4. Candle colors update immediately
5. Changes persist across page refreshes

## Testing Zoom and Pan

### Zoom with Mouse Wheel

1. Scroll wheel up to zoom in
2. Scroll wheel down to zoom out
3. Chart zooms centered on mouse position

### Pan by Dragging

1. Click and drag on chart area
2. Chart should pan smoothly following mouse
3. Release to stop panning

### Reset Zoom

1. Double-click anywhere on chart
2. Chart should reset to default zoom level
3. Visible time range adjusts to show most recent data

## Testing Interval Switching

### Switch Between Intervals

1. Click interval buttons in top toolbar: 1m, 5m, 15m, 1h, 1D
2. Chart should reload with new interval data
3. Drawings are interval-specific (switching intervals shows different drawings)

### Verify Time Labels

1. Time labels on x-axis should match interval:
   - 1m: HH:MM format (e.g., "14:30")
   - 1D: Day-Month format (e.g., "27 Aug '25")

## Testing Symbol Switching

### Change Symbol

1. Type a new symbol in the symbol input field (e.g., "TSLA", "BTC-USD")
2. Press Enter
3. Chart should load new symbol data
4. Drawings are symbol-specific (switching symbols shows different drawings)

## Verifying localStorage Persistence

### Check Drawings Storage

1. Open browser DevTools (F12)
2. Go to Application tab > Local Storage
3. Look for keys like `drawings-AAPL`, `drawings-TSLA`
4. Value should be JSON array of Drawing objects

### Check Theme Settings Storage

1. In Local Storage, look for key `chart-theme-settings`
2. Value should be JSON object with backgroundBrightness, grid, candleColors, etc.

### Test Persistence

1. Draw some trendlines on AAPL chart
2. Refresh the page (F5)
3. Drawings should reappear
4. Change theme settings
5. Refresh page
6. Settings should persist

## Performance Verification

### Check Initial Load Time

1. Open browser DevTools > Network tab
2. Clear cache and reload (Ctrl+Shift+R)
3. Measure time from page load to chart rendering
4. Should be under 2 seconds for ~100 candles

### Check Zoom/Pan Frame Rate

1. Open DevTools > Performance tab
2. Start recording
3. Pan the chart for a few seconds
4. Stop recording
5. Check FPS - should be near 60fps

### Check Crosshair Lag

1. Move mouse quickly across chart
2. Crosshair should follow with minimal lag (<16ms)

## Troubleshooting

### Backend Not Responding

```bash
# Check if backend is running
curl http://localhost:8000/api/v1/health

# Check logs for errors
# Backend logs show in the terminal where uvicorn is running
```

### Frontend Build Errors

```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf .vite dist
npm run dev
```

### Drawings Not Persisting

1. Check browser console for localStorage errors
2. Verify localStorage is enabled (Private/Incognito mode may disable it)
3. Check DevTools > Application > Local Storage for the keys

### Chart Not Rendering

1. Check if backend API is returning data (Network tab)
2. Verify candle data format matches ICandleData interface
3. Check browser console for lightweight-charts errors

## Running Tests

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests for specific component
npm test -- ChartContainer
```

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run specific test file
pytest tests/services/test_providers.py

# Run with coverage
pytest --cov=app
```

## Project Structure Reference

```
TradingAlert/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── candles.py       # Candle data endpoint
│   │   │   └── indicators.py    # Indicator calculation endpoint
│   │   ├── models/
│   │   │   └── candle.py        # Candle database model
│   │   └── services/
│   │       ├── indicators/      # Indicator registry
│   │       └── providers.py     # YFinance/AlphaVantage
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chart/           # Chart components
│   │   │   ├── toolbar/         # Top and left toolbars
│   │   │   ├── drawings/        # Drawing tools
│   │   │   └── settings/        # Settings dialog
│   │   ├── hooks/               # React hooks
│   │   ├── utils/               # Utilities
│   │   └── App.tsx
│   └── tests/
└── specs/
    └── 002-supercharts-visuals/
        ├── spec.md              # Feature specification
        ├── plan.md              # Implementation plan
        ├── research.md          # Research findings
        ├── data-model.md        # This document's entities
        ├── quickstart.md        # This file
        └── contracts/           # TypeScript interfaces
```

## Next Steps

After completing the quickstart:

1. Review the [spec.md](./spec.md) for detailed requirements
2. Check [plan.md](./plan.md) for implementation phases
3. Read [research.md](./research.md) for technical decisions
4. Reference [data-model.md](./data-model.md) for entity definitions
5. Use [contracts/index.ts](./contracts/index.ts) for TypeScript interfaces

## Key Dependencies

- **lightweight-charts** ^5.1.0 - Financial charting library
- **Radix UI** - Dialog, Tabs, Context Menu components
- **Lucide React** - Icon set
- **React 19** - UI framework
- **TypeScript 5.9+** - Type safety
- **Vite** - Build tool

## Constitution Checklist

This feature adheres to all constitution principles:

- [x] Local-first: Drawings and settings stored in browser localStorage
- [x] Performance: 60fps zoom/pan, <16ms crosshair lag, 2s initial load
- [x] Extensibility: Indicator registry pattern for adding new indicators
- [x] No paid libraries: Uses open-source lightweight-charts (not TradingView Charting Library)
- [x] Desktop MVP: Minimum width 1024px, mobile explicitly out of scope
