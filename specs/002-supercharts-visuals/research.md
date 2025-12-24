# Research: TradingView Supercharts Dark Theme UI

**Feature**: 002-supercharts-visuals
**Date**: 2025-12-23

## Overview

This document captures research findings and technology decisions for implementing the TradingView Supercharts-style dark theme UI. All research items from Phase 0 have been resolved.

---

## 1. Lightweight-Charts Multi-Pane Architecture

### Decision

Use multiple `IChartingLibraryApi` instances (one per pane), synchronized via shared time-scale data and React context.

### Rationale

Lightweight-charts doesn't natively support multi-pane layouts. The library is designed for single charts. To achieve the TradingView "stacked panes" look (main chart + indicator panes below), we create multiple chart instances and synchronize their time scales.

### Implementation Pattern

```typescript
// Each pane gets its own chart instance
const mainChartRef = useRef<IChartingLibraryApi>();
const indicatorChartRef1 = useRef<IChartingLibraryApi>();
const indicatorChartRef2 = useRef<IChartingLibraryApi>();

// Synchronize time scales via subscribeVisibleTimeRangeChange
mainChartRef.current?.subscribeVisibleTimeRangeChange((range) => {
  indicatorChartRef1.current?.setVisibleRange(range);
  indicatorChartRef2.current?.setVisibleRange(range);
});
```

### Alternatives Considered

| Alternative | Rejected Because |
|--------------|------------------|
| Single chart with custom rendering for indicators | Too complex - requires bypassing lightweight-charts rendering entirely |
| TradingView Charting Library | Requires expensive license, not permissible (no paid libraries constraint) |
| Recharts | Lower performance for real-time data, not purpose-built for financial charts |

---

## 2. Drawing Overlay Implementation

### Decision

Use lightweight-charts coordinate conversion APIs + SVG overlay for drawings.

### Rationale

Lightweight-charts provides methods to convert between chart coordinates (time/price) and screen coordinates (pixels):
- `timeScaleGetCoordinate()` - Convert time index to X pixel position
- `timeScaleGetTime()` - Convert X pixel position to time index
- `priceScaleGetPrice()` - Convert Y pixel position to price value

This allows us to render drawings in an SVG layer positioned absolutely over the chart canvas.

### Implementation Pattern

```typescript
// Convert drawing coordinates (time/price) to screen (x/y)
const x = chart.timeScaleGetCoordinate(drawing.time1);
const y1 = chart.priceScalePriceToY(drawing.price1, yAxisPosition);
const y2 = chart.priceScalePriceToY(drawing.price2, yAxisPosition);

// Render in SVG overlay
<line x1={x} y1={y1} x2={x} y2={y2} stroke="yellow" strokeWidth={2} />
```

### Hit Detection

For hit detection (selecting drawings, showing drag handles):
1. Store screen bounds for each drawing when rendered
2. On mouse events, check if cursor position intersects with drawing bounds
3. For precise hit detection, use point-to-line distance calculations for trendlines

### Alternatives Considered

| Alternative | Rejected Because |
|--------------|------------------|
| Canvas drawing layer | Requires manual hit detection implementation, harder to debug |
| HTML positioned elements | Limited positioning options, performance issues with many DOM nodes |
| lightweight-charts plugin API | Plugin API exists but is complex and less documented |

---

## 3. LocalStorage Schema for Drawings

### Decision

Store drawings as JSON with per-symbol keys: `drawings-{symbol}`

### Schema Structure

```typescript
interface Drawing {
  id: string;
  type: 'trendline' | 'horizontal_line' | 'rectangle' | 'text';
  // Chart coordinates (not screen pixels)
  time1?: number;      // Unix timestamp or time index
  price1?: number;     // Price value
  time2?: number;      // For trendline endpoint, rectangle corner
  price2?: number;
  color: string;       // Hex color (e.g., "#FFFF00" for yellow)
  lineWidth: number;   // 1 (thin), 2 (medium), 3 (thick)
  fillOpacity?: number; // For rectangles: 0-100
  zIndex?: number;     // Rendering order (for overlapping)
}

// localStorage key format
const STORAGE_KEY = `drawings-${symbol}`;
```

### Example Data

```json
{
  "drawings-AAPL": [
    {
      "id": "draw-001",
      "type": "trendline",
      "time1": 1705334400000,
      "price1": 150.25,
      "time2": 1705420800000,
      "price2": 155.50,
      "color": "#FFFF00",
      "lineWidth": 2
    },
    {
      "id": "draw-002",
      "type": "horizontal_line",
      "time1": 1705334400000,
      "price1": 148.00,
      "color": "#FFFF00",
      "lineWidth": 2
    }
  ]
}
```

### Coordinate System

Drawings are stored in **chart coordinates** (time/price), not screen pixels. This means:
- When user zooms, drawings stay at their chart position (not fixed screen position)
- When user pans, drawings move with the chart
- Each drawing's time1/price1 represents a fixed point on the chart

### Alternatives Considered

| Alternative | Rejected Because |
|--------------|------------------|
| IndexedDB | Overkill for this use case, adds complexity with async API |
| Backend sync | Violates local-first principle, adds network dependency |
| Screen-pixel storage | Drawings would be misaligned after zoom/pan |

---

## 4. Crosshair Pane Synchronization

### Decision

Single React context `CrosshairProvider` that broadcasts time position to all panes via context and callbacks.

### Rationale

All panes need to show a vertical line at the same time index. Using React Context + a simple callback pattern ensures all panes update simultaneously without complex prop drilling or event emitters.

### Implementation Pattern

```typescript
// Context to track crosshair state
interface CrosshairState {
  visible: boolean;
  timeIndex?: number;
  price?: number;
  sourcePaneId?: string;
}

const CrosshairContext = React createContext<CrosshairState>({
  visible: false,
});

// In each pane, subscribe to context changes
useEffect(() => {
  if (crosshairState.visible && crosshairState.timeIndex !== undefined) {
    // Draw vertical line at timeIndex
    const x = chart.timeScaleGetCoordinate(crosshairState.timeIndex);
    drawCrosshairLine(x);
  }
}, [crosshairState]);

// Main pane updates context on mouse move
const handleMouseMove = (timeIndex: number, price: number) => {
  setCrosshairState({
    visible: true,
    timeIndex,
    price,
    sourcePaneId: 'main'
  });
};
```

### Alternatives Considered

| Alternative | Rejected Because |
|--------------|------------------|
| Event bus (EventEmitter) | More complex, harder to debug in React |
| Redux/Zustand store | Unnecessary for this scope, adds boilerplate |
| Prop drilling through all panes | Messy with deeply nested component tree |

---

## 5. Settings Persistence

### Decision

Store theme settings in localStorage with key `chart-theme-settings`.

### Schema Structure

```typescript
interface ThemeSettings {
  backgroundBrightness: number;  // 0-100 (dark to darker)
  gridOpacity: number;             // 0-100
  gridVisible: boolean;
  candleColors: {
    up: string;      // Hex, e.g., "#26a69a"
    down: string;    // Hex, e.g., "#ef5350"
  };
  scaleSettings: {
    showLastPriceLine: boolean;
    showLastPriceLabel: boolean;
    showTimeLabels: boolean;
  };
}

const STORAGE_KEY = 'chart-theme-settings';
```

### Default Values

```typescript
const DEFAULT_SETTINGS: ThemeSettings = {
  backgroundBrightness: 0,
  gridOpacity: 25,
  gridVisible: true,
  candleColors: {
    up: '#26a69a',
    down: '#ef5350'
  },
  scaleSettings: {
    showLastPriceLine: true,
    showLastPriceLabel: true,
    showTimeLabels: true
  }
};
```

### Background Brightness Mapping

The slider value (0-100) maps to actual background color:

```typescript
function getBackgroundColor(brightness: number): string {
  // brightness 0 = #131722 (default dark)
  // brightness 100 = #0a0e14 (darker)
  // Interpolate between these values
  const defaultColor = { r: 19, g: 23, b: 34 };  // #131722
  const darkerColor = { r: 10, g: 14, b: 20 };     // #0a0e14

  const factor = brightness / 100;
  const r = Math.round(defaultColor.r - (defaultColor.r - darkerColor.r) * factor);
  const g = Math.round(defaultColor.g - (defaultColor.g - darkerColor.g) * factor);
  const b = Math.round(defaultColor.b - (defaultColor.b - darkerColor.b) * factor);

  return `rgb(${r}, ${g}, ${b})`;
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|--------------|------------------|
| Backend user preferences | Adds network dependency, violates local-first principle |
| URL params | Limited capacity, not suitable for multiple settings |
| CSS custom properties | Can't persist without JS, harder to type safely |

---

## Summary

All technology decisions have been made. Key choices:

1. **Multi-pane**: Multiple lightweight-charts instances with time-scale synchronization
2. **Drawings**: SVG overlay using coordinate conversion APIs
3. **Storage**: localStorage with per-symbol keys
4. **Crosshair**: React Context + callback pattern
5. **Settings**: localStorage with theme settings object

All decisions align with:
- Constitution principles (local-first, performance budgets, extensibility)
- Project constraints (no paid libraries, desktop MVP)
- Spec requirements (90% TradingView similarity, 60fps target)
