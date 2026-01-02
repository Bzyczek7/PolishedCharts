# Quickstart: Configurable Indicator Instances

**Feature**: 007-configurable-indicators
**Date**: 2025-12-25

## Overview

This guide shows how to use the new configurable indicator API to request any indicator with custom parameters via query strings.

## Basic Usage

### Request Format

```
GET /api/v1/indicators/{symbol}/{indicator_name}?{parameter}={value}
```

**Examples**:

```bash
# SMA with period 50
GET /api/v1/indicators/AAPL/sma?period=50

# EMA with period 9
GET /api/v1/indicators/AAPL/ema?period=9

# cRSI with multiple parameters
GET /api/v1/indicators/AAPL/crsi?dom_cycle=20&vibration=14
```

### Response Format

```json
{
  "symbol": "AAPL",
  "interval": "1d",
  "timestamps": [1735075200, 1735161600, ...],
  "data": {
    "sma": [178.45, 178.52, ...]
  },
  "parameters": {
    "period": 50
  },
  "metadata": { /* rendering metadata */ },
  "calculated_at": "2025-12-25T10:00:00Z",
  "data_points": 100
}
```

## Supported Indicators

### SMA (Simple Moving Average)

**Parameters**:
- `period` (integer, 1-500, default: 20)

**Examples**:
```bash
# Default period (20)
GET /api/v1/indicators/AAPL/sma

# Custom period
GET /api/v1/indicators/AAPL/sma?period=50
GET /api/v1/indicators/AAPL/sma?period=200
```

### EMA (Exponential Moving Average)

**Parameters**:
- `period` (integer, 1-500, default: 20)

**Examples**:
```bash
# Common trading periods
GET /api/v1/indicators/AAPL/ema?period=9
GET /api/v1/indicators/AAPL/ema?period=12
GET /api/v1/indicators/AAPL/ema?period=26
GET /api/v1/indicators/AAPL/ema?period=50
```

### TDFI (Trend Direction & Force Index)

**Parameters**:
- `lookback` (integer, 1-100, default: 13)
- `filter_high` (float, -1.0 to 1.0, default: 0.05)
- `filter_low` (float, -1.0 to 1.0, default: -0.05)

**Examples**:
```bash
# Default lookback
GET /api/v1/indicators/AAPL/tdfi

# Custom lookback
GET /api/v1/indicators/AAPL/tdfi?lookback=20

# Custom thresholds
GET /api/v1/indicators/AAPL/tdfi?filter_high=0.1&filter_low=-0.1
```

### cRSI (Composite Relative Strength Index)

**Parameters**:
- `dom_cycle` (integer, 1-50, default: 20)
- `vibration` (integer, 1-50, default: 14)
- `leveling` (float, 1.0-50.0, default: 11.0)
- `cyclic_memory` (integer, 1-100, default: 40)

**Examples**:
```bash
# Default parameters
GET /api/v1/indicators/AAPL/crsi

# Custom dominant cycle
GET /api/v1/indicators/AAPL/crsi?dom_cycle=25

# Multiple custom parameters
GET /api/v1/indicators/AAPL/crsi?dom_cycle=25&vibration=16&leveling=12.0
```

### ADXVMA (ADX Volatility Moving Average)

**Parameters**:
- `adxvma_period` (integer, 1-100, default: 15)

**Examples**:
```bash
# Default period
GET /api/v1/indicators/AAPL/adxvma

# Custom period
GET /api/v1/indicators/AAPL/adxvma?adxvma_period=20
```

## Common Query Parameters

All indicator endpoints support these parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `interval` | string | 1d | Timeframe: 1m, 5m, 15m, 1h, 4h, 1d, 1wk |
| `limit` | integer | 1000 | Max data points (1-10000) |

**Example**:
```bash
# 5-minute timeframe, last 500 points
GET /api/v1/indicators/AAPL/sma?period=50&interval=5m&limit=500
```

## Default Parameter Behavior

**Omitted parameters use their default values** from `parameter_definitions`:

```bash
# Uses default period=20
GET /api/v1/indicators/AAPL/sma

# Equivalent to
GET /api/v1/indicators/AAPL/sma?period=20
```

**Default values by indicator**:

| Indicator | Parameter | Default |
|-----------|-----------|---------|
| SMA | `period` | 20 |
| EMA | `period` | 20 |
| TDFI | `lookback` | 13 |
| TDFI | `filter_high` | 0.05 |
| TDFI | `filter_low` | -0.05 |
| cRSI | `dom_cycle` | 20 |
| cRSI | `vibration` | 14 |
| cRSI | `leveling` | 11.0 |
| cRSI | `cyclic_memory` | 40 |
| ADXVMA | `adxvma_period` | 15 |

## Error Handling

### Invalid Parameter Value

```json
{
  "detail": "Parameter 'period' must be <= 500, got 1000",
  "error": "Invalid parameter value",
  "parameter": "period",
  "provided": "1000",
  "valid_range": "1-500"
}
```

### Unknown Indicator

```json
{
  "detail": "Indicator 'unknown' not found. Available: ['sma', 'ema', 'tdfi', 'crsi', 'adxvma']",
  "error": "Indicator not found",
  "available_indicators": ["sma", "ema", "tdfi", "crsi", "adxvma"]
}
```

### Invalid Parameter Name

```json
{
  "detail": "Invalid parameter 'invalid_param' for indicator 'sma'. Valid parameters: ['period']",
  "error": "Invalid parameter value",
  "parameter": "invalid_param"
}
```

## Backward Compatibility

The legacy `params` JSON string format is still supported:

```bash
# Old style (still works)
GET /api/v1/indicators/AAPL/sma?params={"period": 50}

# New style (recommended)
GET /api/v1/indicators/AAPL/sma?period=50
```

**Note**: If both query parameters and `params` are provided, query parameters take precedence.

## Discovering Indicators

### List All Supported Indicators

```bash
GET /api/v1/indicators/supported
```

**Response**:
```json
[
  {
    "name": "sma",
    "description": "Simple Moving Average (period=20)",
    "display_type": "overlay",
    "category": "overlay",
    "parameters": {
      "period": {
        "name": "period",
        "type": "integer",
        "default": 20,
        "min": 1,
        "max": 500,
        "description": "Number of periods for the moving average"
      }
    },
    "metadata": { /* ... */ },
    "alert_templates": [ /* ... */ ]
  },
  // ... more indicators
]
```

## Frontend Integration

### Complete TypeScript Interface

```typescript
interface IndicatorParams {
  // SMA / EMA parameters
  period?: number;

  // TDFI parameters
  lookback?: number;
  filter_high?: number;
  filter_low?: number;

  // cRSI parameters
  dom_cycle?: number;
  vibration?: number;
  leveling?: number;
  cyclic_memory?: number;

  // ADXVMA parameters
  adxvma_period?: number;
}

interface IndicatorOutput {
  symbol: string;
  interval: string;
  timestamps: number[];
  data: Record<string, (number | null)[]>;
  parameters: Record<string, number>;
  metadata: IndicatorMetadata;
  calculated_at: string;
  data_points: number;
}

interface IndicatorMetadata {
  display_type: 'overlay' | 'pane';
  color_mode: 'single' | 'gradient' | 'threshold' | 'trend';
  color_schemes: Record<string, string>;
  series_metadata: SeriesMetadata[];
  thresholds?: { upper?: number; lower?: number };
  scale_ranges?: { min: number; max: number; auto: boolean };
  reference_levels?: ReferenceLevel[];
}

interface SeriesMetadata {
  field: string;
  role: 'main' | 'signal' | 'band' | 'histogram';
  label: string;
  line_color: string;
  line_style: 'solid' | 'dashed' | 'dotted' | 'dashdot';
  line_width: number;
  display_type: 'line' | 'histogram';
}

interface ReferenceLevel {
  value: number;
  line_color: string;
  line_label?: string;
  line_style: 'solid' | 'dashed' | 'dotted' | 'dashdot';
}
```

### Fetch Function Example

```typescript
async function fetchIndicator(
  symbol: string,
  indicatorName: string,
  params: IndicatorParams = {}
): Promise<IndicatorOutput> {
  // Build query string from params
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      queryParams.append(key, String(value));
    }
  });

  const queryString = queryParams.toString();
  const url = `/api/v1/indicators/${symbol}/${indicatorName}${
    queryString ? '?' + queryString : ''
  }`;

  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to fetch indicator data');
  }
  return response.json();
}

// Usage examples
const smaData = await fetchIndicator('AAPL', 'sma', { period: 50 });
const crsiData = await fetchIndicator('AAPL', 'crsi', {
  dom_cycle: 20,
  vibration: 14
});
const tdfiData = await fetchIndicator('AAPL', 'tdfi', {
  lookback: 20,
  filter_high: 0.1,
  filter_low: -0.1
});
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface UseIndicatorDataParams {
  symbol: string;
  indicatorName: string;
  params?: Record<string, number>;
  interval?: string;
}

export function useIndicatorData({
  symbol,
  indicatorName,
  params = {},
  interval = '1d'
}: UseIndicatorDataParams) {
  const [data, setData] = useState<IndicatorOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({ interval, ...params });
        const response = await fetch(
          `/api/v1/indicators/${symbol}/${indicatorName}?${queryParams}`
        );

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail);
        }

        const result = await response.json();
        setData(result);
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol, indicatorName, interval, JSON.stringify(params)]);

  return { data, loading, error };
}
```

## Testing Examples

### Using curl

```bash
# Basic request
curl "http://localhost:8000/api/v1/indicators/AAPL/sma?period=50"

# With interval and limit
curl "http://localhost:8000/api/v1/indicators/AAPL/ema?period=9&interval=5m&limit=500"

# cRSI with multiple parameters
curl "http://localhost:8000/api/v1/indicators/AAPL/crsi?dom_cycle=20&vibration=14"

# List supported indicators
curl "http://localhost:8000/api/v1/indicators/supported"
```

### Using Python requests

```python
import requests

base_url = "http://localhost:8000/api/v1/indicators"

# SMA with custom period
response = requests.get(
    f"{base_url}/AAPL/sma",
    params={"period": 50, "interval": "1d"}
)
data = response.json()

# cRSI with multiple parameters
response = requests.get(
    f"{base_url}/AAPL/crsi",
    params={
        "dom_cycle": 20,
        "vibration": 14,
        "leveling": 11.0,
        "cyclic_memory": 40
    }
)
data = response.json()
```

## Performance Tips

1. **Use appropriate limits**: Only request the data points you need
2. **Cache results**: Query string URLs are cacheable by HTTP caches
3. **Batch requests**: For multiple indicators, fetch in parallel
4. **Use intervals wisely**: Higher intervals (1d, 1wk) return fewer data points

## Migration from Old API

If you were using the old `params` JSON string format:

```typescript
// Old
const url = `/api/v1/indicators/AAPL/sma?params=${encodeURIComponent('{"period":50}')}`;

// New (recommended)
const url = `/api/v1/indicators/AAPL/sma?period=50`;
```

The old format still works, but query parameters are recommended for:
- Better readability
- HTTP caching
- Standard REST conventions

## Troubleshooting

### Issue: Parameter not recognized

**Symptom**: `Invalid parameter 'X' for indicator 'Y'`

**Solution**: Check `/api/v1/indicators/supported` for valid parameter names for each indicator.

### Issue: Value out of range

**Symptom**: `Parameter 'period' must be <= 500, got 1000`

**Solution**: Check the parameter's min/max values in the indicator definitions.

### Issue: No data returned

**Symptom**: Empty `data` array

**Solution**: Verify the symbol exists and check the interval. Some symbols may not have data for certain intervals.

## Additional Resources

- [Full API Specification](./contracts/openapi.yaml)
- [Data Model](./data-model.md)
- [Research Findings](./research.md)
- [Feature Specification](./spec.md)
