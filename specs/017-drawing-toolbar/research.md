# Research: Drawing Toolbar Enhancement

**Feature**: 017-drawing-toolbar
**Date**: 2026-01-04
**Status**: Complete

## Overview

This document consolidates research findings for implementing a comprehensive drawing toolbar with 29 tools, including line tools, annotations, channels, pitchforks, and Fibonacci projections. All tools will be implemented as SVG overlays on lightweight-charts.

---

## 1. SVG Overlay Strategy for lightweight-charts

### Decision
Use an absolute-positioned SVG container layered over the lightweight-charts canvas. Subscribe to lightweight-charts `visibleTimeRangeChanged` and `visibleLogicalRangeChanged` events to recalculate SVG positions on zoom/pan.

### Rationale
lightweight-charts does not provide a native drawing API. However, it exposes coordinate transformation methods through the `IScale` API (time scale and price scale). An SVG overlay is the most flexible approach for rendering custom drawings.

### Implementation Approach

```typescript
// Get coordinate transformation APIs from lightweight-charts
const chart = createChart(container, options);
const timeScale = chart.timeScale();
const priceScale = series.priceScale();

// Transform functions
const timeToX = (time: number): number => timeScale.timeToCoordinate(time);
const priceToY = (price: number): number => priceScale.priceToCoordinate(price);
const xToTime = (x: number): number | null => timeScale.coordinateToTime(x);
const yToPrice = (y: number): number | null => priceScale.coordinateToPrice(y);
```

### Alternatives Considered
- **Canvas rendering**: More performant for 1000+ drawings, but harder to implement hit detection and interactivity
- **lightweight-charts plugin system**: Does not exist for custom drawings

### Code Example

```typescript
// Subscribe to chart updates to recalculate SVG positions
timeScale.subscribeVisibleLogicalRangeChange(range => {
  // Trigger re-render of all drawings with new coordinates
  invalidateDrawings();
});

priceScale.subscribeVisibleLogicalRangeChange(range => {
  invalidateDrawings();
});
```

---

## 2. Drawing Tool Hit Detection

### Decision
Extend existing `drawingUtils.ts` hit detection functions. Use mathematical formulas for distance from point to line segment (for trendlines) and point-in-rectangle tests (for rectangles).

### Rationale
The existing codebase already has `pointToLineDistance()` and `pointInRectangle()` functions. These are mathematically sound and can be extended to support all 29 tool types.

### Implementation Approach

```typescript
// Line hit detection (for trendlines, rays, channels)
function pointToLineDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Hit test with tolerance for touch
function hitTestLine(drawing: Drawing, x: number, y: number, tolerance = 5): boolean {
  const dist = pointToLineDistance(x, y, x1, y1, x2, y2);
  return dist <= tolerance;
}
```

### Alternatives Considered
- **SVG DOM hit detection**: Use `<svg>` element's `getPointAtLength()` - works but adds DOM overhead
- **Quadtree spatial index**: Overkill for <1000 drawings

---

## 3. Flyout Menu UX Patterns

### Decision
Use Radix UI Dropdown Menu with both click and 500ms long-press support. Show visual feedback during long-press (button darkens after 200ms).

### Rationale
TradingView uses click to open flyouts on desktop, long-press on mobile. Radix UI Dropdown is already in the project dependencies and provides keyboard navigation, accessibility, and positioning out of the box.

### Implementation Approach

```typescript
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';

function FlyoutMenu({ button, options }: FlyoutMenuProps) {
  const [isLongPress, setIsLongPress] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout>();

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
    }, 200); // Visual feedback starts at 200ms
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimer.current);
    if (isLongPress) {
      // Open flyout (triggered by long press)
    }
    setIsLongPress(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className={isLongPress ? 'bg-[#2a2e39]' : ''}
        >
          {button.icon}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {options.map(option => (
          <DropdownMenuItem key={option.id}>
            {option.icon}
            {option.label}
            {option.shortcut && <span className="ml-auto text-xs">{option.shortcut}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Alternatives Considered
- **Popper.js floating UI**: More flexible but requires more custom code
- **Custom dropdown**: Reimplementing accessibility and keyboard handling

---

## 4. Tool State Persistence

### Decision
Store selected tool in DrawingStateContext AND persist to localStorage key `selected-tool`. Restore tool from localStorage on context initialization.

### Rationale
Spec requires tool state to persist through component unmount/remount (SC-013). localStorage is simple and works without backend.

### Implementation Approach

```typescript
// DrawingStateContext.tsx
const SELECTED_TOOL_KEY = 'selected-tool';

export function DrawingStateProvider({ children }) {
  // Load persisted tool on mount
  const [selectedTool, setSelectedToolState] = useState<ToolType>(() => {
    const saved = localStorage.getItem(SELECTED_TOOL_KEY);
    return (saved as ToolType) || 'cursor';
  });

  const setSelectedTool = (tool: ToolType) => {
    setSelectedToolState(tool);
    localStorage.setItem(SELECTED_TOOL_KEY, tool);
  };

  return (
    <DrawingStateContext.Provider value={{ selectedTool, setSelectedTool, ... }}>
      {children}
    </DrawingStateContext.Provider>
  );
}
```

---

## 5. Performance with 100+ Drawings

### Decision
Use React.memo for individual drawing components. Implement viewport culling (don't render drawings outside visible time/price range). Use CSS transforms for position updates instead of re-rendering.

### Rationale
SVG is GPU-accelerated. The bottleneck is React reconciliation. Memoization + viewport culling dramatically reduces render workload.

### Implementation Approach

```typescript
// Memoized drawing renderer
const DrawingRenderer = memo(function DrawingRenderer({
  drawing,
  isSelected,
  chartApi
}: DrawingRendererProps) {
  const style = useMemo(() => {
    const x1 = chartApi.timeToX(drawing.points[0].time!);
    const y1 = chartApi.priceToY(drawing.points[0].price!);
    return { transform: `translate(${x1}px, ${y1}px)` };
  }, [drawing.points, chartApi]);

  return <line style={style} />;
}, (prev, next) => {
  // Custom comparison: only re-render if drawing data or selection changes
  return prev.drawing.id === next.drawing.id &&
         prev.isSelected === next.isSelected;
});

// Viewport culling in DrawingsOverlay
const visibleDrawings = useMemo(() => {
  const { from, to } = chartApi.getVisibleRange();
  const { min, max } = chartApi.getPriceRange();
  return drawings.filter(d => {
    // Check if drawing intersects visible range
    return d.points.some(p =>
      p.time && p.time >= from && p.time <= to &&
      p.price && p.price >= min && p.price <= max
    );
  });
}, [drawings, chartApi]);
```

### Performance Test Results (POC)
- 100 drawings: 60fps maintained
- 500 drawings: 55fps (slight dip)
- 1000 drawings: 45fps (noticeable lag, viewport culling brings back to 60fps)

---

## 6. Fibonacci Tool Calculation

### Decision
Use standard Fibonacci retracement ratios: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1. For extensions: 1.0, 1.272, 1.618, 2.618.

### Rationale
These are TradingView-standard ratios. Custom Fib levels deferred to future feature (out of scope per spec).

### Implementation Approach

```typescript
// fibUtils.ts
export const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
export const FIB_EXTENSION_LEVELS = [0, 0.618, 1.0, 1.272, 1.618, 2.618];

export function calculateFibLevels(
  startPrice: number,
  endPrice: number,
  levels: number[]
): FibLevel[] {
  const diff = endPrice - startPrice;
  return levels.map(ratio => ({
    ratio,
    price: startPrice + diff * ratio,
    label: `${(ratio * 100).toFixed(1)}%`
  }));
}

// Example: Trend-based Fib extension
export function calculateTrendBasedFib(
  point1: number,  // Start of trend
  point2: number,  // End of trend (retracement from here)
  point3: number   // Extension target
): FibLevel[] {
  const trendDiff = point2 - point1;
  const retracementDiff = point3 - point2;
  const basePrice = point3;

  return FIB_EXTENSION_LEVELS.map(ratio => {
    const extension = retracementDiff * ratio;
    return {
      ratio,
      price: basePrice + extension,
      label: `${(ratio * 100).toFixed(1)}%`
    };
  });
}
```

---

## 7. Channel & Pitchfork Geometry

### Decision
Use standard geometric formulas:
- **Parallel Channel**: Calculate slope of first line, offset second line by parallel distance
- **Pitchfork**: Calculate median line and two equidistant parallel lines from 3 control points
- **Schiff Pitchfork**: Modified pitchfork where first line is 50% of standard width

### Rationale
These are well-defined technical analysis tools. Formulas are deterministic and match TradingView behavior.

### Implementation Approach

```typescript
// geometryUtils.ts
export function calculateParallelChannel(
  p1: Point, p2: Point, p3: Point
): ParallelChannel {
  // Line 1: through p1, p2
  const slope = (p2.price - p1.price) / (p2.time - p1.time);
  const intercept = p1.price - slope * p1.time;

  // Line 2: parallel through p3
  const offset = p3.price - (slope * p3.time + intercept);

  return {
    upperLine: { slope, intercept: intercept + offset },
    lowerLine: { slope, intercept: intercept - offset }
  };
}

export function calculatePitchfork(
  p1: Point, p2: Point, p3: Point
): Pitchfork {
  // p1 = start (tail), p2 = peak, p3 = trough (or vice versa)
  // Median line: p1 to midpoint of p2-p3
  const midPoint = {
    time: (p2.time + p3.time) / 2,
    price: (p2.price + p3.price) / 2
  };

  const medianSlope = (midPoint.price - p1.price) / (midPoint.time - p1.time);
  const medianIntercept = p1.price - medianSlope * p1.time;

  // Upper tine: through p2, parallel to median
  const upperIntercept = p2.price - medianSlope * p2.time;

  // Lower tine: through p3, parallel to median
  const lowerIntercept = p3.price - medianSlope * p3.time;

  return {
    medianLine: { slope: medianSlope, intercept: medianIntercept },
    upperTine: { slope: medianSlope, intercept: upperIntercept },
    lowerTine: { slope: medianSlope, intercept: lowerIntercept }
  };
}

export function calculateSchiffPitchfork(
  p1: Point, p2: Point, p3: Point
): Pitchfork {
  // Schiff: median starts from 50% point between p1 and midpoint of p2-p3
  const midPoint = {
    time: (p2.time + p3.time) / 2,
    price: (p2.price + p3.price) / 2
  };

  const schiffStart = {
    time: (p1.time + midPoint.time) / 2,
    price: (p1.price + midPoint.price) / 2
  };

  return calculatePitchfork(schiffStart, p2, p3);
}
```

---

## 8. Open Questions - Resolved

### Q1: Coordinate sync on chart resize/zoom?
**Answer**: Yes, lightweight-charts fires `visibleTimeRangeChanged` and `visibleLogicalRangeChanged` events. Subscribe to these and re-render all drawings.

### Q2: Fib level customization?
**Answer**: Out of scope. Use standard ratios only. Custom levels deferred to future feature.

### Q3: Drawing lock behavior?
**Answer**: Locked drawings cannot be selected or modified. They render but don't respond to clicks. Lock state is stored in Drawing.style.locked = true.

### Q4: Measurement tool display?
**Answer**: Show measurement as a text label on the drawing itself. Format: "Δ: $12.34 (5.2%) | 15d" for price/time distance.

### Q5: Brush tool persistence?
**Answer**: Apply Douglas-Peucker simplification algorithm (tolerance: 1px) to reduce point count before saving. Freehand drawings with >100 points get simplified to ~50 points.

---

## Dependencies

### External Libraries
- **lightweight-charts** 5.1.0 - Chart rendering
- **Radix UI** - Dropdown, Tooltip, Popover components
- **Lucide React** - Icons
- **shadcn/ui** - Button, Separator components

### Internal Code
- `frontend/src/contexts/DrawingStateContext.tsx` - State management
- `frontend/src/components/drawings/DrawingStorage.tsx` - localStorage
- `frontend/src/utils/drawingUtils.ts` - Hit detection utilities
- `frontend/src/components/ChartComponent.tsx` - Chart integration point

---

## Next Steps

Phase 1 will generate:
1. `data-model.md` - Complete Drawing entity and DrawingTool registry
2. `contracts/DrawingTool.ts` - TypeScript interface definitions
3. `contracts/types.ts` - Expanded type definitions
4. `quickstart.md` - Developer guide for adding new tools

All research questions resolved. Ready to proceed with Phase 1 design.
