# Tasks: Full pandas-ta Indicator Integration

**Feature**: Complete pandas-ta library integration (151 indicators)
**Input**:
- plan-full-integration.md (strategy)
- inputs-and-styling.md (detailed configuration)
- styling-quickref.md (quick lookup)
**Prerequisites**: Phase 1 (User Stories 1-3) from original tasks.md must be complete

---

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- All styling is defined in `inputs-and-styling.md` - reference it for colors, scales, reference levels

## Path Conventions

- **Backend**: `backend/app/`, `backend/tests/`
- **Frontend**: `frontend/src/` (no changes needed for this feature)
- **Config**: `backend/app/services/indicator_registry/pandas_ta_config.py` (NEW)

---

## Phase A: Generic Wrapper Infrastructure (Foundation)

**Purpose**: Create the infrastructure to auto-wrap any pandas-ta indicator

### A1: Core Wrapper Class

- [ ] A-T01 [P] Create `PandasTAIndicator` base wrapper class in `backend/app/services/indicator_registry/pandas_ta_wrapper.py`
  - Inherit from `Indicator` base class
  - Accept `indicator_name` and `**default_params` in constructor
  - Implement `base_name`, `description`, `category` properties
  - Implement `calculate()` method using pandas-ta function

- [ ] A-T02 [P] Implement indicator discovery via `ta.Category` in `backend/app/services/indicator_registry/pandas_ta_wrapper.py`
  - Create function `get_all_pandas_ta_indicators()` that returns list of (category, name) tuples
  - Filter out utility functions and candle patterns
  - Return ~140 usable indicators

- [ ] A-T03 [P] Implement column name mapping logic in `backend/app/services/indicator_registry/pandas_ta_wrapper.py`
  - Map pandas-ta dynamic names (e.g., "RSI_14") to stable names ("rsi")
  - Handle multi-output indicators (MACD: MACD, MACDs, MACDh → macd, signal, histogram)
  - Create `_map_columns()` method

### A2: Configuration System

- [ ] A-T04 [P] Create `backend/app/services/indicator_registry/pandas_ta_config.py`
  - Define `PARAMETER_DEFS` dictionary with standard parameter types
  - Define `INDICATOR_CONFIG` dictionary with per-indicator styling
  - Follow `inputs-and-styling.md` for all color, scale, and reference level values
  - Implement helper functions: `get_parameter_def()`, `get_indicator_config()`, `create_metadata()`
  - Add config for cornerstone indicators (rsi, macd, bbands, atr)

- [ ] A-T04e [P] Implement `normalize_indicator_config()` function
  - Validate required keys: display_type, color_mode, color_schemes, series_metadata
  - Apply defaults for missing optional fields (scale_ranges, reference_levels)
  - Validate series_metadata has unique field names (no duplicates)
  - Normalize line styles and widths
  - Raise `ConfigValidationError` for missing required fields

- [ ] A-T04f [P] Implement `create_metadata()` with validation
  - Call `normalize_indicator_config()` before creating IndicatorMetadata
  - Enforce required keys per indicator type (see plan Appendix A)
  - Assert output column names match series_metadata fields
  - Log warnings for missing optional configurations

- [ ] A-T04a Define standard parameter types in `PARAMETER_DEFS`:
  - `period`: integer, 2-200, step 1
  - `length`: integer, 2-200, step 1
  - `fast`: integer, 2-50, step 1
  - `slow`: integer, 5-200, step 1
  - `signal`: integer, 2-50, step 1
  - `std`: float, 0.1-5.0, step 0.1
  - `multiplier`: float, 1.0-10.0, step 0.1
  - `source`: select, options=["close","high","low","open","hl2","hlc3","ohlc4"]
  - `mamode`: select, options=["sma","ema","wma","dema","tema","smma","rma"]
  - `k`, `d`, `smooth_k`: integer, 1-50, step 1

- [ ] A-T04b Add styling for cornerstone overlay indicators:
  - SMA: Blue `#2962FF`, single color, solid line
  - EMA: Orange `#FF9800`, single color, solid line
  - VWMA: Purple `#9C27B0`, single color, solid line
  - BBANDS: Blue bands with gray middle, dashed middle line
  - VWAP: Purple, single color, solid line
  - SuperTrend: Green/Red threshold-based, dots

- [ ] A-T04c Add styling for cornerstone oscillator indicators:
  - RSI: Gray, 0-100 scale, 30/50/70 reference levels
  - MACD: Cyan main, Orange signal, histogram, 0 reference
  - STOCH: Purple K, Green D, 20/50/80 reference
  - CCI: Orange, auto scale, -100/0/100 reference
  - ATR: Orange, auto scale, no reference levels

- [ ] A-T04d Add styling for extended indicator set:
  - All momentum indicators (33): see inputs-and-styling.md
  - All trend indicators (20): see inputs-and-styling.md
  - All volume indicators (19): see inputs-and-styling.md
  - All statistics indicators (10): see inputs-and-styling.md

### A3: Integration

- [ ] A-T05 Modify `backend/app/services/indicator_registry/initialization.py`
  - Add import for pandas_ta_wrapper
  - Add `initialize_pandas_ta_indicators()` function
  - Call auto-discovery and register all indicators
  - Update `deserialize_indicator_params()` to handle auto-registered indicators

### A4: Tests for Phase A

- [ ] A-T06 [P] Write unit tests for wrapper factory in `backend/tests/services/test_pandas_ta_wrapper.py`
  - Test indicator discovery returns expected count
  - Test wrapper instantiation with parameters
  - Test column name mapping for single-output indicators
  - Test column name mapping for multi-output indicators

- [ ] A-T07 [P] Write integration test for auto-registration in `backend/tests/services/test_pandas_ta_auto_discovery.py`
  - Test that all indicators appear in registry
  - Test that indicators can be retrieved by name
  - Test basic calculation for sample indicators

---

## Phase B: Basic Indicators (28 High-Priority)

**Goal**: Auto-wrap the most commonly used indicators

**Indicators**:
- Overlays (13): sma, ema, dema, tema, wma, hma, kama, mama, vwma, swma, fwma, linreg, vwap
- Momentum (10): rsi, macd, stoch, stochrsi, willr, cci, mfi, adx, aroon, cmo
- Volatility (5): bbands, atr, natr, kc, donchian

**Excluded from Phase B**: alma (rarely used), supertrend, ichimoku (Phase 5)

### B1: Overlap Indicators (13)

- [ ] B-T01 [P] Configure and register overlap indicators in `pandas_ta_config.py`
  - sma, ema, dema, tema, wma, hma, kama, mama, vwma, swma, fwma, linreg, vwap
  - Set `display_type: "overlay"`
  - Set appropriate colors

- [ ] B-T02 [P] Configure supertrend (deferred to Phase 5)
  - Requires threshold-based colors
  - Skip for now, mark for Phase 5

- [ ] B-T03 [P] Configure ichimoku (deferred to Phase 5)
  - Requires cloud fill rendering
  - Skip for now, mark for Phase 5

### B2: Momentum Indicators (10)

- [ ] B-T04 [P] Configure RSI in `pandas_ta_config.py`
  - `display_type: "pane"`
  - `scale_ranges: {min: 0, max: 100, auto: false}`
  - `reference_levels: [{value: 30}, {value: 70}]`

- [ ] B-T05 [P] Configure MACD in `pandas_ta_config.py`
  - `display_type: "pane"`
  - Handle histogram output with color generation

- [ ] B-T06 [P] Configure STOCH in `pandas_ta_config.py`
  - `display_type: "pane"`
  - Handle multiple output columns (K, D)

- [ ] B-T07 [P] Configure remaining momentum indicators
  - stochrsi, willr, cci, mfi, adx, aroon, cmo
  - Set appropriate scale ranges and reference levels

### B3: Volatility Indicators (5)

- [ ] B-T08 [P] Configure BBANDS in `pandas_ta_config.py`
  - `display_type: "overlay"`
  - Map lower, middle, upper band fields

- [ ] B-T09 [P] Configure ATR in `pandas_ta_config.py`
  - `display_type: "pane"`
  - Set `scale_ranges: {min: 0, max: null, auto: true}`

- [ ] B-T10 [P] Configure natr, kc, donchian in `pandas_ta_config.py`
  - Set appropriate display types and ranges

### B4: Tests for Phase B

- [ ] B-T11 [P] Write parameterized tests for basic indicators
  - Test each indicator calculates without error
  - Test output has expected columns
  - Test metadata matches config

- [ ] B-T12 [P] Manual verification
  - Open IndicatorDialog, verify 28 indicators appear
  - Add each to a chart, verify rendering

---

## Phase C: Extended Indicators (100+)

**Goal**: Auto-wrap remaining indicators (excluding those in Phase 5 or excluded list)

### C1: Remaining Momentum (31)

**Indicators**: ao, apo, bias, bop, brar, cfo, cg, coppock, cti, er, eri, exhc, kst, mom, pgo, ppo, psl, qqe, roc, rsx, rvgi, slope, smc, smi, squeeze, squeeze_pro, stc, stochf, tmo, trix, tsi, uo

**Excluded from Momentum**: crsi, fisher, ifisher, kdj, inertia (non-standard params)

- [ ] C-T01 [P] Configure all remaining momentum indicators
  - Set appropriate display_type (mostly pane)
  - Set default scale ranges
  - Add to INDICATOR_CONFIG

### C2: Trend Indicators (17)

**Indicators**: adx, alphatramaat, aroon, chop, cksp, decreasing, dpo, ht_trendline, increasing, long_run, qstick, rwi, short_run, trendflex, vhf, vortex

**Excluded from Trend**: decay (one-way), zigzag (repaints), psar (Phase 5)

- [ ] C-T02 [P] Configure trend indicators
  - Most are pane-type oscillators
  - psar deferred to Phase 5

### C3: Volatility Indicators (13)

**Indicators**: accbands, atrts, chandelier_exit, hwc, massi, pdist, pvo, rvi, thermo, ui

**Excluded from Volatility**: aberration (rare), true_range (building block)

- [ ] C-T03 [P] Configure volatility indicators
  - accbands, hwc are overlays
  - Others are pane-type

### C4: Volume Indicators (19)

**Indicators**: ad, adosc, aobv, cmf, efi, eom, kvo, mfi, nvi, obv, pvi, pvo, pvol, pvr, pvt, tsv, vhm, vwap, vwma

- [ ] C-T04 [P] Configure volume indicators
  - vwap, vwma are overlays
  - Others are pane-type oscillators

### C5: Statistics Indicators (10)

**Indicators**: entropy, kurtosis, mad, median, quantile, skew, stdev, tos_stdevall, variance, zscore

- [ ] C-T05 [P] Configure statistics indicators
  - All are pane-type
  - Set appropriate scale ranges

### C6: Performance & Cycle (4)

**Indicators**: log_return, percent_return (performance); ebsw, reflex (cycle)

- [ ] C-T06 [P] Configure performance and cycle indicators
  - Performance indicators show returns (can be negative)
  - Cycle indicators are bounded (0-1 range typically)

### C7: Tests for Phase C

- [ ] C-T07 [P] Write representative tests
  - Test 1 indicator from each category
  - Test parameter passing
  - Test metadata generation

- [ ] C-T08 [P] Manual verification sampling
  - Randomly select 10 indicators from this phase
  - Verify they render correctly

---

## Phase D: Special Indicators (MOVED TO PHASE 5)

**Status**: Deferred to Phase 5 - requires frontend rendering extensions

The following indicators require specialized frontend support that is not yet implemented:
- Ichimoku (cloud fill rendering)
- PSAR (threshold-based colors)
- Heikin Ashi (OHLC transformation)
- Candle Patterns (marker rendering)

These will be implemented in **Phase 5** after frontend extensions are complete.

---

## Phase E: Testing & Polish

- [ ] E-T01 Run all unit tests, ensure 95%+ pass rate
- [ ] E-T02 Run all integration tests
- [ ] E-T03 Performance test: Calculate 100 indicators on 1000 candles, verify <5s total
- [ ] E-T04 Memory test: Verify no leaks with repeated calculations
- [ ] E-T05 Update API documentation for new indicators
- [ ] E-T06 Generate parity report comparing values to TradingView (sample indicators)

### E-T07 [P] Test: Metadata Schema Completeness
- [ ] Implement `test_metadata_schema_completeness()` in `backend/tests/services/test_pandas_ta_auto_discovery.py`
- [ ] Assert required keys: display_type, color_mode, color_schemes, series_metadata
- [ ] Assert parameter definitions resolved
- [ ] Assert output column names exist after calculate()
- [ ] Run against all 131 auto-registered indicators

### E-T08 [P] Test: Column Name Stability (No Collisions)
- [ ] Implement `test_no_column_collisions()` in `backend/tests/services/test_pandas_ta_auto_discovery.py`
- [ ] Run 100 randomized iterations with 5 indicators each
- [ ] Assert no duplicate field names across indicators
- [ ] Test multi-output indicators (MACD, BBANDS, STOCH, ADX, AROON)

### E-T09 [P] Test: Backward Compatibility
- [ ] Implement `test_backward_compatibility()` in `backend/tests/services/test_pandas_ta_auto_discovery.py`
- [ ] Test deserializing old saved layouts (pre-auto-registration format)
- [ ] Test deserializing new format (auto-registered indicators)
- [ ] Test that all cornerstone indicators (rsi, macd, bbands, atr) work

### E-T10 [P] Test: Performance Budget
- [ ] Implement `test_indicator_performance()` in `backend/tests/services/test_pandas_ta_performance.py`
- [ ] Assert 1000 candles < 5 seconds total
- [ ] Assert per-indicator average < 50ms
- [ ] Assert 10000 candles < 30 seconds total
- [ ] Log slow indicators for monitoring

---

## Phase F: Frontend Extensions (MOVED TO PHASE 5)

**Status**: Deferred to Phase 5 - required for special indicators

These tasks are now part of Phase 5 - see Phase 5 section below.

---

## Phase 5: Future Enhancement (Special Indicators)

**Purpose**: Implement indicators requiring frontend rendering extensions

**Indicators (5 total)**: Ichimoku, PSAR, SuperTrend, Heikin Ashi, Candle Patterns

**Prerequisites**:
- Phase 1-4 complete
- User approval for Phase 5 work

### 5-1: Frontend Extensions (Required First)

- [ ] 5-T01 Add cloud fill rendering for Ichimoku
  - File: `frontend/src/components/IndicatorPane.tsx`
  - Implement `cloud_fill` property rendering
  - Handle bullish/bearish cloud coloring

- [ ] 5-T02 Add marker rendering for candle patterns
  - File: `frontend/src/components/GenericIndicatorRenderer.tsx`
  - Implement `markers` property rendering
  - Support arrow, dot, triangle marker types

- [ ] 5-T03 Add threshold-based colors for PSAR/SuperTrend
  - File: `frontend/src/components/GenericIndicatorRenderer.tsx`
  - Update color based on threshold crossing
  - Support Green/Red threshold mode

- [ ] 5-T04 (Optional) Add fill-between-lines for Alligator
  - File: `frontend/src/components/IndicatorPane.tsx`
  - Implement `fill_regions` property

### 5-2: Backend Implementation

- [ ] 5-T05 Create `IchimokuIndicator` class
  - Handle 5 output columns (tenkan, kijun, senkou_a, senkou_b, chikou)
  - Implement cloud metadata

- [ ] 5-T06 Create `PSARIndicator` class
  - Handle PSAR output with direction signal
  - Implement threshold-based colors

- [ ] 5-T07 Create `SuperTrendIndicator` class
  - Handle SuperTrend output with direction signal
  - Implement threshold-based colors

- [ ] 5-T08 Create `HeikinAshiIndicator` class
  - Transform OHLC data to HA format
  - Return HA close, open, high, low columns

- [ ] 5-T09 Create `CandlePatternIndicator` class
  - Support cdl_pattern function
  - Return pattern detection signals

### 5-3: Registration & Testing

- [ ] 5-T10 Register all 5 indicators in `initialization.py`
- [ ] 5-T11 Write tests for all Phase 5 indicators

---

## Task Summary

| Phase | Tasks | Effort | Indicators |
|-------|-------|--------|------------|
| A: Infrastructure | 9 tasks | ~15 hours | - |
| B: Basic (28) | 12 tasks | ~10 hours | 28 |
| C: Extended (101) | 8 tasks | ~10 hours | 101 |
| E: Polish + Tests | 4 tasks | ~4 hours | - |
| 5: Future Enhancement | 11 tasks | ~14 hours | 5 |
| **Total (Phases 1-3)** | **33 tasks** | **~39 hours** | **128** |
| **Total (All Phases)** | **44 tasks** | **~53 hours** | **134** |

### Count Formula (Authoritative)

```
Auto-registered (Phases 1-3) = 128 indicators
  = 151 (pandas-ta total)
  - 18 (excluded)
  - 5 (Phase 5)

Future Enhancement (Phase 5) = 5 indicators
  = 1 (Ichimoku)
  + 1 (PSAR)
  + 1 (SuperTrend)
  + 1 (Heikin Ashi)
  + 1 (Candle Patterns)

Excluded = 18 indicators
  = hl2, hlc3, ohlc4, wcp, hilo, pivots, alma
  + crsi, fisher, ifisher, kdj, inertia
  + zigzag, amat, decay
  + true_range, aberration, cdl_z
```

### Test Assertion Targets

| Phase | Assertion | Expected | Calculation |
|-------|-----------|----------|-------------|
| 1-3 | Auto-registered count | 128 | registry count - excluded - future |
| 1-3 | Manually registered count | 0 | All Phase 1-3 via auto-discovery |
| 5 | Future enhancement indicators | 5 | Ichimoku, PSAR, SuperTrend, HA, Patterns |
| All | Excluded indicator count | 18 | From exclusions list |

---

## Parallel Execution

Many tasks can run in parallel within each phase:

- **Phase A**: T01-T03 can run in parallel, T04-T07 can run in parallel
- **Phase B**: T01-T04 can run in parallel, T11-T12 can run in parallel
- **Phase C**: T01-T06 can run in parallel, T07-T08 can run in parallel
- **Phase 5**: T01-T04 can run in parallel, T05-T09 can run in parallel

---

## Exclusions (Not in Scope) - 18 Indicators

| Indicator | Reason |
|-----------|--------|
| hl2, hlc3, ohlc4, wcp | Price type helpers, not indicators |
| hilo | Composite (HL2 + HLC3), confusing UI |
| pivots | Multi-level output, no clear rendering |
| alma | Rarely used, edge case params |
| crsi, fisher, ifisher | Non-standard parameter structures |
| kdj | Triply-nested calculation, rarely used |
| inertia | Non-standard output format |
| zigzag | Repaints - unsuitable for alerts |
| amat | Requires price sequence analysis |
| decay | One-way indicator, limited use |
| true_range | Building block, not standalone |
| aberration | Rarely used, edge case |
| cdl_z | Score-based (-5 to +5), not line-compatible |

---

## References

- pandas-ta Category: `ta.Category` dict with all indicators
- Existing implementation: `backend/app/services/indicator_registry/registry.py`
- Config file: `backend/app/services/indicator_registry/pandas_ta_config.py`
- Configuration pattern: `pandas_ta_config.py` (new)
- Wrapper factory: `pandas_ta_wrapper.py` (new)
