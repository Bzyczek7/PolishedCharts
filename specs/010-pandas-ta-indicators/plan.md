# Implementation Plan: pandas-ta Indicator Pack

**Branch**: `010-pandas-ta-indicators` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-pandas-ta-indicators/spec.md`

## Summary

Expose 4 pandas-ta indicators (RSI, MACD, BBANDS, ATR) through the existing Indicator Registry system. The integration uses a wrapper pattern that maps pandas-ta's dynamic column names (e.g., "RSI_14", "MACD_12_26_9") to stable field names (e.g., "rsi", "macd") for metadata-driven frontend rendering. No API or frontend changes are required - the existing registry pattern automatically discovers and renders new indicators.

**Technical Approach**:
1. Add `pandas-ta>=0.3.14b0` dependency to requirements.txt
2. Create 4 Indicator subclasses (RSIIndicator, MACDIndicator, BBANDSIndicator, ATRIndicator)
3. Implement stable column name mapping in calculate() methods
4. Register indicators in initialization.py with indicator_classes mapping
5. Write unit tests following existing patterns

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9+ (frontend)

**Primary Dependencies**:
- pandas-ta>=0.3.14b0 (NEW - technical analysis library)
- FastAPI 0.104+ (existing API framework)
- SQLAlchemy 2.0+ (existing ORM)
- pandas 2.1+ (existing data manipulation)
- numpy 1.26+ (existing numerical computing)

**Storage**: PostgreSQL (existing candles table, no schema changes needed)

**Testing**: pytest with existing test patterns from test_indicator_registry.py

**Target Platform**: Linux server (backend), React 19 web browser (frontend)

**Project Type**: Web application (backend/frontend split)

**Performance Goals**:
- Indicator calculations: < 2 seconds for 1000 candles (SC-002)
- API response time: < 500ms for indicator metadata
- Memory: Ephemeral calculations (~100 KB per request, no persistence)

**Constraints**:
- pandas-ta column names are dynamic (include parameters) - must map to stable names
- RSI/ATR use "length" parameter, UI expects "period" - must accept both
- MACD slow period must be > fast period - must validate in calculate()

**Scale/Scope**:
- Phase 1: 4 cornerstone indicators (RSI, MACD, BBANDS, ATR)
- Phase 2: 130+ pandas-ta indicators (after user approval)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UX Parity with TradingView

- [x] Chart interactions (zoom/pan/crosshair) match TradingView behavior
  - **N/A**: This feature does not modify chart interactions
- [x] UI changes include before/after verification
  - **N/A**: No frontend UI changes - metadata-driven rendering automatically discovers new indicators
- [x] Performance budgets: 60fps panning, 3s initial load
  - **Compliant**: Calculations are on-demand API calls (< 2s per 1000 candles), do not affect panning performance

**Assessment**: PASS - No UI changes, performance within budgets

### Correctness Over Cleverness

- [x] Timestamp handling: UTC normalization documented
  - **Compliant**: Uses existing candle data (already UTC-normalized)
- [x] Deduplication strategy: database constraints or idempotent inserts
  - **Compliant**: Indicators calculated on-demand from existing candles, no persistence
- [x] Alert semantics: above/below/crosses defined with edge cases tested
  - **N/A**: Out of scope (alerts use existing indicators)
- [x] Gap handling: explicit marking and backfill strategy
  - **Compliant**: pandas-ta handles gaps automatically, follows existing candle gap handling

**Assessment**: PASS - Uses existing correct data handling

### Unlimited Alerts Philosophy

- [x] No application-level hard caps on alert count
  - **N/A**: Out of scope (feature does not modify alerts)
- [x] Alert evaluation performance budgeted (500ms)
  - **N/A**: Out of scope
- [x] Graceful degradation defined for high alert volumes
  - **N/A**: Out of scope

**Assessment**: PASS - Not applicable to this feature

### Local-First and Offline-Tolerant

- [x] Caching strategy: all market data stored locally
  - **Compliant**: Uses existing local PostgreSQL candle cache
- [x] Offline behavior: charts, alerts, history remain accessible
  - **Compliant**: Indicators calculated from cached candle data
- [x] Provider error handling: graceful degradation with user feedback
  - **Compliant**: pandas-ta errors caught and returned as meaningful API errors

**Assessment**: PASS - Uses existing local-first architecture

### Testing and Quality Gates

- [x] Core logic uses TDD (alert engine, indicators, candle normalization)
  - **Compliant**: Will write unit tests following existing patterns before implementation
- [x] Bug fixes include regression tests
  - **N/A**: New feature, not a bug fix
- [x] CI includes: lint, typecheck, unit, integration tests
  - **Compliant**: Tests will be added to existing test suite

**Assessment**: PASS - TDD approach for new indicator classes

### Performance Budgets

- [x] Initial chart load: 3 seconds
  - **Compliant**: Indicators loaded on-demand after chart, do not affect initial load
- [x] Price update latency: 2 seconds
  - **Compliant**: Calculations complete in < 2s for 1000 candles (pandas-ta benchmarked)
- [x] Alert evaluation: 500ms
  - **N/A**: Out of scope
- [x] UI panning: 60fps
  - **Compliant**: No UI changes
- [x] Memory: 500MB for 5 symbols / 20 alerts
  - **Compliant**: Ephemeral calculations (~100 KB per request), no persistent memory

**Assessment**: PASS - Within performance budgets

### Architecture for Extensibility

- [x] Indicators use plugin registry pattern
  - **Compliant**: Uses existing Indicator base class and IndicatorRegistry
- [x] Data providers implement common interface
  - **N/A**: No new data providers
- [x] Provider-specific logic isolated from UI
  - **Compliant**: pandas-ta logic wrapped in Indicator subclass, isolated from frontend

**Assessment**: PASS - Follows existing plugin architecture

### Security & Privacy

- [x] No telemetry or data upload without consent
  - **Compliant**: All calculations local, no external calls
- [x] API keys stored securely (not in repo)
  - **N/A**: No API keys required (pandas-ta is local library)
- [x] Local data treated as sensitive
  - **Compliant**: Uses existing local database

**Assessment**: PASS - No new security concerns

### Governance

- [x] If any principle violated: justification in Complexity Tracking
  - **No violations**
- [x] Constitution supersedes spec/plan conflicts
  - **No conflicts**

**Assessment**: PASS - No violations

## Project Structure

### Documentation (this feature)

```text
specs/010-pandas-ta-indicators/
├── plan.md              # This file (Phase 1 design)
├── research.md          # Phase 0 research (pandas-ta API patterns, test patterns)
├── data-model.md        # Phase 1 data model (IndicatorMetadata, IndicatorOutput)
├── quickstart.md        # Phase 1 quickstart (step-by-step implementation guide)
├── contracts/           # Phase 1 API contracts
│   ├── indicators-api.yaml     # OpenAPI spec for indicator endpoints
│   └── indicator-metadata.json # JSON Schema for IndicatorMetadata
├── spec.md              # Feature specification (user input)
└── tasks.md             # Phase 2 task breakdown (NOT created yet - use /speckit.tasks)
```

### Source Code (repository root)

```text
# Backend changes
backend/
├── requirements.txt                    # ADD: pandas-ta>=0.3.14b0
├── app/
│   ├── services/
│   │   └── indicator_registry/
│   │       ├── registry.py            # ADD: RSIIndicator, MACDIndicator, BBANDSIndicator, ATRIndicator classes
│   │       └── initialization.py      # MODIFY: Register pandas-ta indicators in initialize_standard_indicators()
│   │                                   #        Add to indicator_classes mapping in deserialize_indicator_params()
│   └── schemas/
│       └── indicator.py                # EXISTING: IndicatorMetadata, IndicatorOutput schemas (no changes needed)
└── tests/
    └── services/
        └── test_indicator_registry.py  # ADD: Tests for pandas-ta indicators

# Frontend changes
frontend/                                  # NO CHANGES NEEDED
└── src/
    ├── components/
    │   └── IndicatorDialog.tsx           # EXISTING: Auto-discovers new indicators via /supported API
    └── hooks/
        └── useIndicatorData.ts           # EXISTING: Generic rendering via metadata
```

**Structure Decision**: Web application with backend/frontend split. All changes are backend-only - the existing metadata-driven frontend architecture automatically discovers and renders the new pandas-ta indicators without any code changes.

## Complexity Tracking

> **No violations to justify** - All constitution checks pass.

## Implementation Phases

### Phase 1: Cornerstone Indicators (MVP)

**Goal**: Implement and validate the 4 most popular pandas-ta indicators to prove the integration approach works correctly.

**Scope**:
- RSI (Relative Strength Index) - pane indicator
- MACD (Moving Average Convergence Divergence) - pane indicator
- BBANDS (Bollinger Bands) - overlay indicator
- ATR (Average True Range) - pane indicator

**Implementation Pattern**:
Each indicator will be implemented as an `Indicator` subclass with:
- `base_name` property: "rsi", "macd", "bbands", "atr"
- `parameter_definitions` property: Define default parameters and validation bounds
- `calculate(df, **kwargs)` method: Call pandas-ta and return DataFrame with stable column names
- `metadata` property: Provide IndicatorMetadata for generic frontend rendering
- Registered in `initialize_standard_indicators()` with default parameters
- Added to `indicator_classes` mapping in `deserialize_indicator_params()` for dynamic instantiation

**Deliverables**:
- `RSIIndicator`, `MACDIndicator`, `BBANDSIndicator`, `ATRIndicator` classes in `app/services/indicator_registry/registry.py`
- Registration in `initialize_standard_indicators()` with default params
- Extended `indicator_classes` mapping for dynamic instantiation
- Unit tests validating output alignment and calculation correctness
- User acceptance testing - trader validates indicators appear and work correctly

**Approval Gate**: User must test the 4 indicators and approve before proceeding to Phase 2.

### Phase 2: Full pandas-ta Library Exposure

**Goal**: Automatically expose all remaining 130+ pandas-ta indicators through the existing integration pattern.

**Scope**:
- All remaining pandas-ta indicators (130+ indicators beyond the initial 4)
- Automatic discovery and registration of indicators
- Generic parameter handling for diverse indicator types

**Prerequisites**:
- Phase 1 must be complete and approved by user
- User confirms the 4 cornerstone indicators work correctly
- Integration pattern validated and documented

**Approach**:
- Reuse the wrapper/integration pattern from Phase 1
- Implement auto-discovery mechanism for pandas-ta library
- Bulk register all available pandas-ta indicators
- Test indicator diversity (different parameter types, output formats)

**Deliverables**:
- Auto-discovery mechanism for pandas-ta indicators
- All 130+ indicators exposed via supported indicators API
- Tests validating representative indicators from each category
- Documentation of any indicators that cannot be exposed (with reasons)

## Key Technical Decisions

### Decision 1: Use pandas-ta Library

**Rationale**:
- 130+ indicators in single library
- Python 3.11+ compatible
- Stable column naming pattern (predictable)
- High performance (vectorized numpy operations)

**Alternatives Considered**:
- TA-Lib: Requires C library installation, more complex setup
- Manual implementation: Higher maintenance burden, risk of calculation errors

### Decision 2: Map Dynamic Column Names to Stable Names

**Problem**: pandas-ta returns dynamic column names (e.g., "RSI_14", "MACD_12_26_9")

**Solution**: Map to stable names in `calculate()` method

**Rationale**:
- Frontend metadata-driven rendering requires stable field names
- Enables generic indicator handling without per-indicator frontend code
- SeriesMetadata.field must match DataFrame column name

**Mapping Table**:
- RSI: "RSI_14" → "rsi"
- MACD: "MACD_12_26_9" → "macd", "MACDh_12_26_9" → "histogram", "MACDs_12_26_9" → "signal"
- BBANDS: "BBL_20_2.0" → "lower", "BBM_20_2.0" → "middle", "BBU_20_2.0" → "upper"
- ATR: "ATR_14" → "atr"

### Decision 3: Parameter Name Mapping Strategy

**Challenge**: UI parameter names may differ from pandas-ta function parameter names.

**Solution**: `calculate()` method accepts both names and maps appropriately.

**Mapping Table**:
- RSI: UI uses `period`, pandas-ta uses `length` → Accept both: `period = kwargs.get('period', kwargs.get('length', self._period))`
- MACD: Use pandas-ta names directly (`fast`, `slow`, `signal`)
- BBANDS: Use pandas-ta names directly (`length`, `std`)
- ATR: UI uses `period`, pandas-ta uses `length` → Accept both

**Rationale**:
- Provides consistent UI experience (RSI/ATR use "period" like other indicators)
- Maintains compatibility with pandas-ta API
- Settings UI sends the correct key defined in `parameter_definitions`

### Decision 4: No API or Frontend Changes

**Rationale**:
- Existing Indicator Registry pattern handles new indicators automatically
- `GET /api/v1/indicators/supported` calls `registry.list_indicators_with_metadata()` - includes new indicators
- `GET /api/v1/indicators/{symbol}/{indicatorName}` looks up by base_name - works for new indicators
- Frontend uses metadata-driven rendering - auto-discovers new indicators

**Impact**:
- Zero frontend code changes
- Zero API endpoint changes
- Minimal testing surface (backend-only)

## Dependencies & Integration Points

### External Dependencies

**NEW**: `pandas-ta>=0.3.14b0`
- Purpose: Technical indicator calculations
- Python 3.11+ compatible
- Install via: `pip install pandas-ta`

### Internal Dependencies

**Existing Code Used**:
1. `app/services/indicator_registry/registry.py`
   - `Indicator` base class
   - `IndicatorRegistry` class
   - `validate_params()` method
   - `name` property (auto-generates unique names)

2. `app/services/indicator_registry/initialization.py`
   - `initialize_standard_indicators()` function
   - `deserialize_indicator_params()` function
   - `indicator_classes` mapping

3. `app/api/v1/indicators.py`
   - `GET /api/v1/indicators/supported` endpoint
   - `GET /api/v1/indicators/{symbol}/{indicatorName}` endpoint
   - Parameter validation logic
   - Output construction logic

4. `app/schemas/indicator.py`
   - `IndicatorMetadata` schema
   - `IndicatorOutput` schema
   - `ParameterDefinition` schema
   - `SeriesMetadata` schema

5. `app/models/candle.py`
   - `Candle` database model (no changes needed)
   - OHLCV data for indicator calculations

## Testing Strategy

### Unit Tests

For each indicator (RSI, MACD, BBANDS, ATR):
1. **Name generation tests**: Default and parameterized instances
2. **Calculation tests**: Return DataFrame with expected columns
3. **Field alignment tests**: pandas-ta columns → stable names
4. **Parameter validation tests**: Type and range checking
5. **Metadata validation tests**: Structure and completeness
6. **Edge case tests**: Insufficient data, flat prices, gaps

### Integration Tests

1. **Registry integration**: Indicators appear in `/supported` endpoint
2. **API endpoint tests**: Valid IndicatorOutput format
3. **Parameter passing tests**: Query params → calculate() kwargs
4. **Error handling tests**: Invalid parameters raise meaningful errors

### Performance Tests

1. **Calculation speed**: < 2 seconds for 1000 candles
2. **Memory usage**: Ephemeral calculations, no leaks

### Test Patterns

Following existing patterns from `tests/services/test_indicator_registry.py`:
- `test_all_indicators_have_metadata()`
- `test_indicator_calculations_produce_expected_fields()`
- `test_parameter_validation_rejects_out_of_bounds()`

## Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| pandas-ta calculations differ from TradingView | High | Medium | Document calculation methodology, validate against known test cases |
| Field name instability across pandas-ta versions | High | Low | Stable wrapper layer maps to fixed field names |
| pandas-ta raises unexpected errors | Medium | Low | Try-catch in `calculate()` with meaningful error messages |
| Performance degradation with 130+ indicators | Medium | Low | Benchmark with 10,000 candles; add caching if needed |
| Multi-series indicator output complexity | Low | Medium | Follow existing cRSI pattern for multi-series metadata |

## Next Steps

### Immediate Actions

1. **Update requirements.txt**: Add `pandas-ta>=0.3.14b0`
2. **Install dependency**: `pip install pandas-ta`
3. **Create indicator classes**: Implement RSIIndicator, MACDIndicator, BBANDSIndicator, ATRIndicator
4. **Register indicators**: Add to initialization.py
5. **Write tests**: Follow existing test patterns
6. **Run tests**: Verify all tests pass
7. **Manual testing**: Open IndicatorDialog, add pandas-ta indicators, verify rendering
8. **User approval**: Get user sign-off before Phase 2

### Phase 2 Triggers

- User approval of Phase 1 indicators
- Validation of calculation correctness
- Confirmation of metadata-driven rendering

---

**Planning Complete**: All technical unknowns resolved, design artifacts generated, ready for implementation.

**Generated Artifacts**:
- [research.md](./research.md) - pandas-ta API research and test patterns
- [data-model.md](./data-model.md) - IndicatorMetadata and IndicatorOutput schemas
- [quickstart.md](./quickstart.md) - Step-by-step implementation guide
- [contracts/indicators-api.yaml](./contracts/indicators-api.yaml) - OpenAPI specification
- [contracts/indicator-metadata.json](./contracts/indicator-metadata.json) - JSON Schema

**Next Command**: `/speckit.tasks` to generate actionable task breakdown.
