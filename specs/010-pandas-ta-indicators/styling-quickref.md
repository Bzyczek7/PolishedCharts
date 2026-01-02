# Quick Reference: Indicator Inputs & Styling

**For quick lookup during implementation**

---

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Blue | `#2962FF` | SMA, BBANDS |
| Orange | `#FF9800` | EMA, ATR, CCI |
| Cyan | `#00BCD4` | MACD |
| Purple | `#9C27B0` | VWMA, STOCH, QQE |
| Green | `#4CAF50` | Bullish signals, ADX+, SuperTrend bullish |
| Red | `#F44336` | Bearish signals, ADX-, SuperTrend bearish |
| Gray | `#808080` | Neutral, middle lines |
| Pink | `#E91E63` | Williams %R |

---

## Line Styles

| Style | Usage |
|-------|-------|
| `SOLID` | Main indicator lines |
| `DASHED` | Reference levels, signal lines |
| `DOTTED` | Neutral reference lines |
| `DOTS` | SuperTrend, PSAR (point-based) |

---

## Display Types

| Type | Usage |
|------|-------|
| `LINE` | Standard line chart |
| `HISTOGRAM` | MACD-style bars |
| `POINTS` | PSAR, SuperTrend dots |
| `BAND` | BBANDS upper/lower/lower |

---

## Series Roles

| Role | Usage |
|------|-------|
| `MAIN` | Primary indicator line |
| `SIGNAL` | Signal line (MACD, STOCH) |
| `BAND` | Band component (BBANDS) |
| `HISTOGRAM` | Histogram data |

---

## Color Modes

| Mode | Behavior |
|------|----------|
| `SINGLE` | One color for all states |
| `THRESHOLD` | Color changes at threshold (RSI 30/70) |
| `TREND` | Color based on slope direction |
| `SIGNAL` | Compare main vs signal |

---

## Standard Parameters

| Parameter | Type | Default | Range | Used By |
|-----------|------|---------|-------|---------|
| `period` | int | 14 | 2-200 | Most indicators |
| `length` | int | 14 | 2-200 | Some indicators |
| `fast` | int | 12 | 2-50 | MACD, PPO, KAMA |
| `slow` | int | 26 | 5-200 | MACD, PPO, KAMA |
| `signal` | int | 9 | 2-50 | MACD, PPO |
| `std` | float | 2.0 | 0.1-5.0 | BBANDS, ZSCORE |
| `multiplier` | float | 3.0 | 1.0-10.0 | SuperTrend, Chandelier |
| `k` | int | 14 | 1-50 | STOCH |
| `d` | int | 3 | 1-20 | STOCH |
| `smooth_k` | int | 3 | 1-20 | STOCH |
| `source` | str | "close" | OHLCV | Most |
| `mamode` | str | "sma" | sma/ema/wma/dema/tema/smma/rma | Many |

---

## Reference Level Quick Ref

| Indicator | Levels | Purpose |
|-----------|--------|---------|
| RSI | 30, 50, 70 | Overbought/oversold |
| STOCH | 20, 50, 80 | Overbought/oversold |
| CCI | -100, 0, 100 | Extreme/neutral |
| MFI | 20, 80 | Overbought/oversold |
| ADX | 20, 25, 50 | Weak/Trend/Strong |
| AROON | 30, 50, 70 | Weak/Moderate/Strong |
| MACD | 0 | Crossover |
| ZSCORE | -2, 0, +2 | Statistical outliers |
| CMO | -50, 0, 50 | Momentum direction |
| UO | 30, 70 | Overbought/oversold |

---

## Category Summary

### Overlays (display on price)
- **MAs**: SMA, EMA, DEMA, TEMA, WMA, HMA, KAMA, MAMA, ALMA, VWMA, LINREG
- **Bands**: BBANDS, KC, DONCHIAN, ACCBANDS
- **Special**: SuperTrend, PSAR, Ichimoku, VWAP, Pivots

### Pane Oscillators
- **Momentum**: RSI, STOCH, STOCHRSI, WILLR, CCI, MFI, CMO, TSI, UO, PPO, MOM, ROC, KST, QQE
- **Trend**: ADX, AROON, VORTEX, CHOP
- **Volume**: OBV, CMF, MFI, AD, ADOSC, KVO, PVO, AOBV
- **Statistics**: STDEV, ZSCORE, QUANTILE, MEDIAN, MAD, ENTROPY, SKEW, KURTOSIS

---

## UI Ordering (Indicator Picker)

1. **Suggested** (Most Popular)
   - SMA, EMA, BBANDS, VWAP (Overlay)
   - RSI, MACD, STOCH, CCI, ATR (Pane)

2. **All Overlays**
   - Moving Averages first
   - Bands/Channels second
   - Special indicators last

3. **All Oscillators**
   - Momentum (RSI family)
   - Trend (ADX family)
   - Volume
   - Statistics

---

## Parameter Display Order

For each indicator, parameters should be displayed in this order:

1. **Core calculation parameters** (period, length)
2. **Secondary parameters** (fast, slow, signal)
3. **Style parameters** (std, multiplier)
4. **Source selection** (source)
5. **Advanced options** (offset, mamode)

---

## Example: RSI Configuration

```python
{
    "name": "rsi",
    "display_type": "pane",
    "color_mode": "single",
    "color": "#808080",
    "scale_range": {"min": 0, "max": 100},
    "reference_levels": [
        {"value": 30, "color": "#b2ebf2"},
        {"value": 50, "color": "#9e9e9e"},
        {"value": 70, "color": "#ef5350"},
    ],
    "parameters": [
        {"name": "period", "type": "integer", "default": 14, "min": 2, "max": 200},
        {"name": "source", "type": "select", "default": "close", "options": [...]},
    ],
}
```
