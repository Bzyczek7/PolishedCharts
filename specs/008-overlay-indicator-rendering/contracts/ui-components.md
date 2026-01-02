# UI Component Contracts: Overlay Indicator Rendering & Configuration UI

**Feature**: 008-overlay-indicator-rendering
**Date**: 2025-12-26
**Status**: Phase 1 Output

## Overview

This document defines the API contracts for all UI components created for Feature 008.

---

## 1. OverlayIndicatorLegend

**Purpose**: Display list of overlay indicators with hover-based context menu

**File**: `frontend/src/components/OverlayIndicatorLegend.tsx`

### Props

```typescript
interface OverlayIndicatorLegendProps {
  // List of overlay indicator instances
  indicators: IndicatorInstance[];

  // Currently hovered indicator ID (for context menu positioning)
  hoveredIndicatorId: string | null;

  // Callback: User hovered over an indicator
  onHover: (indicatorId: string | null) => void;

  // Callback: User requested to hide/show indicator
  onToggleVisibility: (indicatorId: string) => void;

  // Callback: User clicked "Settings" button
  onOpenSettings: (indicatorId: string) => void;

  // Callback: User clicked "Source Code" button
  onViewSource: (indicatorId: string) => void;

  // Callback: User clicked "Remove" button
  onRemove: (indicatorId: string) => void;
}
```

### Behavior

- **Rendering**: Display each indicator as a horizontal row with:
  - Color swatch (filled circle with indicator's `style.color`)
  - Display name (e.g., "SMA (20)")
  - Hidden indicator shown with opacity 0.5

- **Hover Interaction**:
  - On hover: show context menu with 4 actions
  - Menu appears adjacent to legend item (viewport-aware)
  - Menu disappears when cursor leaves area

- **Context Menu Actions**:
  1. **Hide/Show**: Toggle `isVisible` state
  2. **Settings...**: Open `IndicatorSettingsDialog`
  3. **Source Code**: Open `SourceCodeModal`
  4. **Remove**: Delete indicator (with confirmation)

### Example Usage

```tsx
<OverlayIndicatorLegend
  indicators={overlayIndicators}
  hoveredIndicatorId={hoveredId}
  onHover={setHoveredId}
  onToggleVisibility={handleToggleVisibility}
  onOpenSettings={handleOpenSettings}
  onViewSource={handleViewSource}
  onRemove={handleRemove}
/>
```

### Accessibility

- Keyboard: Tab to navigate, Enter/Space to activate actions
- ARIA: `role="list"`, `aria-label="Overlay indicators"`
- Focus: Visual indicator for keyboard focus

---

## 2. IndicatorContextMenu

**Purpose**: Hover-based action menu for individual indicators

**File**: `frontend/src/components/IndicatorContextMenu.tsx`

### Props

```typescript
interface IndicatorContextMenuProps {
  // Whether menu is open
  open: boolean;

  // Indicator instance this menu controls
  indicator: IndicatorInstance;

  // Position relative to viewport
  x: number;
  y: number;

  // Callbacks for each action
  onHide: () => void;
  onSettings: () => void;
  onSourceCode: () => void;
  onRemove: () => void;
}
```

### Behavior

- **Positioning**: Automatically adjust if near viewport edge
- **Trigger**: Mouse hover over legend item (delay 200ms)
- **Dismiss**: Mouse leave or action clicked

### Menu Items

| Label | Icon | Action |
|-------|------|--------|
| Hide / Show | Eye / EyeOff | Toggle visibility |
| Settings... | Settings | Open settings dialog |
| Source Code | Code | View Pine Script |
| Remove | Trash | Delete indicator |

---

## 3. IndicatorSettingsDialog

**Purpose**: Tabbed settings modal for indicator configuration

**File**: `frontend/src/components/IndicatorSettingsDialog.tsx`

### Props

```typescript
interface IndicatorSettingsDialogProps {
  // Whether dialog is open
  open: boolean;

  // Indicator being edited
  indicator: IndicatorInstance | null;

  // Available indicator metadata (from backend)
  indicatorMetadata: IndicatorInfo | null;

  // Callback: User closed dialog (cancel or apply)
  onOpenChange: (open: boolean) => void;

  // Callback: User applied changes
  onApplyChanges: (instanceId: string, updates: Partial<IndicatorInstance>) => void;
}
```

### Behavior

- **Layout**: Radix UI Dialog with Tabs (Inputs, Style, Visibility)
- **Persistence**: Changes apply immediately (no "Save" button)
- **Validation**: Live validation on parameter inputs

### Tabs

| Tab | Content | Component |
|-----|---------|-----------|
| Inputs | Parameter inputs (number fields) | `IndicatorSettingsInputs` |
| Style | Color picker, line width | `IndicatorSettingsStyle` |
| Visibility | Hide/show toggle | `IndicatorSettingsVisibility` |

### Example Usage

```tsx
<IndicatorSettingsDialog
  open={isSettingsOpen}
  indicator={editingIndicator}
  indicatorMetadata={metadata}
  onOpenChange={setIsSettingsOpen}
  onApplyChanges={handleApplyChanges}
/>
```

---

## 4. IndicatorSettingsInputs (Inputs Tab)

**Purpose**: Parameter editing inputs

**File**: `frontend/src/components/IndicatorSettingsInputs.tsx`

### Props

```typescript
interface IndicatorSettingsInputsProps {
  // Current parameter values
  params: Record<string, number | string>;

  // Parameter definitions from backend
  parameterDefinitions: ParameterDefinition[];

  // Callback: Parameter value changed
  onParamChange: (name: string, value: number | string) => void;

  // Validation errors (param name -> error message)
  errors: Record<string, string>;
}
```

### Behavior

- Render one input per parameter in `parameterDefinitions`
- Number inputs show min/max range
- String inputs show as text fields
- Live validation: show error if value out of range

### Example

```tsx
<IndicatorSettingsInputs
  params={{ period: 20 }}
  parameterDefinitions={[
    { name: 'period', type: 'int', default: 20, min: 1, max: 200, description: 'SMA period' }
  ]}
  onParamChange={handleParamChange}
  errors={{}}
/>
```

---

## 5. IndicatorSettingsStyle (Style Tab)

**Purpose**: Visual styling controls

**File**: `frontend/src/components/IndicatorSettingsStyle.tsx`

### Props

```typescript
interface IndicatorSettingsStyleProps {
  // Current style configuration
  style: IndicatorStyle;

  // Callback: Style property changed
  onStyleChange: (style: Partial<IndicatorStyle>) => void;
}
```

### UI Elements

- **Color Picker**: `<input type="color">` wrapped in `ColorPicker` component
- **Line Width**: Slider or select (1, 2, 3, 4)
- **Show Last Value**: Checkbox toggle

### Example

```tsx
<IndicatorSettingsStyle
  style={{ color: '#ff6d00', lineWidth: 2, showLastValue: true }}
  onStyleChange={handleStyleChange}
/>
```

---

## 6. IndicatorSettingsVisibility (Visibility Tab)

**Purpose**: Visibility toggle

**File**: `frontend/src/components/IndicatorSettingsVisibility.tsx`

### Props

```typescript
interface IndicatorSettingsVisibilityProps {
  // Current visibility state
  isVisible: boolean;

  // Callback: Visibility toggled
  onVisibilityChange: (visible: boolean) => void;
}
```

### UI Elements

- **Toggle Switch**: Radix UI Switch component
- **Label**: "Show indicator on chart" / "Indicator is hidden"

### Example

```tsx
<IndicatorSettingsVisibility
  isVisible={true}
  onVisibilityChange={setVisible}
/>
```

---

## 7. ColorPicker

**Purpose**: Color input wrapper with accessibility

**File**: `frontend/src/components/ColorPicker.tsx`

### Props

```typescript
interface ColorPickerProps {
  // Current color value (hex format)
  value: string;

  // Label for accessibility
  label?: string;

  // Callback: Color changed
  onChange: (color: string) => void;

  // Optional: Dismissible preset colors
  presets?: string[];
}
```

### Behavior

- Native `<input type="color">` with custom wrapper
- Optional preset swatches for quick selection
- Keyboard accessible (Tab to focus, Enter to open picker)

### Example

```tsx
<ColorPicker
  value="#ff6d00"
  label="Line color"
  onChange={setColor}
  presets={['#ff6d00', '#2962ff', '#26a69a', '#ef5350']}
/>
```

---

## 8. SourceCodeModal

**Purpose**: Display indicator Pine Script source code

**File**: `frontend/src/components/SourceCodeModal.tsx`

### Props

```typescript
interface SourceCodeModalProps {
  // Whether modal is open
  open: boolean;

  // Indicator whose source to display
  indicator: IndicatorInstance | null;

  // Source code content (Pine Script)
  sourceCode: string;

  // Callback: Close modal
  onOpenChange: (open: boolean) => void;
}
```

### Behavior

- Read-only text display in `<pre><code>` block
- Basic syntax highlighting (regex-based)
- Copy to clipboard button

### Example

```tsx
<SourceCodeModal
  open={isSourceModalOpen}
  indicator={editingIndicator}
  sourceCode="// Pine Script source code..."}
  onOpenChange={setIsSourceModalOpen}
/>
```

---

## 9. useIndicatorInstances Hook

**Purpose**: localStorage CRUD for indicator instances

**File**: `frontend/src/hooks/useIndicatorInstances.ts`

### Signature

```typescript
interface UseIndicatorInstancesReturn {
  // All instances for current symbol
  instances: IndicatorInstance[];

  // Add new indicator instance
  addInstance: (type: string, params: Record<string, number | string>) => string;

  // Update instance (params, style, visibility)
  updateInstance: (id: string, updates: Partial<IndicatorInstance>) => void;

  // Remove instance
  removeInstance: (id: string) => void;

  // Get instance by ID
  getInstance: (id: string) => IndicatorInstance | undefined;

  // Loading state
  isLoading: boolean;

  // Error state
  error: string | null;
}

function useIndicatorInstances(symbol: string): UseIndicatorInstancesReturn;
```

### Behavior

- **Initial Load**: Read from `indicator_list:${symbol}` and all `indicator_instance:${id}` keys
- **Add**: Generate ID, save instance, append to list
- **Update**: Modify instance in-place, save to localStorage
- **Remove**: Delete instance key, remove from list index
- **Symbol Change**: Reload instances for new symbol

### Example

```tsx
const { instances, addInstance, updateInstance, removeInstance } = useIndicatorInstances(symbol);

// Add SMA(20)
const id = addInstance('sma', { period: 20 });

// Update color
updateInstance(id, { style: { ...instances[0].style, color: '#ff0000' } });

// Remove
removeInstance(id);
```

---

## 10. useChartSeries Hook

**Purpose**: Manage Lightweight Charts series lifecycle

**File**: `frontend/src/hooks/useChartSeries.ts`

### Signature

```typescript
interface UseChartSeriesReturn {
  // Add overlay series to chart
  addSeries: (instance: IndicatorInstance, data: OverlayDataPoint[]) => void;

  // Update series data
  updateSeries: (instanceId: string, data: OverlayDataPoint[]) => void;

  // Update series style
  updateSeriesStyle: (instanceId: string, style: IndicatorStyle) => void;

  // Remove series from chart
  removeSeries: (instanceId: string) => void;

  // Clear all series
  clearAll: () => void;
}

function useChartSeries(chartRef: RefObject<any>): UseChartSeriesReturn;
```

### Behavior

- **Add**: Create `LineSeries`, set data, store ref by instance ID
- **Update**: Call `series.setData()` with new data
- **Update Style**: Call `series.applyOptions()` with new style
- **Remove**: Call `chart.removeSeries()`, delete ref

### Example

```tsx
const chartRef = useRef<any>(null);
const { addSeries, updateSeries, updateSeriesStyle, removeSeries } = useChartSeries(chartRef);

// Add indicator
addSeries(indicatorInstance, indicatorData);

// Update style
updateSeriesStyle(indicatorId, { color: '#ff0000', lineWidth: 2 });
```

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ useIndicatorInstances(symbol)                         │  │
│  │   └─ instances: IndicatorInstance[]                   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ useIndicatorData(indicators, symbol, interval)         │  │
│  │   └─ dataMap: IndicatorDataMap                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ passes indicators, data, callbacks
                ┌───────────┴───────────┐
                ▼                       ▼
┌───────────────────────┐   ┌───────────────────────┐
│  ChartComponent       │   │  OverlayIndicatorLegend│
│  ┌─────────────────┐  │   │  ┌─────────────────┐  │
│  │ useChartSeries  │  │   │  │ IndicatorContext│  │
│  │   └─ overlays   │  │   │  │   Menu (hover)  │  │
│  └─────────────────┘  │   │  └─────────────────┘  │
└───────────────────────┘   └───────────────────────┘
            │                           │
            │                           │ onSettings clicked
            │                           ▼
            │                   ┌───────────────────────┐
            │                   │ IndicatorSettingsDialog│
            │                   │  ┌─────────────────┐  │
            │                   │  │ Tabs (Inputs,   │  │
            │                   │  │      Style,     │  │
            │                   │  │      Visibility)│  │
            │                   │  └─────────────────┘  │
            │                   └───────────────────────┘
            │                           │
            │                           │ onApplyChanges
            └───────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ updateInstance()      │
                    │ useIndicatorInstances │
                    └───────────────────────┘
```

---

## Testing Contracts

### Unit Tests

- **OverlayIndicatorLegend**: Render, hover, click actions
- **IndicatorSettingsDialog**: Tab switching, apply changes
- **IndicatorSettingsInputs**: Validation, min/max enforcement
- **ColorPicker**: Color format validation, change callback
- **useIndicatorInstances**: CRUD operations, localStorage persistence
- **useChartSeries**: Series lifecycle management

### Integration Tests

- Add indicator → appears in legend and on chart
- Change color → chart line color updates
- Hide indicator → line disappears
- Open settings → correct params shown
- Change params → data refetches, chart updates
- Remove indicator → removed from legend and chart
- Refresh page → all state restored

---

**Document Version**: 1.0
**Last Updated**: 2025-12-26
