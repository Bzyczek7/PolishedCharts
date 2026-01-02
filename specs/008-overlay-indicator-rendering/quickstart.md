# Quickstart Guide: Overlay Indicator Rendering & Configuration UI

**Feature**: 008-overlay-indicator-rendering
**Date**: 2025-12-26
**Status**: Phase 1 Output

## Overview

This guide helps developers quickly understand how to use and extend the overlay indicator rendering system added in Feature 008.

## What's New

Feature 008 adds:
- **Visual rendering**: Overlay indicators (SMA, EMA, TDFI, ADXVMA) now display as colored lines on the main price chart
- **Configuration UI**: TradingView-style settings dialog for customizing indicator parameters and visual styles
- **Context menu**: Hover-based actions (Hide, Settings, Source Code, Remove)
- **localStorage persistence**: All indicator configurations persist across browser sessions

## Quick Start for Users

### Adding an Overlay Indicator

1. Click the **Indicators** button (or press `Cmd/Ctrl+I`)
2. Select an overlay indicator (e.g., SMA)
3. Configure parameters (e.g., Period = 20)
4. Click **Add**

The indicator appears as a colored line on the chart.

### Customizing Indicator Appearance

1. Hover over the indicator name in the legend
2. Click **Settings** from the context menu
3. Go to the **Style** tab
4. Change color, line width, or visibility
5. Changes apply immediately

### Hiding/Showing Indicators

**Option 1**: Hover and click "Hide"

**Option 2**: Settings dialog → Visibility tab → Toggle switch

### Removing an Indicator

1. Hover over the indicator name
2. Click **Remove** from the context menu
3. Confirm removal

## Developer Guide

### Key Concepts

#### IndicatorInstance

Represents a single overlay indicator added to a chart:

```typescript
interface IndicatorInstance {
  id: string;                    // Unique ID
  symbol: string;                // "AAPL", "IBM", etc.
  indicatorType: {
    category: 'overlay';
    name: string;                // "sma", "ema", "tdfi", "adxvma"
    params: Record<string, number | string>;
  };
  displayName: string;           // "SMA (20)"
  style: IndicatorStyle;         // Visual styling
  isVisible: boolean;            // Hide without removing
  createdAt: string;             // ISO timestamp
}
```

#### IndicatorStyle

Controls how the indicator looks:

```typescript
interface IndicatorStyle {
  color: string;           // Hex format: "#ff6d00"
  lineWidth: number;       // 1-4 pixels
  showLastValue: boolean;  // Show value on price scale
}
```

### Using the useIndicatorInstances Hook

```tsx
import { useIndicatorInstances } from '@/hooks/useIndicatorInstances';

function MyComponent() {
  const {
    instances,
    addInstance,
    updateInstance,
    removeInstance,
  } = useIndicatorInstances(symbol);

  // Add an SMA with period 20
  const handleAddSMA = () => {
    addInstance('sma', { period: 20 });
  };

  // Update indicator color
  const handleColorChange = (id: string, color: string) => {
    const instance = instances.find(i => i.id === id);
    if (instance) {
      updateInstance(id, {
        style: { ...instance.style, color }
      });
    }
  };

  return (
    <div>
      <button onClick={handleAddSMA}>Add SMA(20)</button>
      {instances.map(instance => (
        <div key={instance.id}>
          <span style={{ color: instance.style.color }}>
            {instance.displayName}
          </span>
          <button onClick={() => removeInstance(instance.id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Integrating with ChartComponent

```tsx
import ChartComponent from '@/components/ChartComponent';
import { useIndicatorData } from '@/hooks/useIndicatorData';

function ChartView() {
  const overlayInstances = instances.filter(i => i.indicatorType.category === 'overlay');
  const indicatorDataMap = useIndicatorData(overlayInstances, symbol, interval);

  // Format instances for ChartComponent
  const overlays = overlayInstances.map(instance => {
    const data = indicatorDataMap[instance.id];
    if (!data) return null;

    return {
      id: instance.id,
      data: formatIndicatorData(data),
      color: instance.style.color,
      lineWidth: instance.style.lineWidth,
      showLastValue: instance.style.showLastValue,
    };
  }).filter(Boolean);

  return (
    <ChartComponent
      symbol={symbol}
      candles={candles}
      overlays={overlays}
    />
  );
}
```

## localStorage Schema

### Key Structure

```
indicator_instance:${id}  →  IndicatorInstance JSON
indicator_list:${symbol}   →  { instances: string[], updatedAt: string }
```

### Example State

```json
{
  "indicator_instance:ind-123": {
    "id": "ind-123",
    "symbol": "AAPL",
    "indicatorType": {
      "category": "overlay",
      "name": "sma",
      "params": { "period": 20 }
    },
    "displayName": "SMA (20)",
    "style": { "color": "#ff6d00", "lineWidth": 2, "showLastValue": true },
    "isVisible": true,
    "createdAt": "2025-12-26T10:00:00.000Z"
  },
  "indicator_list:AAPL": {
    "instances": ["ind-123"],
    "updatedAt": "2025-12-26T10:00:00.000Z"
  }
}
```

## Component Reference

### OverlayIndicatorLegend

Displays the list of overlay indicators with hover menu.

```tsx
<OverlayIndicatorLegend
  indicators={overlayInstances}
  hoveredIndicatorId={hoveredId}
  onHover={setHoveredId}
  onToggleVisibility={(id) => updateInstance(id, { isVisible: !instance.isVisible })}
  onOpenSettings={setEditingIndicator}
  onViewSource={setSourceIndicator}
  onRemove={removeInstance}
/>
```

### IndicatorSettingsDialog

Three-tab settings modal.

```tsx
<IndicatorSettingsDialog
  open={isSettingsOpen}
  indicator={editingIndicator}
  indicatorMetadata={indicatorMetadata}
  onOpenChange={setIsSettingsOpen}
  onApplyChanges={(id, updates) => updateInstance(id, updates)}
/>
```

### ColorPicker

Simple color input with preset swatches.

```tsx
<ColorPicker
  value={instance.style.color}
  label="Line color"
  onChange={(color) => updateStyle({ color })}
  presets={['#ff6d00', '#2962ff', '#26a69a']}
/>
```

## Extending the System

### Adding a New Overlay Indicator

1. **Backend**: Add indicator to `/app/services/indicator_registry/`
2. **Frontend Type**: Add to supported overlay indicators:

```typescript
// frontend/src/components/types/indicators.ts
export const OVERLAY_INDICATORS = ['sma', 'ema', 'tdfi', 'adxvma', 'YOUR_NEW_INDICATOR'];
```

3. **Metadata**: Ensure backend returns proper `IndicatorMetadata` with default colors

### Adding a New Style Property

```typescript
// 1. Extend IndicatorStyle interface
interface IndicatorStyle {
  color: string;
  lineWidth: number;
  showLastValue: boolean;
  yourNewProp: string;  // Add here
}

// 2. Update default values
const DEFAULT_STYLE: IndicatorStyle = {
  color: '#2962ff',
  lineWidth: 2,
  showLastValue: true,
  yourNewProp: 'defaultValue',
};

// 3. Add to ChartComponent series options
lineSeries = chart.addSeries(LineSeries, {
  ...options,
  yourNewProp: instance.style.yourNewProp,
});
```

### Custom Validation for Parameters

```typescript
// In IndicatorSettingsInputs.tsx
const validateParam = (name: string, value: number, definition: ParameterDefinition): string | null => {
  if (definition.type === 'int' && !Number.isInteger(value)) {
    return `${name} must be an integer`;
  }
  if (definition.min !== undefined && value < definition.min) {
    return `${name} must be at least ${definition.min}`;
  }
  if (definition.max !== undefined && value > definition.max) {
    return `${name} must be at most ${definition.max}`;
  }
  return null;
};
```

## Troubleshooting

### Indicator Not Showing on Chart

**Check**:
1. Is `isVisible: true`?
2. Is indicator data fetched? Check `indicatorDataMap[id]`
3. Is overlay formatted correctly for `ChartComponent`?
4. Is series added via `useChartSeries.addSeries()`?

**Debug**:
```typescript
console.log('Instance:', instance);
console.log('Data:', indicatorDataMap[instance.id]);
console.log('Formatted overlay:', formattedOverlay);
```

### Changes Not Persisting

**Check**:
1. Is `updateInstance()` being called?
2. Is localStorage available? (Check browser settings)
3. Are keys correct? (`indicator_instance:${id}`, `indicator_list:${symbol}`)

**Debug**:
```typescript
console.log('localStorage keys:', Object.keys(localStorage));
console.log('Instance data:', localStorage.getItem(`indicator_instance:${id}`));
```

### Performance Issues with Many Indicators

**Mitigations**:
- Limit to 10 concurrent overlay indicators
- Debounce style updates (wait 100ms before saving)
- Use `useCallback` for event handlers

**Monitoring**:
```typescript
useEffect(() => {
  const start = performance.now();
  // ... indicator operations
  const elapsed = performance.now() - start;
  if (elapsed > 500) {
    console.warn(`Slow operation: ${elapsed}ms`);
  }
}, [indicators]);
```

## Testing

### Unit Test Example

```typescript
describe('useIndicatorInstances', () => {
  it('should add instance and save to localStorage', () => {
    const { result } = renderHook(() => useIndicatorInstances('AAPL'));
    const id = result.current.addInstance('sma', { period: 20 });

    expect(result.current.instances).toHaveLength(1);
    expect(localStorage.getItem(`indicator_instance:${id}`)).toBeTruthy();
  });
});
```

### Integration Test Example

```typescript
describe('IndicatorSettingsDialog', () => {
  it('should apply style changes to chart', async () => {
    const onApplyChanges = jest.fn();
    render(<IndicatorSettingsDialog {...props} onApplyChanges={onApplyChanges} />);

    fireEvent.change(screen.getByLabelText('Line color'), { target: { value: '#ff0000' } });

    expect(onApplyChanges).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        style: expect.objectContaining({ color: '#ff0000' })
      })
    );
  });
});
```

## Performance Budgets

| Operation | Budget | Measurement |
|-----------|--------|-------------|
| Add indicator | <500ms | Time from click to chart render |
| Update style | <100ms | Time from color change to chart update |
| Load from localStorage | <50ms | Time to restore 10 indicators |
| Chart redraw | 60fps | 16.67ms per frame |

## Known Limitations

1. **Dashed lines**: Not natively supported by Lightweight Charts v5.1.0; deferred to future phase
2. **Multiple indicators per symbol**: Practical limit of ~10 overlay indicators for performance
3. **localStorage quota**: ~5-10MB; ~500 bytes per indicator
4. **Source code display**: Currently shows placeholder; requires backend `source_code` field

## Future Enhancements

- Dashed/dotted line styles (custom rendering)
- Advanced color picker (react-colorful)
- Indicator favorites/templates
- Drag-and-drop reordering
- Export indicator data to CSV
- Alert rules based on indicator values

---

## Quick Reference

| Task | Component / Hook |
|------|------------------|
| Add indicator | `useIndicatorInstances.addInstance()` |
| Update style | `useIndicatorInstances.updateInstance()` |
| Hide indicator | `updateInstance(id, { isVisible: false })` |
| Remove indicator | `useIndicatorInstances.removeInstance()` |
| Show settings | `IndicatorSettingsDialog` |
| Format for chart | Map to `overlays` prop |

---

**Version**: 1.0
**Last Updated**: 2025-12-26
