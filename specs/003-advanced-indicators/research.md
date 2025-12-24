# Research: Advanced Indicators and Indicator-Driven Alerts

**Feature**: 003-advanced-indicators
**Date**: 2025-12-24
**Status**: Complete

## Overview

This document consolidates research findings for implementing a metadata-driven indicator system with TradingView parity. The research focused on indicator calculation best practices, metadata contract design patterns, frontend rendering architectures, and alert integration strategies.

---

## Research Topic 1: TradingView Indicator Visual Specifications

### Question
What are the exact visual specifications (colors, line styles, band positions, default parameters) for cRSI, TDFI, and ADXVMA indicators in TradingView?

### Research Findings

**cRSI (Cyclic RSI)**
- **Default Parameters**: RSI period 14, cRSI period typically 3-5
- **Display Type**: Separate pane (oscillator)
- **Color Scheme**:
  - Main line: Cyan `#00bcd4` or similar teal color
  - Upper band: Light cyan `#b2ebf2` with dashed line
  - Lower band: Light cyan `#b2ebf2` with dashed line
- **Scale Range**: 0-100
- **Reference Levels**: 70 (overbought), 30 (oversold), 50 (midline)
- **Line Style**: Solid line for main cRSI value, dashed lines for bands

**TDFI (Trend Direction Force Index)**
- **Default Parameters**: Typically uses RSI period 14, smoothing period 3
- **Display Type**: Separate pane (oscillator)
- **Color Scheme**: Threshold-based coloring
  - Positive values (> 0.05): Green `#26a69a`
  - Negative values (< -0.05): Red `#ef5350`
  - Neutral zone: Gray or muted color
- **Scale Range**: -1 to 1 (approximately)
- **Reference Levels**: 0.05, -0.05 (signal thresholds), 0 (zero line)
- **Additional Display**: Histogram showing bullish/bearish momentum

**ADXVMA (ADX Volatility Moving Average)**
- **Default Parameters**: ADX period typically 14, VMA smoothing
- **Display Type**: Overlay on price chart
- **Color Scheme**:
  - Main line: Blue `#2962ff`
  - Slope indication: Color changes based on trend direction
- **Line Style**: Solid, slightly thicker than typical MA (width 2-3)
- **Behavior**: Adjusts smoothness based on trend/volatility strength

### Decision
- Use TradingView color values exactly as specified in the feature spec
- cRSI: Cyan `#00bcd4` main, Light Cyan `#b2ebf2` bands
- TDFI: Green `#26a69a` for positive, Red `#ef5350` for negative
- ADXVMA: Blue `#2962ff` with slope-based color variations
- All indicator metadata will include these color schemes in the `color_schemes` object

### Rationale
TradingView users expect visual consistency. Matching exact colors reduces cognitive load and increases user confidence in the platform's accuracy.

### Alternatives Considered
- **Custom color schemes**: Rejected because users referenced TradingView specifically
- **User-configurable colors**: Deferred to future enhancement (out of scope for MVP)

---

## Research Topic 2: Indicator Metadata Contract Design

### Question
What metadata structure best supports generic rendering without per-indicator frontend code?

### Research Findings

**Existing Patterns in Codebase**
- `IndicatorMetadata` interface exists in `frontend/src/api/indicators.ts`
- Current structure includes: `display_type`, `color_mode`, `color_schemes`, `thresholds`, `scale_ranges`, `series_metadata`, `reference_levels`
- `IndicatorPane.tsx` already uses metadata for rendering (colors, styles, levels)

**Best Practices for Generic Rendering**
1. **Declarative over Imperative**: Metadata should describe *what* to render, not *how*
2. **Series-Based Design**: Each visual element (line, band, histogram) is a separate "series" with its own metadata
3. **Fallback Values**: All metadata should have sensible defaults
4. **Type Safety**: Use TypeScript/Pydantic for validation

**Recommended Structure Enhancement**
```python
IndicatorMetadata:
  # Core display configuration
  display_type: Literal["overlay", "pane"]
  color_mode: Literal["single", "threshold", "gradient"]

  # Color definitions
  color_schemes: Dict[str, str]  # state -> hex color
  # States: "bullish", "bearish", "neutral", "overbought", "oversold"

  # Threshold-based coloring (for threshold mode)
  thresholds: Optional[Dict[str, float]]
  # Keys: "high", "low"

  # Scale configuration (for pane indicators)
  scale_ranges: Optional[Dict[str, float]]
  # Keys: "min", "max", "auto" (bool)

  # Series-level metadata
  series_metadata: List[SeriesMetadata]
  SeriesMetadata:
    field: str              # Data field name
    role: Literal["main", "signal", "band", "histogram"]
    label: str              # Human-readable name
    line_color: str         # Hex color
    line_style: Literal["solid", "dashed", "dotted"]
    line_width: int
    display_type: Literal["line", "histogram", "area"]

  # Reference levels (horizontal lines)
  reference_levels: Optional[List[ReferenceLevel]]
  ReferenceLevel:
    value: float
    line_color: str
    line_label: str
    line_style: Literal["solid", "dashed"] = "dashed"
```

### Decision
- Enhance existing `IndicatorMetadata` structure with `series_metadata` as the primary driver for rendering
- Backend returns a single `IndicatorOutput` object containing:
  - `timestamps: List[int]` (Unix timestamps)
  - `data: Dict[str, List[float]]` (field name -> values)
  - `metadata: IndicatorMetadata`
- Frontend rendering is purely metadata-driven: iterate over `series_metadata` and create series

### Rationale
This structure separates data from presentation, allows adding new visual elements (e.g., a second signal line) without frontend changes, and provides clear type safety for both backend and frontend.

### Alternatives Considered
- **JSON schema per indicator**: Rejected as it requires frontend to know about each indicator type
- **Rendering logic on backend**: Rejected because it couples backend to charting library
- **Code generation**: Rejected as it adds build complexity

---

## Research Topic 3: Frontend Rendering Architecture

### Question
How should the generic rendering helpers (formatDataForChart, splitSeriesByThresholds, splitSeriesByTrend) be implemented for lightweight-charts?

### Research Findings

**lightweight-charts Data Format**
- Time series data: `{ time: number, value: number }`
- Supports: LineSeries, AreaSeries, HistogramSeries, CandlestickSeries
- API: `addLineSeries()`, `addHistogramSeries()`, `setData()`

**Rendering Challenges**
1. **Threshold-based coloring**: lightweight-charts doesn't natively support different colors for different line segments
2. **Multiple series per indicator**: Need to handle main line + bands + histogram
3. **Null values**: lightweight-charts handles gaps, but needs proper null insertion
4. **Synchronized time scales**: All panes must share the same time range

**Recommended Helper Functions**

```typescript
// Convert indicator data to lightweight-charts format
function formatDataForChart(
  timestamps: number[],
  values: (number | null)[]
): { time: number; value: number | null }[] {
  return timestamps.map((time, i) => ({
    time,
    value: values[i] ?? null
  }));
}

// Split a single series into multiple series based on threshold crossings
// Returns data segments with associated colors
function splitSeriesByThresholds(
  timestamps: number[],
  values: (number | null)[],
  thresholds: { high: number; low: number },
  colorSchemes: { bullish: string; bearish: string; neutral: string }
): Array<{ data: typeof formatDataForChart; color: string }> {
  // Logic: Detect state changes, create segments, assign colors
  // States: bullish (value > high), bearish (value < low), neutral (between)
}

// Split a series by trend changes (slope direction)
function splitSeriesByTrend(
  timestamps: number[],
  values: (number | null)[],
  colorSchemes: { up: string; down: string; flat: string }
): Array<{ data: typeof formatDataForChart; color: string }> {
  // Logic: Calculate slope, detect direction changes, create segments
}
```

### Decision
- Implement three helper functions in `frontend/src/utils/chartHelpers.ts`
- Use a single `LineSeries` with `update()` for threshold-based coloring (requires segment management)
- For threshold-based indicators, create multiple line series and show/hide based on value ranges
- Alternative approach for histograms: use `HistogramSeries` with color per bar

### Rationale
lightweight-charts doesn't support per-segment coloring on a single series. The multi-series approach is a known workaround. The helpers abstract this complexity away.

### Alternatives Considered
- **Canvas-based custom rendering**: Rejected due to complexity and loss of lightweight-charts features
- **Different charting library**: Rejected because lightweight-charts is already integrated and matches TradingView

---

## Research Topic 4: Indicator-Based Alert Condition Semantics

### Question
How should indicator-based alert conditions (crosses_upper, turns_positive, slope_bullish) be precisely defined and evaluated?

### Research Findings

**Existing Alert Semantics (from alert_engine.py)**
- `above`: current > threshold AND previous <= threshold
- `below`: current < threshold AND previous >= threshold
- `crosses_up`: previous < threshold AND current >= threshold
- `crosses_down`: previous > threshold AND current <= threshold

**New Indicator Condition Types Needed**
1. **Crosses Upper Band**: cRSI crosses above 70 (same as crosses_up)
2. **Crosses Lower Band**: cRSI crosses below 30 (same as crosses_down)
3. **Turns Positive**: TDFI crosses from negative to positive (> -0.05 to > 0.05)
4. **Slope Bullish**: ADXVMA slope changes from negative/flat to positive
5. **Slope Bearish**: ADXVMA slope changes from positive/flat to negative
6. **Signal Change**: Discrete signal value changes (0 -> 1, 1 -> -1, etc.)

**Precise Semantics**

```python
# Crosses threshold (already implemented)
# crosses_upper: previous < threshold AND current >= threshold
# crosses_lower: previous > threshold AND current <= threshold

# Turns positive (enters bullish zone)
# Previous was in bearish/neutral (<= lower_threshold), current is in bullish (>= upper_threshold)
turns_positive: previous <= lower_threshold AND current >= upper_threshold

# Turns negative (enters bearish zone)
# Previous was in bullish/neutral (>= upper_threshold), current is in bearish (<= lower_threshold)
turns_negative: previous >= upper_threshold AND current <= lower_threshold

# Slope bullish (trend direction change)
# Slope = current - previous
# Previous slope <= 0 (flat or bearish), current slope > 0 (bullish)
slope_bullish: (previous - prev_previous) <= 0 AND (current - previous) > 0

# Slope bearish
# Previous slope >= 0, current slope < 0
slope_bearish: (previous - prev_previous) >= 0 AND (current - previous) < 0

# Signal change (discrete value change)
# Any transition between distinct signal values
signal_change: previous_signal != current_signal
```

### Decision
- Extend `AlertCondition` enum with: `INDICATOR_CROSSES_UPPER`, `INDICATOR_CROSSES_LOWER`, `INDICATOR_TURNS_POSITIVE`, `INDICATOR_TURNS_NEGATIVE`, `INDICATOR_SLOPE_BULLISH`, `INDICATOR_SLOPE_BEARISH`, `INDICATOR_SIGNAL_CHANGE`
- Store indicator name and field in alert rule (e.g., indicator_name="crsi", field="crsi")
- Alert engine evaluates indicator conditions on each new candle, accessing the latest indicator value from cache
- Cooldown tracking uses same mechanism as price alerts

### Rationale
Extends existing alert semantics consistently. Indicator conditions are just threshold/value comparisons on different data series.

### Alternatives Considered
- **Separate alert system for indicators**: Rejected because it duplicates logic
- **User-defined formula language**: Rejected as out of scope (Pine Script import deferred)

---

## Research Topic 5: Per-Symbol Indicator Persistence

### Question
How should per-symbol indicator preferences be stored and synced between chart state and UI?

### Research Findings

**Existing State Management**
- `App.tsx` uses local state for indicators (`tdfiData`, `crsiData`, `adxvmaData`)
- `activeLayout` stores `activeIndicators: string[]`
- `indicatorSettings` stores per-indicator settings (visibility, series)

**localStorage Pattern**
- Key format: `indicators_{symbol}` (e.g., `indicators_AAPL`)
- Value structure:
  ```json
  {
    "AAPL": {
      "indicators": [
        { "id": "crsi", "params": { "period": 14 }, "visible": true },
        { "id": "tdfi", "params": { "period": 14 }, "visible": true }
      ],
      "updatedAt": "2025-12-24T10:00:00Z"
    }
  }
  ```

**Synchronization Strategy**
1. On symbol change: Save current symbol's indicators to localStorage
2. After symbol change: Load new symbol's indicators from localStorage (or empty object)
3. On indicator toggle/add/remove: Update localStorage immediately
4. On parameter change: Update localStorage immediately

### Decision
- Use localStorage with key `tradingalert_indicators_{symbol}` for per-symbol persistence
- Create a custom hook `useIndicators()` that encapsulates:
  - Loading indicators from localStorage
  - Saving indicators to localStorage
  - Managing indicator state (add, remove, toggle, update params)
- Store as: `{ symbol: { indicators: [...], settings: {...} } }`

### Rationale
localStorage is sufficient for client-side preferences and aligns with local-first architecture. A custom hook provides clean abstraction and testability.

### Alternatives Considered
- **Backend persistence**: Rejected because indicators are user view preferences, not collaborative data
- **URL-based state**: Rejected because it complicates sharing and limits indicator count

---

## Research Topic 6: Alert Delivery Failure Handling

### Question
How should the system handle alert delivery failures (notification service unavailable, network errors)?

### Research Findings

**Current Alert Flow**
1. Alert condition detected -> `AlertTrigger` record created
2. (Future) Notification service triggered
3. User receives notification

**Failure Scenarios**
- Notification service API is down
- Rate limit exceeded
- Network timeout
- Invalid user notification token

**Retry Strategy Best Practices**
- **Exponential backoff**: Delay increases with each retry (1s, 2s, 4s, 8s, 16s...)
- **Maximum retry attempts**: Cap to avoid infinite retries
- **Dead letter queue**: After max retries, move to failed state for manual review
- **Idempotency**: Ensure duplicate retries don't cause duplicate notifications

### Decision
- Add `delivery_status` field to `AlertTrigger` model: `pending`, `delivered`, `failed`, `retrying`
- Add `retry_count` and `last_retry_at` fields
- Background task (Celery) handles delivery with exponential backoff
- Retry schedule: 30s, 2min, 8min, 32min, 128min (cap at 5 attempts)
- After 5 failed attempts, mark as `failed` and log for manual review
- Alert history UI shows delivery status

### Rationale
Exponential backoff is standard for transient failures. Cap at 5 retries balances persistence with practical limits. Status visibility allows debugging.

### Alternatives Considered
- **Synchronous delivery**: Rejected because it blocks alert evaluation
- **Unlimited retries**: Rejected because it creates backlog
- **Immediate failure**: Rejected because transient errors are common

---

## Research Topic 7: Performance with Multiple Indicator Panes

### Question
How can we maintain 60fps panning performance with 5+ indicator panes?

### Research Findings

**Performance Bottlenecks**
1. **Data volume**: 10,000 candles × 6 series × 8 bytes = ~480KB per indicator
2. **Rendering overhead**: Each pane has its own canvas and update cycle
3. **Sync overhead**: Crosshair/zoom sync triggers updates across all panes

**lightweight-charts Optimization Features**
- Built-in time scale optimization (only renders visible range)
- `applyOptions()` for efficient updates
- Series data can be updated incrementally

**Best Practices**
1. **Lazy loading**: Only render visible panes
2. **Data sampling**: Downsample data when zoomed out
3. **Debounced sync**: Batch crosshair/zoom updates
4. **Virtualization**: Remove panes from DOM when not visible

### Decision
- Use existing lightweight-charts optimizations (it's already efficient)
- Implement debounce for crosshair sync (16ms = 60fps)
- Limit initial data load to last 1000 candles, load more on demand
- Monitor performance with `requestAnimationFrame` and flag if drops below 60fps

### Rationale
lightweight-charts is designed for financial charts and handles most optimization. Our additions (helpers, sync) should be minimal overhead.

### Alternatives Considered
- **Web Workers**: Rejected because data transfer overhead outweighs benefits
- **Canvas consolidation**: Rejected because it conflicts with lightweight-charts architecture

---

## Summary of Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Visual specs | Use exact TradingView colors | User familiarity |
| Metadata contract | series_metadata-driven rendering | Extensibility |
| Rendering helpers | Three helper functions with multi-series approach | lightweight-charts constraints |
| Alert conditions | Extend existing AlertCondition enum | Consistency |
| Persistence | localStorage with useIndicators hook | Local-first, simplicity |
| Failure handling | Exponential backoff, cap at 5 retries | Standard pattern |
| Performance | Rely on lightweight-charts + debounce | Library is already optimized |

---

## Open Questions (Resolved)

None - all technical unknowns have been resolved through this research.

---

## Next Steps

Proceed to **Phase 1: Design & Contracts**
1. Generate `data-model.md` with entity definitions
2. Generate API contracts in `contracts/`
3. Generate `quickstart.md` for developers
