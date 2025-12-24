# Data Model: TradingView Supercharts Dark Theme UI

**Feature**: 002-supercharts-visuals
**Date**: 2025-12-23

## Overview

This document defines the TypeScript entities and interfaces for the frontend chart UI. All entities are designed for local state management with localStorage persistence.

---

## Frontend Entities

### ChartTheme

Represents the complete color scheme for the dark theme chart.

```typescript
interface ChartTheme {
  background: string;           // #131722 (default dark)
  grid: {
    color: string;              // #2a2e39
    opacity: number;            // 0-100 (default 25)
    visible: boolean;           // true
  };
  candle: {
    up: {
      body: string;             // #26a69a (green)
      border: string;           // #26a69a
      wick: string;             // #26a69a
    };
    down: {
      body: string;             // #ef5350 (red)
      border: string;           // #ef5350
      wick: string;             // #ef5350
    };
  };
  volume: {
    up: string;                 // #26a69a (semi-transparent)
    down: string;               // #ef5350 (semi-transparent)
  };
  text: {
    primary: string;            // #d1d4dc
    secondary: string;          // #787b86
  };
  crosshair: {
    color: string;              // #758696
    labelBackground: string;    // #4c525e
    labelColor: string;         // #ffffff
  };
  lastPrice: {
    line: string;               // #363c4e
    labelBackground: string;    // chart color (green or red)
    labelColor: string;         // #ffffff
  };
  indicator: {
    lineColors: string[];       // [#2962ff, #ff6d00, #b71c1c, ...]
  };
  drawing: {
    defaultColor: string;       // #ffff00 (yellow)
    selectedColor: string;      // #ffffff (white border)
  };
}
```

### Drawing

Represents a single drawing on the chart. Stored in chart coordinates (time/price indices), not screen pixels.

```typescript
type DrawingType =
  | 'trendline'       // Two-click diagonal line
  | 'horizontal_line' // Single-click horizontal line
  | 'rectangle'       // Click-drag rectangle
  | 'text';           // Click to place text

interface Drawing {
  id: string;                  // UUID
  type: DrawingType;
  // Chart coordinates (not screen pixels)
  time1?: number;              // Unix timestamp (ms) or time index
  price1?: number;             // Price value
  time2?: number;              // End point for trendline, corner for rectangle
  price2?: number;
  // Visual properties
  color: string;               // Hex color (default #ffff00)
  lineWidth: number;           // 1 (thin), 2 (medium), 3 (thick)
  fillOpacity?: number;        // For rectangles: 0-100
  zIndex?: number;             // Rendering order (for overlapping)
  // Text content (for text drawings)
  text?: string;               // Text content
  fontSize?: number;           // Font size in pixels
  // Pane reference
  paneId: string;              // 'main' or indicator pane ID
}
```

### IndicatorPane

Represents an indicator pane (oscillator displayed below main chart).

```typescript
interface IndicatorPane {
  id: string;                  // UUID
  indicatorType: IndicatorType;
  name: string;                // Display name (e.g., "RSI 14")
  displaySettings: {
    visible: boolean;          // true
    height: number;            // Percentage of chart height (default 25)
    position: number;          // Order in pane stack (1 = top indicator)
  };
  scaleRange?: {
    min: number;               // Fixed minimum (e.g., 0 for RSI)
    max: number;               // Fixed maximum (e.g., 100 for RSI)
    auto: boolean;             // true for auto-scale
  };
  focusState: 'focused' | 'active' | 'inactive';
}
```

### IndicatorType

Supported indicator types (overlay vs oscillator).

```typescript
interface IndicatorType {
  category: 'overlay' | 'oscillator';
  name: string;                // 'RSI', 'MACD', 'SMA', 'EMA', etc.
  params: Record<string, number | string>;  // { period: 14 }
}

// Common indicator presets
const INDICATOR_PRESETS: IndicatorType[] = [
  { category: 'oscillator', name: 'RSI', params: { period: 14 } },
  { category: 'oscillator', name: 'Stochastic', params: { kPeriod: 14, dPeriod: 3 } },
  { category: 'oscillator', name: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
  { category: 'overlay', name: 'SMA', params: { period: 20 } },
  { category: 'overlay', name: 'EMA', params: { period: 20 } },
  { category: 'overlay', name: 'BB', params: { period: 20, stdDev: 2 } },
];
```

### ChartState

Central state for the entire chart component.

```typescript
interface ChartState {
  // Current symbol/interval
  symbol: string;              // e.g., 'AAPL', 'BTC-USD'
  interval: Interval;          // '1m' | '5m' | '15m' | '1h' | '1D'

  // Navigation state
  zoom: {
    level: number;             // Zoom factor (1 = default, >1 = zoomed in)
    maxLevel: number;          // Maximum zoom (e.g., 10x)
  };
  scroll: {
    position: number;          // Scroll position (0 = rightmost, 1 = leftmost)
    offset: number;            // Pixel offset from right edge
  };

  // Visible ranges (for synchronization)
  visibleTimeRange?: {
    from: number;              // Unix timestamp (ms)
    to: number;                // Unix timestamp (ms)
  };

  // Active tool
  activeTool: ToolType;        // 'cursor' | 'trendline' | 'horizontal_line' | 'rectangle'

  // Theme
  theme: ChartTheme;

  // Focused pane
  focusedPaneId: string;       // 'main' or indicator pane ID

  // Data availability
  dataAvailable: boolean;      // true if candles loaded
  loading: boolean;            // true while fetching
  error?: string;              // Error message if any
}

type Interval = '1m' | '5m' | '15m' | '1h' | '1D';

type ToolType =
  | 'cursor'
  | 'trendline'
  | 'horizontal_line'
  | 'rectangle'
  | 'text';
```

### DrawingState

State for drawing tools interaction.

```typescript
interface DrawingState {
  selectedTool: ToolType;
  activeDrawing: {
    type: DrawingType;
    step: number;              // 0 = no click, 1 = first click, 2 = complete
    tempData?: Partial<Drawing>; // In-progress drawing data
  };
  drawings: Drawing[];         // All drawings for current symbol
  hoveredDrawing?: Drawing;    // Drawing under cursor
  selectedDrawing?: Drawing;   // Currently selected for editing
}
```

### ThemeSettings

User-customizable appearance settings (persisted to localStorage).

```typescript
interface ThemeSettings {
  backgroundBrightness: number; // 0-100 (0 = #131722 default, 100 = #0a0e14 darker)
  grid: {
    visible: boolean;
    opacity: number;           // 0-100
  };
  candleColors: {
    up: string;                // Hex, e.g., "#26a69a"
    down: string;              // Hex, e.g., "#ef5350"
  };
  scaleSettings: {
    showLastPriceLine: boolean;
    showLastPriceLabel: boolean;
    showTimeLabels: boolean;
    showPriceLabels: boolean;
  };
}

const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  backgroundBrightness: 0,
  grid: {
    visible: true,
    opacity: 25,
  },
  candleColors: {
    up: '#26a69a',
    down: '#ef5350',
  },
  scaleSettings: {
    showLastPriceLine: true,
    showLastPriceLabel: true,
    showTimeLabels: true,
    showPriceLabels: true,
  },
};
```

### CrosshairState

Shared crosshair state synchronized across all panes.

```typescript
interface CrosshairState {
  visible: boolean;
  timeIndex?: number;          // Time index for vertical line position
  price?: number;              // Price for horizontal line position (main pane only)
  sourcePaneId?: string;       // Which pane triggered the crosshair
}
```

### OHLCV

Open-High-Low-Close-Volume data for a single candle.

```typescript
interface OHLCV {
  time: number;                // Unix timestamp (seconds or milliseconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}
```

---

## Backend Entities (Existing from 001-initial-setup)

These entities exist in the backend and are consumed via API.

### Candle (Backend Model)

```python
# Python model from backend/app/models/candle.py
class Candle(Base):
    id: int
    symbol_id: int
    timestamp: datetime        # UTC
    interval: str              # '1m', '5m', '15m', '1h', '1d'
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
```

### Indicator Registry (Backend)

```python
# Python interface from backend/app/services/indicators/
class IndicatorRegistry:
    def calculate(self, candles: List[Candle], params: dict) -> Dict[str, float]:
        """Returns indicator values with metadata."""
```

---

## localStorage Schema

### Drawings Storage

Key: `drawings-{symbol}` (e.g., `drawings-AAPL`)

```typescript
// Stored value: Drawing[]
localStorage.setItem('drawings-AAPL', JSON.stringify([
  {
    id: 'draw-001',
    type: 'trendline',
    time1: 1705334400000,
    price1: 150.25,
    time2: 1705420800000,
    price2: 155.50,
    color: '#ffff00',
    lineWidth: 2,
    paneId: 'main'
  }
]));
```

### Theme Settings Storage

Key: `chart-theme-settings`

```typescript
localStorage.setItem('chart-theme-settings', JSON.stringify({
  backgroundBrightness: 0,
  grid: { visible: true, opacity: 25 },
  candleColors: { up: '#26a69a', down: '#ef5350' },
  scaleSettings: {
    showLastPriceLine: true,
    showLastPriceLabel: true,
    showTimeLabels: true,
    showPriceLabels: true
  }
}));
```

---

## State Management Architecture

```
App.tsx
├── ChartStateContext (central chart state)
├── CrosshairContext (synchronized crosshair)
├── DrawingStateContext (drawing tools)
├── ThemeSettingsContext (appearance)
└── IndicatorPaneContext (pane management)
```

### React Context Hierarchy

```typescript
// Top-level providers in App.tsx
<ChartStateProvider>
  <CrosshairProvider>
    <DrawingStateProvider>
      <ThemeSettingsProvider>
        <IndicatorPaneProvider>
          <ChartContainer />
        </IndicatorPaneProvider>
      </ThemeSettingsProvider>
    </DrawingStateProvider>
  </CrosshairProvider>
</ChartStateProvider>
```

---

## Data Flow

### Initial Load

```
1. User navigates to chart page
2. ChartContainer reads symbol from URL or default
3. Fetch candles from GET /api/v1/candles/{symbol}?interval={interval}
4. Create main lightweight-charts instance with candle data
5. Fetch existing drawings from localStorage (drawings-{symbol})
6. Render drawings as SVG overlay
```

### Interval Change

```
1. User clicks interval button (e.g., '5m')
2. Update ChartState.interval
3. Fetch new candles from API
4. Update main chart data
5. Clear and reload drawings for new interval (drawings are interval-specific)
```

### Indicator Add

```
1. User clicks "Indicators" button
2. IndicatorDialog opens with available indicators
3. User selects "RSI 14"
4. Create new IndicatorPane entity
5. Fetch indicator data from GET /api/v1/indicators/{symbol}/rsi?interval={}&period=14
6. Create new lightweight-charts instance for indicator pane
7. Synchronize time scale with main chart
```

### Drawing Tool

```
1. User selects "Trendline" tool
2. Update DrawingState.selectedTool = 'trendline'
3. User clicks first point on chart
4. Convert screen (x, y) to chart (time, price) using lightweight-charts APIs
5. Update DrawingState.activeDrawing = { type: 'trendline', step: 1, tempData }
6. User moves mouse -> show preview line
7. User clicks second point
8. Create Drawing entity with time1/price1/time2/price2
9. Add to DrawingState.drawings
10. Save to localStorage (drawings-{symbol})
```

---

## Coordinate System Conversion

### Chart to Screen

```typescript
// Using lightweight-charts APIs
const x = chart.timeScaleGetCoordinate(timeValue);        // time -> pixels
const y = chart.priceScalePriceToY(priceValue, paneId);   // price -> pixels
```

### Screen to Chart

```typescript
const timeValue = chart.timeScaleGetTime(xPosition);      // pixels -> time
const priceValue = chart.priceScalePriceFromY(yPosition, paneId); // pixels -> price
```

---

## Performance Considerations

1. **Debounced localStorage writes**: Batch drawing updates to avoid excessive writes
2. **Canvas rendering**: lightweight-charts uses canvas for high-performance candle rendering
3. **SVG overlay**: Drawings rendered as SVG layer on top of canvas (minimal performance impact)
4. **Throttled crosshair updates**: Limit crosshair position updates to ~60fps
5. **Lazy pane creation**: Create indicator panes on-demand when added by user
