# Data Model: Overlay Indicator Rendering & Configuration UI

**Feature**: 008-overlay-indicator-rendering
**Date**: 2025-12-26
**Status**: Phase 1 Output

## Overview

This document defines the data entities and schemas for Feature 008, which adds visual rendering and configuration UI for overlay indicators.

## Entity Definitions

### 1. IndicatorInstance

Represents a single overlay indicator instance added to a chart for a specific symbol.

```typescript
interface IndicatorInstance {
  // Unique identifier for this instance (UUID format)
  id: string;

  // Symbol this indicator is attached to (e.g., "AAPL", "IBM")
  symbol: string;

  // Indicator type definition
  indicatorType: {
    category: 'overlay';  // Only overlay indicators supported in Feature 008
    name: string;         // 'sma', 'ema', 'tdfi', 'adxvma', 'crsi'
    params: Record<string, number | string>;  // Parameter values
  };

  // Human-readable display name (e.g., "SMA (20)", "EMA (50)")
  displayName: string;

  // Visual styling configuration
  style: IndicatorStyle;

  // Visibility state (hide without removing)
  isVisible: boolean;

  // Creation timestamp (ISO 8601 string)
  createdAt: string;
}
```

**Storage**: `localStorage` key `indicator_instance:${id}`

**Validation Rules**:
- `id`: Must be unique; generated via `crypto.randomUUID()` or `Date.now() + random`
- `symbol`: Non-empty string; valid ticker symbol
- `indicatorType.name`: Must be in supported overlay indicators list
- `indicatorType.params`: Must match `ParameterDefinition` constraints from backend
- `displayName`: Non-empty if provided; auto-generated if omitted
- `style.color`: Valid hex color string (#RRGGBB format)

**Example**:
```json
{
  "id": "indicator-1735198400000-abc123",
  "symbol": "AAPL",
  "indicatorType": {
    "category": "overlay",
    "name": "sma",
    "params": { "period": 20 }
  },
  "displayName": "SMA (20)",
  "style": {
    "color": "#ff6d00",
    "lineWidth": 2,
    "showLastValue": true
  },
  "isVisible": true,
  "createdAt": "2025-12-26T10:00:00.000Z"
}
```

---

### 2. IndicatorStyle

Defines visual properties for an indicator instance.

```typescript
interface IndicatorStyle {
  // Primary line color (hex format)
  color: string;

  // Line width in pixels (1-4)
  lineWidth: number;

  // Show the last value label on the price scale
  showLastValue: boolean;

  // Reserved for future: dashed/dotted line styles
  // lineStyle?: 'solid' | 'dashed' | 'dotted';
}
```

**Default Values**:
```typescript
const DEFAULT_STYLE: IndicatorStyle = {
  color: '#2962ff',    // TradingView blue
  lineWidth: 2,
  showLastValue: true,
};
```

**Validation Rules**:
- `color`: Must match regex `/^#[0-9A-Fa-f]{6}$/`
- `lineWidth`: Integer between 1 and 4 inclusive
- `showLastValue`: Boolean

**Color Mapping by Indicator Type**:
| Indicator | Default Color |
|-----------|---------------|
| SMA | `#ff6d00` (orange) |
| EMA | `#2962ff` (blue) |
| TDFI | `#9e9e9e` (gray) |
| ADXVMA | `#ff6d00` (orange) |
| cRSI | `#00bcd4` (cyan) |

---

### 3. IndicatorListIndex

Maintains ordered list of indicator instances for a symbol.

```typescript
interface IndicatorListIndex {
  // Ordered list of instance IDs
  instances: string[];

  // Last updated timestamp
  updatedAt: string;
}
```

**Storage**: `localStorage` key `indicator_list:${symbol}`

**Example**:
```json
{
  "instances": [
    "indicator-1735198400000-abc123",
    "indicator-1735198405000-def456"
  ],
  "updatedAt": "2025-12-26T10:00:05.000Z"
}
```

**Purpose**:
- Restore indicator order after page refresh
- Quickly check if an instance exists for a symbol
- Support reordering (drag-and-drop) in future

---

### 4. IndicatorSettingsState

Transient UI state for the settings dialog (not persisted).

```typescript
interface IndicatorSettingsState {
  // Currently editing instance ID
  activeInstanceId: string | null;

  // Currently active tab
  activeTab: 'inputs' | 'style' | 'visibility';

  // Pending parameter changes (not yet applied)
  pendingParams: Record<string, number | string>;

  // Pending style changes (not yet applied)
  pendingStyle: Partial<IndicatorStyle>;

  // Form validation errors
  errors: Record<string, string>;
}
```

**Lifecycle**: Component state only; not persisted to localStorage

---

## Entity Relationships

```
┌─────────────────────────────────────┐
│     IndicatorListIndex              │
│     (indicator_list:AAPL)            │
│  ┌─────────────────────────────┐   │
│  │ instances: [id1, id2, id3]   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
           │
           │ references
           ▼
┌─────────────────────────────────────┐
│     IndicatorInstance (id1)         │
│     (indicator_instance:id1)         │
│  ┌─────────────────────────────┐   │
│  │ indicatorType                │   │
│  │   └─ name: "sma"             │   │
│  │   └─ params: {period: 20}    │   │
│  │ style                        │   │
│  │   └─ color: "#ff6d00"        │   │
│  │   └─ lineWidth: 2            │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
           │
           │ uses metadata from
           ▼
┌─────────────────────────────────────┐
│     IndicatorInfo (backend)         │
│  ┌─────────────────────────────┐   │
│  │ name: "sma"                  │   │
│  │ parameters: [...]            │   │
│  │ metadata.color_schemes       │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## State Transitions

### Adding an Indicator

```
[User clicks "Add SMA(20)"]
    ↓
[Create IndicatorInstance]
    ├─ id: generateUUID()
    ├─ symbol: currentSymbol
    ├─ indicatorType: { name: "sma", params: { period: 20 } }
    ├─ displayName: "SMA (20)"
    ├─ style: DEFAULT_STYLE
    ├─ isVisible: true
    └─ createdAt: now
    ↓
[Save to localStorage]
    ├─ Key: indicator_instance:${id}
    └─ Key: indicator_list:${symbol} (append id)
    ↓
[Fetch indicator data via useIndicatorData]
    ↓
[Render line on chart via ChartComponent]
```

### Updating Style

```
[User changes color in settings dialog]
    ↓
[Update IndicatorInstance.style]
    └─ style.color = "#ff0000"
    ↓
[Save to localStorage]
    └─ Key: indicator_instance:${id}
    ↓
[ChartComponent re-renders with new color]
    └─ Uses applyOptions() for real-time update
```

### Hiding/Showing

```
[User clicks "Hide" from context menu]
    ↓
[Update IndicatorInstance.isVisible = false]
    ↓
[Save to localStorage]
    └─ Key: indicator_instance:${id}
    ↓
[ChartComponent.series.applyOptions({ visible: false })]
```

### Removing

```
[User clicks "Remove" from context menu]
    ↓
[Remove from localStorage]
    ├─ Key: indicator_instance:${id}
    └─ Key: indicator_list:${symbol} (filter out id)
    ↓
[ChartComponent removes series]
    └─ chart.removeSeries(series)
```

---

## localStorage Schema

### Key Format

| Key Pattern | Value Type | Description |
|-------------|------------|-------------|
| `indicator_instance:${id}` | `IndicatorInstance` | Single indicator instance data |
| `indicator_list:${symbol}` | `IndicatorListIndex` | Ordered list of instance IDs for a symbol |

### Example localStorage State

```json
{
  "indicator_instance:ind-1735198400000-abc123": {
    "id": "ind-1735198400000-abc123",
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
  "indicator_instance:ind-1735198405000-def456": {
    "id": "ind-1735198405000-def456",
    "symbol": "AAPL",
    "indicatorType": {
      "category": "overlay",
      "name": "ema",
      "params": { "period": 50 }
    },
    "displayName": "EMA (50)",
    "style": { "color": "#2962ff", "lineWidth": 2, "showLastValue": true },
    "isVisible": false,
    "createdAt": "2025-12-26T10:00:05.000Z"
  },
  "indicator_list:AAPL": {
    "instances": ["ind-1735198400000-abc123", "ind-1735198405000-def456"],
    "updatedAt": "2025-12-26T10:00:05.000Z"
  },
  "indicator_list:IBM": {
    "instances": [],
    "updatedAt": "2025-12-26T09:00:00.000Z"
  }
}
```

---

## Type Definitions Summary

```typescript
// Core instance type
interface IndicatorInstance {
  id: string;
  symbol: string;
  indicatorType: {
    category: 'overlay';
    name: string;
    params: Record<string, number | string>;
  };
  displayName: string;
  style: IndicatorStyle;
  isVisible: boolean;
  createdAt: string;
}

// Visual styling
interface IndicatorStyle {
  color: string;           // Hex #RRGGBB
  lineWidth: number;       // 1-4
  showLastValue: boolean;
}

// List index for ordering
interface IndicatorListIndex {
  instances: string[];
  updatedAt: string;
}

// Transient UI state
interface IndicatorSettingsState {
  activeInstanceId: string | null;
  activeTab: 'inputs' | 'style' | 'visibility';
  pendingParams: Record<string, number | string>;
  pendingStyle: Partial<IndicatorStyle>;
  errors: Record<string, string>;
}
```

---

## Backend Integration

This feature does not require backend changes. All data is stored locally in the browser.

**Existing Backend Endpoints Used**:
- `GET /api/v1/indicators` - List available indicators
- `GET /api/v1/indicators/supported` - Get indicator metadata
- `GET /api/v1/indicators/{symbol}/{indicatorName}` - Calculate indicator values

**Future Enhancement** (not part of Feature 008):
- Add `source_code` field to `IndicatorInfo` response for displaying Pine Script

---

## Migration Strategy

No database migrations needed (localStorage only). On first load:

1. Check for existing `indicator_list:${symbol}` keys
2. Restore instances on symbol change
3. If no existing data, start with empty list

---

**Document Version**: 1.0
**Last Updated**: 2025-12-26
