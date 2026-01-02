# Research: pandas-ta Indicator Pack

**Feature**: 010-pandas-ta-indicators
**Date**: 2025-12-28
**Status**: Complete

## Overview

This document consolidates research findings for implementing 4 pandas-ta indicators (RSI, MACD, BBANDS, ATR) through the existing Indicator Registry system.

## Research Task 1: pandas-ta API and Capabilities

### Decision: Use pandas-ta library v0.3.14b+

**Rationale**:
- pandas-ta is actively maintained with 130+ indicators
- Compatible with Python 3.11+ (verified from project requirements: pandas==2.1.4, numpy==1.26.2)
- Official package: `pip install pandas-ta` (latest stable: v0.3.14b)
- Tightly correlated with de facto TA Lib if indicators share common implementations
- Returns results in pandas Series/DataFrame format with Uppercase Underscore naming (e.g., "RSI_14", "BBANDS_20_2.0")

**Alternatives Considered**:
- TA-Lib: Requires C library installation, more complex setup
- Manual implementation: Higher maintenance burden, risk of calculation errors

**API Details** (from [official documentation](https://github.com/twopirllc/pandas-ta)):

#### RSI (Relative Strength Index)
```python
import pandas_ta as ta

# Function signature
ta.rsi(close, length=14, scalar=1, talib=None)

# Returns: Series with name like "RSI_14"
# Parameters:
#   - length: Period for calculation (default: 14)
#   - scalar: Multiplier (default: 1)
#   - talib: If True, uses TA-Lib version if installed (default: None)

# Example
rsi_result = ta.rsi(df['close'], length=14)
# Output: Series with index matching df, values 0-100
```

#### MACD (Moving Average Convergence Divergence)
```python
# Function signature
ta.macd(close, fast=12, slow=26, signal=9, talib=None, asmode=False)

# Returns: DataFrame with columns:
#   - "MACD_12_26_9" (MACD line)
#   - "MACDh_12_26_9" (Histogram)
#   - "MACDs_12_26_9" (Signal line)

# Parameters:
#   - fast: Fast period (default: 12)
#   - slow: Slow period (default: 26)
#   - signal: Signal period (default: 9)
#   - asmode: If True, enables AS version (default: False)

# Example
macd_result = ta.macd(df['close'], fast=12, slow=26, signal=9)
# Output: DataFrame with 3 columns named with parameter suffixes
```

#### BBANDS (Bollinger Bands)
```python
# Function signature
ta.bbands(close, length=20, std=2, mamode='sma', ddof=0, talib=None)

# Returns: DataFrame with columns:
#   - "BBL_20_2.0" (Lower Band)
#   - "BBM_20_2.0" (Middle Band - SMA)
#   - "BBU_20_2.0" (Upper Band)
#   - "BBB_20_2.0" (Band Width)
#   - "BBP_20_2.0" (Band Percent - optional)

# Parameters:
#   - length: Period (default: 20)
#   - std: Standard deviations (default: 2)
#   - mamode: Moving average mode (default: 'sma')
#   - ddof: Degrees of freedom (default: 0)

# Example
bbands_result = ta.bbands(df['close'], length=20, std=2)
# Output: DataFrame with 3-5 columns depending on parameters
```

#### ATR (Average True Range)
```python
# Function signature
ta.atr(high, low, close, length=14, mamode='rma', talib=None)

# Returns: Series with name like "ATR_14"

# Parameters:
#   - high: High price series
#   - low: Low price series
#   - close: Close price series
#   - length: Period (default: 14)
#   - mamode: Moving average mode (default: 'rma' - Welles Wilder's smoothing)
#   - talib: If True, uses TA-Lib version if installed (default: None)

# Example
atr_result = ta.atr(df['high'], df['low'], df['close'], length=14)
# Output: Series with index matching df
```

**Key Implementation Notes**:
- pandas-ta returns Series/DataFrame with **dynamic column names** that include parameters (e.g., "RSI_14", "MACD_12_26_9")
- We MUST map these dynamic names to **stable field names** for frontend binding (e.g., "rsi", "macd", "signal", "histogram")
- pandas-ta automatically handles NaN for warmup periods (first `length` bars)
- All functions accept pandas Series and return pandas structures

---

## Research Task 2: Existing Indicator Registry Integration Points

### Decision: Use existing Indicator base class and registration patterns

**Rationale**:
- Registry already provides all necessary abstractions
- Metadata-driven rendering is working for existing indicators (SMA, EMA, TDFI, cRSI, ADXVMA)
- Dynamic instantiation pattern is proven and stable

**Key Integration Points** (from `backend/app/services/indicator_registry/registry.py`):

#### 1. Indicator Base Class Structure

All pandas-ta indicators must extend the `Indicator` abstract base class:

```python
class Indicator(ABC):
    @property
    @abstractmethod
    def base_name(self) -> str:
        """Return base indicator name (e.g., 'sma', 'rsi')"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Return indicator description"""
        pass

    @property
    def parameter_definitions(self) -> Dict[str, ParameterDefinition]:
        """Return structured parameter definitions with type, default, min, max"""
        return {}  # Override in subclass

    @abstractmethod
    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        """Calculate indicator on DataFrame with OHLCV data"""
        pass

    @property
    @abstractmethod
    def metadata(self) -> IndicatorMetadata:
        """Return metadata for generic frontend rendering"""
        raise NotImplementedError(...)

    @property
    def alert_templates(self) -> List[AlertTemplate]:
        """Return alert condition templates (optional)"""
        return []
```

#### 2. Naming Conventions

The `name` property auto-generates unique names based on `base_name` and parameters:
- Default instances (no custom params): Use `base_name` only (e.g., "rsi")
- Parameterized instances: Append primary parameter (e.g., "rsi_50" for period=50)
- Primary parameters checked in order: `['period', 'length', 'lookback', 'window']`

```python
# Example from SMAIndicator
def __init__(self, period: int = _DEFAULT_PERIOD):
    self._period = period
    if period != self._DEFAULT_PERIOD:
        super().__init__(period=period)  # name becomes "sma_{period}"
    else:
        super().__init__()  # name becomes "sma"
```

#### 3. Parameter Definitions Pattern

Use `ParameterDefinition` schema from `app/schemas.indicator`:

```python
@property
def parameter_definitions(self) -> Dict[str, ParameterDefinition]:
    from app.schemas.indicator import ParameterDefinition
    return {
        "period": ParameterDefinition(
            type="integer",  # or "float", "string", "boolean"
            default=14,
            min=2,
            max=200,
            description="RSI period for calculation"
        )
    }
```

#### 4. Registration Flow (from `initialization.py`)

Two-step registration process:

**Step 1**: Register default variants in `initialize_standard_indicators()`:
```python
def initialize_standard_indicators() -> None:
    registry = get_registry()
    registry.register(RSIIndicator())      # "rsi" (default: 14)
    registry.register(RSIIndicator(50))     # "rsi_50" (custom variant)
```

**Step 2**: Add to `indicator_classes` mapping for dynamic instantiation:
```python
def deserialize_indicator_params(serialized: str) -> Indicator:
    indicator_classes = {
        "sma": SMAIndicator,
        "ema": EMAIndicator,
        "tdfi": TDFIIndicator,
        "crsi": cRSIIndicator,
        "adxvma": ADXVMAIndicator,
        # Add pandas-ta indicators here:
        "rsi": RSIIndicator,
        "macd": MACDIndicator,
        "bbands": BBANDSIndicator,
        "atr": ATRIndicator,
    }
    # ... creates instance from {base_name, parameters}
```

#### 5. Metadata Structure for Frontend Rendering

All indicators must provide `IndicatorMetadata` with:

```python
from app.schemas.indicator import (
    IndicatorMetadata, IndicatorDisplayType, ColorMode,
    SeriesMetadata, SeriesRole, LineStyle, DisplayType,
    ScaleRangesConfig, ReferenceLevel
)

return IndicatorMetadata(
    display_type=IndicatorDisplayType.PANE,  # or OVERLAY
    color_mode=ColorMode.SINGLE,  # or THRESHOLD, GRADIENT, TREND
    color_schemes={
        "bullish": "#00FF00",
        "bearish": "#ef5350",
        "neutral": "#808080"
    },
    scale_ranges=ScaleRangesConfig(min=0, max=100, auto=False),
    series_metadata=[
        SeriesMetadata(
            field="rsi",  # CRITICAL: Must match calculate() output column
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

**Critical Success Factor**: `series_metadata[].field` MUST exactly match the column name returned by `calculate()` method.

---

## Research Task 3: API Endpoint Contracts

### Decision: Use existing endpoints without modifications

**Rationale**:
- Endpoints already handle all requirements via registry pattern
- No changes needed to API layer for Phase 1
- Query parameter passing mechanism supports all parameter types

**Confirmed Endpoints** (from `backend/app/api/v1/indicators.py`):

#### GET /api/v1/indicators/supported

**Purpose**: List all available indicators with full metadata

**Implementation**: Calls `registry.list_indicators_with_metadata()`

**Response Format** (List):
```json
[
  {
    "name": "rsi",
    "description": "Relative Strength Index (period=14)",
    "display_type": "pane",
    "category": "oscillator",
    "parameters": {
      "period": {
        "type": "integer",
        "default": 14,
        "min": 2,
        "max": 200,
        "description": "RSI period for calculation"
      }
    },
    "metadata": {
      "display_type": "pane",
      "color_mode": "single",
      "color_schemes": {"bullish": "#808080", "bearish": "#808080", "neutral": "#808080"},
      "series_metadata": [...],
      "reference_levels": [...]
    },
    "alert_templates": [...]
  }
]
```

**No changes needed** - pandas-ta indicators will automatically appear once registered.

#### GET /api/v1/indicators/{symbol}/{indicatorName}

**Purpose**: Calculate and return indicator data

**URL Parameters**:
- `symbol`: Stock ticker (e.g., "AAPL")
- `indicatorName`: Indicator base name (e.g., "rsi", "macd")

**Query Parameters**:
- `interval`: Timeframe ("1m", "5m", "15m", "1h", "4h", "1d", "1wk")
- `limit`: Max data points (1-10000, default: 1000)
- Indicator-specific parameters (e.g., `period`, `fast`, `slow`, `signal`)

**Example Requests**:
```
GET /api/v1/indicators/AAPL/rsi?interval=1d&period=14
GET /api/v1/indicators/AAPL/macd?interval=1d&fast=12&slow=26&signal=9
GET /api/v1/indicators/AAPL/bbands?interval=1d&length=20&std=2
GET /api/v1/indicators/AAPL/atr?interval=1d&period=14
```

**Response Format** (IndicatorOutput):
```json
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
    "display_type": "pane",
    "color_mode": "single",
    "series_metadata": [...]
  },
  "calculated_at": "2025-12-28T10:30:00Z",
  "data_points": 252
}
```

**Key Implementation Details**:
1. **Parameter Mapping**: API endpoint maps query params to indicator kwargs
   - Example: `period` query param → `period` kwarg in `calculate(df, period=14)`
   - For cRSI: `dom_cycle` query param → `domcycle` kwarg (API uses snake_case)

2. **Parameter Validation** (lines 232-277):
   - Type validation: Converts to int/float if needed
   - Range validation: Checks min/max from `parameter_definitions`
   - Returns 400 error if validation fails

3. **Indicator Lookup** (lines 220-230):
   - First tries `registry.get(indicator_name)` for instance name
   - Falls back to `registry.get_by_base_name(indicator_name)` for base name
   - This allows dynamic parameter configuration

4. **Output Construction** (lines 284-309):
   - Calls `indicator.calculate(df, **indicator_params)`
   - Extracts all `series_metadata[].field` values from result DataFrame
   - Converts timestamps to Unix seconds (numeric, not strings)
   - Cleans NaN/Inf to `None` for JSON compatibility

**No changes needed** - existing endpoint logic handles pandas-ta indicators automatically.

---

## Research Task 4: Parameter Validation Patterns

### Decision: Follow existing validation implementation

**Rationale**:
- Validation logic is already proven and battle-tested
- Consistent error messages and behavior across all indicators

**Validation Implementation** (from `registry.py` lines 216-270):

#### 1. Instance Validation (in __init__)

```python
def __init__(self, **default_params):
    self._default_params = default_params
    if default_params:
        self.validate_params(default_params)  # Raise ValueError if invalid
```

**Example**: SMAIndicator validates period on instantiation:
```python
# If user creates SMAIndicator(period=1), raises ValueError:
# "Parameter 'period' must be >= 2, got 1"
```

#### 2. Request Validation (in API endpoint)

API endpoint validates query parameters before calculation (lines 232-277):

```python
# Get parameter definitions
param_defs = indicator.parameter_definitions

# Validate each parameter
for param_name, param_value in indicator_params.items():
    if param_name not in param_defs:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid parameter '{param_name}' for indicator '{indicator_name}'"
        )

    param_def = param_defs[param_name]

    # Type validation
    if param_def.type == "integer":
        if not isinstance(param_value, int):
            try:
                indicator_params[param_name] = int(param_value)
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=400,
                    detail=f"Parameter '{param_name}' must be an integer"
                )

    # Range validation
    if param_def.min is not None and indicator_params[param_name] < param_def.min:
        raise HTTPException(
            status_code=400,
            detail=f"Parameter '{param_name}' must be >= {param_def.min}"
        )
```

**Recommended Validation Rules for pandas-ta Indicators**:

| Indicator | Parameter | Type | Min | Max | Default | Rationale |
|-----------|-----------|------|-----|-----|---------|-----------|
| RSI | period | integer | 2 | 200 | 14 | Standard RSI range, prevent excessive computation |
| MACD | fast | integer | 2 | 200 | 12 | Fast period must be reasonable |
| MACD | slow | integer | 2 | 300 | 26 | Slow period > fast period (validated in calculate) |
| MACD | signal | integer | 2 | 100 | 9 | Signal period for MACD line smoothing |
| BBANDS | length | integer | 2 | 500 | 20 | Standard BBANDS period range |
| BBANDS | std | float | 0.1 | 5.0 | 2.0 | Standard deviation multiplier |
| ATR | period | integer | 2 | 200 | 14 | ATR lookback period |

**Error Message Format**:
- Invalid parameter name: `Invalid parameter 'foo' for indicator 'rsi'. Valid parameters: ['period']`
- Type mismatch: `Parameter 'period' must be an integer, got string`
- Out of range: `Parameter 'period' must be >= 2, got 1`

---

## Research Task 5: Testing Patterns for Indicators

### Decision: Follow existing test structure from test_indicator_registry.py

**Rationale**:
- Existing tests provide proven patterns for unit and integration testing
- Metadata validation tests ensure frontend compatibility
- Performance tests prevent regressions

**Test File Structure** (from `backend/tests/services/test_indicator_registry.py`):

#### 1. Metadata Validation Tests

```python
def test_all_indicators_have_metadata():
    """Test that all registered indicators have valid metadata."""
    registry = get_registry()
    for indicator_name, indicator in registry._indicators.items():
        # Check metadata property exists
        assert hasattr(indicator, 'metadata')

        # Validate structure
        validate_metadata_structure(indicator.metadata, indicator_name)

        # Test serialization for API response
        metadata_dict = indicator.metadata.model_dump()
        assert isinstance(metadata_dict, dict)
```

**Key validation checks**:
- `display_type` is "overlay" or "pane"
- `color_mode` is valid ("single", "threshold", "gradient", "trend")
- All hex colors are valid (`#[0-9A-Fa-f]{6}`)
- `series_metadata` is non-empty list
- All `series[].field` values are strings
- `scale_ranges.min < scale_ranges.max` for pane indicators
- `thresholds.high > thresholds.low` for threshold mode

#### 2. Calculation Field Alignment Tests

```python
def test_indicator_calculations_produce_expected_fields():
    """Test that indicator calculate() produces fields matching metadata."""
    df = pd.DataFrame({
        'open': np.linspace(100, 110, 100),
        'high': np.linspace(101, 111, 100),
        'low': np.linspace(99, 109, 100),
        'close': np.linspace(100.5, 110.5, 100),
        'volume': np.ones(100) * 1000
    })

    for indicator_name, indicator in registry._indicators.items():
        result = indicator.calculate(df)

        # Verify result is DataFrame
        assert isinstance(result, pd.DataFrame)

        # Check all series_metadata fields exist
        for series in indicator.metadata.series_metadata:
            assert series.field in result.columns, \
                f"Field '{series.field}' not in calculate() result"
```

**Critical for pandas-ta**: This test ensures we map pandas-ta's dynamic column names to stable field names correctly.

#### 3. Parameter Validation Tests

```python
def test_parameter_validation_rejects_out_of_bounds():
    """Test that parameter validation rejects out-of-bounds values."""
    # SMA period must be 2-500
    with pytest.raises(ValueError, match="must be >= 2"):
        SMAIndicator(period=1)

    with pytest.raises(ValueError, match="must be <= 500"):
        SMAIndicator(period=501)
```

#### 4. Performance Tests

```python
def test_name_generation_performance():
    """Test that name generation completes in under 10ms per 1000 registrations."""
    import time
    start_time = time.time()

    for i in range(1000):
        period = (i % 498) + 2  # Valid range
        indicator = SMAIndicator(period=period)
        _ = indicator.name

    elapsed_ms = (time.time() - start_time) * 1000
    assert elapsed_ms < 10000  # <10ms per registration
```

**Test Coverage Requirements for pandas-ta Indicators**:
1. Unit test for each indicator class (rsi, macd, bbands, atr)
2. Metadata validation test
3. Field alignment test (pandas-ta output → stable names)
4. Parameter validation test (min/max bounds)
5. Integration test via API endpoint
6. Performance benchmark for 1000 candles

---

## Research Task 6: Data Model Integration

### Decision: Use existing candle data format without changes

**Rationale**:
- Candle schema already provides all required OHLCV data
- UTC timezone normalization already implemented
- DataFrame format matches pandas-ta expectations

**Candle Data Model** (from `app/models/candle.py` and test fixtures):

```python
# Database schema
class Candle(Base):
    __tablename__ = "candles"
    id = Column(Integer, primary_key=True)
    symbol_id = Column(Integer, ForeignKey("symbols.id"))
    timestamp = Column(DateTime, nullable=False)  # UTC normalized
    interval = Column(String, nullable=False)
    open = Column(Numeric)
    high = Column(Numeric)
    low = Column(Numeric)
    close = Column(Numeric)
    volume = Column(BigInteger)
```

**DataFrame Format Expected by calculate()**:

From `test_data_poller.py` and API endpoint (line 211-214):
```python
# API creates DataFrame from candles
df = pd.DataFrame(candles_data)
df["timestamp"] = pd.to_datetime(df["timestamp"])
df = df.sort_values("timestamp")
df = df.drop_duplicates(subset=["timestamp"], keep="first")

# Required columns for pandas-ta indicators:
# - 'close' for RSI, MACD, BBANDS
# - 'high', 'low', 'close' for ATR
```

**Key Data Flow**:
1. API fetches candles from database (already UTC-normalized)
2. Creates pandas DataFrame with OHLCV columns
3. Calls `indicator.calculate(df, **params)`
4. pandas-ta functions consume the DataFrame
5. Returns DataFrame with original columns + indicator columns

**No database changes needed** - candles table already provides all data.

---

## Summary of Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Use pandas-ta v0.3.14b | Proven library, 130+ indicators, Python 3.11+ compatible | Add to requirements.txt |
| Dynamic instantiation model | Better UX, consistent with existing pattern | Add to `indicator_classes` mapping |
| Map dynamic column names to stable names | pandas-ta returns "RSI_14", need "rsi" for frontend | Manual mapping in calculate() |
| Parameter name mapping strategy | UI uses "period", pandas-ta uses "length" for some | Accept both names in calculate() |
| No API endpoint changes | Existing registry pattern handles everything | Zero frontend changes |
| No database changes | Candle schema already provides OHLCV | Use existing tables |

## Implementation Checklist

Based on research findings, implementation requires:

1. **Add dependency**: `pandas-ta` to requirements.txt
2. **Create indicator classes**: RSIIndicator, MACDIndicator, BBANDSIndicator, ATRIndicator
3. **Implement stable column mapping**: Map pandas-ta outputs to fixed field names
4. **Register indicators**: Add to `initialize_standard_indicators()` and `indicator_classes`
5. **Write tests**: Unit tests, metadata validation, field alignment, parameter validation
6. **Verify API integration**: Test endpoints return correct format

## Open Questions Resolved

1. **Q**: Do we need to modify API endpoints?
   **A**: No - existing endpoints use registry pattern, automatically support new indicators

2. **Q**: How do we handle pandas-ta's dynamic column names?
   **A**: Map to stable names in `calculate()` method (e.g., "RSI_14" → "rsi")

3. **Q**: What if pandas-ta parameters differ from UI conventions?
   **A**: Accept both names in `calculate()` using `kwargs.get('period', kwargs.get('length', ...))`

4. **Q**: Do we need database schema changes?
   **A**: No - candles table already provides all OHLCV data needed

5. **Q**: Will frontend need code changes?
   **A**: No - metadata-driven rendering automatically discovers new indicators

## Next Steps

Proceed to **Phase 1: Design & Contracts**:
1. Generate `data-model.md` with indicator entity definitions
2. Generate API contracts in `contracts/` directory
3. Generate `quickstart.md` with implementation examples
4. Update agent context (CLAUDE.md) with new dependency

---

**Sources**:
- [pandas-ta GitHub Repository](https://github.com/twopirllc/pandas-ta)
- [pandas-ta Official Documentation](https://github.com/twopirllc/pandas-ta)
- Existing codebase: `backend/app/services/indicator_registry/registry.py`
- Existing codebase: `backend/app/services/indicator_registry/initialization.py`
- Existing codebase: `backend/app/api/v1/indicators.py`
- Existing codebase: `backend/tests/services/test_indicator_registry.py`
