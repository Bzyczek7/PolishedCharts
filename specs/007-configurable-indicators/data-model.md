# Data Model: Configurable Indicator Instances

**Feature**: 007-configurable-indicators
**Date**: 2025-12-25

## Overview

This document describes the data model for dynamic indicator configuration via query parameters. The core concept is that indicators are identified by their base name (sma, ema, etc.) and accept parameters via query string.

## Core Entities

### Indicator Type

The base indicator class/template (e.g., SMA, EMA, TDFI, cRSI, ADXVMA).

**Attributes**:
- `base_name`: string - The canonical identifier (e.g., "sma", "ema")
- `display_name`: string - Human-readable name
- `description`: string - Description of the indicator
- `category`: string - "overlay" or "oscillator"
- `parameter_definitions`: map of ParameterDefinition

**Example**:
```json
{
  "base_name": "sma",
  "display_name": "Simple Moving Average",
  "description": "Simple Moving Average indicator",
  "category": "overlay"
}
```

### ParameterDefinition

Defines a single parameter for an indicator.

**Attributes**:
- `name`: string - Parameter name
- `type`: string - "integer", "float", "boolean", "string"
- `default`: any - Default value
- `min`: number | null - Minimum value (for numeric types)
- `max`: number | null - Maximum value (for numeric types)
- `description`: string - Parameter description

**Example**:
```json
{
  "name": "period",
  "type": "integer",
  "default": 20,
  "min": 1,
  "max": 500,
  "description": "Number of periods for the moving average"
}
```

### IndicatorRequest

Represents a request for indicator data with parameters.

**Attributes**:
- `symbol`: string - Stock ticker (e.g., "AAPL")
- `indicator_name`: string - Base indicator name (e.g., "sma")
- `interval`: string - Timeframe ("1m", "5m", "15m", "1h", "4h", "1d", "1wk")
- `parameters`: map - Parameter values (e.g., {"period": 50})
- `limit`: number - Max data points to return

**Example**:
```json
{
  "symbol": "AAPL",
  "indicator_name": "sma",
  "interval": "1d",
  "parameters": {
    "period": 50
  },
  "limit": 1000
}
```

### IndicatorOutput

Standardized response containing indicator data and rendering metadata.

**Attributes**:
- `symbol`: string - Stock ticker
- `interval`: string - Timeframe
- `timestamps`: number[] - Unix timestamps in seconds
- `data`: map - Field name to value arrays
- `parameters`: map - Parameters used for calculation
- `metadata`: IndicatorMetadata - Rendering metadata
- `calculated_at`: datetime - When calculation was performed
- `data_points`: number - Number of data points returned

**Example**:
```json
{
  "symbol": "AAPL",
  "interval": "1d",
  "timestamps": [1735075200, 1735161600],
  "data": {
    "sma": [178.45, 178.52]
  },
  "parameters": {
    "period": 50
  },
  "metadata": { /* ... */ },
  "calculated_at": "2025-12-25T10:00:00Z",
  "data_points": 2
}
```

## Parameter Definitions by Indicator

### SMA (Simple Moving Average)

```json
{
  "period": {
    "type": "integer",
    "default": 20,
    "min": 1,
    "max": 500,
    "description": "Number of periods for the moving average"
  }
}
```

### EMA (Exponential Moving Average)

```json
{
  "period": {
    "type": "integer",
    "default": 20,
    "min": 1,
    "max": 500,
    "description": "Number of periods for the exponential moving average"
  }
}
```

### TDFI (Trend Direction & Force Index)

```json
{
  "lookback": {
    "type": "integer",
    "default": 13,
    "min": 1,
    "max": 100,
    "description": "Lookback period for TDFI calculation"
  },
  "filter_high": {
    "type": "float",
    "default": 0.05,
    "min": -1.0,
    "max": 1.0,
    "description": "Upper threshold for bullish zone"
  },
  "filter_low": {
    "type": "float",
    "default": -0.05,
    "min": -1.0,
    "max": 1.0,
    "description": "Lower threshold for bearish zone"
  }
}
```

### cRSI (Composite Relative Strength Index)

```json
{
  "dom_cycle": {
    "type": "integer",
    "default": 20,
    "min": 1,
    "max": 50,
    "description": "Dominant cycle period"
  },
  "vibration": {
    "type": "integer",
    "default": 14,
    "min": 1,
    "max": 50,
    "description": "Vibration period"
  },
  "leveling": {
    "type": "float",
    "default": 11.0,
    "min": 1.0,
    "max": 50.0,
    "description": "Leveling factor"
  },
  "cyclic_memory": {
    "type": "integer",
    "default": 40,
    "min": 1,
    "max": 100,
    "description": "Cyclic memory period"
  }
}
```

### ADXVMA (ADX Volatility Moving Average)

```json
{
  "adxvma_period": {
    "type": "integer",
    "default": 15,
    "min": 1,
    "max": 100,
    "description": "ADXVMA period for calculation"
  }
}
```

## Validation Rules

### Type Validation

| Input Type | Accepts | Conversion |
|------------|---------|------------|
| integer | int | Convert to int if possible |
| float | int, float | Convert to float if possible |
| boolean | bool | No conversion |
| string | string | No conversion |

### Range Validation

For numeric types (integer, float):
- If `min` is defined: value >= min
- If `max` is defined: value <= max

**Example**:
```python
# period=0 for SMA -> Rejected (min=1)
# period=1000 for SMA -> Rejected (max=500)
# period=50 for SMA -> Accepted
```

### Parameter Name Validation

Only defined parameter names are accepted for each indicator. Unknown parameters return 400 error.

**Example**:
```
GET /api/v1/indicators/AAPL/sma?invalid_param=50
-> 400 Bad Request: "Invalid parameter 'invalid_param' for indicator 'sma'. Valid parameters: ['period']"
```

## State Transitions

### Request Lifecycle

```
1. Parse Request
   ├─ Extract base indicator name
   ├─ Parse query parameters
   └─ Parse JSON params (if present)

2. Validate Parameters
   ├─ Check parameter names exist
   ├─ Validate types
   └─ Validate ranges

3. Fetch Data
   ├─ Query database for symbol
   └─ Fetch candles from provider

4. Calculate Indicator
   ├─ Get indicator by base name
   └─ Call calculate(params)

5. Return Response
   └─ Serialize to IndicatorOutput
```

### Error States

| State | HTTP Status | Response |
|-------|-------------|----------|
| Invalid indicator name | 404 | Indicator not found |
| Invalid parameter name | 400 | Unknown parameter |
| Type mismatch | 400 | Type conversion failed |
| Out of range | 400 | Value outside min/max |
| Symbol not found | 404 | Symbol not in database |
| No candles available | 404 | No data for symbol/interval |

## Storage

### Indicator Definitions

Indicators are stored in-memory only (no database). The `IndicatorRegistry` holds:
- Single instance per indicator type (SMA, EMA, etc.)
- Parameter definitions for validation

### No Persistence

- Indicator requests are stateless
- No saved parameter configurations
- Each request is calculated on-demand

## Relationships

```
IndicatorType (1) ----< (1) ParameterDefinition
       |
       | uses
       v
IndicatorRequest (1) ----< (1..*) Parameter (name, value)
       |
       | produces
       v
IndicatorOutput (1) ----< (1..*) SeriesData (field, values[])
```

## Indexes and Lookups

### Indicator Lookup

**By Base Name** (primary):
```python
registry.get_by_base_name("sma") -> SMAIndicator
registry.get_by_base_name("ema") -> EMAIndicator
```

Case-insensitive lookup for user convenience.

### Parameter Validation Lookup

Each indicator validates parameters against its `parameter_definitions` map:

```python
param_def = indicator.parameter_definitions["period"]
if value < param_def.min:
    raise ValidationError(...)
```

## Migration Notes

### From Feature 006 (Parameterized Instances)

**Old Approach**:
- Pre-register instances: SMA(period=50) -> "sma_50"
- Lookup by instance name

**New Approach**:
- Single SMA type, pass parameters in query
- Lookup by base name: "sma"?period=50

**Backward Compatibility**:
- Existing API with `params` JSON string still works
- Frontend can migrate gradually

### Breaking Changes

None - this feature is additive.

## Performance Considerations

- Indicator lookup: O(1) hash map by base name
- Parameter validation: O(n) where n = number of parameters (typically 1-4)
- No database queries for indicator definitions (in-memory)
- Calculation time unchanged (same algorithm)

## Security Considerations

- All parameters validated before use
- Type coercion prevents injection attacks
- No code execution from parameters
- Rate limiting applies per API endpoint
