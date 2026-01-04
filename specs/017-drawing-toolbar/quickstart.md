# Developer Quickstart: Adding a New Drawing Tool

**Feature**: 017-drawing-toolbar
**Date**: 2026-01-04

## Overview

This guide explains how to add a new drawing tool to the TradingAlert drawing toolbar. The registry pattern makes it easy to add tools without modifying core toolbar code.

---

## Prerequisites

- Familiarity with React 19 and TypeScript 5.9
- Understanding of SVG rendering
- Knowledge of the existing drawing infrastructure (contexts, storage, types)

---

## Step-by-Step Guide

### Step 1: Define the Tool Configuration

Create a new entry in the tool registry at `/frontend/src/constants/drawingTools.ts`:

```typescript
import { PenTool } from 'lucide-react';

export const MY_NEW_TOOL: DrawingToolConfig = {
  id: 'my_tool',                     // Must match ToolId type
  label: 'My Tool',                  // Display name
  category: 'annotation',
  icon: PenTool,                     // Lucide React component
  cursor: 'crosshair',
  minPoints: 2,                      // Minimum clicks to create
  maxPoints: 2,                      // Maximum control points
  flyout: undefined,                // Or 'lines' if it's a sub-tool
  keyboardShortcut: undefined,      // Or 'Alt+M' for shortcut
  defaultStyle: {
    color: '#ffff00',
    lineWidth: 2,
  },
  enabled: true,
};
```

**Key fields**:
- `id`: Unique identifier, add to `ToolId` type in `/contracts/types.ts`
- `category`: Determines which toolbar group the tool belongs to
- `flyout`: If defined, this tool appears in a flyout menu instead of the main toolbar
- `minPoints`/`maxPoints`: How many clicks the user makes to create this tool

---

### Step 2: Add to ToolId Type (if new tool)

If you created a brand new tool (not one of the 29 in the spec), add it to the `ToolId` type in `/contracts/types.ts`:

```typescript
export type ToolId =
  | 'cursor'
  | 'trend_line'
  // ... existing tools ...
  | 'my_tool';  // Add your tool here
```

---

### Step 3: Create the Renderer Component

Create `/frontend/src/components/drawings/renderers/MyToolRenderer.tsx`:

```typescript
import React from 'react';
import type { Drawing, ChartApi } from '@/contracts/types';

interface MyToolRendererProps {
  drawing: Drawing;
  chartApi: ChartApi;
  isSelected: boolean;
  isHovered: boolean;
}

export function MyToolRenderer({
  drawing,
  chartApi,
  isSelected,
  isHovered,
}: MyToolRendererProps) {
  // Transform drawing points to screen coordinates
  const p1 = drawing.points[0];
  const p2 = drawing.points[1];

  const x1 = chartApi.timeToX(p1.time!);
  const y1 = chartApi.priceToY(p1.price!);
  const x2 = chartApi.timeToX(p2.time!);
  const y2 = chartApi.priceToY(p2.price!);

  // Get style
  const { color, lineWidth, lineStyle } = drawing.style;

  // Render SVG
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={isSelected ? '#26a69a' : color}
      strokeWidth={lineWidth}
      strokeDasharray={lineStyle === 'dotted' ? '2,2' : lineStyle === 'dashed' ? '8,4' : undefined}
      opacity={drawing.hidden ? 0 : 1}
    />
  );
}
```

**Key points**:
- Use `chartApi.timeToX()` and `chartApi.priceToY()` for coordinate transforms
- Apply `isSelected` styling (teal accent color)
- Respect `drawing.hidden` (opacity: 0)
- Handle null/undefined points (use `!` assertion only if you're sure the point exists)

---

### Step 4: Implement Hit Detection

Create `/frontend/src/utils/drawings/hitTest/myTool.ts`:

```typescript
import type { Drawing, Point, ChartApi } from '@/contracts/types';
import { pointToLineDistance } from '../drawingUtils';

export function hitTestMyTool(
  drawing: Drawing,
  point: Point,
  chartApi: ChartApi,
  tolerance = 5
): boolean {
  const p1 = drawing.points[0];
  const p2 = drawing.points[1];

  const x1 = chartApi.timeToX(p1.time!);
  const y1 = chartApi.priceToY(p1.price!);
  const x2 = chartApi.timeToX(p2.time!);
  const y2 = chartApi.priceToY(p2.price!);

  const dist = pointToLineDistance(point.x, point.y, x1, y1, x2, y2);
  return dist <= tolerance;
}
```

**For simple shapes** (lines, rectangles), use existing utilities:
- `pointToLineDistance()` - for trendlines, rays
- `pointInRectangle()` - for rectangles
- `distance()` - for points (circles)

**For complex shapes** (channels, pitchforks), test each sub-line individually.

---

### Step 5: Create the Tool Implementation

Create `/frontend/src/components/drawings/tools/MyTool.ts`:

```typescript
import React from 'react';
import type { DrawingTool } from '@/contracts/DrawingTool';
import { MyToolRenderer } from '../../renderers/MyToolRenderer';
import { hitTestMyTool } from '../../../utils/drawings/hitTest/myTool';
import { getLineHandles } from '../../../utils/drawings/handles';

export const MyTool: DrawingTool = {
  render(drawing, chartApi, isSelected, isHovered) {
    return (
      <MyToolRenderer
        drawing={drawing}
        chartApi={chartApi}
        isSelected={isSelected}
        isHovered={isHovered}
      />
    );
  },

  hitTest(drawing, point, chartApi, tolerance) {
    return hitTestMyTool(drawing, point, chartApi, tolerance);
  },

  getHandles(drawing, chartApi) {
    if (drawing.locked) return [];
    return getLineHandles(drawing, chartApi);
  },

  validatePoint(drawing, newPoint) {
    // Example: Reject duplicate points
    const lastPoint = drawing.points[drawing.points.length - 1];
    if (lastPoint && newPoint.time === lastPoint.time && newPoint.price === lastPoint.price) {
      return false;
    }
    return true;
  },

  getDefaultStyle() {
    return {
      color: '#ffff00',
      lineWidth: 2,
      lineStyle: 'solid',
    };
  },
};
```

---

### Step 6: Register the Tool

Add the tool to the registry in `/frontend/src/components/drawings/tools/index.ts`:

```typescript
import { MyTool } from './MyTool';
import { MY_NEW_TOOL } from '@/constants/drawingTools';

export const DRAWING_TOOLS: Record<string, DrawingTool> = {
  // ... existing tools ...
  my_tool: MyTool,
};

export const TOOL_CONFIGS: DrawingToolConfig[] = [
  // ... existing configs ...
  MY_NEW_TOOL,
];
```

---

### Step 7: Add to Toolbar or Flyout

#### Option A: Add as Primary Toolbar Button

Edit `/frontend/src/components/toolbar/DrawingToolbar.tsx` and add to the appropriate group:

```typescript
const GROUP_2_TOOLS: ToolId[] = [
  'brush',
  'text',
  'rectangle',
  'my_tool',  // Add here
];
```

#### Option B: Add to Flyout Menu

If the tool should be in a flyout, add it to the flyout configuration:

```typescript
const ANNOTATION_FLYOUT: FlyoutMenuConfig = {
  id: 'annotation',
  label: 'Annotation Tools',
  tools: ['brush', 'text', 'rectangle', 'my_tool'],
};
```

---

### Step 8: Add Icons (if needed)

If you're using a new Lucide icon, import it in `/frontend/src/constants/drawingTools.ts`:

```typescript
import { MyIcon } from 'lucide-react';
```

If the icon doesn't exist in Lucide, create a custom SVG icon component in `/frontend/src/components/icons/`:

```typescript
import React from 'react';

export function MyCustomIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2L2 22h20L12 2z" />  // Your icon path
    </svg>
  );
}
```

---

### Step 9: Write Tests

Create `/frontend/tests/unit/components/drawings/tools/MyTool.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MyToolRenderer } from '@/components/drawings/renderers/MyToolRenderer';
import { mockChartApi } from '@/test-utils/mocks';

describe('MyTool', () => {
  it('renders line correctly', () => {
    const drawing: Drawing = {
      id: '1',
      symbol: 'AAPL',
      toolId: 'my_tool',
      points: [
        { time: 1609459200000, price: 150 },
        { time: 1609545600000, price: 155 },
      ],
      style: { color: '#ffff00', lineWidth: 2 },
      state: 'complete',
      locked: false,
      hidden: false,
      createdAt: 1609459200000,
      updatedAt: 1609545600000,
    };

    const { container } = render(
      <MyToolRenderer
        drawing={drawing}
        chartApi={mockChartApi}
        isSelected={false}
        isHovered={false}
      />
    );

    const line = container.querySelector('line');
    expect(line).toBeTruthy();
    expect(line?.getAttribute('stroke')).toBe('#ffff00');
  });

  it('hit detection works correctly', () => {
    // Test hit detection logic
    const drawing = { /* ... */ };
    const point = { x: 100, y: 100 };
    const result = hitTestMyTool(drawing, point, mockChartApi);
    expect(result).toBe(true); // or false based on your test
  });
});
```

---

### Step 10: Verify and Test

1. **Start the dev server**:
   ```bash
   cd frontend && npm run dev
   ```

2. **Open the chart** and verify your tool appears in the toolbar/flyout

3. **Test the workflow**:
   - Click the tool button
   - Click on the chart to create the drawing
   - Verify the drawing renders correctly
   - Test selection (click on the drawing)
   - Test dragging (if handles implemented)
   - Test deletion (select + Delete key)

4. **Check persistence**:
   - Reload the page
   - Verify the drawing still exists

5. **Run tests**:
   ```bash
   npm test -- MyTool
   ```

---

## Examples

### Example 1: Simple Two-Point Tool (Trendline)

See `/frontend/src/components/drawings/tools/TrendlineTool.tsx` (existing).

### Example 2: Tool with Multiple Points (Brush)

Brush tools can have `maxPoints: 100` and handle many points. Simplify using Douglas-Peucker algorithm before saving.

### Example 3: Tool with Calculated Points (Fib Retracement)

Fib tools have `calculatePoints()` method that returns Fib levels based on the two input points.

---

## Troubleshooting

### Tool doesn't appear in toolbar
- Check that the tool is registered in `DRAWING_TOOLS` and `TOOL_CONFIGS`
- Verify it's added to the correct group array in `DrawingToolbar.tsx`
- Check browser console for errors

### Drawing doesn't render
- Verify `chartApi` is not null (check if chart is initialized)
- Add console.log to check if `render()` is being called
- Verify point coordinates are valid (not NaN, not null)

### Hit detection doesn't work
- Check that tolerance is sufficient (try increasing to 10px)
- Add console.log to verify the hit test function is called
- Verify coordinate transforms are correct

### Drawing doesn't persist
- Check that `state === 'complete'` before saving (drafts are not saved)
- Verify `DrawingStorage.saveForSymbol()` is called
- Check localStorage in DevTools → Application → Local Storage

---

## Next Steps

After creating your tool:
1. Add tests for hit detection edge cases
2. Add tests for coordinate transformation
3. Test on mobile (touch interactions)
4. Test with high DPI screens (Retina displays)
5. Test performance with 100+ drawings of your tool type

---

## Related Documentation

- [Data Model](../data-model.md) - Complete entity definitions
- [Contracts](./DrawingTool.ts) - DrawingTool interface
- [Research](../research.md) - SVG overlay strategy, hit detection
- [Spec](../spec.md) - Functional requirements
