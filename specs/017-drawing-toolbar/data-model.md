# Data Model: Drawing Toolbar Enhancement

**Feature**: 017-drawing-toolbar
**Date**: 2026-01-04

## Overview

This document defines the data model for the Drawing Toolbar feature, including the Drawing entity, DrawingTool registry, tool configuration, and state management.

---

## Core Entities

### 1. Drawing

Represents a single drawing annotation on the chart. Drawings are created by users and persisted per symbol in localStorage.

```typescript
interface Drawing {
  // Identity
  id: string;                  // UUID v4
  symbol: string;              // Stock symbol (e.g., 'AAPL')

  // Tool type
  toolId: ToolId;              // From Tool Identifier Mapping

  // Geometry (variable based on tool type)
  points: DrawingPoint[];      // 1-5 control points

  // Styling
  style: DrawingStyle;

  // State
  state: DrawingState;         // 'draft' | 'complete' | 'locked' | 'hidden'
  locked: boolean;             // If true, cannot be modified
  hidden: boolean;             // If true, not rendered

  // Metadata
  createdAt: number;           // Unix timestamp (ms)
  updatedAt: number;           // Unix timestamp (ms)

  // Tool-specific extensions
  extension?: ToolExtension;   // Additional data for Fib/channels/pitchforks
}

interface DrawingPoint {
  time?: number | null;        // Unix timestamp (ms) or null for price-only
  price?: number | null;       // Price or null for time-only
}

interface DrawingStyle {
  color: string;               // Hex color (default: #ffff00)
  lineWidth: number;           // 1-4px
  lineStyle?: LineStyle;       // 'solid' | 'dotted' | 'dashed'
  fillOpacity?: number;        // 0-100 for rectangles/channels
  fontSize?: number;           // For text (default: 12)
}

type LineStyle = 'solid' | 'dotted' | 'dashed';
type DrawingState = 'draft' | 'complete' | 'locked' | 'hidden';
```

**Tool Extension Types**:

```typescript
// Fibonacci-specific data
interface FibExtension {
  levels: FibLevel[];
  customLevels?: number[];     // Future: custom Fib ratios
}

interface FibLevel {
  ratio: number;               // e.g., 0.236, 0.382, 0.5, 0.618
  price: number;               // Calculated price
  label: string;               // e.g., "23.6%"
  showLabel: boolean;          // Whether to display label
}

// Channel-specific data
interface ChannelExtension {
  upperOffset: number;         // Price offset for upper line
  lowerOffset: number;         // Price offset for lower line
}

// Pitchfork-specific data
interface PitchforkExtension {
  type: 'standard' | 'schiff' | 'modified_schiff' | 'inside';
  medianRatio: number;         // Schiff uses 0.5, others use 1.0
}

// Brush-specific data (simplified)
interface BrushExtension {
  simplifiedPoints: Point[];   // After Douglas-Peucker simplification
  originalPointCount: number;  // For reference
}

// Measurement-specific data
interface MeasurementExtension {
  priceDelta: number;          // Price difference
  timeDelta: number;           // Time difference (ms)
  percentChange?: number;      // Percentage change (if applicable)
  displayFormat: 'compact' | 'verbose';
}

type ToolExtension = FibExtension | ChannelExtension | PitchforkExtension | BrushExtension | MeasurementExtension;
```

**Relationships**:
- Each `Drawing` belongs to exactly one `symbol`
- Each `Drawing` has exactly one `toolId` from the `DrawingToolRegistry`
- Each `Drawing` can have zero or one `ToolExtension` depending on its type

---

### 2. DrawingTool (Registry)

Represents a drawing tool type in the toolbar. Tools are registered in a central registry.

```typescript
interface DrawingToolConfig {
  // Identity
  id: ToolId;                  // e.g., 'trend_line', 'fib_retracement'
  label: string;               // Display name
  category: ToolCategory;

  // UI
  icon: string;                // Lucide icon name (e.g., 'MousePointer', 'Minus')
  iconName: string;            // Alias for icon (for clarity in code)

  // Cursor
  cursor: CSSCursor;           // CSS cursor value when tool active

  // Keyboard shortcut
  keyboardShortcut?: string;   // e.g., 'Alt+T', 'Alt+H'

  // Geometry
  minPoints: number;           // Minimum points to create (1-5)
  maxPoints: number;           // Maximum control points (1-5)

  // Rendering & interaction
  renderer: DrawingToolRenderer; // React component
  hitTester: HitTester;        // Hit detection function
  handleProvider?: HandleProvider; // Drag handles (optional)

  // Flyout
  flyout?: string;             // Parent flyout menu ID (if sub-tool)
  flyoutIndex?: number;        // Order within flyout

  // Defaults
  defaultStyle: Partial<DrawingStyle>;

  // Metadata
  enabled: boolean;            // Can be disabled for future features
}

type CSSCursor =
  | 'crosshair'
  | 'pointer'
  | 'text'
  | 'move'
  | 'nwse-resize'
  | 'nesw-resize'
  | 'ew-resize'
  | 'ns-resize'
  | 'default';

type ToolCategory =
  | 'basic'      // Cursor, Crosshair (5 tools)
  | 'lines'      // Line tools (7 tools)
  | 'annotation' // Brush, Text, Rectangle (3 tools)
  | 'channels'   // Channel tools (4 tools)
  | 'pitchforks' // Pitchfork tools (4 tools)
  | 'projections' // Fib tools (3 tools)
  | 'advanced'   // Measurement (1 tool)
  | 'actions';   // Lock/Unlock, Show/Hide, Delete (3 tools)
```

**Tool Interface**:

```typescript
interface DrawingToolRenderer {
  (props: DrawingRendererProps): React.ReactNode;
}

interface DrawingRendererProps {
  drawing: Drawing;
  chartApi: ChartApi;
  isSelected: boolean;
  isHovered: boolean;
  onPointUpdate: (index: number, point: DrawingPoint) => void;
}

type HitTester = (drawing: Drawing, point: Point, chartApi: ChartApi, tolerance?: number) => boolean;

type HandleProvider = (drawing: Drawing, chartApi: ChartApi) => Handle[];
```

---

### 3. DrawingToolRegistry

Central registry of all available drawing tools.

```typescript
interface DrawingToolRegistry {
  register(config: DrawingToolConfig): void;
  unregister(id: ToolId): void;
  get(id: ToolId): DrawingToolConfig | undefined;
  getAll(): DrawingToolConfig[];
  getByCategory(category: ToolCategory): DrawingToolConfig[];
  getByFlyout(flyoutId: string): DrawingToolConfig[];
}

// Usage
const registry: DrawingToolRegistry = {
  // Basic tools
  'cursor': { id: 'cursor', label: 'Cursor', category: 'basic', minPoints: 0, maxPoints: 0, ... },
  'trend_line': { id: 'trend_line', label: 'Trend Line', category: 'lines', minPoints: 2, maxPoints: 2, keyboardShortcut: 'Alt+T', ... },
  'horizontal_line': { id: 'horizontal_line', label: 'Horizontal Line', category: 'lines', minPoints: 1, maxPoints: 1, keyboardShortcut: 'Alt+H', ... },

  // Lines flyout
  'ray': { id: 'ray', label: 'Ray', category: 'lines', minPoints: 2, maxPoints: 2, flyout: 'lines', flyoutIndex: 0, ... },
  'vertical_line': { id: 'vertical_line', label: 'Vertical Line', category: 'lines', minPoints: 1, maxPoints: 1, keyboardShortcut: 'Alt+V', flyout: 'lines', flyoutIndex: 5, ... },

  // Annotations
  'brush': { id: 'brush', label: 'Brush', category: 'annotation', minPoints: 2, maxPoints: 100, ... },
  'text': { id: 'text', label: 'Text', category: 'annotation', minPoints: 1, maxPoints: 1, ... },
  'rectangle': { id: 'rectangle', label: 'Rectangle', category: 'annotation', minPoints: 2, maxPoints: 2, ... },

  // Projections
  'fib_retracement': { id: 'fib_retracement', label: 'Fib Retracement', category: 'projections', minPoints: 2, maxPoints: 2, flyout: 'projections', flyoutIndex: 0, ... },

  // Actions (not drawings)
  'lock_unlock': { id: 'lock_unlock', label: 'Lock/Unlock', category: 'actions', isAction: true, ... },
  'show_hide_all': { id: 'show_hide_all', label: 'Show/Hide All', category: 'actions', isAction: true, ... },
  'delete_all': { id: 'delete_all', label: 'Delete All', category: 'actions', isAction: true, ... },
};
```

---

### 4. ChartApi (Abstraction)

Interface for coordinate transformation between chart data (time/price) and screen coordinates (x/y pixels).

```typescript
interface ChartApi {
  // Coordinate transforms
  timeToX(time: number): number;
  priceToY(price: number): number;
  xToTime(x: number): number | null;
  yToPrice(y: number): number | null;

  // Chart bounds
  getVisibleTimeRange(): VisibleTimeRange;
  getVisiblePriceRange(): VisiblePriceRange;

  // Canvas dimensions
  getWidth(): number;
  getHeight(): number;

  // Subscribe to changes (zoom, pan)
  // Returns unsubscribe function (call to remove listener)
  subscribeToChanges(callback: () => void): () => void;
}

interface VisibleTimeRange {
  from: number;  // Unix timestamp (ms)
  to: number;    // Unix timestamp (ms)
}

interface VisiblePriceRange {
  min: number;
  max: number;
}
```

---

### 5. DrawingStateContext

React Context for managing drawing state across the application.

```typescript
interface DrawingStateContextValue {
  // Current tool selection
  selectedTool: ToolId;
  setSelectedTool: (tool: ToolId) => void;

  // Active drawing (being created)
  activeDrawing: Drawing | null;
  setActiveDrawing: (drawing: Drawing | null) => void;

  // Drawings for current symbol
  drawings: Drawing[];
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  removeDrawing: (id: string) => void;

  // Selection/hover state
  selectedDrawing: Drawing | null;
  setSelectedDrawing: (drawing: Drawing | null) => void;
  hoveredDrawing: Drawing | null;
  setHoveredDrawing: (drawing: Drawing | null) => void;

  // Actions
  lockAllDrawings: () => void;
  unlockAllDrawings: () => void;
  hideAllDrawings: () => void;
  showAllDrawings: () => void;
  deleteAllDrawings: () => void;

  // Symbol management
  loadDrawingsForSymbol: (symbol: string) => void;
  clearDrawings: () => void;

  // Chart API reference
  chartApi: ChartApi | null;
  setChartApi: (api: ChartApi) => void;
}
```

---

### 6. Flyout Menu

Configuration for toolbar flyout menus.

```typescript
interface FlyoutMenuConfig {
  id: string;                  // e.g., 'lines', 'channels', 'pitchforks', 'projections'
  label: string;               // For accessibility
  tools: ToolId[];             // Tools in this flyout
  icon?: React.ReactNode;      // Icon for the parent button
  keyboardShortcut?: string;   // Shortcut for primary tool in flyout
}

// Example
const LINES_FLYOUT: FlyoutMenuConfig = {
  id: 'lines',
  label: 'Line Tools',
  tools: [
    'ray',
    'info_line',
    'extended_line',
    'trend_angle',
    'horizontal_ray',
    'vertical_line',
    'cross_line'
  ],
  icon: <Minus className="rotate-[-45deg]" />,
  keyboardShortcut: 'Alt+T' // For Trend Line (primary)
};

### Keyboard Shortcut Mapping

The following keyboard shortcuts are displayed in flyout menus next to their corresponding tools:

| Shortcut | Tool ID | Display Name | Flyout Menu | Position in Flyout |
|----------|---------|--------------|-------------|-------------------|
| Alt+T | trend_line | Trend Line | (Primary button - not in flyout) | N/A |
| Alt+H | horizontal_line | Horizontal Line | (Primary button - not in flyout) | N/A |
| Alt+V | vertical_line | Vertical Line | lines | Index 5 |
| Alt+C | cross_line | Cross Line | lines | Index 6 |
| Alt+J | horizontal_ray | Horizontal Ray | lines | Index 4 |

**Implementation Notes**:
- Only these 5 shortcuts have keyboard bindings defined in FR-026
- When rendering flyout menus, check `toolConfig.keyboardShortcut` and display if present
- Format: `<span className="ml-auto text-xs text-slate-400">{shortcut}</span>`
- Shortcuts should be right-aligned in the flyout menu item
```

---

## State Machine

### Tool Selection State

```
States:
  - cursor: Default state, normal chart interaction
  - drawing_tool_selected: Tool button clicked, waiting for first click
  - creating: User has clicked at least once, collecting points
  - complete: Drawing finished, can be selected/edited
  - locked: Drawing immutable, cannot be modified
  - hidden: Drawing not rendered

Transitions:
  1. Any state → cursor:
     - Trigger: ESC key, click Cursor button, click empty space
     - Action: Deselect any drawing, clear activeDrawing

  2. cursor → drawing_tool_selected:
     - Trigger: Click tool button, keyboard shortcut
     - Action: Set selectedTool, update cursor style

  3. drawing_tool_selected → creating:
     - Trigger: First click on chart
     - Action: Create new Drawing with state='draft', set as activeDrawing

  4. creating → creating (add point):
     - Trigger: Click on chart (before minPoints reached)
     - Action: Add point to activeDrawing.points[]

  5. creating → complete:
     - Trigger: minPoints reached + Enter key or double-click or timeout
     - Action: Set activeDrawing.state='complete', save to localStorage

  6. creating → cursor:
     - Trigger: ESC key during creation
     - Action: Discard activeDrawing

  7. complete → creating:
     - Trigger: Click existing drawing (edit mode)
     - Action: Set activeDrawing, allow point modification

  8. complete → locked:
     - Trigger: Click Lock button or right-click → Lock
     - Action: Set drawing.locked=true

  9. locked → complete:
     - Trigger: Click Unlock button
     - Action: Set drawing.locked=false

  10. complete → hidden:
     - Trigger: Click Hide button or right-click → Hide
     - Action: Set drawing.hidden=true

  11. hidden → complete:
     - Trigger: Click Show All button
     - Action: Set drawing.hidden=false
```

---

## Data Validation

### Drawing Point Validation

```typescript
function validateDrawingPoint(point: DrawingPoint): ValidationResult {
  const errors: string[] = [];

  if (point.time !== null && point.time !== undefined) {
    if (point.time < 0) errors.push('time must be >= 0');
    if (!Number.isInteger(point.time)) errors.push('time must be integer (ms)');
  }

  if (point.price !== null && point.price !== undefined) {
    if (point.price < 0) errors.push('price must be >= 0');
    if (!Number.isFinite(point.price)) errors.push('price must be finite');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

### Drawing Validation

```typescript
function validateDrawing(drawing: Drawing, toolConfig: DrawingToolConfig): ValidationResult {
  const errors: string[] = [];

  // Check point count
  if (drawing.points.length < toolConfig.minPoints) {
    errors.push(`Drawing must have at least ${toolConfig.minPoints} points`);
  }
  if (drawing.points.length > toolConfig.maxPoints) {
    errors.push(`Drawing cannot have more than ${toolConfig.maxPoints} points`);
  }

  // Validate each point
  drawing.points.forEach((point, i) => {
    const validation = validateDrawingPoint(point);
    if (!validation.valid) {
      errors.push(`Point ${i}: ${validation.errors.join(', ')}`);
    }
  });

  // Check style
  if (!drawing.style.color) errors.push('Style must have color');
  if (drawing.style.lineWidth < 1 || drawing.style.lineWidth > 4) {
    errors.push('lineWidth must be 1-4px');
  }

  return { valid: errors.length === 0, errors };
}
```

---

## Storage Schema

### localStorage Keys

```
drawings-{SYMBOL}: Drawing[]
  - Array of complete drawings for a symbol
  - Draft drawings NOT saved (exist only in memory)
  - Example: drawings-AAPL, drawings-TSLA

selected-tool: ToolId
  - Currently selected tool
  - Persists across page reloads

drawings-meta: {
  version: string;  // For migrations
  lastUpdated: number;
}
```

### Drawing JSON Format

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "symbol": "AAPL",
  "toolId": "trend_line",
  "points": [
    { "time": 1609459200000, "price": 150.25 },
    { "time": 1609545600000, "price": 155.50 }
  ],
  "style": {
    "color": "#ffff00",
    "lineWidth": 2,
    "lineStyle": "solid"
  },
  "state": "complete",
  "locked": false,
  "hidden": false,
  "createdAt": 1609459200000,
  "updatedAt": 1609545600000
}
```

---

## Relationships Summary

```
┌─────────────────┐
│   DrawingTool   │
│    Registry     │
└────────┬────────┘
         │ 1
         │
         │ has many
         ▼
┌─────────────────┐
│   DrawingTool   │
│     Config      │
└─────────────────┘
         │ 1
         │
         │ creates
         ▼
┌─────────────────┐       ┌─────────────────┐
│    Drawing      │───────│  ToolExtension  │
│                 │ 1..1  │  (optional)     │
└────────┬────────┘       └─────────────────┘
         │
         │ has many
         ▼
┌─────────────────┐
│  DrawingPoint   │
│    (1-5)        │
└─────────────────┘
```

---

## Index Considerations

For performance with 100+ drawings per symbol:

1. **Symbol-based partitioning**: Each symbol has its own localStorage key (`drawings-{SYMBOL}`). Load only the current symbol's drawings into memory.

2. **Viewport culling**: Filter drawings by visible time/price range before rendering. Drawings outside the visible range are not rendered (but remain in memory).

3. **Spatial indexing (deferred)**: For 1000+ drawings, consider an R-tree or quadtree for faster hit testing. Not needed for MVP (100 drawings target).

---

## Migration Strategy

### Version 1 → Version 2

If the drawing schema changes, add a migration function:

```typescript
function migrateDrawings_v1_to_v2(oldDrawings: any[]): Drawing[] {
  return oldDrawings.map(old => ({
    ...old,
    // Add new fields with defaults
    locked: old.locked ?? false,
    hidden: old.hidden ?? false,
    // Transform old format to new
    toolId: mapOldToolType(old.type),
  }));
}
```

Check version on load:

```typescript
const meta = localStorage.getItem('drawings-meta');
if (meta) {
  const { version } = JSON.parse(meta);
  if (version !== CURRENT_VERSION) {
    drawings = migrateDrawings(drawings, version, CURRENT_VERSION);
  }
}
```
