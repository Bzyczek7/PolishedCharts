# Feature Specification: pandas-ta Indicator Pack

**Feature Branch**: `010-pandas-ta-indicators`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Expose a starter pack of pandas-ta indicators (RSI, MACD, BBANDS, ATR) through the existing Indicator Registry"

## Clarifications

### Session 2025-12-28

- Q: What is the expected maximum number of candles that indicators should efficiently handle in a single calculation request? → A: 10,000 candles (matches constitution UI panning budget)
- Q: When there are fewer candles than the indicator requires for warmup (e.g., 5 candles but RSI period is 14), what should the system return? → A: Return array with null/NaN for uncalculable values, valid values where possible
- Q: What type of parity evidence is required to validate that pandas-ta indicator calculations match TradingView's implementations (constitutionally required per Principle I)? → A: Automated tests with known datasets + Parity Report (indicator values, thresholds, axis bounds)
- Q: When a user provides an invalid parameter value (e.g., RSI period = -5 or period = 10000), what should the system do? → A: Return HTTP 400 with specific validation error message explaining the constraint
- Q: When candle data has gaps or missing timestamps (e.g., missing weekend data for daily candles), how should the system handle indicator calculation? → A: Calculate indicators on actual data only; gaps result in null/NaN at those positions

## User Scenarios & Testing

### User Story 1 - Discover and Add pandas-ta Indicators (Priority: P1)

As a trader, I want to discover and add popular technical indicators (RSI, MACD, Bollinger Bands, ATR) to my chart so that I can analyze price momentum, volatility, and trends using industry-standard calculations.

**Why this priority**: This is the core value proposition - exposing these widely-used indicators makes the platform immediately more useful to traders who rely on these standard analysis tools. Without this, users cannot access these indicators at all.

**Independent Test**: Can be fully tested by opening the **IndicatorDialog** (which loads dynamically from `/indicators/supported`), verifying the 4 new indicators appear in the list, adding each one to a chart with existing candle data, and confirming that values appear and align with candle timestamps.

**Note**: The hardcoded `IndicatorSearch.tsx` component is out of scope for this feature. The dynamic `IndicatorDialog` component (which fetches from `/indicators/supported`) will automatically show the new pandas-ta indicators.

**Acceptance Scenarios**:

1. **Given** I am viewing a chart with candle data, **When** I open the IndicatorDialog, **Then** I see "RSI", "MACD", "BBANDS", and "ATR" in the list of available indicators
2. **Given** the indicator list includes pandas-ta indicators, **When** I select "RSI" and add it to my chart, **Then** the RSI panel appears below the price chart with values ranging from 0-100
3. **Given** I have added MACD to my chart, **When** the indicator renders, **Then** I see MACD line, signal line, and histogram values (3 data series)
4. **Given** I have added BBANDS to my chart, **When** the indicator renders, **Then** I see upper, middle, and lower bands overlaid on the price chart
5. **Given** I have added ATR to my chart, **When** the indicator renders, **Then** I see ATR values in a separate pane reflecting volatility
6. **Given** I add any pandas-ta indicator, **When** the API returns indicator data, **Then** the number of data points equals the number of candle timestamps (no misalignment)

---

### User Story 2 - Configure pandas-ta Indicator Parameters (Priority: P2)

As a trader, I want to adjust standard parameters for these indicators (e.g., RSI period, MACD fast/slow/signal lengths) so that I can customize the analysis to my trading style and timeframes.

**Why this priority**: Parameter customization is important for advanced users but not critical for initial usability. Default parameters work for most users, so this is P2.

**Independent Test**: Can be fully tested by adding an indicator, opening its settings, changing a parameter value, and verifying that the indicator recalculates with new values.

**Acceptance Scenarios**:

1. **Given** I have added RSI to my chart, **When** I open indicator settings, **Then** I can adjust the period parameter (default: 14)
2. **Given** I have added MACD to my chart, **When** I open indicator settings, **Then** I can adjust fast, slow, and signal period parameters
3. **Given** I change an indicator parameter, **When** I save the settings, **Then** the indicator recalculates and displays updated values
4. **Given** I set an invalid parameter value (e.g., period = -5), **When** I attempt to save, **Then** the system returns HTTP 400 with a specific validation error message explaining the constraint and does not apply the change

---

### User Story 3 - Remove and Manage pandas-ta Indicators (Priority: P3)

As a trader, I want to remove pandas-ta indicators from my chart so that I can declutter my view and focus on specific analysis tools.

**Why this priority**: Removing indicators is a basic necessity but has lower priority than adding and configuring them. Users can work around this by refreshing or starting a new chart if needed.

**Independent Test**: Can be fully tested by adding multiple indicators, removing one, and verifying it disappears while others remain.

**Acceptance Scenarios**:

1. **Given** I have multiple pandas-ta indicators on my chart, **When** I remove one indicator, **Then** that indicator disappears while others remain visible
2. **Given** the system persists indicator instances (database or localStorage), **When** I remove an indicator and refresh the chart, **Then** the removed indicator does not reappear
3. **Given** I remove all pandas-ta indicators, **When** I open the indicator picker, **Then** the pandas-ta indicators are still available to add again

---

### User Story 4 - Access All pandas-ta Indicators (Priority: P4 - Phase 2)

As a trader, I want access to the complete library of 130+ pandas-ta indicators so that I can use any technical analysis tool I need for my trading strategy.

**Why this priority**: This is Phase 2 functionality that depends on successful completion and approval of Phase 1 (cornerstone indicators). It extends the proven integration pattern to the full library.

**Independent Test**: Can be fully tested by querying the supported indicators API and confirming all pandas-ta indicators appear, then adding a diverse set of indicators to verify they work.

**Prerequisites**: Phase 1 (cornerstone indicators) must be complete and approved by the user.

**Acceptance Scenarios**:

1. **Given** Phase 1 is approved and complete, **When** I query the supported indicators API, **Then** I see 130+ pandas-ta indicators available
2. **Given** the full indicator library is exposed, **When** I add any indicator to my chart, **Then** it calculates and displays correctly
3. **Given** I add indicators with different parameter types, **When** I configure them, **Then** the parameter UI adapts to each indicator's requirements
4. **Given** some indicators cannot be auto-exposed, **When** I review the documentation, **Then** I see clear reasons for any exclusions

---

### Edge Cases

- **Insufficient data for warmup**: When there are fewer candles than the indicator requires (e.g., 5 candles but RSI period is 14), the system returns arrays with null/NaN values for positions that cannot be calculated and valid values where calculation is possible
- **Candle data gaps**: When candle data has gaps or missing timestamps (e.g., missing weekend data for daily candles), the system calculates indicators on actual data only; gaps result in null/NaN at those positions
- How does the system handle calculation when all candle values are the same (no volatility)?
- What happens if pandas-ta library raises an error during calculation?
- How does the system behave when multiple indicators are added simultaneously?
- What happens if the user requests an indicator for a symbol with no historical data?

## Requirements

### Functional Requirements

**Indicator Discovery and Availability**

- **FR-001**: System MUST expose RSI, MACD, BBANDS, and ATR in the supported indicators list via the indicators API endpoint
- **FR-002**: System MUST provide metadata for each indicator including name, description, display type (pane vs overlay), and configurable parameters
- **FR-003**: System MUST use stable, human-readable field names for indicator outputs (not pandas-ta's internal column names)

**Indicator Calculation**

- **FR-004**: System MUST calculate RSI using pandas-ta's RSI implementation with configurable period (default 14)
- **FR-005**: System MUST calculate MACD using pandas-ta's MACD implementation with configurable fast period (default 12), slow period (default 26), and signal period (default 9)
- **FR-006**: System MUST calculate Bollinger Bands using pandas-ta's BBANDS implementation with configurable period (default 20) and standard deviations (default 2)
- **FR-007**: System MUST calculate ATR using pandas-ta's ATR implementation with configurable period (default 14)
- **FR-008**: System MUST return indicator values as arrays aligned one-to-one with input candle timestamps
- **FR-009**: System MUST handle insufficient data gracefully by returning null/NaN for values that cannot be calculated (warmup period)

**Indicator Integration**

- **FR-010**: System MUST register pandas-ta indicators with the existing Indicator Registry at application startup
- **FR-011**: System MUST support adding pandas-ta indicators to charts without requiring frontend code changes, assuming the existing generic metadata-driven indicator rendering and settings UI already supports the required parameter types (integer, float, select)
- **FR-012**: System MUST support parameter customization for all pandas-ta indicators through the existing parameter configuration interface

**Error Handling**

- **FR-013**: System MUST return meaningful error messages if indicator calculation fails
- **FR-014**: System MUST validate parameter ranges (e.g., period must be positive integer) before calculation and return HTTP 400 with specific validation error message explaining the constraint when validation fails

**Parity Validation**

- **FR-015**: System MUST include automated tests validating pandas-ta calculations against known TradingView datasets
- **FR-016**: System MUST generate a Parity Report documenting indicator values, axis bounds, threshold levels, and color schemes for each indicator

**Output Format**

- **FR-017**: System MUST return RSI as a single array of values
- **FR-018**: System MUST return MACD as three arrays: MACD line, signal line, and histogram
- **FR-019**: System MUST return BBANDS as three arrays: upper band, middle band (SMA), and lower band
- **FR-020**: System MUST return ATR as a single array of values
- **FR-021**: System MUST ensure all output arrays have the same length as the input candle timestamp array

### Key Entities

- **Indicator Metadata**: Name, description, display type (pane/overlay), parameter definitions with defaults and valid ranges
- **Indicator Output**: One or more data arrays (values) aligned to candle timestamps
- **Indicator Parameters**: User-configurable calculation inputs (period, standard deviations, etc.)

### API Contracts

**Confirmed Endpoints** (verified from frontend implementation):

This feature uses the existing indicator API infrastructure already consumed by the frontend:

- **GET /api/v1/indicators/supported**: Returns list of all supported indicators with metadata
  - Frontend calls: `client.get('/indicators/supported')`
  - Backend implementation: Calls `IndicatorRegistry.list_indicators_with_metadata()`
  - Response includes: indicator name, description, display_type, parameter_definitions, metadata, alert_templates

- **GET /api/v1/indicators/{symbol}/{indicatorName}**: Calculates and returns indicator values for a symbol
  - Frontend calls: `client.get('/indicators/{symbol}/{indicatorName}', { params: { interval, ...indicatorParams } })`
  - Example request: `GET /api/v1/indicators/AAPL/rsi?interval=1d&period=14`
  - Example MACD request: `GET /api/v1/indicators/AAPL/macd?interval=1d&fast=12&slow=26&signal=9`
  - **Canonical Output Format** (Option A - matches metadata-driven renderer):

```typescript
{
  "symbol": "AAPL",
  "interval": "1d",
  "timestamps": [1609459200, 1609545600, ...],  // Unix seconds (numeric)
  "data": {
    "rsi": [45.2, 46.1, ...],  // Single-series indicator
    "macd": [1.2, 1.5, ...],   // Multi-series indicator
    "signal": [1.1, 1.3, ...],
    "histogram": [0.1, 0.2, ...]
  },
  "metadata": {
    "display_type": "pane",  // or "overlay"
    "color_mode": "single",  // or "threshold", "gradient", "trend"
    "color_schemes": {
      "bullish": "#00FF00",
      "bearish": "#ef5350",
      "neutral": "#808080"
    },
    "series_metadata": [
      {
        "field": "rsi",  // Must match data key - CRITICAL for generic renderer
        "role": "main",
        "label": "RSI",
        "line_color": "#808080",
        "line_style": "solid",
        "line_width": 2
      }
    ]
  },
  "calculated_at": "2025-12-28T10:30:00Z",
  "data_points": 252
}
```

**Critical Requirements**:
- **Output Format**: All indicators (single and multi-series) MUST use `{ timestamps, data: { [field]: [...] }, metadata }` format
  - `data` object keys MUST exactly match `metadata.series_metadata[].field` values
  - This enables generic metadata-driven rendering without frontend changes
- **Timestamps**: Numeric Unix seconds (milliseconds / 1000), not ISO strings
- **Array Alignment**: All data arrays must have same length as `timestamps` array
- **Null Values**: Allowed in data arrays for warmup periods
- **Field Naming**: Backend JSON uses snake_case (`series_metadata`, `reference_levels`) to match frontend TypeScript interfaces

**Parameter Name Mapping**:
Backend `calculate()` methods accept UI parameter names and map to pandas-ta parameters:

- **RSI**: UI sends `period` (advertised in `parameter_definitions`), backend maps to pandas-ta's `length`
  - Code: `period = kwargs.get('period', kwargs.get('length', self._period))`
  - This allows UI to use consistent `period` naming while supporting pandas-ta's `length`
- **MACD**: Use pandas-ta names directly: `fast`, `slow`, `signal`
- **BBANDS**: Use pandas-ta names directly: `length`, `std`
- **ATR**: UI sends `period` (advertised in `parameter_definitions`), backend maps to pandas-ta's `length`
  - Code: `length = kwargs.get('period', kwargs.get('length', self._period))`

**Parameter Definition Consistency**:
- Each indicator's `parameter_definitions` property MUST define the parameter name that the UI uses (e.g., `period`)
- The `calculate()` method MUST accept that parameter name and map to pandas-ta if needed
- This ensures the settings UI sends the correct key that the backend expects

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 4 pandas-ta indicators (RSI, MACD, BBANDS, ATR) appear in the indicator picker within 1 second of opening the list
- **SC-002**: Indicator calculations complete within 2 seconds for 1000 candles
- **SC-003**: Indicator calculations complete within 10 seconds for 10,000 candles (maximum expected scale)
- **SC-004**: Output arrays always match the length of input candle timestamp arrays (100% alignment)
- **SC-005**: Users can successfully add any pandas-ta indicator to a chart on first attempt (95% success rate measured by successful API responses)
- **SC-006**: Parameter changes are applied and reflected in the chart within 1 second
- **SC-007**: Indicators handle edge cases (insufficient data, flat prices) without crashing the application

## Out of Scope

- **OOS-001**: Automatic exposure of all 130+ pandas-ta indicators in Phase 1 (only 4 cornerstone indicators in Phase 1; remaining indicators to be added in Phase 2 after user approval)
- **OOS-002**: Custom indicator creation by users
- **OOS-003**: Real-time streaming indicator updates (calculations happen on-demand)
- **OOS-004**: Multi-timeframe analysis for the same indicator
- **OOS-005**: Backtesting strategies based on these indicators
- **OOS-006**: Indicator alerts/signals based on threshold crossings
- **OOS-007**: Custom indicator visualization beyond existing generic rendering

## Implementation Phases

### Phase 1: Cornerstone Indicators (MVP)

**Goal**: Implement and validate the 4 most popular pandas-ta indicators to prove the integration approach works correctly.

**Scope**:
- RSI (Relative Strength Index) - pane indicator
- MACD (Moving Average Convergence Divergence) - pane indicator
- BBANDS (Bollinger Bands) - overlay indicator
- ATR (Average True Range) - pane indicator

**Implementation Pattern** (Dynamic Model - Better UX):
Each indicator will be implemented as an `Indicator` subclass with:
- `base_name` property: "rsi", "macd", "bbands", "atr"
- `parameter_definitions` property: Define default parameters and validation bounds
- `calculate(df, **kwargs)` method: Call pandas-ta and return DataFrame with stable column names
- `metadata` property: Provide IndicatorMetadata for generic frontend rendering
- Registered in `initialize_standard_indicators()` with default parameters
- Added to `indicator_classes` mapping in `deserialize_indicator_params()` for dynamic instantiation

**Why Dynamic Model?**
- Users can customize parameters freely without pre-registering variants
- Consistent with existing deserialize_indicator_params() pattern
- Better UX - any parameter change can create/resolve an instance from {basename, parameters}

**Deliverables**:
- `RSIIndicator`, `MACDIndicator`, `BBANDSIndicator`, `ATRIndicator` classes in `app/services/indicator_registry/registry.py`
- Registration in `initialize_standard_indicators()` with default params
- Extended `indicator_classes` mapping for dynamic instantiation
- Unit tests validating output alignment and calculation correctness
- Parity validation tests with known TradingView datasets
- Parity Report documenting indicator values, axis bounds, threshold levels, and color schemes
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

### Technical Implementation Notes

**Indicator Registry Architecture** (Existing):
- `Indicator` base class with abstract `base_name`, `calculate()`, `metadata` properties
- `IndicatorRegistry.list_indicators_with_metadata()` returns full metadata for API consumption
- `initialize_standard_indicators()` registers default variants at startup
- `deserialize_indicator_params()` creates instances from {base_name, parameters}

**Required Implementation for Each pandas-ta Indicator**:
```python
class RSIIndicator(Indicator):
    _DEFAULT_PERIOD = 14

    def __init__(self, period: int = _DEFAULT_PERIOD):
        self._period = period
        if period != self._DEFAULT_PERIOD:
            super().__init__(period=period)
        else:
            super().__init__()

    @property
    def base_name(self) -> str:
        return "rsi"

    @property
    def description(self) -> str:
        return f"Relative Strength Index (period={self._period})"

    @property
    def category(self) -> str:
        return "oscillator"

    @property
    def parameter_definitions(self) -> Dict[str, ParameterDefinition]:
        from app.schemas.indicator import ParameterDefinition
        # Define the parameter name that the UI will use and send
        return {
            "period": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_PERIOD,
                min=2,
                max=200,
                description="RSI period for calculation"
            )
        }

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        import pandas_ta as ta
        # Accept UI parameter name ('period') and map to pandas-ta name ('length')
        # This allows parameter_definitions to use consistent naming while
        # supporting pandas-ta's API
        period = kwargs.get('period', kwargs.get('length', self._period))

        # pandas_ta returns Series with dynamic name like "RSI_14"
        # Map to stable field name for FR-003
        result = ta.rsi(df['close'], length=period)
        df_copy = df.copy()
        df_copy['rsi'] = result  # Stable field name (matches metadata.series_metadata[0].field)
        return df_copy

    @property
    def metadata(self) -> IndicatorMetadata:
        from app.schemas.indicator import (
            IndicatorMetadata, IndicatorDisplayType, ColorMode,
            SeriesMetadata, SeriesRole, LineStyle, DisplayType,
            ScaleRangesConfig, ReferenceLevel
        )
        return IndicatorMetadata(
            display_type=IndicatorDisplayType.PANE,
            color_mode=ColorMode.SINGLE,  # MVP: Single color mode
            color_schemes={"bullish": "#808080", "bearish": "#808080", "neutral": "#808080"},
            scale_ranges=ScaleRangesConfig(min=0, max=100, auto=False),
            series_metadata=[
                SeriesMetadata(
                    field="rsi",  # Must match calculate() output column - CRITICAL for data binding
                    role=SeriesRole.MAIN,
                    label="RSI",
                    line_color="#808080",
                    line_style=LineStyle.SOLID,
                    line_width=2,
                    display_type=DisplayType.LINE,
                )
            ],
            reference_levels=[
                ReferenceLevel(
                    value=30,
                    line_color="#b2ebf2",
                    line_label="30",
                    line_style=LineStyle.DASHED,
                ),
                ReferenceLevel(
                    value=70,
                    line_color="#ef5350",
                    line_label="70",
                    line_style=LineStyle.DASHED,
                ),
            ],
        )
```

**Key Implementation Points**:
1. `parameter_definitions` defines `"period"` (UI-facing parameter name)
2. `calculate()` accepts both `"period"` (UI) and `"length"` (pandas-ta) via `kwargs.get('period', kwargs.get('length', ...))`
3. `metadata.series_metadata[0].field` is `"rsi"` which matches the output column name
4. Backend JSON uses snake_case (`series_metadata`, `reference_levels`) to match frontend TypeScript interfaces

**Registration Changes Required**:
1. In `initialize_standard_indicators()`: Add `registry.register(RSIIndicator())`, etc.
2. In `deserialize_indicator_params()`: Add `"rsi": RSIIndicator` to `indicator_classes` mapping
3. Import new classes at top of `initialization.py`

## Dependencies & Assumptions

### Dependencies

- Existing Indicator Registry plugin system is functional and can register new indicators
- `app/services/indicator_registry/registry.py` - Indicator base class and registry
- `app/services/indicator_registry/initialization.py` - Registration and deserialization
- Frontend indicator picker can consume and display indicators from the supported indicators API
- Generic metadata-driven indicator rendering is working for existing indicators
- pandas-ta library is compatible with Python 3.11+ (to be added to requirements.txt)
- Candle data is available in the database with timestamps, open, high, low, close, volume

**API Endpoints** (Existing - to be verified during planning):
- `GET /api/v1/indicators/supported` - Returns `IndicatorRegistry.list_indicators_with_metadata()` results
- Indicator calculation endpoint (to be verified - likely via `/api/v1/indicators/` routes)

### Assumptions

- pandas-ta library uses standard calculation methods that match TradingView's implementations (calculations may differ slightly but should be functionally equivalent)
- Default indicator parameters (RSI 14, MACD 12/26/9, BBANDS 20/2, ATR 14) are acceptable for most users
- Indicator metadata (names, descriptions) can be in English only
- Indicator calculations are performed synchronously when requested (not pre-calculated or cached)
- Existing frontend parameter configuration UI can handle the 4 new indicators without modification (supports integer, float, and select parameter types)
- Warmup periods where indicators return null/NaN are acceptable behavior (standard for technical analysis)
- Indicator instance persistence (where added indicators are stored: database vs localStorage) will be determined during planning based on existing system architecture
- Indicator instances have stable identifiers for add/remove operations (to be verified during planning)

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| pandas-ta calculation results differ from TradingView, confusing users | High | Medium | Document calculation methodology, validate against known test cases |
| pandas-ta library has performance issues with large datasets | Medium | Low | Benchmark with 10,000+ candles, add caching if needed |
| Parameter validation is insufficient, causing crashes | Medium | Medium | Implement strict parameter validation with min/max bounds |
| Field name instability across pandas-ta versions breaks integration | High | Low | Create stable wrapper layer that maps pandas-ta outputs to fixed field names |
| Insufficient candle data produces all-null results | Low | High | Return clear error message when data is insufficient for calculation |
| Existing frontend metadata-driven UI does not support required parameter types | High | Medium | Verify parameter type support during planning; implement frontend changes if needed (adds to scope) |
| Indicator instance persistence mechanism unclear or requires backend changes | Medium | Medium | Determine persistence approach during planning; may require database schema changes |
| Existing indicator API endpoints differ from assumed contracts | High | Medium | Verify actual API contracts during planning; update integration layer accordingly |

---

**Next Steps**:

1. **Immediate**: Proceed to `/speckit.plan` to generate implementation plan for Phase 1 (cornerstone indicators)
2. **After Phase 1 Implementation**: User tests and approves the 4 indicators
3. **After User Approval**: Proceed to Phase 2 implementation (auto-expose 130+ indicators)

**Implementation Sequence**:
- Phase 1 tasks: Implement RSI, MACD, BBANDS, ATR indicators
- Approval Gate: User validates the 4 cornerstone indicators work correctly
- Phase 2 tasks: Auto-discover and expose remaining 130+ pandas-ta indicators

**Planning Note**: The task breakdown should be organized into two phases with a clear approval checkpoint between them.
