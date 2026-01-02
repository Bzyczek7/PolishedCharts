# Plan: Full pandas-ta Indicator Integration

**Feature**: Complete pandas-ta library integration (130+ indicators)
**Version**: 1.2 (Reconciled counts and scope)
**Date**: 2025-12-30
**Status**: Draft

## Indicator Classification (Authoritative)

| Category | pandas-ta Total | Supported (Phase 1-3) | Future Enhancement (Phase 5) | Excluded | Notes |
|----------|-----------------|----------------------|------------------------------|----------|-------|
| Overlap | 36 | 28 | 1 (Ichimoku) | 7 | hl2, hlc3, ohlc4, wcp, hilo, pivots, alma |
| Momentum | 43 | 38 | 0 | 5 | crsi, fisher, ifisher, kdj, inertia |
| Trend | 20 | 16 | 1 (PSAR) | 3 | zigzag, amat, decay |
| Volatility | 16 | 13 | 1 (SuperTrend) | 2 | true_range, aberration |
| Volume | 19 | 19 | 0 | 0 | - |
| Statistics | 10 | 10 | 0 | 0 | - |
| Performance | 2 | 2 | 0 | 0 | - |
| Cycle | 2 | 2 | 0 | 0 | - |
| Candle | 3 | 0 | 2 (HA, Patterns) | 1 | cdl_z |
| **Total** | **151** | **128** | **5** | **18** | |

Note: Ichimoku (Overlap) and SuperTrend (Volatility) deferred to Phase 5

### Count Formula

```
Auto-registered (Phases 1-3) = 128 indicators
  = 151 (pandas-ta total)
  - 18 (excluded)
  - 5 (Phase 5: Ichimoku, PSAR, SuperTrend, HA, Patterns)

Future Enhancement (Phase 5) = 5 indicators
  = 1 (Ichimoku - cloud fill rendering)
  + 1 (PSAR - threshold coloring)
  + 1 (SuperTrend - threshold coloring)
  + 1 (Heikin Ashi - OHLC transformation)
  + 1 (Candle Patterns - marker rendering)

Excluded = 18 indicators (see table above)
```

### Definition of Terms

| Term | Definition |
|------|------------|
| **Supported (Phase 1-3)** | Indicators fully integrated with generic wrapper + config |
| **Future Enhancement (Phase 5)** | Indicators requiring frontend extensions (fills, markers) |
| **Excluded** | Indicators intentionally not exposed (see list below) |

### Exclusions List (18 indicators)

| Indicator | Reason | Phase |
|-----------|--------|-------|
| hl2, hlc3, ohlc4, wcp | Price type helpers, not indicators | All |
| hilo | Composite (HL2 + HLC3), confusing UI | All |
| pivots | Multi-level output, no clear rendering | All |
| alma | Rarely used, edge case params | All |
| crsi, fisher, ifisher | Non-standard parameter structures | All |
| kdj | Triply-nested calculation, rarely used | All |
| inertia | Non-standard output format | All |
| zigzag | Repaints - unsuitable for alerts | All |
| amat | Requires price sequence analysis | All |
| decay | One-way indicator, limited use | All |
| true_range | Building block, not standalone | All |
| aberration | Rarely used, edge case | All |
| cdl_z | Score-based (-5 to +5), not line-compatible | All |

### Test Assertion Targets

| Phase | Assertion | Expected Value | Calculation |
|-------|-----------|---------------|-------------|
| 1-3 | Auto-registered count | 128 | registry count - excluded - future |
| 1-3 | Manually registered count | 0 | All Phase 1-3 via auto-discovery |
| 5 | Future enhancement indicators | 5 | Ichimoku, PSAR, SuperTrend, HA, Patterns |
| All | Excluded indicator count | 18 | From exclusions list |

## Implementation Strategy

### Key Insight: Generic Wrapper Class

Rather than creating 151 individual indicator classes, we'll create a **generic pandas-ta wrapper** that:
1. Dynamically discovers all pandas-ta indicators at startup
2. Creates a lightweight wrapper class for each indicator
3. Maps pandas-ta output columns to stable field names
4. Generates appropriate metadata based on indicator behavior

This is **NOT** code generation - it's **runtime wrapper creation** using a factory pattern.

### Architecture

```
backend/app/services/indicator_registry/
├── registry.py           # Base Indicator class (existing)
├── initialization.py     # Startup registration (existing)
├── pandas_ta_wrapper.py  # NEW: Generic wrapper factory
├── pandas_ta_config.py   # NEW: Per-indicator metadata overrides
└── indicators/
    ├── __init__.py
    ├── manual/           # Custom implementations (existing: SMA, EMA, etc.)
    └── auto/             # Auto-generated wrappers (NEW - generated at runtime)
```

## Phased Implementation

### Phase 1: Generic Wrapper Infrastructure (Foundation)

**Goal**: Create the infrastructure to auto-wrap any pandas-ta indicator

**Files Modified/Created**:
- `backend/app/services/indicator_registry/pandas_ta_wrapper.py` (NEW)
- `backend/app/services/indicator_registry/pandas_ta_config.py` (NEW)
- `backend/app/services/indicator_registry/initialization.py` (MODIFIED)

**Tasks**:
1. Create `PandasTAIndicator` generic wrapper class
2. Implement indicator discovery via `ta.Category`
3. Create column name mapping strategy (pandas-ta uses dynamic names like "RSI_14")
4. Implement metadata generation based on indicator behavior
5. Add configuration file for indicators needing custom metadata

### Phase 2: Basic Indicators (Priority: High Usage)

**Goal**: Auto-wrap the most commonly used indicators (28 total)

**Indicators**:
- **Overlap (13)**: sma, ema, dema, tema, wma, hma, kama, mama, vwma, swma, fwma, linreg, vwap
- **Momentum (10)**: rsi, macd, stoch, stochrsi, willr, cci, mfi, adx, aroon, cmo
- **Volatility (5)**: bbands, atr, natr, kc, donchian

**Deferred to Phase 5**: alma (rarely used), supertrend, ichimoku

**Tasks**:
1. Implement wrapper factory for basic indicators
2. Configure metadata for overlay vs pane display
3. Add reference levels where appropriate (RSI 30/70, etc.)
4. Register all 28 in initialization
5. Write tests for representative indicators

### Phase 3: Extended Indicators (Priority: Medium Usage)

**Goal**: Auto-wrap remaining indicators (94 total)

**Breakdown**:
- Momentum (32): ao, apo, bias, bop, brar, cfo, cg, coppock, cti, er, eri, exhc, kst, mom, pgo, ppo, psl, qqe, roc, rsx, rvgi, slope, smc, smi, squeeze, squeeze_pro, stc, stochf, tmo, trix, tsi, uo
- Trend (16): adx, alphatramaat, aroon, chop, cksp, decreasing, dpo, ht_trendline, increasing, long_run, qstick, rwi, short_run, trendflex, vhf, vortex
- Volatility (13): accbands, atrts, chandelier_exit, hwc, massi, pdist, rvi, thermo, ui, kc, natr, donchian, aberration
- Volume (19): ad, adosc, aobv, cmf, efi, eom, kvo, mfi, nvi, obv, pvi, pvo, pvol, pvr, pvt, tsv, vhm, vwap, vwma
- Statistics (10): entropy, kurtosis, mad, median, quantile, skew, stdev, tos_stdevall, variance, zscore
- Performance (2): log_return, percent_return
- Cycle (2): ebsw, reflex

**Excluded from Phase 3**: crsi, fisher, ifisher, kdj, inertia, decay, zigzag, psar, aberration, true_range

**Tasks**:
1. Implement extended wrapper with configurable parameters
2. Auto-generate metadata for all indicators
3. Handle special cases (multi-output indicators, histogram outputs)
4. Register all 94 in initialization

### Phase 4: Special Indicators (MOVED TO PHASE 5)

**Status**: Deferred to Phase 5 - Future Enhancement

The following indicators require frontend rendering extensions that are not yet implemented:

| Indicator | Required Extension | Frontend File |
|-----------|-------------------|---------------|
| Ichimoku | Cloud fill between Senkou A/B | IndicatorPane.tsx |
| PSAR | Threshold-based colors (Green/Red) | GenericIndicatorRenderer.tsx |
| Heikin Ashi | OHLC transformation | Backend only |
| Candle Patterns | Marker rendering | GenericIndicatorRenderer.tsx |

These will be implemented in **Phase 5** after the frontend extensions (F-T01-F-T04) are complete.

See Phase 5 section below for full implementation plan.

## Technical Details

### Wrapper Class Structure

```python
class PandasTAIndicator(Indicator):
    """Generic wrapper for pandas-ta indicators."""

    def __init__(self, indicator_name: str, **default_params):
        self._indicator_name = indicator_name
        self._pandas_ta_func = getattr(ta, indicator_name)
        # Store default parameters

    @property
    def base_name(self) -> str:
        return self._indicator_name.lower()

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        # Call pandas-ta function
        result = self._pandas_ta_func(df['close'], **kwargs)
        # Map to stable column names
        return self._map_columns(df, result)

    @property
    def metadata(self) -> IndicatorMetadata:
        # Generate from config or auto-detect
        return self._get_metadata()
```

### Column Name Mapping

pandas-ta returns columns with dynamic suffixes:
- RSI: "RSI_14" → map to "rsi"
- MACD: "MACD_12_26_9", "MACDs_12_26_9", "MACDh_12_26_9" → map to "macd", "signal", "histogram"

**Strategy**:
1. Use first column as main (field="rsi")
2. Use pattern matching for signal/histogram columns
3. Store mapping in config file for complex indicators

### Metadata Auto-Detection

- **display_type**: overlay if outputs are price-like (0-∞ range), pane otherwise
- **color_mode**: single for most, threshold for RSI/TSI-like (0-100 bounded)
- **scale_ranges**: auto-detect from output, or use config overrides
- **reference_levels**: use config for standard levels (30/70 for RSI, 0 for MACD)

### Configuration File (pandas_ta_config.py)

```python
INDICATOR_CONFIG = {
    "rsi": {
        "display_type": "pane",
        "color_mode": "single",
        "scale_ranges": {"min": 0, "max": 100, "auto": False},
        "reference_levels": [{"value": 30}, {"value": 70}],
    },
    "macd": {
        "display_type": "pane",
        "color_mode": "single",
        "scale_ranges": {"min": None, "max": None, "auto": True},
        "histogram": True,
    },
    "bbands": {
        "display_type": "overlay",
        "color_mode": "single",
        "band_fields": ["lower", "middle", "upper"],
    },
    # ... more overrides
}
```

## Task Breakdown

### Phase 1 Tasks (Foundation)

| ID | Task | File | Effort |
|----|------|------|--------|
| P1-T01 | Create PandasTAIndicator base wrapper class | pandas_ta_wrapper.py | 2h |
| P1-T02 | Implement indicator discovery via ta.Category | pandas_ta_wrapper.py | 1h |
| P1-T03 | Implement column name mapping logic | pandas_ta_wrapper.py | 2h |
| P1-T04 | Create pandas_ta_config.py with metadata overrides | pandas_ta_config.py | 3h |
| P1-T05 | Modify initialization.py to use auto-registration | initialization.py | 1h |
| P1-T06 | Write unit tests for wrapper factory | test_pandas_ta_wrapper.py | 2h |
| P1-T07 | Write integration test for auto-registered indicators | test_pandas_ta_auto.py | 2h |

**Subtotal**: ~13 hours

### Phase 2 Tasks (Basic Indicators - 30 indicators)

| ID | Task | Effort |
|----|------|--------|
| P2-T01 | Configure and test 15 overlap indicators | 3h |
| P2-T02 | Configure and test 10 momentum indicators | 2h |
| P2-T03 | Configure and test 5 volatility indicators | 1h |
| P2-T04 | Write parameterized tests for all Phase 2 indicators | 2h |
| P2-T05 | Manual verification of all Phase 2 indicators | 2h |

**Subtotal**: ~10 hours

### Phase 3 Tasks (Extended Indicators - 100+ indicators)

| ID | Task | Effort |
|----|------|--------|
| P3-T01 | Auto-register all momentum indicators (33) | 2h |
| P3-T02 | Auto-register all trend indicators (20) | 1.5h |
| P3-T03 | Auto-register all volatility indicators (11) | 1h |
| P3-T04 | Auto-register all volume indicators (19) | 1.5h |
| P3-T05 | Auto-register all statistics indicators (10) | 1h |
| P3-T06 | Auto-register performance and cycle indicators (4) | 0.5h |
| P3-T07 | Write representative tests for each category | 2h |
| P3-T08 | Manual verification sampling (10 random indicators) | 1h |

**Subtotal**: ~10 hours

### Phase 4 Tasks (Special Indicators)

| ID | Task | Effort |
|----|------|--------|
| P4-T01 | Implement Heikin Ashi transformation | 2h |
| P4-T02 | Implement candle pattern indicator | 3h |
| P4-T03 | Handle multi-output indicators (ichimoku, alligator) | 3h |
| P4-T04 | Write tests for special indicators | 2h |

**Subtotal**: ~10 hours

**Total Estimated Effort**: ~43 hours

## Excluded Indicators

The following require significant additional work and are NOT in scope:

| Indicator | Reason |
|-----------|--------|
| cdl_pattern | Candle patterns require special UI (not line charts) |
| cdl_z | Score-based, not suitable for line rendering |
| ichimoku | Requires 5-line overlay with cloud shading |
| alligator | Requires multi-line overlay with fill |
| zigzag | Repaints and requires special handling |

These can be added in a future enhancement.

## Success Criteria

1. **Discovery**: `/api/v1/indicators/supported` returns 140+ indicators
2. **Calculation**: Each indicator can be calculated via `/api/v1/indicators/{symbol}/{name}`
3. **Rendering**: All indicators render correctly in the UI
4. **Parameters**: Custom parameters can be passed to all indicators
5. **Tests**: 90%+ unit test pass rate for indicator module
6. **Performance**: Indicator calculation completes in <2s for 1000 candles

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| pandas-ta API changes | High | Pin to specific version in requirements.txt |
| Memory usage with 150+ indicators | Medium | Lazy initialization, only create wrappers when needed |
| Inconsistent output formats | Medium | Config validation + normalization enforces defaults |
| Missing metadata for obscure indicators | Low | Auto-generate sensible defaults, use config overrides |
| Column name collisions | High | No-duplicate-keys rule, randomized collision tests |
| Frontend rendering gaps | Medium | Phase 5 frontend tasks for fills/markers |
| Backward compatibility breakage | High | Explicit deserialization tests |

## Phase 5: Future Enhancement (Special Indicators)

**Purpose**: Implement indicators requiring frontend rendering extensions

**Prerequisites**:
- Phase 1-4 complete
- Frontend extensions (T01-T04) implemented
- User approval for Phase 5 work

### Indicators (5 total)

| Indicator | Backend Class | Frontend Extension | Status |
|-----------|---------------|-------------------|--------|
| Ichimoku | IchimokuIndicator | Cloud fill rendering | Requires T01 |
| PSAR | PSARIndicator | Threshold colors | Requires T02 |
| SuperTrend | SuperTrendIndicator | Threshold colors | Requires T03 |
| Heikin Ashi | HeikinAshiIndicator | OHLC transformation | Backend only |
| Candle Patterns | CandlePatternIndicator | Marker rendering | Requires T04 |

### Frontend Extensions (Required First)

| Task | Description | Frontend File |
|------|-------------|---------------|
| T01 | Add cloud fill rendering for Ichimoku | IndicatorPane.tsx |
| T02 | Add marker rendering for candle patterns | GenericIndicatorRenderer.tsx |
| T03 | Add threshold-based colors for PSAR/SuperTrend | GenericIndicatorRenderer.tsx |
| T04 | (Optional) Alligator fill-between-lines | IndicatorPane.tsx |

### Cloud Fill Rendering (Ichimoku)

Ichimoku requires filling the area between Senkou A and Senkou B (the cloud):

```typescript
// Required metadata extension for cloud fill
interface IchimokuMetadata extends IndicatorMetadata {
  cloud_fill: {
    above_field: string;   // "senkou_a"
    below_field: string;   // "senkou_b"
    bullish_color: string; // "#4CAF50"
    bearish_color: string; // "#F44336"
  };
}
```

### Marker Rendering (Candle Patterns)

Candle patterns require point markers on the price chart:

```typescript
// Required metadata extension for markers
interface CandlePatternMetadata extends IndicatorMetadata {
  markers: {
    field: string;        // Pattern detection column
    marker_type: "arrow" | "dot" | "triangle";
    marker_size: number;
  };
}
```

### Fill-Between-Lines (Alligator)

Alligator requires filling between three moving averages:

```typescript
// Required metadata extension for multi-line fill
interface AlligatorMetadata extends IndicatorMetadata {
  fill_regions: Array<{
    between: [string, string];  // ["jaw", "teeth"]
    color: string;
  }>;
}
```

## Dependencies

- pandas-ta >= 0.4.71b0 (exact version for API stability)
- Existing Indicator registry infrastructure (in place)
- Phase 5 frontend tasks for fills/markers (only if implementing Phase 5)

## References

- pandas-ta documentation: https://github.com/twopirllc/pandas-ta
- Existing indicator implementation: `backend/app/services/indicator_registry/registry.py`
- Current cornerstone indicators: RSI, MACD, BBANDS, ATR

---

## Appendix A: Config Validation & Normalization

### Validation Rules (Enforced by `create_metadata()`)

Every indicator metadata MUST have:

| Property | Required | Default if Missing | Behavior |
|----------|----------|-------------------|----------|
| `display_type` | Yes | PANE | Raises ConfigValidationError |
| `color_mode` | Yes | SINGLE | Raises ConfigValidationError |
| `color_schemes` | Yes | Gray fallback | Uses gray colors, logs warning |
| `scale_ranges` | Yes | auto=True | Auto-scales, no reference |
| `series_metadata` | Yes | None | Raises ConfigValidationError |
| `reference_levels` | No | [] | Optional |
| `thresholds` | No | None | Optional |

### Normalization Function

```python
def normalize_indicator_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure all required fields have valid values."""
    normalized = config.copy()

    # Apply defaults for missing required fields
    if 'display_type' not in normalized:
        normalized['display_type'] = IndicatorDisplayType.PANE

    if 'color_mode' not in normalized:
        normalized['color_mode'] = ColorMode.SINGLE

    if 'color_schemes' not in normalized:
        normalized['color_schemes'] = {
            'bullish': '#808080',
            'bearish': '#808080',
            'neutral': '#808080',
        }

    if 'scale_ranges' not in normalized:
        normalized['scale_ranges'] = ScaleRangesConfig(
            min=None, max=None, auto=True
        )

    if 'series_metadata' not in normalized or not normalized['series_metadata']:
        raise ConfigValidationError(
            f"Indicator requires at least one series in series_metadata"
        )

    if 'reference_levels' not in normalized:
        normalized['reference_levels'] = []

    # Validate series_metadata has unique field names
    fields = [s['field'] for s in normalized['series_metadata']]
    if len(fields) != len(set(fields)):
        raise ConfigValidationError(
            f"Duplicate field names in series_metadata: {fields}"
        )

    # Normalize line styles
    for series in normalized['series_metadata']:
        if 'line_style' not in series:
            series['line_style'] = LineStyle.SOLID
        if 'line_width' not in series:
            series['line_width'] = 2
        if 'display_type' not in series:
            series['display_type'] = DisplayType.LINE

    return normalized
```

### Required Keys per Indicator Type

| Type | Required Fields |
|------|----------------|
| Overlay (single line) | display_type, color_mode, color_schemes, series[0].field/color/style |
| Overlay (bands) | display_type, color_mode, color_schemes, series[0-2] (upper/middle/lower) |
| Oscillator (single) | display_type, color_mode, scale_ranges, reference_levels |
| Oscillator (multi) | display_type, color_mode, scale_ranges, series[0].main, series[1].signal |
| Histogram | display_type, color_mode, series[0].histogram |

---

## Appendix B: Column-Name Stability Rules

### Rule: No Duplicate Output Keys

Each indicator wrapper MUST ensure unique field names in output DataFrame:

```python
class PandasTAIndicator(Indicator):
    def _map_columns(self, df: pd.DataFrame, result) -> pd.DataFrame:
        df_copy = df.copy()
        used_names = set(df.columns)

        if isinstance(result, pd.Series):
            stable_name = self._get_stable_name()
            # Ensure no collision
            if stable_name in used_names:
                stable_name = f"{stable_name}_{self.base_name}"
            df_copy[stable_name] = result
        elif isinstance(result, pd.DataFrame):
            # Map each column with prefix to avoid collisions
            for i, col in enumerate(result.columns):
                stable_name = self._get_stable_name_for_col(i, col)
                if stable_name in used_names:
                    stable_name = f"{stable_name}_{self.base_name}_{i}"
                df_copy[stable_name] = result[col]
                used_names.add(stable_name)

        return df_copy
```

### Column Naming Strategy

| Indicator | Output Columns | Stable Names |
|-----------|---------------|--------------|
| RSI | RSI_14 | rsi |
| MACD | MACD_12_26_9, MACDs_12_26_9, MACDh_12_26_9 | macd, signal, histogram |
| BBANDS | BBL_20_2.0, BBM_20_2.0, BBU_20_2.0 | lower, middle, upper |
| STOCH | STOCHk_14_3_3, STOCHd_14_3_3 | stoch_k, stoch_d |
| ADX | ADX_14, DIP_14, DIN_14 | adx, dip, din |
| AROON | AROON_25_25, AROONUp_25, AROONDn_25 | aroon, aroon_up, aroon_down |

### Collision Detection Test

```python
def test_no_column_collisions():
    """Randomized test to catch duplicate field names."""
    import random

    for _ in range(100):  # Run 100 random combinations
        indicators = random.sample(ALL_INDICATOR_NAMES, k=5)
        df = generate_test_candles()

        results = {}
        for name in indicators:
            indicator = create_indicator(name)
            result = indicator.calculate(df)
            for col in result.columns:
                if col in results:
                    raise ColumnCollisionError(
                        f"Collision: '{col}' used by both {results[col]} and {name}"
                    )
                results[col] = name
```

---

## Appendix C: Backward Compatibility

### Deserialization Compatibility

The `deserialize_indicator_params()` function must handle both:

1. **Old format** (pre-auto-registration): Indicators with explicit class mappings
2. **New format** (post-auto-registration): Indicators from auto-discovery

```python
def deserialize_indicator_params(serialized: str) -> Indicator:
    """Deserialize indicator with backward compatibility."""
    data = json.loads(serialized)
    base_name = data["base_name"]
    params = data.get("parameters", {})

    # Try explicit class mapping first (for manually-implemented indicators)
    if base_name in INDICATOR_CLASSES:
        indicator_class = INDICATOR_CLASSES[base_name]
        return indicator_class(**params)

    # Fall back to auto-registered indicator factory
    if base_name in get_registry()._indicators:
        # Just update parameters if needed
        existing = get_registry().get(base_name)
        return create_indicator_with_params(base_name, params)

    raise ValueError(f"Unknown indicator: {base_name}")
```

### Compatibility Test

```python
def test_backward_compatibility():
    """Test loading old saved layouts with auto-registered indicators."""
    # Old format: indicators registered manually
    old_layouts = [
        '{"base_name": "sma", "parameters": {"period": 20}}',
        '{"base_name": "rsi", "parameters": {"period": 14}}',
        '{"base_name": "bbands", "parameters": {"length": 20, "std": 2.0}}',
    ]

    for serialized in old_layouts:
        indicator = deserialize_indicator_params(serialized)
        assert indicator is not None
        assert indicator.base_name in ["sma", "rsi", "bbands"]

    # New format: indicators from auto-discovery
    new_layouts = [
        '{"base_name": "cci", "parameters": {"period": 20}}',
        '{"base_name": "obv", "parameters": {}}',
    ]

    for serialized in new_layouts:
        indicator = deserialize_indicator_params(serialized)
        assert indicator is not None
```

---

## Appendix D: Performance Targets

### Calculation Performance

| Dataset Size | Target Time | Per-Indicator Budget |
|--------------|-------------|---------------------|
| 1000 candles | < 5 seconds | < 50ms average |
| 10,000 candles | < 30 seconds | < 300ms average |

### Performance Test

```python
def test_indicator_performance():
    """Performance test for all indicators on 1000 candles."""
    df = generate_test_candles(n=1000)
    indicators = list_auto_registered_indicators()

    results = {}
    for name in indicators:
        indicator = create_indicator(name)
        start = time.time()
        result = indicator.calculate(df)
        elapsed = time.time() - start
        results[name] = elapsed

    # Assert all complete within budget
    slow_indicators = [
        name for name, elapsed in results.items()
        if elapsed > 0.05  # 50ms
    ]

    if slow_indicators:
        raise PerformanceError(
            f"Indicators exceeding 50ms: {slow_indicators}"
        )

    # Log average for monitoring
    avg_time = sum(results.values()) / len(results)
    logger.info(f"Average indicator calculation time: {avg_time*1000:.2f}ms")
```

---

## Appendix E: Metadata Schema Completeness Test

```python
def test_metadata_schema_completeness():
    """Assert all auto-registered indicators have valid, complete metadata."""
    registry = get_registry()
    errors = []

    for name, indicator in registry._indicators.items():
        try:
            # 1. Check required metadata keys
            metadata = indicator.metadata
            assert hasattr(metadata, 'display_type'), f"{name}: missing display_type"
            assert hasattr(metadata, 'color_mode'), f"{name}: missing color_mode"
            assert hasattr(metadata, 'color_schemes'), f"{name}: missing color_schemes"
            assert hasattr(metadata, 'series_metadata'), f"{name}: missing series_metadata"

            # 2. Check parameter definitions resolved
            param_defs = indicator.parameter_definitions
            for param_name in param_defs:
                assert param_defs[param_name] is not None, \
                    f"{name}: param '{param_name}' definition is None"

            # 3. Check output column names exist after calculate
            df = generate_test_candles()
            result = indicator.calculate(df)
            for series in metadata.series_metadata:
                assert series.field in result.columns, \
                    f"{name}: field '{series.field}' not in output columns"

        except (AssertionError, AttributeError) as e:
            errors.append(str(e))

    if errors:
        raise MetadataIncompleteError(
            f"Metadata schema validation failed for {len(errors)} indicators:\n"
            + "\n".join(errors[:10])  # First 10 errors
        )
```
