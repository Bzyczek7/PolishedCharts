# Data Model: Parameterized Indicator Instances

**Feature**: 006-parameterized-indicators
**Date**: 2025-12-25

## Overview

This feature introduces parameterized indicator instances. The data model changes are minimal - we're adding instance state to existing indicator classes rather than introducing new entities.

## Entity: Indicator Instance

An indicator instance represents a specific configuration of an indicator type with concrete parameter values.

### Attributes

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `base_name` | string | The base indicator type (e.g., "sma", "ema", "crsi") | "sma" |
| `name` | string | Unique identifier generated from base_name + parameters | "sma_50" |
| `_default_params` | dict | Instance-specific parameter values | `{"period": 50}` |
| `description` | string | Human-readable description including parameters | "Simple Moving Average (period=50)" |

### Naming Rules

1. **Default instance**: If `parameters == {}`, `name = base_name`
   - Example: `SMAIndicator()` → name = "sma"

2. **Single parameter**: If one distinguishing parameter exists, `name = "{base_name}_{value}"`
   - Example: `SMAIndicator(50)` → name = "sma_50"

3. **Multiple parameters**: `name = "{base_name}_{param1}_{param2}_..."`
   - Example: `cRSIIndicator(25, 16, 12.0, 50)` → name = "crsi_25_16_12.0_50"

### Name Generation Priority

Parameters are checked in this order for naming:
1. `period`
2. `length`
3. `lookback`
4. `window`

If none of these exist, all parameters are concatenated.

## Entity: Parameter Configuration

Represents the set of parameter values that distinguish one indicator instance from another.

### Structure

```python
{
    "period": 20,          # SMA/EMA period
    "lookback": 13,        # TDFI lookback period
    "domcycle": 20,        # cRSI dominant cycle
    "vibration": 14,       # cRSI vibration
    "leveling": 11.0,      # cRSI leveling
    "cyclicmemory": 40,    # cRSI cyclic memory
    "adxvma_period": 15    # ADXVMA period
}
```

## Relationships

### Indicator Instance → Indicator Type (Composition)

- Each indicator instance IS-A specific indicator type
- Base name identifies the type
- Multiple instances can exist for the same type

```
SMAIndicator (type)
├── Instance: SMAIndicator()       → name="sma",     period=20 (default)
├── Instance: SMAIndicator(5)      → name="sma_5",   period=5
├── Instance: SMAIndicator(50)     → name="sma_50",  period=50
└── Instance: SMAIndicator(200)    → name="sma_200", period=200
```

### Indicator Instance → Registry (Aggregation)

- The registry holds references to all indicator instances
- Registry key is the instance's `name` property
- Each name must be unique within the registry

## State Transitions

### Instance Lifecycle

```
1. Instantiation
   ↓
2. Name Generation (automatic)
   ↓
3. Registration
   ↓
4. Available for Queries
```

### Registration Behavior

```
                    ┌─────────────────────┐
                    │  Registry.get()     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Instance Exists?     │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │ YES                       │ NO
                 ▼                           ▼
        ┌─────────────────┐         ┌─────────────────┐
        │ Return Instance │         │ Return None     │
        └─────────────────┘         └─────────────────┘
```

## Validation Rules

1. **Name uniqueness**: Two instances with the same `name` cannot coexist in the registry (last write wins)

2. **Parameter types**: Each indicator class defines valid parameter types in its `__init__` signature

3. **Parameter ranges**: (Future) May add min/max validation via `parameter_definitions`

4. **Backward compatibility**: Default instances (no parameters) always use base name

## Storage Considerations

### In-Memory Storage

- Indicator instances are stored in the `IndicatorRegistry` dictionary
- Key: instance `name`, Value: instance object
- Registry is global and populated at module import time

### Persistence

- Indicator instances are recreated on each application restart
- No database persistence needed (indicators are code-defined)
- User preferences for which indicators to use are stored separately (future feature)

## Example Instances

### SMA Variants

```python
# Default instance
sma = SMAIndicator()
# name = "sma"
# _default_params = {}

# Custom period instances
sma_5 = SMAIndicator(5)
# name = "sma_5"
# _default_params = {"period": 5}

sma_50 = SMAIndicator(50)
# name = "sma_50"
# _default_params = {"period": 50}

sma_200 = SMAIndicator(200)
# name = "sma_200"
# _default_params = {"period": 200}
```

### EMA Variants

```python
# Default
ema = EMAIndicator()
# name = "ema"
# _default_params = {}

# Custom periods
ema_9 = EMAIndicator(9)
# name = "ema_9"
# _default_params = {"period": 9}

ema_26 = EMAIndicator(26)
# name = "ema_26"
# _default_params = {"period": 26}
```

### cRSI (Multi-Parameter)

```python
# Default
crsi = cRSIIndicator()
# name = "crsi"
# _default_params = {}

# Custom (all params default except one)
crsi_custom = cRSIIndicator(domcycle=25)
# name = "crsi_25"
# _default_params = {"domcycle": 25}

# All custom (rare)
crsi_full = cRSIIndicator(25, 16, 12.0, 50)
# name = "crsi_25_16_12.0_50"
# _default_params = {
#     "domcycle": 25,
#     "vibration": 16,
#     "leveling": 12.0,
#     "cyclicmemory": 50
# }
```

## API Impact

### List Indicators Response

```json
[
    {
        "name": "sma",
        "description": "Simple Moving Average (period=20)",
        "display_type": "overlay",
        "category": "overlay",
        "parameters": {...},
        "metadata": {...}
    },
    {
        "name": "sma_5",
        "description": "Simple Moving Average (period=5)",
        "display_type": "overlay",
        "category": "overlay",
        "parameters": {...},
        "metadata": {...}
    },
    {
        "name": "sma_50",
        "description": "Simple Moving Average (period=50)",
        "display_type": "overlay",
        "category": "overlay",
        "parameters": {...},
        "metadata": {...}
    }
]
```

### Calculate Indicator Request

```http
GET /api/v1/indicators/AAPL/sma_50?interval=1d
```

The indicator name "sma_50" is looked up in the registry, returning the SMAIndicator instance with period=50.
