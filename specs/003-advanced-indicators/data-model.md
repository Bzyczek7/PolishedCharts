# Data Model: Advanced Indicators and Indicator-Driven Alerts

**Feature**: 003-advanced-indicators
**Date**: 2025-12-24
**Status**: Phase 1 - Design

## Overview

This document defines the data entities, their relationships, validation rules, and state transitions for the advanced indicators feature.

---

## Core Entities

### 1. IndicatorMetadata

**Purpose**: Configuration object describing how to display an indicator on the chart.

**Location**: Backend `app/schemas/indicator.py`, Frontend `src/types/indicators.ts`

```python
class IndicatorMetadata(BaseModel):
    """Configuration for rendering an indicator"""

    # Core display configuration
    display_type: Literal["overlay", "pane"]
    """overlay: draws on price chart; pane: creates separate pane below"""

    color_mode: Literal["single", "threshold", "gradient"]
    """single: one color; threshold: color based on value ranges; gradient: color gradient"""

    # Color definitions (state -> hex color)
    color_schemes: Dict[str, str]
    """States: bullish, bearish, neutral, overbought, oversold, positive, negative"""

    # Threshold-based coloring (for threshold mode)
    thresholds: Optional[ThresholdsConfig] = None

    # Scale configuration (for pane indicators)
    scale_ranges: Optional[ScaleRangesConfig] = None

    # Series-level metadata (each visual element)
    series_metadata: List[SeriesMetadata]

    # Reference levels (horizontal lines on panes)
    reference_levels: Optional[List[ReferenceLevel]] = None
```

```python
class ThresholdsConfig(BaseModel):
    """Threshold values for threshold-based coloring"""
    high: float
    low: float

class ScaleRangesConfig(BaseModel):
    """Y-axis scale configuration for pane indicators"""
    min: float
    max: float
    auto: bool = False  # If True, min/max are ignored

class SeriesMetadata(BaseModel):
    """Metadata for a single visual series (line, histogram, band)"""
    field: str  # Data field name in output
    role: Literal["main", "signal", "band", "histogram"]
    label: str  # Human-readable name for legend/UI
    line_color: str  # Hex color
    line_style: Literal["solid", "dashed", "dotted"] = "solid"
    line_width: int = 1
    display_type: Literal["line", "histogram", "area"] = "line"

class ReferenceLevel(BaseModel):
    """Horizontal reference line on indicator pane"""
    value: float
    line_color: str  # Hex color
    line_label: str  # Text shown next to line
    line_style: Literal["solid", "dashed"] = "dashed"
```

**Validation Rules**:
- `display_type` must be "overlay" or "pane"
- `color_mode` must be one of: "single", "threshold", "gradient"
- `line_width` must be between 1 and 5
- All hex colors must be valid 6-digit hex codes (e.g., "#00bcd4")
- `scale_ranges.min` must be less than `scale_ranges.max`
- `thresholds.high` must be greater than `thresholds.low`

**Example (cRSI)**:
```json
{
  "display_type": "pane",
  "color_mode": "single",
  "color_schemes": {
    "bullish": "#00bcd4",
    "bearish": "#00bcd4",
    "neutral": "#00bcd4"
  },
  "thresholds": null,
  "scale_ranges": {
    "min": 0,
    "max": 100,
    "auto": false
  },
  "series_metadata": [
    {
      "field": "crsi",
      "role": "main",
      "label": "cRSI",
      "line_color": "#00bcd4",
      "line_style": "solid",
      "line_width": 2,
      "display_type": "line"
    },
    {
      "field": "upper_band",
      "role": "band",
      "label": "Upper Band",
      "line_color": "#b2ebf2",
      "line_style": "dashed",
      "line_width": 1,
      "display_type": "line"
    },
    {
      "field": "lower_band",
      "role": "band",
      "label": "Lower Band",
      "line_color": "#b2ebf2",
      "line_style": "dashed",
      "line_width": 1,
      "display_type": "line"
    }
  ],
  "reference_levels": [
    {
      "value": 70,
      "line_color": "#b2ebf2",
      "line_label": "70",
      "line_style": "dashed"
    },
    {
      "value": 30,
      "line_color": "#b2ebf2",
      "line_label": "30",
      "line_style": "dashed"
    }
  ]
}
```

---

### 2. IndicatorOutput

**Purpose**: Data returned from backend containing indicator values and metadata.

**Location**: Backend `app/schemas/indicator.py`, Frontend `src/api/indicators.ts`

```python
class IndicatorOutput(BaseModel):
    """Indicator calculation result with metadata for rendering"""

    # Symbol and interval
    symbol: str
    interval: str

    # Data
    timestamps: List[int]  # Unix timestamps (seconds)
    data: Dict[str, List[Optional[float]]]  # field -> values

    # Metadata
    metadata: IndicatorMetadata

    # Additional info
    calculated_at: datetime  # When calculation was performed
    data_points: int  # Number of data points
```

**Validation Rules**:
- `timestamps` length must equal all `data` array lengths
- `timestamps` must be in ascending order
- `data` values can be `null` for insufficient data periods
- All `data` field names must exist in `metadata.series_metadata[*].field`

**Example**:
```json
{
  "symbol": "AAPL",
  "interval": "1d",
  "timestamps": [1704067200, 1704153600, 1704240000],
  "data": {
    "crsi": [null, 65.5, 72.3],
    "upper_band": [null, 70.0, 70.0],
    "lower_band": [null, 30.0, 30.0]
  },
  "metadata": { /* cRSI metadata from above */ },
  "calculated_at": "2025-12-24T10:00:00Z",
  "data_points": 3
}
```

---

### 3. IndicatorAlertRule

**Purpose**: User-defined alert rule for indicator-based conditions.

**Location**: Backend `app/models/alert.py` (extends existing Alert model)

```python
# Extend existing Alert model
class Alert(Base):
    """
    Existing fields:
    - id: int
    - symbol_id: int (FK)
    - condition: AlertCondition (enum)
    - threshold: float
    - is_active: bool
    - cooldown: int (seconds)
    """

    # NEW: Indicator-specific fields
    indicator_name: Optional[str] = None
    """Name of indicator (e.g., 'crsi', 'tdfi', 'adxvma')"""

    indicator_field: Optional[str] = None
    """Field within indicator output (e.g., 'crsi', 'tdfi_signal')"""

    indicator_params: Optional[Dict[str, Any]] = None
    """Parameters for indicator calculation (e.g., {'period': 14})"""
```

**Validation Rules**:
- If `indicator_name` is not null, `indicator_field` must also be not null
- If `indicator_name` is null, alert is a price-based alert (existing behavior)
- `indicator_params` must be valid for the specified indicator

**State Transitions**:
```
[Created] -> [Active] -> [Triggered] -> [Cooldown] -> [Active]
                |
                v
            [Paused]
```

---

### 4. AlertTrigger (Extended)

**Purpose**: Record of when an alert condition was met.

**Location**: Backend `app/models/alert_trigger.py` (extends existing)

```python
class AlertTrigger(Base):
    """
    Existing fields:
    - id: int
    - alert_id: int (FK)
    - triggered_at: datetime
    - observed_price: float
    """

    # NEW: Indicator-specific fields
    indicator_value: Optional[float] = None
    """Value of indicator that triggered the alert"""

    delivery_status: Literal["pending", "delivered", "failed", "retrying"] = "pending"
    """Status of notification delivery"""

    retry_count: int = 0
    """Number of delivery retry attempts"""

    last_retry_at: Optional[datetime] = None
    """Timestamp of last retry attempt"""
```

**Delivery Status Transitions**:
```
[pending] -> [delivered]
     |
     v
  [retrying] -> [delivered]
     |
     v
  [failed] (after 5 retries)
```

---

### 5. IndicatorState (Frontend-Only)

**Purpose**: Per-symbol user preferences for indicators.

**Location**: Frontend `src/hooks/useIndicators.ts` (stored in localStorage)

```typescript
interface IndicatorState {
  /** Map of symbol -> indicator configuration */
  [symbol: string]: SymbolIndicatorConfig
}

interface SymbolIndicatorConfig {
  /** List of enabled indicators for this symbol */
  indicators: IndicatorConfig[]

  /** When this configuration was last updated */
  updatedAt: string  // ISO timestamp
}

interface IndicatorConfig {
  /** Unique indicator identifier (e.g., 'crsi', 'tdfi', 'ema_20') */
  id: string

  /** Display parameters */
  params: Record<string, number | string>

  /** Whether indicator is currently visible on chart */
  visible: boolean

  /** Per-series visibility settings (optional) */
  seriesVisibility?: Record<string, boolean>  // field -> visible
}
```

**localStorage Key Format**:
- Key: `tradingalert_indicators`
- Value: JSON string of `IndicatorState`

---

## Entity Relationships

```
Symbol (1) ----< (*) Alert (indicator alerts)
   |
   | (1)
   |
   +- (*) AlertTrigger (price or indicator triggers)

Indicator (Registry) (1) ----< (*) Alert (by indicator_name)
   |
   | (1)
   |
   +- (*) IndicatorOutput (calculation results)

IndicatorOutput (*) ----< (1) IndicatorMetadata (rendering config)

Symbol (Frontend State) (1) ----< (1) IndicatorState (localStorage)
```

---

## Database Schema Changes

### New Columns on `alerts` Table

```sql
ALTER TABLE alerts
ADD COLUMN indicator_name VARCHAR(50) NULL,
ADD COLUMN indicator_field VARCHAR(50) NULL,
ADD COLUMN indicator_params JSONB NULL;

-- Index for filtering by indicator
CREATE INDEX ix_alerts_indicator_name ON alerts(indicator_name) WHERE indicator_name IS NOT NULL;
```

### New Columns on `alert_triggers` Table

```sql
ALTER TABLE alert_triggers
ADD COLUMN indicator_value FLOAT NULL,
ADD COLUMN delivery_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN retry_count INT DEFAULT 0,
ADD COLUMN last_retry_at TIMESTAMP NULL;

-- Index for delivery retry queries
CREATE INDEX ix_alert_triggers_delivery_status ON alert_triggers(delivery_status, retry_count)
WHERE delivery_status IN ('pending', 'retrying');
```

---

## Validation Rules Summary

| Entity | Rule | Enforcement |
|--------|------|-------------|
| IndicatorMetadata | display_type in ["overlay", "pane"] | Pydantic validator |
| IndicatorMetadata | line_width 1-5 | Pydantic validator |
| IndicatorMetadata | scale_ranges.min < max | Pydantic validator |
| IndicatorOutput | timestamps length == data arrays lengths | Pydantic validator |
| IndicatorOutput | All data fields exist in series_metadata | Pydantic validator |
| Alert | If indicator_name, then indicator_field required | DB constraint |
| Alert | indicator_name must exist in registry | Application validation |
| AlertTrigger | delivery_status enum values | DB check constraint |
| AlertTrigger | retry_count <= 5 | Application validation |

---

## Data Lifecycle

### Indicator Data Flow

1. **User selects indicator** → Frontend calls `GET /api/v1/indicators/{symbol}/{indicator_name}`
2. **Backend calculates** → Using indicator registry, fetches candles, computes values
3. **Backend responds** → `IndicatorOutput` with data + metadata
4. **Frontend renders** → Uses metadata to create chart series
5. **Frontend persists** → Saves to localStorage via `useIndicators` hook

### Alert Evaluation Flow

1. **New candle received** → Orchestrator triggers alert engine
2. **Alert engine queries** → Gets active alerts for symbol
3. **For price alerts** → Evaluates price conditions (existing)
4. **For indicator alerts** → Fetches latest indicator value, evaluates conditions
5. **Condition met** → Creates `AlertTrigger` record
6. **Delivery attempted** → Background task sends notification
7. **On failure** → Retry with exponential backoff (max 5)

### State Persistence Flow

1. **User adds indicator** → `useIndicators` hook updates state
2. **State saved** → Immediately to localStorage
3. **Symbol changed** → Previous state saved, new state loaded
4. **Indicator toggled** → Visibility updated, saved to localStorage
5. **Parameters changed** → New params saved, indicator recalculated

---

## Performance Considerations

### Indicator Output Size

- **Typical**: 1000 candles × 3 series × 8 bytes ≈ 24KB per indicator
- **With 5 indicators**: ≈ 120KB per symbol
- **localStorage capacity**: 5-10MB (sufficient for 50+ symbols)

### Alert Trigger Storage

- **Growth rate**: Depends on market volatility and alert sensitivity
- **Retention**: Implement TTL-based cleanup (e.g., keep 30 days)
- **Indexing**: Use delivery_status index for efficient retry queries

---

## Next Steps

1. **API Contracts**: Generate OpenAPI specs in `contracts/`
2. **Quickstart Guide**: Create developer onboarding guide
3. **Agent Context**: Update agent-specific context files
