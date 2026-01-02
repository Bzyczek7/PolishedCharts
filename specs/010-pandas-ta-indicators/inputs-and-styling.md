# pandas-ta Indicator Configuration: Inputs & Styling

**Date**: 2025-12-30
**Version**: 1.0

This document specifies the input parameters and styling configuration for all pandas-ta indicators.

---

## 1. Input Parameter System

### 1.1 Parameter Types

| Type | UI Control | Example |
|------|------------|---------|
| `integer` | Slider with step 1 | Period: 14 |
| `float` | Slider with step 0.1 | Multiplier: 3.0 |
| `select` | Dropdown | MA Mode: SMA/EMA/WMA |
| `source` | Dropdown (OHLCV) | Source: close/high/low/open/volume |
| `boolean` | Toggle | Use Talib: true/false |

### 1.2 Standard Parameter Definitions

```python
STANDARD_PARAMS = {
    # Length/Period parameters (most common)
    "period": {
        "type": "integer",
        "default": 14,
        "min": 2,
        "max": 200,
        "step": 1,
        "description": "Lookback period"
    },
    "length": {
        "type": "integer",
        "default": 14,
        "min": 2,
        "max": 200,
        "step": 1,
        "description": "Number of periods"
    },

    # Standard deviation for bands
    "std": {
        "type": "float",
        "default": 2.0,
        "min": 0.1,
        "max": 5.0,
        "step": 0.1,
        "description": "Standard deviation multiplier"
    },

    # Multiplier for SuperTrend, etc.
    "multiplier": {
        "type": "float",
        "default": 3.0,
        "min": 1.0,
        "max": 10.0,
        "step": 0.1,
        "description": "ATR multiplier"
    },

    # Fast/Slow periods (MACD, KAMA, etc.)
    "fast": {
        "type": "integer",
        "default": 12,
        "min": 2,
        "max": 50,
        "step": 1,
        "description": "Fast period"
    },
    "slow": {
        "type": "integer",
        "default": 26,
        "min": 5,
        "max": 200,
        "step": 1,
        "description": "Slow period"
    },
    "signal": {
        "type": "integer",
        "default": 9,
        "min": 2,
        "max": 50,
        "step": 1,
        "description": "Signal period"
    },

    # MA Mode selection
    "mamode": {
        "type": "select",
        "options": ["sma", "ema", "wma", "dema", "tema", "smma", "rma"],
        "default": "sma",
        "description": "Moving average type"
    },

    # Source column selection
    "source": {
        "type": "source",
        "options": ["close", "high", "low", "open", "hl2", "hlc3", "ohlc4", "vwap"],
        "default": "close",
        "description": "Price source for calculation"
    },

    # ATR-related
    "atr_length": {
        "type": "integer",
        "default": 14,
        "min": 2,
        "max": 100,
        "step": 1,
        "description": "ATR period"
    },
}
```

---

## 2. Per-Category Input Configuration

### 2.1 Overlap Indicators (Moving Averages)

**Common Parameters**:
- `period`: 2-500, default 20
- `source`: price source (default: close)
- `offset`: -50 to 50 (shift indicator left/right)

| Indicator | Parameters | UI Order |
|-----------|-----------|----------|
| SMA | period, source | 1. Period, 2. Source |
| EMA | period, source | 1. Period, 2. Source |
| DEMA | period, source | 1. Period, 2. Source |
| TEMA | period, source | 1. Period, 2. Source |
| WMA | period, source, asc | 1. Period, 2. Source, 3. Ascending |
| HMA | period, mamode | 1. Period, 2. MA Mode |
| KAMA | period, fast, slow, source | 1. Period, 2. Fast, 3. Slow, 4. Source |
| MAMA | fastlimit, slowlimit, source | 1. Fast Limit, 2. Slow Limit |
| ALMA | period, sigma, dist_offset, source | 1. Period, 2. Sigma, 3. Offset |
| VWMA | period, source | 1. Period, 2. Source |
| LINREG | period, source | 1. Period, 2. Source |
| SUPERTREND | period, atr_length, multiplier | 1. Period, 2. ATR Length, 3. Multiplier |

### 2.2 Momentum Indicators

| Indicator | Parameters | Output Fields | Default Scale |
|-----------|-----------|---------------|---------------|
| RSI | period, source | rsi | 0-100 |
| MACD | fast, slow, signal | macd, signal, histogram | auto |
| STOCH | k, d, smooth_k, source | stoch_k, stoch_d | 0-100 |
| STOCHRSI | period, rsi_length, k, d | stochrsi_k, stochrsi_d | 0-100 |
| WILLR | period | willr | -100-0 |
| CCI | period | cci | auto |
| MFI | period | mfi | 0-100 |
| ADX | period, signal_length | adx, dip, din | 0-100 |
| AROON | period | aroon_up, aroon_down | 0-100 |
| CMO | period, source | cmo | -100-100 |
| TSI | long, short, source | tsi | -100-100 |
| UO | period1, period2, period3, weight | uo | 0-100 |
| PPO | fast, slow, source | ppo, signal, histogram | auto |
| MOM | period, source | mom | auto |
| ROC | period, source | roc | auto |
| KST | roc1-4, sig1-4 | kst, signal | auto |
| QQE | period, smooth, src | qqe, rsi_m, qqel | auto |

### 2.3 Volatility Indicators

| Indicator | Parameters | Output Fields | Display |
|-----------|-----------|---------------|---------|
| BBANDS | period, std, source | lower, middle, upper | overlay |
| ATR | period | atr | pane |
| NATR | period | natr | pane |
| KC | period, scalar, source | upper, middle, lower | overlay/pane |
| DONCHIAN | lower_length, upper_length | dc_upper, dc_lower, dc_mid | overlay |
| TRUE_RANGE | - | tr | pane |
| ABERRATION | period | up, mid, down | overlay |
| ACCBANDS | period, source | lower, middle, upper | overlay |
| CHANDELIER_EXIT | period, atr_multiplier | long, short | overlay |

### 2.4 Volume Indicators

| Indicator | Parameters | Output Fields | Display |
|-----------|-----------|---------------|---------|
| OBV | source | obv | pane (cumulative) |
| CMF | period | cmf | pane (-1 to 1) |
| MFI | period | mfi | pane (0-100) |
| AD | - | ad | pane (cumulative) |
| ADOSC | period_fast, period_slow | adosc | pane |
| KVO | period_fast, period_slow | kvo, signal | pane |
| VWAP | anchor | vwap | overlay |
| VWMA | period, source | vwma | overlay |
| PVO | period_fast, period_slow | pvo, signal, histogram | pane |
| AOBV | period, source | aobv, signal | pane |

### 2.5 Trend Indicators

| Indicator | Parameters | Output Fields | Display |
|-----------|-----------|---------------|---------|
| PSAR | af, max_af | psar, psarb | overlay (dots) |
| ADX | period, signal_length | adx, dip, din | pane (0-100) |
| AROON | period | aroon_up, aroon_down | pane (0-100) |
| VORTEX | period | vi_plus, vi_minus | pane |
| CHOP | period | chop | pane (0-100) |
| PIVOTS | - | pivots, s1-s4, r1-r4 | overlay |
| ZIGZAG | - | zigzag | overlay (lines) |

### 2.6 Statistics Indicators

| Indicator | Parameters | Output Fields | Display |
|-----------|-----------|---------------|---------|
| STDEV | period | stdev | pane |
| ZSCORE | period, std | zscore | pane (-3 to 3) |
| QUANTILE | period, q | quantile | pane (0-1) |
| MEDIAN | period | median | overlay |
| MAD | period | mad | pane |
| ENTROPY | period | entropy | pane |
| SKEW | period | skew | pane |
| KURTOSIS | period | kurtosis | pane |

### 2.7 Performance Indicators

| Indicator | Parameters | Output Fields | Display |
|-----------|-----------|---------------|---------|
| LOG_RETURN | period | log_return | pane (can be negative) |
| PERCENT_RETURN | period | percent_return | pane (can be negative) |

### 2.8 Cycle Indicators

| Indicator | Parameters | Output Fields | Display |
|-----------|-----------|---------------|---------|
| EBSW | period | ebsw | pane (-1 to 1) |
| REFLEX | period | reflex | pane (-1 to 1) |

---

## 3. Styling Configuration

### 3.1 Color Schemes

#### Overlay Indicators (Price Chart)

| Indicator | Bullish Color | Bearish Color | Style |
|-----------|---------------|---------------|-------|
| SMA | Blue #2962FF | Blue #2962FF | Solid |
| EMA | Orange #FF9800 | Orange #FF9800 | Solid |
| BBANDS Upper | Blue #2962FF | Blue #2962FF | Solid |
| BBANDS Middle | Gray #808080 | Gray #808080 | Dashed |
| BBANDS Lower | Blue #2962FF | Blue #2962FF | Solid |
| VWAP | Purple #9C27B0 | Purple #9C27B0 | Solid |
| SuperTrend | Green #4CAF50 | Red #F44336 | Dots |
| Ichimoku Tenkan | Red #F44336 | Red #F44336 | Solid |
| Ichimoku Kijun | Blue #2196F3 | Blue #2196F3 | Solid |
| Ichimoku Senkou A | Green #4CAF50 | Green #4CAF50 | Solid (cloud) |
| Ichimoku Senkou B | Red #F44336 | Red #F44336 | Solid (cloud) |

#### Pane Indicators (Oscillators)

| Indicator | Main Color | Signal Color | Histogram Color | Style |
|-----------|------------|--------------|-----------------|-------|
| RSI | Gray #808080 | - | - | Solid |
| MACD | Cyan #00BCD4 | Orange #FF9800 | Blue/Red | Histogram |
| STOCH | Purple #9C27B0 | Green #4CAF50 | - | Solid |
| CCI | Orange #FF9800 | - | - | Solid |
| MFI | Blue #2196F3 | - | - | Solid |
| ADX | Green #4CAF50 | Red #F44336 | - | Solid |
| AROON Up | Green #4CAF50 | - | - | Solid |
| AROON Down | Red #F44336 | - | - | Solid |
| ATR | Orange #FF9800 | - | - | Solid |
| VWMA | Purple #9C27B0 | - | - | Solid |
| OBV | Blue #2196F3 | - | - | Solid |
| CMF | Green #4CAF50 | - | - | Solid |
| ZSCORE | Blue #2196F3 | - | - | Solid |

### 3.2 Reference Levels

| Indicator | Levels | Purpose |
|-----------|--------|---------|
| RSI | 30, 50, 70 | Oversold, neutral, overbought |
| STOCH | 20, 50, 80 | Oversold, neutral, overbought |
| CCI | -100, 0, 100 | Oversold, neutral, overbought |
| MFI | 20, 50, 80 | Oversold, neutral, overbought |
| ADX | 20, 25, 50 | Weak, moderate, strong trend |
| AROON | 30, 50, 70 | Weak, moderate, strong |
| MACD | 0 | Signal line crossover |
| AO | 0 | Zero line crossover |
| CMF | 0 | Money flow direction |
| ZSCORE | -2, 0, 2 | Statistical boundaries |

### 3.3 Scale Ranges

| Indicator | Min | Max | Auto | Notes |
|-----------|-----|-----|------|-------|
| RSI | 0 | 100 | No | Fixed 0-100 |
| STOCH | 0 | 100 | No | Fixed 0-100 |
| WILLR | -100 | 0 | No | Fixed -100-0 |
| CCI | -200 | 200 | Yes | Auto with bounds |
| MFI | 0 | 100 | No | Fixed 0-100 |
| ADX | 0 | 100 | No | Fixed 0-100 |
| MACD | -Inf | Inf | Yes | Dynamic |
| ATR | 0 | Inf | Yes | Dynamic |
| ZSCORE | -3 | 3 | Yes | +/- 3 std |
| CMO | -100 | 100 | No | Fixed -100-100 |
| UO | 0 | 100 | No | Fixed 0-100 |
| VORTEX | 0 | 2 | Yes | Usually 0.8-1.2 |

### 3.4 Color Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `SINGLE` | One color for all states | Most indicators |
| `THRESHOLD` | Color based on value vs threshold | RSI (30/70), STOCH |
| `TREND` | Color based on slope direction | ADXVMA, moving averages |
| `SIGNAL` | Compare main vs signal line | MACD, STOCH |

---

## 4. Indicator Display Order (UI Picker)

### 4.1 Suggested Indicators (Top Section)

```
🔷 OVERLAY (Price)
  ├── SMA (Simple Moving Average)
  ├── EMA (Exponential MA)
  ├── VWAP (Volume-Weighted Average)
  └── BBANDS (Bollinger Bands)

🔶 OSCILLATORS (Pane)
  ├── RSI (Relative Strength Index)
  ├── MACD (Moving Average Convergence Divergence)
  ├── STOCH (Stochastic Oscillator)
  ├── CCI (Commodity Channel Index)
  └── ATR (Average True Range)
```

### 4.2 Full Indicator List (Expandable)

```
🔷 OVERLAY
  ├── Moving Averages: SMA, EMA, DEMA, TEMA, WMA, HMA, KAMA, MAMA, ALMA, VWMA, LINREG
  └── Bands/Channels: BBANDS, KC, DONCHIAN, ACCBANDS, ICHIMOKU, SUPERTREND, PIVOTS

🔶 OSCILLATORS
  ├── Momentum: RSI, STOCH, STOCHRSI, WILLR, MFI, CMO, TSI, UO, PPO, MOM, ROC, KST, QQE
  ├── Trend: ADX, AROON, VORTEX, CHOP, PIVOTS, PSAR
  ├── Volume: OBV, CMF, MFI, AD, ADOSC, KVO, PVO, AOBV, VWMA
  └── Statistics: STDEV, ZSCORE, QUANTILE, MEDIAN, MAD, ENTROPY, SKEW, KURTOSIS

📈 PERFORMANCE
  └── LOG_RETURN, PERCENT_RETURN

🔄 CYCLE
  └── EBSW, REFLEX
```

---

## 5. Example Configuration Files

### 5.1 Complete Indicator Config

```python
# backend/app/services/indicator_registry/pandas_ta_config.py

from typing import Dict, Any
from app.schemas.indicator import (
    ColorMode, IndicatorDisplayType, LineStyle, DisplayType,
    ParameterDefinition, IndicatorMetadata, SeriesMetadata, SeriesRole,
    ScaleRangesConfig, ReferenceLevel, ThresholdsConfig
)

# =============================================================================
# INPUT PARAMETER DEFINITIONS
# =============================================================================

PARAMETER_DEFS = {
    # Standard parameters used across indicators
    "period": ParameterDefinition(
        type="integer",
        default=14,
        min=2,
        max=200,
        step=1,
        description="Lookback period"
    ),
    "length": ParameterDefinition(
        type="integer",
        default=14,
        min=2,
        max=200,
        step=1,
        description="Number of periods"
    ),
    "fast": ParameterDefinition(
        type="integer",
        default=12,
        min=2,
        max=50,
        step=1,
        description="Fast period"
    ),
    "slow": ParameterDefinition(
        type="integer",
        default=26,
        min=5,
        max=200,
        step=1,
        description="Slow period"
    ),
    "signal": ParameterDefinition(
        type="integer",
        default=9,
        min=2,
        max=50,
        step=1,
        description="Signal period"
    ),
    "std": ParameterDefinition(
        type="float",
        default=2.0,
        min=0.1,
        max=5.0,
        step=0.1,
        description="Standard deviation multiplier"
    ),
    "multiplier": ParameterDefinition(
        type="float",
        default=3.0,
        min=1.0,
        max=10.0,
        step=0.1,
        description="ATR multiplier"
    ),
    "source": ParameterDefinition(
        type="select",
        options=["close", "high", "low", "open", "hl2", "hlc3", "ohlc4"],
        default="close",
        description="Price source"
    ),
    "mamode": ParameterDefinition(
        type="select",
        options=["sma", "ema", "wma", "dema", "tema", "smma", "rma"],
        default="sma",
        description="Moving average type"
    ),
    "k": ParameterDefinition(
        type="integer",
        default=14,
        min=1,
        max=50,
        step=1,
        description="Stochastic %K period"
    ),
    "d": ParameterDefinition(
        type="integer",
        default=3,
        min=1,
        max=20,
        step=1,
        description="Stochastic %D period (smoothing)"
    ),
    "smooth_k": ParameterDefinition(
        type="integer",
        default=3,
        min=1,
        max=20,
        step=1,
        description="Stochastic %K smoothing period"
    ),
}

# =============================================================================
# INDICATOR STYLING CONFIGURATION
# =============================================================================

INDICATOR_CONFIG: Dict[str, Dict[str, Any]] = {
    # -------------------------------------------------------------------------
    # OVERLAY INDICATORS
    # -------------------------------------------------------------------------

    "sma": {
        "display_type": IndicatorDisplayType.OVERLAY,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#2962FF",
            "bearish": "#2962FF",
            "neutral": "#2962FF",
        },
        "series": [
            {
                "field": "sma",
                "role": SeriesRole.MAIN,
                "label": "SMA",
                "color": "#2962FF",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "parameters": ["period", "source"],
        "default_params": {"period": 20},
    },

    "ema": {
        "display_type": IndicatorDisplayType.OVERLAY,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#FF9800",
            "bearish": "#FF9800",
            "neutral": "#FF9800",
        },
        "series": [
            {
                "field": "ema",
                "role": SeriesRole.MAIN,
                "label": "EMA",
                "color": "#FF9800",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "parameters": ["period", "source"],
        "default_params": {"period": 20},
    },

    "vwma": {
        "display_type": IndicatorDisplayType.OVERLAY,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#9C27B0",
            "bearish": "#9C27B0",
            "neutral": "#9C27B0",
        },
        "series": [
            {
                "field": "vwma",
                "role": SeriesRole.MAIN,
                "label": "VWMA",
                "color": "#9C27B0",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "parameters": ["period", "source"],
        "default_params": {"period": 20},
    },

    "bbands": {
        "display_type": IndicatorDisplayType.OVERLAY,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#2962FF",
            "bearish": "#2962FF",
            "neutral": "#2962FF",
        },
        "series": [
            {
                "field": "upper",
                "role": SeriesRole.BAND,
                "label": "Upper",
                "color": "#2962FF",
                "style": LineStyle.SOLID,
                "width": 1,
                "display_type": DisplayType.LINE,
            },
            {
                "field": "middle",
                "role": SeriesRole.BAND,
                "label": "Middle",
                "color": "#808080",
                "style": LineStyle.DASHED,
                "width": 1,
                "display_type": DisplayType.LINE,
            },
            {
                "field": "lower",
                "role": SeriesRole.BAND,
                "label": "Lower",
                "color": "#2962FF",
                "style": LineStyle.SOLID,
                "width": 1,
                "display_type": DisplayType.LINE,
            },
        ],
        "parameters": ["period", "std", "source"],
        "default_params": {"period": 20, "std": 2.0},
    },

    "vwap": {
        "display_type": IndicatorDisplayType.OVERLAY,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#9C27B0",
            "bearish": "#9C27B0",
            "neutral": "#9C27B0",
        },
        "series": [
            {
                "field": "vwap",
                "role": SeriesRole.MAIN,
                "label": "VWAP",
                "color": "#9C27B0",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "parameters": [],
        "default_params": {},
    },

    "supertrend": {
        "display_type": IndicatorDisplayType.OVERLAY,
        "color_mode": ColorMode.THRESHOLD,
        "color_schemes": {
            "bullish": "#4CAF50",
            "bearish": "#F44336",
            "neutral": "#4CAF50",
        },
        "thresholds": ThresholdsConfig(high=0, low=0),  # Direction-based
        "series": [
            {
                "field": "SUPERT",
                "role": SeriesRole.MAIN,
                "label": "SuperTrend",
                "color": "#4CAF50",
                "style": LineStyle.DOTS,
                "width": 3,
                "display_type": DisplayType.POINTS,
            }
        ],
        "parameters": ["period", "multiplier", "atr_length"],
        "default_params": {"period": 10, "multiplier": 3.0, "atr_length": 14},
        "special_output": "SUPERTd",  # Direction signal
    },

    # -------------------------------------------------------------------------
    # OSCILLATOR INDICATORS
    # -------------------------------------------------------------------------

    "rsi": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#808080",
            "bearish": "#808080",
            "neutral": "#808080",
        },
        "scale_ranges": ScaleRangesConfig(min=0, max=100, auto=False),
        "series": [
            {
                "field": "rsi",
                "role": SeriesRole.MAIN,
                "label": "RSI",
                "color": "#808080",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "reference_levels": [
            ReferenceLevel(value=30, color="#b2ebf2", label="30", style=LineStyle.DASHED),
            ReferenceLevel(value=50, color="#9e9e9e", label="50", style=LineStyle.DOTTED),
            ReferenceLevel(value=70, color="#ef5350", label="70", style=LineStyle.DASHED),
        ],
        "parameters": ["period", "source"],
        "default_params": {"period": 14},
    },

    "macd": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#00BCD4",
            "bearish": "#00BCD4",
            "neutral": "#00BCD4",
        },
        "scale_ranges": ScaleRangesConfig(min=None, max=None, auto=True),
        "series": [
            {
                "field": "macd",
                "role": SeriesRole.MAIN,
                "label": "MACD",
                "color": "#00BCD4",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            },
            {
                "field": "signal",
                "role": SeriesRole.SIGNAL,
                "label": "Signal",
                "color": "#FF9800",
                "style": LineStyle.SOLID,
                "width": 1,
                "display_type": DisplayType.LINE,
            },
            {
                "field": "histogram",
                "role": SeriesRole.HISTOGRAM,
                "label": "Histogram",
                "color": "#808080",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.HISTOGRAM,
            },
        ],
        "reference_levels": [
            ReferenceLevel(value=0, color="#808080", label="0", style=LineStyle.DASHED),
        ],
        "parameters": ["fast", "slow", "signal", "source"],
        "default_params": {"fast": 12, "slow": 26, "signal": 9},
    },

    "stoch": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#9C27B0",
            "bearish": "#9C27B0",
            "neutral": "#9C27B0",
        },
        "scale_ranges": ScaleRangesConfig(min=0, max=100, auto=False),
        "series": [
            {
                "field": "stoch_k",
                "role": SeriesRole.MAIN,
                "label": "%K",
                "color": "#9C27B0",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            },
            {
                "field": "stoch_d",
                "role": SeriesRole.SIGNAL,
                "label": "%D",
                "color": "#4CAF50",
                "style": LineStyle.SOLID,
                "width": 1,
                "display_type": DisplayType.LINE,
            },
        ],
        "reference_levels": [
            ReferenceLevel(value=20, color="#b2ebf2", label="20", style=LineStyle.DASHED),
            ReferenceLevel(value=50, color="#9e9e9e", label="50", style=LineStyle.DOTTED),
            ReferenceLevel(value=80, color="#ef5350", label="80", style=LineStyle.DASHED),
        ],
        "parameters": ["k", "d", "smooth_k", "source"],
        "default_params": {"k": 14, "d": 3, "smooth_k": 3},
    },

    "stochrsi": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#FF9800",
            "bearish": "#FF9800",
            "neutral": "#FF9800",
        },
        "scale_ranges": ScaleRangesConfig(min=0, max=100, auto=False),
        "series": [
            {
                "field": "stochrsi_k",
                "role": SeriesRole.MAIN,
                "label": "%K",
                "color": "#FF9800",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            },
            {
                "field": "stochrsi_d",
                "role": SeriesRole.SIGNAL,
                "label": "%D",
                "color": "#2962FF",
                "style": LineStyle.SOLID,
                "width": 1,
                "display_type": DisplayType.LINE,
            },
        ],
        "reference_levels": [
            ReferenceLevel(value=20, color="#b2ebf2", label="20", style=LineStyle.DASHED),
            ReferenceLevel(value=80, color="#ef5350", label="80", style=LineStyle.DASHED),
        ],
        "parameters": ["period", "k", "d"],
        "default_params": {"period": 14, "k": 3, "d": 3},
    },

    "willr": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#E91E63",
            "bearish": "#E91E63",
            "neutral": "#E91E63",
        },
        "scale_ranges": ScaleRangesConfig(min=-100, max=0, auto=False),
        "series": [
            {
                "field": "willr",
                "role": SeriesRole.MAIN,
                "label": "Williams %R",
                "color": "#E91E63",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "reference_levels": [
            ReferenceLevel(value=-80, color="#b2ebf2", label="-80", style=LineStyle.DASHED),
            ReferenceLevel(value=-20, color="#ef5350", label="-20", style=LineStyle.DASHED),
        ],
        "parameters": ["period"],
        "default_params": {"period": 14},
    },

    "cci": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#FF9800",
            "bearish": "#FF9800",
            "neutral": "#FF9800",
        },
        "scale_ranges": ScaleRangesConfig(min=-200, max=200, auto=True),
        "series": [
            {
                "field": "cci",
                "role": SeriesRole.MAIN,
                "label": "CCI",
                "color": "#FF9800",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "reference_levels": [
            ReferenceLevel(value=-100, color="#b2ebf2", label="-100", style=LineStyle.DASHED),
            ReferenceLevel(value=0, color="#9e9e9e", label="0", style=LineStyle.DOTTED),
            ReferenceLevel(value=100, color="#ef5350", label="100", style=LineStyle.DASHED),
        ],
        "parameters": ["period"],
        "default_params": {"period": 20},
    },

    "mfi": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#2196F3",
            "bearish": "#2196F3",
            "neutral": "#2196F3",
        },
        "scale_ranges": ScaleRangesConfig(min=0, max=100, auto=False),
        "series": [
            {
                "field": "mfi",
                "role": SeriesRole.MAIN,
                "label": "MFI",
                "color": "#2196F3",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "reference_levels": [
            ReferenceLevel(value=20, color="#b2ebf2", label="20", style=LineStyle.DASHED),
            ReferenceLevel(value=80, color="#ef5350", label="80", style=LineStyle.DASHED),
        ],
        "parameters": ["period"],
        "default_params": {"period": 14},
    },

    "atr": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#FF9800",
            "bearish": "#FF9800",
            "neutral": "#FF9800",
        },
        "scale_ranges": ScaleRangesConfig(min=0, max=None, auto=True),
        "series": [
            {
                "field": "atr",
                "role": SeriesRole.MAIN,
                "label": "ATR",
                "color": "#FF9800",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "parameters": ["period"],
        "default_params": {"period": 14},
    },

    "adx": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#4CAF50",
            "bearish": "#F44336",
            "neutral": "#4CAF50",
        },
        "scale_ranges": ScaleRangesConfig(min=0, max=100, auto=False),
        "series": [
            {
                "field": "adx",
                "role": SeriesRole.MAIN,
                "label": "ADX",
                "color": "#4CAF50",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            },
            {
                "field": "dip",
                "role": SeriesRole.SIGNAL,
                "label": "+DI",
                "color": "#4CAF50",
                "style": LineStyle.DASHED,
                "width": 1,
                "display_type": DisplayType.LINE,
            },
            {
                "field": "din",
                "role": SeriesRole.SIGNAL,
                "label": "-DI",
                "color": "#F44336",
                "style": LineStyle.DASHED,
                "width": 1,
                "display_type": DisplayType.LINE,
            },
        ],
        "reference_levels": [
            ReferenceLevel(value=20, color="#b2ebf2", label="20", style=LineStyle.DASHED),
            ReferenceLevel(value=25, color="#4CAF50", label="Trend Start", style=LineStyle.DASHED),
            ReferenceLevel(value=50, color="#9e9e9e", label="50", style=LineStyle.DOTTED),
        ],
        "parameters": ["period", "signal_length"],
        "default_params": {"period": 14, "signal_length": 14},
    },

    "aroon": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#4CAF50",
            "bearish": "#F44336",
            "neutral": "#808080",
        },
        "scale_ranges": ScaleRangesConfig(min=0, max=100, auto=False),
        "series": [
            {
                "field": "aroon_up",
                "role": SeriesRole.MAIN,
                "label": "Aroon Up",
                "color": "#4CAF50",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            },
            {
                "field": "aroon_down",
                "role": SeriesRole.MAIN,
                "label": "Aroon Down",
                "color": "#F44336",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            },
        ],
        "reference_levels": [
            ReferenceLevel(value=30, color="#b2ebf2", label="30", style=LineStyle.DASHED),
            ReferenceLevel(value=50, color="#9e9e9e", label="50", style=LineStyle.DOTTED),
            ReferenceLevel(value=70, color="#ef5350", label="70", style=LineStyle.DASHED),
        ],
        "parameters": ["period"],
        "default_params": {"period": 25},
    },

    "cmf": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#4CAF50",
            "bearish": "#F44336",
            "neutral": "#808080",
        },
        "scale_ranges": ScaleRangesConfig(min=-1, max=1, auto=False),
        "series": [
            {
                "field": "cmf",
                "role": SeriesRole.MAIN,
                "label": "CMF",
                "color": "#4CAF50",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "reference_levels": [
            ReferenceLevel(value=0, color="#808080", label="0", style=LineStyle.DASHED),
        ],
        "parameters": ["period"],
        "default_params": {"period": 20},
    },

    "obv": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#2196F3",
            "bearish": "#2196F3",
            "neutral": "#2196F3",
        },
        "scale_ranges": ScaleRangesConfig(min=None, max=None, auto=True),
        "series": [
            {
                "field": "obv",
                "role": SeriesRole.MAIN,
                "label": "OBV",
                "color": "#2196F3",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "parameters": [],
        "default_params": {},
    },

    "zscore": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {
            "bullish": "#2196F3",
            "bearish": "#2196F3",
            "neutral": "#2196F3",
        },
        "scale_ranges": ScaleRangesConfig(min=-3, max=3, auto=False),
        "series": [
            {
                "field": "zscore",
                "role": SeriesRole.MAIN,
                "label": "Z-Score",
                "color": "#2196F3",
                "style": LineStyle.SOLID,
                "width": 2,
                "display_type": DisplayType.LINE,
            }
        ],
        "reference_levels": [
            ReferenceLevel(value=-2, color="#b2ebf2", label="-2σ", style=LineStyle.DASHED),
            ReferenceLevel(value=0, color="#9e9e9e", label="0", style=LineStyle.DOTTED),
            ReferenceLevel(value=2, color="#ef5350", label="+2σ", style=LineStyle.DASHED),
        ],
        "parameters": ["period", "std"],
        "default_params": {"period": 30, "std": 1},
    },

    # -------------------------------------------------------------------------
    # ADDITIONAL MOMENTUM INDICATORS (concise config)
    # -------------------------------------------------------------------------

    "cmo": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {"bullish": "#FF5722", "bearish": "#FF5722", "neutral": "#FF5722"},
        "scale_ranges": ScaleRangesConfig(min=-100, max=100, auto=False),
        "series": [{"field": "cmo", "role": SeriesRole.MAIN, "label": "CMO",
                   "color": "#FF5722", "style": LineStyle.SOLID, "width": 2,
                   "display_type": DisplayType.LINE}],
        "reference_levels": [
            ReferenceLevel(value=-50, color="#b2ebf2", label="-50", style=LineStyle.DASHED),
            ReferenceLevel(value=50, color="#ef5350", label="50", style=LineStyle.DASHED),
        ],
        "parameters": ["period", "source"],
        "default_params": {"period": 14},
    },

    "tsi": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {"bullish": "#673AB7", "bearish": "#673AB7", "neutral": "#673AB7"},
        "scale_ranges": ScaleRangesConfig(min=-100, max=100, auto=True),
        "series": [{"field": "tsi", "role": SeriesRole.MAIN, "label": "TSI",
                   "color": "#673AB7", "style": LineStyle.SOLID, "width": 2,
                   "display_type": DisplayType.LINE}],
        "reference_levels": [ReferenceLevel(value=0, color="#808080", label="0",
                                           style=LineStyle.DASHED)],
        "parameters": ["long", "short", "source"],
        "default_params": {"long": 25, "short": 13},
    },

    "uo": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {"bullish": "#00BCD4", "bearish": "#00BCD4", "neutral": "#00BCD4"},
        "scale_ranges": ScaleRangesConfig(min=0, max=100, auto=False),
        "series": [{"field": "uo", "role": SeriesRole.MAIN, "label": "UO",
                   "color": "#00BCD4", "style": LineStyle.SOLID, "width": 2,
                   "display_type": DisplayType.LINE}],
        "reference_levels": [
            ReferenceLevel(value=30, color="#b2ebf2", label="30", style=LineStyle.DASHED),
            ReferenceLevel(value=70, color="#ef5350", label="70", style=LineStyle.DASHED),
        ],
        "parameters": ["period1", "period2", "period3"],
        "default_params": {"period1": 7, "period2": 14, "period3": 28},
    },

    "ppo": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {"bullish": "#E91E63", "bearish": "#E91E63", "neutral": "#E91E63"},
        "scale_ranges": ScaleRangesConfig(min=None, max=None, auto=True),
        "series": [
            {"field": "ppo", "role": SeriesRole.MAIN, "label": "PPO",
             "color": "#E91E63", "style": LineStyle.SOLID, "width": 2,
             "display_type": DisplayType.LINE},
            {"field": "signal", "role": SeriesRole.SIGNAL, "label": "Signal",
             "color": "#FF9800", "style": LineStyle.SOLID, "width": 1,
             "display_type": DisplayType.LINE},
        ],
        "reference_levels": [ReferenceLevel(value=0, color="#808080", label="0",
                                           style=LineStyle.DASHED)],
        "parameters": ["fast", "slow", "signal", "source"],
        "default_params": {"fast": 12, "slow": 26, "signal": 9},
    },

    "mom": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {"bullish": "#8BC34A", "bearish": "#8BC34A", "neutral": "#8BC34A"},
        "scale_ranges": ScaleRangesConfig(min=None, max=None, auto=True),
        "series": [{"field": "mom", "role": SeriesRole.MAIN, "label": "MOM",
                   "color": "#8BC34A", "style": LineStyle.SOLID, "width": 2,
                   "display_type": DisplayType.LINE}],
        "reference_levels": [ReferenceLevel(value=0, color="#808080", label="0",
                                           style=LineStyle.DASHED)],
        "parameters": ["period", "source"],
        "default_params": {"period": 10},
    },

    "roc": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {"bullish": "#009688", "bearish": "#009688", "neutral": "#009688"},
        "scale_ranges": ScaleRangesConfig(min=None, max=None, auto=True),
        "series": [{"field": "roc", "role": SeriesRole.MAIN, "label": "ROC",
                   "color": "#009688", "style": LineStyle.SOLID, "width": 2,
                   "display_type": DisplayType.LINE}],
        "reference_levels": [ReferenceLevel(value=0, color="#808080", label="0",
                                           style=LineStyle.DASHED)],
        "parameters": ["period", "source"],
        "default_params": {"period": 10},
    },

    "kst": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {"bullish": "#FF9800", "bearish": "#FF9800", "neutral": "#FF9800"},
        "scale_ranges": ScaleRangesConfig(min=None, max=None, auto=True),
        "series": [
            {"field": "kst", "role": SeriesRole.MAIN, "label": "KST",
             "color": "#FF9800", "style": LineStyle.SOLID, "width": 2,
             "display_type": DisplayType.LINE},
            {"field": "signal", "role": SeriesRole.SIGNAL, "label": "Signal",
             "color": "#2962FF", "style": LineStyle.SOLID, "width": 1,
             "display_type": DisplayType.LINE},
        ],
        "reference_levels": [ReferenceLevel(value=0, color="#808080", label="0",
                                           style=LineStyle.DASHED)],
        "parameters": ["roc1", "roc2", "roc3", "roc4", "sig1", "sig2", "sig3", "sig4"],
        "default_params": {"roc1": 10, "roc2": 15, "roc3": 20, "roc4": 30,
                          "sig1": 10, "sig2": 10, "sig3": 10, "sig4": 15},
    },

    "qqe": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "color_schemes": {"bullish": "#9C27B0", "bearish": "#9C27B0", "neutral": "#9C27B0"},
        "scale_ranges": ScaleRangesConfig(min=None, max=None, auto=True),
        "series": [
            {"field": "qqe", "role": SeriesRole.MAIN, "label": "QQE",
             "color": "#9C27B0", "style": LineStyle.SOLID, "width": 2,
             "display_type": DisplayType.LINE},
            {"field": "qqel", "role": SeriesRole.SIGNAL, "label": "SSL",
             "color": "#FF9800", "style": LineStyle.DASHED, "width": 1,
             "display_type": DisplayType.LINE},
        ],
        "reference_levels": [ReferenceLevel(value=0, color="#808080", label="0",
                                           style=LineStyle.DASHED)],
        "parameters": ["period", "smooth", "source"],
        "default_params": {"period": 14, "smooth": 5},
    },
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_parameter_def(name: str) -> ParameterDefinition:
    """Get parameter definition by name."""
    return PARAMETER_DEFS.get(name)

def get_indicator_config(name: str) -> Dict[str, Any]:
    """Get indicator configuration by name."""
    return INDICATOR_CONFIG.get(name.lower(), {})

def create_metadata(name: str) -> IndicatorMetadata:
    """Create IndicatorMetadata from config."""
    config = get_indicator_config(name)
    if not config:
        return None

    series = [
        SeriesMetadata(
            field=s["field"],
            role=SeriesRole(s["role"]),
            label=s["label"],
            line_color=s["color"],
            line_style=LineStyle(s["style"]),
            line_width=s["width"],
            display_type=DisplayType(s["display_type"]),
        )
        for s in config.get("series", [])
    ]

    ref_levels = []
    for ref in config.get("reference_levels", []):
        ref_levels.append(ReferenceLevel(
            value=ref["value"],
            line_color=ref["color"],
            line_label=ref["label"],
            line_style=LineStyle(ref["style"]),
        ))

    scale = config.get("scale_ranges")
    if scale:
        scale_ranges = ScaleRangesConfig(
            min=scale.get("min"),
            max=scale.get("max"),
            auto=scale.get("auto", True),
        )
    else:
        scale_ranges = ScaleRangesConfig(min=None, max=None, auto=True)

    thresholds = config.get("thresholds")
    if thresholds:
        thresholds_config = ThresholdsConfig(
            high=thresholds.get("high"),
            low=thresholds.get("low"),
        )
    else:
        thresholds_config = None

    return IndicatorMetadata(
        display_type=config["display_type"],
        color_mode=config["color_mode"],
        color_schemes=config["color_schemes"],
        series_metadata=series,
        scale_ranges=scale_ranges,
        reference_levels=ref_levels,
        thresholds=thresholds_config,
    )

def get_default_parameters(name: str) -> Dict[str, Any]:
    """Get default parameters for an indicator."""
    config = get_indicator_config(name)
    return config.get("default_params", {})

def get_parameter_schema(name: str) -> Dict[str, ParameterDefinition]:
    """Get parameter schema for an indicator."""
    config = get_indicator_config(name)
    params = config.get("parameters", [])
    return {
        p: PARAMETER_DEFS[p]
        for p in params
        if p in PARAMETER_DEFS
    }
