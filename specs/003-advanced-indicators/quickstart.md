# Quickstart: Advanced Indicators Feature

**Feature**: 003-advanced-indicators
**Target Audience**: Developers adding new indicators or extending the alert system
**Last Updated**: 2025-12-24

## Overview

This feature implements a metadata-driven indicator system that allows adding new technical indicators without modifying frontend rendering code. Backend indicator calculations expose rich metadata that drives generic frontend rendering helpers.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐      ┌──────────────────────────────────────┐  │
│  │  IndicatorPane │◄─────┤  GenericIndicatorRenderer (NEW)      │  │
│  │  ChartComponent│      │  - Uses metadata to render series    │  │
│  └────────────────┘      │  - formatDataForChart()              │  │
│                          │  - splitSeriesByThresholds()         │  │
│                          │  - splitSeriesByTrend()              │  │
│                          └──────────────────────────────────────┘  │
│                                   ▲                                 │
│                          useIndicators() hook                       │
│                          (per-symbol state)                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           BACKEND API                                │
├─────────────────────────────────────────────────────────────────────┤
│  GET /api/v1/indicators/{symbol}/{indicator_name}                   │
│  Returns: IndicatorOutput { timestamps, data, metadata }             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        INDICATOR REGISTRY                            │
├─────────────────────────────────────────────────────────────────────┤
│  IndicatorRegistry                                                   │
│  ├── register(Indicator)                                             │
│  ├── get(indicator_name)                                            │
│  └── list_indicators()                                               │
│                                                                      │
│  Indicator (ABC)                                                     │
│  ├── name: str                                                       │
│  ├── parameters: Dict                                                │
│  ├── calculate(df, **kwargs) -> DataFrame                           │
│  └── get_metadata() -> IndicatorMetadata                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        ALERT ENGINE                                  │
├─────────────────────────────────────────────────────────────────────┤
│  AlertEngine.evaluate_symbol_alerts(symbol, candles, indicator_data)│
│  ├── Price alerts (existing)                                        │
│  └── Indicator alerts (NEW)                                         │
│      ├── indicator_crosses_upper                                    │
│      ├── indicator_turns_positive                                   │
│      └── indicator_slope_bullish                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Adding a New Indicator

This is the primary extensibility pattern. Adding a new indicator requires **only backend changes**.

### Step 1: Implement the Calculation Function

Location: `backend/app/services/indicators.py` or new module

```python
import pandas as pd
import numpy as np

def calculate_my_indicator(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """
    Calculate My Indicator.

    Args:
        df: DataFrame with 'close' column
        period: Lookback period

    Returns:
        DataFrame with original columns + 'MY_INDICATOR' column
    """
    close = df['close']

    # Your calculation logic here
    # Example: Simple momentum indicator
    my_indicator = close.pct_change(period) * 100

    result = df.copy()
    result['my_indicator'] = my_indicator

    return result
```

### Step 2: Create the Indicator Class

Location: `backend/app/services/indicator_registry/registry.py`

```python
from backend.app.services.indicator_registry.registry import (
    Indicator, IndicatorRegistry, ParameterDefinition
)
from backend.app.services.indicators import calculate_my_indicator
from backend.app.schemas.indicator import IndicatorMetadata

class MyIndicator(Indicator):
    @property
    def name(self) -> str:
        return "my_indicator"

    @property
    def description(self) -> str:
        return "My custom momentum indicator"

    @property
    def parameters(self) -> Dict[str, ParameterDefinition]:
        return {
            "period": ParameterDefinition(
                type="integer",
                default=14,
                min=2,
                max=200,
                description="Lookback period for calculation"
            )
        }

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        period = kwargs.get('period', 14)
        return calculate_my_indicator(df, period=period)

    @property
    def metadata(self) -> IndicatorMetadata:
        return IndicatorMetadata(
            display_type="pane",  # or "overlay"
            color_mode="threshold",
            color_schemes={
                "bullish": "#26a69a",    # Green
                "bearish": "#ef5350",    # Red
                "neutral": "#b2ebf2"     # Light blue
            },
            thresholds={
                "high": 2.0,
                "low": -2.0
            },
            scale_ranges={
                "min": -10.0,
                "max": 10.0,
                "auto": False
            },
            series_metadata=[
                {
                    "field": "my_indicator",
                    "role": "main",
                    "label": "My Indicator",
                    "line_color": "#26a69a",
                    "line_style": "solid",
                    "line_width": 2,
                    "display_type": "line"
                }
            ],
            reference_levels=[
                {
                    "value": 0.0,
                    "line_color": "#9e9e9e",
                    "line_label": "0",
                    "line_style": "dashed"
                }
            ]
        )
```

### Step 3: Register the Indicator

Location: `backend/app/services/indicator_registry/__init__.py`

```python
from .registry import MyIndicator, get_registry

_registry = get_registry()
_registry.register(MyIndicator())
```

### Step 4: That's It!

- The indicator automatically appears in `GET /api/v1/indicators`
- The frontend indicator selector shows it
- When added to a chart, it renders automatically based on metadata
- No frontend code changes required

---

## Adding Alert Conditions for an Indicator

After implementing your indicator, you can define which alert conditions it supports. This is optional but recommended for enabling indicator-driven alerts.

### Step 1: Define Alert Templates

Location: `backend/app/services/indicator_registry/registry.py` (in your Indicator class)

```python
class MyIndicator(Indicator):
    # ... existing properties ...

    @property
    def alert_templates(self) -> List[AlertTemplate]:
        return [
            AlertTemplate(
                condition="indicator_crosses_upper",
                label="Crosses Above Upper",
                description="Triggers when indicator crosses above threshold",
                applicable_fields=["my_indicator"],
                requires_threshold=True
            ),
            AlertTemplate(
                condition="indicator_slope_bullish",
                label="Bullish Slope",
                description="Triggers when indicator slope turns positive",
                applicable_fields=["my_indicator"],
                requires_threshold=False
            )
        ]
```

### Step 2: Implement Condition Evaluation (if custom)

Most conditions work with the standard evaluation logic in `alert_engine.py`. For custom logic:

Location: `backend/app/services/alert_engine.py`

```python
def evaluate_indicator_condition(
    condition: str,
    current_value: float,
    previous_value: float,
    threshold: Optional[float] = None,
    current_signal: Optional[int] = None,
    previous_signal: Optional[int] = None
) -> bool:
    """
    Evaluate if an indicator alert condition is met.
    """
    if condition == "indicator_crosses_upper":
        return previous_value < threshold and current_value >= threshold
    elif condition == "indicator_turns_positive":
        return previous_value <= 0.05 and current_value >= 0.05
    # ... other conditions
```

---

## Frontend: Using the Generic Rendering Helpers

The generic helpers in `frontend/src/utils/chartHelpers.ts` transform indicator data for lightweight-charts.

### formatDataForChart

Converts indicator output to lightweight-charts format:

```typescript
import { formatDataForChart } from '@/utils/chartHelpers';

const indicatorData = await api.getIndicator('AAPL', 'crsi');
const chartData = formatDataForChart(
  indicatorData.timestamps,
  indicatorData.data.crsi
);
// Result: [{ time: 1704067200, value: 65.5 }, ...]
```

### splitSeriesByThresholds

Splits a single series into multiple colored segments:

```typescript
const segments = splitSeriesByThresholds(
  indicatorData.timestamps,
  indicatorData.data.tdfi,
  { high: 0.05, low: -0.05 },
  { bullish: '#26a69a', bearish: '#ef5350', neutral: '#b2ebf2' }
);
// Result: [
//   { data: [...], color: '#26a69a' },  // Bullish segment
//   { data: [...], color: '#ef5350' },  // Bearish segment
//   ...
// ]
```

### splitSeriesByTrend

Splits series by slope direction:

```typescript
const trendSegments = splitSeriesByTrend(
  indicatorData.timestamps,
  indicatorData.data.adxvma,
  { up: '#26a69a', down: '#ef5350', flat: '#9e9e9e' }
);
```

---

## Frontend: Managing Per-Symbol Indicator State

Use the `useIndicators` hook for per-symbol indicator management:

```typescript
import { useIndicators } from '@/hooks/useIndicators';

function MyComponent() {
  const {
    indicators,           // Map of symbol -> IndicatorConfig[]
    addIndicator,         // (symbol, indicator) => void
    removeIndicator,      // (symbol, indicatorId) => void
    toggleIndicator,      // (symbol, indicatorId) => void
    updateIndicatorParams // (symbol, indicatorId, params) => void
  } = useIndicators();

  // Add indicator for current symbol
  const handleAddCrsi = () => {
    addIndicator('AAPL', {
      id: 'crsi',
      params: { period: 14 },
      visible: true
    });
  };

  return (
    <button onClick={handleAddCrsi}>Add cRSI</button>
  );
}
```

---

## Testing Indicators

### Backend Tests

Location: `backend/tests/services/test_indicators.py`

```python
import pytest
from backend.app.services.indicators import calculate_my_indicator

def test_my_indicator_calculation():
    # Arrange
    df = pd.DataFrame({
        'close': [100, 101, 102, 103, 104, 105]
    })

    # Act
    result = calculate_my_indicator(df, period=3)

    # Assert
    assert 'my_indicator' in result.columns
    # First 3 values should be NaN (insufficient data)
    assert pd.isna(result['my_indicator'].iloc[0])
    assert pd.isna(result['my_indicator'].iloc[1])
    assert pd.isna(result['my_indicator'].iloc[2])
    # Fourth value should have a number
    assert not pd.isna(result['my_indicator'].iloc[3])
```

### Alert Engine Tests

Location: `backend/tests/services/test_alert_engine.py`

```python
def test_indicator_crosses_upper_alert():
    # Create alert
    alert = create_indicator_alert(
        symbol='AAPL',
        indicator_name='my_indicator',
        condition='indicator_crosses_upper',
        threshold=2.0
    )

    # Simulate indicator values
    previous_values = {'my_indicator': 1.5}
    current_values = {'my_indicator': 2.5}

    # Evaluate
    triggered = alert_engine.evaluate_indicator_alert(
        alert, current_values, previous_values
    )

    assert triggered is True
```

### Frontend Tests

Location: `frontend/tests/utils/chartHelpers.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { formatDataForChart, splitSeriesByThresholds } from '@/utils/chartHelpers';

describe('formatDataForChart', () => {
  it('converts timestamps and values to chart format', () => {
    const timestamps = [1704067200, 1704153600];
    const values = [65.5, 72.3];

    const result = formatDataForChart(timestamps, values);

    expect(result).toEqual([
      { time: 1704067200, value: 65.5 },
      { time: 1704153600, value: 72.3 }
    ]);
  });

  it('handles null values', () => {
    const timestamps = [1704067200, 1704153600];
    const values = [null, 72.3];

    const result = formatDataForChart(timestamps, values);

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBe(72.3);
  });
});
```

---

## Common Patterns

### Overlay vs Pane Indicators

```python
# Overlay indicator (draws on price chart)
metadata = IndicatorMetadata(
    display_type="overlay",
    # ...
)

# Pane indicator (separate pane below chart)
metadata = IndicatorMetadata(
    display_type="pane",
    scale_ranges={"min": 0, "max": 100, "auto": False},
    # ...
)
```

### Multiple Series (e.g., Bands)

```python
series_metadata=[
    {
        "field": "main",
        "role": "main",
        "label": "Main Line",
        "line_color": "#00bcd4",
        # ...
    },
    {
        "field": "upper_band",
        "role": "band",
        "label": "Upper Band",
        "line_color": "#b2ebf2",
        "line_style": "dashed",
        # ...
    },
    {
        "field": "lower_band",
        "role": "band",
        "label": "Lower Band",
        "line_color": "#b2ebf2",
        "line_style": "dashed",
        # ...
    }
]
```

### Histogram Display

```python
series_metadata=[
    {
        "field": "histogram",
        "role": "histogram",
        "label": "Momentum",
        "line_color": "#26a69a",
        "display_type": "histogram"
    }
]
```

---

## Troubleshooting

### Indicator Not Appearing in Selector

1. Check indicator is registered: `get_registry().list_indicators()`
2. Verify `name` property returns correct string
3. Check API logs for errors

### Wrong Colors on Chart

1. Verify `color_schemes` in metadata
2. Check `color_mode` matches expected behavior
3. Ensure hex colors are valid 6-digit codes

### Null Values at Start of Data

This is expected for indicators that require a minimum lookback period. The frontend will skip null values when rendering.

### Alert Not Triggering

1. Check alert evaluation logs in backend
2. Verify indicator field name matches alert's `indicator_field`
3. Ensure condition type is supported for your indicator

---

## Performance Tips

1. **Limit data points**: Use `limit` parameter when fetching indicators
2. **Cache calculations**: Consider caching results for expensive indicators
3. **Lazy rendering**: Only render visible indicator panes
4. **Debounce updates**: Use debouncing for parameter changes

---

## Reference

- **Data Model**: See `data-model.md` for entity definitions
- **API Contracts**: See `contracts/` for OpenAPI specifications
- **Research**: See `research.md` for design decisions
