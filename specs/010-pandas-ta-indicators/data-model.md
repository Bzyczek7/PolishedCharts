# Data Model: pandas-ta Indicator Pack

**Feature**: 010-pandas-ta-indicators
**Date**: 2025-12-28
**Status**: Phase 1 Design

## Overview

This document defines the data model for integrating 4 pandas-ta indicators (RSI, MACD, BBANDS, ATR) with the existing Indicator Registry system. No new database tables are required - all data is ephemeral (calculated on-demand from existing candle data).

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Indicator Registry                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Indicator (Base Class)                                     ││
│  │  ├─ base_name: str                                          ││
│  │  ├─ name: str (auto-generated)                              ││
│  │  ├─ description: str                                        ││
│  │  ├─ category: str                                           ││
│  │  ├─ parameter_definitions: Dict[str, ParameterDefinition]  ││
│  │  ├─ calculate(df, **kwargs) -> DataFrame                    ││
│  │  ├─ metadata: IndicatorMetadata                             ││
│  │  └─ alert_templates: List[AlertTemplate]                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                            △                                      │
│          ┌─────────────────┼─────────────────┐                  │
│          │                 │                 │                  │
│  ┌───────┴───────┐ ┌───────┴───────┐ ┌──────┴───────┐         │
│  │ RSIIndicator  │ │ MACDIndicator │ │BBANDSIndicator│ ...     │
│  │ _period: int  │ │ _fast: int    │ │ _length: int  │         │
│  │               │ │ _slow: int    │ │ _std: float   │         │
│  └───────────────┘ └───────────────┘ └───────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ calculates on-demand
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Candle Data (Existing)                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Candle (Database Table)                                    ││
│  │  ├─ symbol_id: int                                          ││
│  │  ├─ timestamp: datetime (UTC)                               ││
│  │  ├─ interval: str                                           ││
│  │  ├─ open: Decimal                                           ││
│  │  ├─ high: Decimal                                           ││
│  │  ├─ low: Decimal                                            ││
│  │  ├─ close: Decimal                                          ││
│  │  └─ volume: BigInteger                                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ pandas DataFrame input
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Indicator Output (API Response)                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  IndicatorOutput (Pydantic Model)                            ││
│  │  ├─ symbol: str                                             ││
│  │  ├─ interval: str                                           ││
│  │  ├─ timestamps: List[int] (Unix seconds)                    ││
│  │  ├─ data: Dict[str, List[Optional[float]]]                  ││
│  │  │   ├─ "rsi": [45.2, 46.1, ...]                           ││
│  │  │   ├─ "macd": [1.2, 1.5, ...]                            ││
│  │  │   ├─ "signal": [1.1, 1.3, ...]                          ││
│  │  │   └─ "histogram": [0.1, 0.2, ...]                       ││
│  │  ├─ metadata: IndicatorMetadata                              ││
│  │  ├─ calculated_at: datetime                                  ││
│  │  └─ data_points: int                                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 1. Indicator Metadata Structure

### 1.1 IndicatorMetadata Schema

**Location**: `backend/app/schemas/indicator.py`

**Purpose**: Defines how indicator renders in the frontend (generic metadata-driven rendering).

```python
class IndicatorMetadata(BaseModel):
    """Configuration for rendering an indicator."""
    display_type: IndicatorDisplayType  # "overlay" or "pane"
    color_mode: ColorMode               # "single", "threshold", "gradient", "trend"
    color_schemes: Dict[str, str]       # State -> hex color mapping
    thresholds: Optional[ThresholdsConfig]  # For threshold-based coloring
    scale_ranges: Optional[ScaleRangesConfig]  # Y-axis bounds for pane
    series_metadata: List[SeriesMetadata]  # One per visual series
    reference_levels: Optional[List[ReferenceLevel]]  # Horizontal lines
```

**Field Descriptions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `display_type` | Enum | Yes | "overlay": draws on price chart; "pane": creates separate pane |
| `color_mode` | Enum | Yes | "single": one color; "threshold": color based on value ranges; "gradient": color gradient; "trend": color based on trend direction |
| `color_schemes` | Dict | Yes | Mapping from state name to hex color (e.g., {"bullish": "#00FF00", "bearish": "#ef5350", "neutral": "#808080"}) |
| `thresholds` | Object | No | Threshold values for threshold-based coloring (required if color_mode="threshold") |
| `scale_ranges` | Object | Conditional | Y-axis min/max for pane indicators (required if display_type="pane") |
| `series_metadata` | List | Yes | Metadata for each visual series (main line, bands, signals, histograms) |
| `reference_levels` | List | No | Horizontal reference lines with labels (e.g., 30/70 for RSI) |

### 1.2 SeriesMetadata Schema

```python
class SeriesMetadata(BaseModel):
    """Metadata for a single visual series (line, histogram, band)."""
    field: str                    # Data field name in indicator output
    role: SeriesRole              # "main", "signal", "band", "histogram"
    label: str                    # Human-readable name for legend
    line_color: str               # Hex color code (#[0-9A-Fa-f]{6})
    line_style: LineStyle         # "solid", "dashed", "dotted"
    line_width: int               # 1-5 pixels
    display_type: DisplayType     # "line", "histogram", "area"
```

**Field Naming Convention**:

- `field` is the **critical binding** between backend and frontend
- Must exactly match the DataFrame column name returned by `calculate()`
- Must be stable (not dynamic like pandas-ta's "RSI_14")

**Example for RSI**:
```python
series_metadata=[
    SeriesMetadata(
        field="rsi",  # Matches calculate() output column
        role=SeriesRole.MAIN,
        label="RSI",
        line_color="#808080",
        line_style=LineStyle.SOLID,
        line_width=2,
        display_type=DisplayType.LINE,
    )
]
```

**Example for MACD** (multi-series):
```python
series_metadata=[
    SeriesMetadata(field="macd", role=SeriesRole.MAIN, label="MACD", ...),
    SeriesMetadata(field="signal", role=SeriesRole.SIGNAL, label="Signal", ...),
    SeriesMetadata(field="histogram", role=SeriesRole.HISTOGRAM, label="Histogram", ...),
]
```

### 1.3 ParameterDefinition Schema

```python
class ParameterDefinition(BaseModel):
    """Definition for an indicator parameter."""
    type: Literal["integer", "float", "string", "boolean"]
    default: Any
    min: Optional[float]
    max: Optional[float]
    description: str
```

**Parameter Type Mapping**:

| UI Type | Python Type | Validation |
|---------|-------------|------------|
| "integer" | int | Must be whole number, within min/max |
| "float" | float | Can be decimal, within min/max |
| "string" | str | No range validation |
| "boolean" | bool | Must be True/False |

**Example**:
```python
parameter_definitions={
    "period": ParameterDefinition(
        type="integer",
        default=14,
        min=2,
        max=200,
        description="RSI period for calculation"
    )
}
```

## 2. Indicator Output Format

### 2.1 IndicatorOutput Schema

**Location**: `backend/app/schemas/indicator.py`

```python
class IndicatorOutput(BaseModel):
    """Indicator calculation result with metadata for rendering."""
    symbol: str                              # Stock ticker
    interval: str                            # Candle interval
    timestamps: List[int]                    # Unix seconds (numeric)
    data: Dict[str, List[Optional[float]]]   # Field name -> array of values
    metadata: IndicatorMetadata              # Rendering configuration
    calculated_at: datetime                  # When calculation was performed
    data_points: int                         # Number of data points returned
```

### 2.2 Output Format Requirements

**Canonical Format** (Option A - matches metadata-driven renderer):

```json
{
  "symbol": "AAPL",
  "interval": "1d",
  "timestamps": [1609459200, 1609545600, ...],
  "data": {
    "rsi": [45.2, 46.1, ...],           // Single-series indicator (RSI)
    "macd": [1.2, 1.5, ...],            // Multi-series indicator (MACD line)
    "signal": [1.1, 1.3, ...],          // Signal line
    "histogram": [0.1, 0.2, ...],       // Histogram
    "upper": [112.5, 113.2, ...],       // Bollinger Upper Band
    "middle": [110.0, 110.5, ...],      // Bollinger Middle Band
    "lower": [107.5, 108.2, ...],       // Bollinger Lower Band
    "atr": [2.5, 2.6, ...]              // ATR
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

**Critical Requirements**:

1. **Timestamps**: Numeric Unix seconds (milliseconds / 1000), **not ISO strings**
2. **Data Keys**: Must exactly match `metadata.series_metadata[].field` values
3. **Array Alignment**: All data arrays must have same length as `timestamps` array
4. **Null Values**: `null` (None in Python) for insufficient data (warmup periods)
5. **Field Naming**: Backend uses snake_case (`series_metadata`, `reference_levels`) to match frontend TypeScript interfaces

### 2.3 Field Name Stability

**Problem**: pandas-ta returns dynamic column names (e.g., "RSI_14", "MACD_12_26_9")

**Solution**: Map to stable names in `calculate()` method

**Mapping Table**:

| Indicator | pandas-ta Column | Stable Field Name |
|-----------|------------------|-------------------|
| RSI | "RSI_14" | "rsi" |
| MACD (line) | "MACD_12_26_9" | "macd" |
| MACD (signal) | "MACDs_12_26_9" | "signal" |
| MACD (histogram) | "MACDh_12_26_9" | "histogram" |
| BBANDS (lower) | "BBL_20_2.0" | "lower" |
| BBANDS (middle) | "BBM_20_2.0" | "middle" |
| BBANDS (upper) | "BBU_20_2.0" | "upper" |
| ATR | "ATR_14" | "atr" |

**Implementation Pattern**:
```python
def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
    import pandas_ta as ta

    # Call pandas-ta (returns Series with dynamic name)
    result = ta.rsi(df['close'], length=14)

    # Map to stable field name
    df_copy = df.copy()
    df_copy['rsi'] = result  # Stable name (matches metadata.series_metadata[0].field)

    return df_copy
```

## 3. Parameter Mapping

### 3.1 UI-Facing vs pandas-ta Parameter Names

**Challenge**: UI parameter names may differ from pandas-ta function parameter names.

**Solution**: `calculate()` method accepts both names and maps appropriately.

**Mapping Table**:

| Indicator | UI Parameter | pandas-ta Parameter | Implementation |
|-----------|--------------|---------------------|----------------|
| RSI | `period` | `length` | `period = kwargs.get('period', kwargs.get('length', self._period))` |
| MACD | `fast` | `fast` | Use directly (match) |
| MACD | `slow` | `slow` | Use directly (match) |
| MACD | `signal` | `signal` | Use directly (match) |
| BBANDS | `length` | `length` | Use directly (match) |
| BBANDS | `std` | `std` | Use directly (match) |
| ATR | `period` | `length` | `period = kwargs.get('period', kwargs.get('length', self._period))` |

### 3.2 Parameter Definition Consistency

**Contract**: Each indicator's `parameter_definitions` property defines the UI-facing parameter name. The `calculate()` method MUST accept that name.

**Example for RSI**:
```python
@property
def parameter_definitions(self) -> Dict[str, ParameterDefinition]:
    # Defines UI-facing name as "period"
    return {
        "period": ParameterDefinition(
            type="integer",
            default=14,
            min=2,
            max=200,
            description="RSI period for calculation"
        )
    }

def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
    # Accepts UI name "period" and maps to pandas-ta name "length"
    period = kwargs.get('period', kwargs.get('length', self._period))

    # Call pandas-ta with "length" parameter
    result = ta.rsi(df['close'], length=period)

    df_copy = df.copy()
    df_copy['rsi'] = result
    return df_copy
```

**This ensures**:
- Settings UI sends `period=14` (as defined in `parameter_definitions`)
- Backend accepts both `period` (UI) and `length` (pandas-ta)
- pandas-ta receives correct parameter name
- Field name matches `metadata.series_metadata[0].field`

## 4. Registry Integration

### 4.1 Indicator Base Class Interface

**Required Properties**:
```python
class Indicator(ABC):
    @property
    @abstractmethod
    def base_name(self) -> str:
        """Base indicator name (e.g., 'rsi', 'macd')"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable description"""
        pass

    @property
    def category(self) -> str:
        """Indicator category: 'overlay', 'oscillator', 'momentum', 'trend', 'volatility'"""
        pass

    @property
    def parameter_definitions(self) -> Dict[str, ParameterDefinition]:
        """Structured parameter definitions with type, default, min, max"""
        return {}

    @abstractmethod
    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        """Calculate indicator on DataFrame with OHLCV data"""
        pass

    @property
    @abstractmethod
    def metadata(self) -> IndicatorMetadata:
        """Rendering configuration for generic frontend"""
        raise NotImplementedError(...)

    @property
    def alert_templates(self) -> List[AlertTemplate]:
        """Alert condition templates (optional)"""
        return []
```

### 4.2 Registration Flow

**Step 1**: Create indicator class
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
    # ... implement other properties
```

**Step 2**: Register default variants in `initialize_standard_indicators()`
```python
def initialize_standard_indicators() -> None:
    registry = get_registry()
    registry.register(RSIIndicator())      # "rsi" (default: 14)
    registry.register(RSIIndicator(50))     # "rsi_50" (variant)
```

**Step 3**: Add to `indicator_classes` mapping for dynamic instantiation
```python
def deserialize_indicator_params(serialized: str) -> Indicator:
    indicator_classes = {
        # ... existing indicators
        "rsi": RSIIndicator,
        "macd": MACDIndicator,
        "bbands": BBANDSIndicator,
        "atr": ATRIndicator,
    }
    # Creates instance from {base_name, parameters}
```

### 4.3 Name Generation Logic

**Rules**:
1. Default instances (no custom params): Return `base_name` only
   - `RSIIndicator()` → "rsi"
2. Parameterized instances: Append primary parameter value
   - `RSIIndicator(50)` → "rsi_50"
3. Primary parameters (checked in order): `period`, `length`, `lookback`, `window`
4. Multi-parameter indicators: Concatenate all non-default values
   - `MACDIndicator(fast=8, slow=21)` → "macd_8_21"

**Implementation** (from `registry.py`):
```python
@property
def name(self) -> str:
    if not self._default_params:
        return self.base_name

    # Check for primary length parameter
    length_params = ['period', 'length', 'lookback', 'window']
    for param in length_params:
        if param in self._default_params:
            return f"{self.base_name}_{self._default_params[param]}"

    # Fallback: concatenate all parameters
    param_str = "_".join(str(v) for v in self._default_params.values())
    return f"{self.base_name}_{param_str}"
```

## 5. Candle Data Integration

### 5.1 Candle Data Schema

**No new tables required** - use existing `candles` table.

```python
class Candle(Base):
    __tablename__ = "candles"
    id = Column(Integer, primary_key=True)
    symbol_id = Column(Integer, ForeignKey("symbols.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False)  # UTC normalized
    interval = Column(String(10), nullable=False)  # "1m", "5m", "1h", "1d", etc.
    open = Column(Numeric(20, 6), nullable=False)
    high = Column(Numeric(20, 6), nullable=False)
    low = Column(Numeric(20, 6), nullable=False)
    close = Column(Numeric(20, 6), nullable=False)
    volume = Column(BigInteger, nullable=False)
```

### 5.2 DataFrame Format

**API creates DataFrame from candles**:
```python
# From app/api/v1/indicators.py lines 211-214
df = pd.DataFrame(candles_data)
df["timestamp"] = pd.to_datetime(df["timestamp"])
df = df.sort_values("timestamp")
df = df.drop_duplicates(subset=["timestamp"], keep="first")
```

**Required columns for pandas-ta indicators**:
- RSI, MACD, BBANDS: `close`
- ATR: `high`, `low`, `close`

**Data types**:
- `timestamp`: datetime64[ns] (UTC)
- `open`, `high`, `low`, `close`: float64
- `volume`: int64

### 5.3 Data Flow

```
Database (candles table)
        │
        ▼
API fetches candles (SELECT * FROM candles WHERE symbol=? AND interval=?)
        │
        ▼
pandas DataFrame creation
        │
        ▼
indicator.calculate(df, **params)
        │
        ▼
pandas-ta library calculation
        │
        ▼
DataFrame with original + indicator columns
        │
        ▼
Extract indicator columns (map dynamic names to stable names)
        │
        ▼
Construct IndicatorOutput (timestamps, data, metadata)
        │
        ▼
Return JSON to frontend
```

## 6. Validation Rules

### 6.1 Parameter Validation

**Instance Validation** (in `__init__`):
```python
def __init__(self, period: int = 14):
    if period < 2 or period > 200:
        raise ValueError(f"Parameter 'period' must be between 2 and 200, got {period}")
    self._period = period
```

**Request Validation** (in API endpoint):
- Type checking: Convert to int/float if needed
- Range checking: Enforce min/max from `parameter_definitions`
- Error response: 400 status with descriptive message

### 6.2 Output Validation

**Array Alignment**:
```python
@field_validator('data')
@classmethod
def data_arrays_must_match_timestamps(cls, v, info):
    """Ensure all data arrays have same length as timestamps."""
    if 'timestamps' in info.data:
        expected_len = len(info.data['timestamps'])
        for field, values in v.items():
            if len(values) != expected_len:
                raise ValueError(
                    f"Data array '{field}' has length {len(values)} "
                    f"but timestamps has length {expected_len}"
                )
    return v
```

**Hex Color Validation**:
```python
def validate_hex_color(color: str) -> bool:
    if not color.startswith('#'):
        return False
    if len(color[1:]) != 6:
        return False
    try:
        int(color[1:], 16)
        return True
    except ValueError:
        return False
```

## 7. Edge Case Handling

### 7.1 Insufficient Data

**Scenario**: User requests RSI(14) but only has 5 candles.

**Behavior**: pandas-ta returns NaN for first `length` bars. API converts NaN to `null` in JSON.

**Example**:
```python
# 5 candles, RSI(14)
timestamps: [1, 2, 3, 4, 5]
data: {"rsi": [null, null, null, null, null]}  # All null (insufficient data)
```

### 7.2 Flat Prices (No Volatility)

**Scenario**: All candle prices are identical (no volatility).

**Behavior**: pandas-ta returns 0 or constant values for volatility indicators.

**Example**:
```python
# All close prices = 100.0
atr: [0.0, 0.0, 0.0, ...]  # Zero volatility
```

### 7.3 Parameter Edge Cases

**Scenario**: User provides `fast=26, slow=12` for MACD (slow < fast).

**Behavior**: Validate in `calculate()` and raise ValueError:
```python
if fast >= slow:
    raise ValueError(f"MACD fast period ({fast}) must be less than slow period ({slow})")
```

### 7.4 Gaps in Candle Data

**Scenario**: Missing timestamps (weekends, holidays).

**Behavior**: pandas-ta handles gaps automatically (no special handling needed). DataFrame timestamps may have gaps, but indicator calculation uses the provided data as-is.

## 8. Performance Considerations

### 8.1 Calculation Performance

**Requirement**: SC-002 specifies 2 second calculation time for 1000 candles.

**Expected Performance**:
- RSI: ~5-10ms for 1000 candles (simple moving average calculation)
- MACD: ~10-20ms for 1000 candles (multiple EMAs)
- BBANDS: ~10-20ms for 1000 candles (SMA + standard deviation)
- ATR: ~5-10ms for 1000 candles (simple range calculation)

**Optimization**: pandas-ta uses vectorized numpy operations under the hood, which are already optimized.

### 8.2 Memory Usage

**Per-calculation memory footprint**:
- Input DataFrame: 1000 candles × 6 columns × 8 bytes ≈ 48 KB
- Output DataFrame: Additional 1-4 columns × 1000 rows × 8 bytes ≈ 8-32 KB
- Total: ~100 KB per calculation (ephemeral, garbage collected after response)

**No persistent memory overhead** - calculations are on-demand and response is sent immediately.

## 9. Testing Requirements

### 9.1 Unit Tests

For each indicator (RSI, MACD, BBANDS, ATR):
```python
def test_<indicator>_default_name():
    """Test default instance name matches base_name"""
    indicator = <Indicator>Indicator()
    assert indicator.name == "<base>"

def test_<indicator>_parameterized_name():
    """Test parameterized instance name includes parameter"""
    indicator = <Indicator>Indicator(<param>=50)
    assert indicator.name == "<base>_50"

def test_<indicator>_calculation_returns_dataframe():
    """Test calculate() returns DataFrame with expected columns"""
    df = create_test_dataframe()
    result = indicator.calculate(df)
    assert isinstance(result, pd.DataFrame)
    assert "<field>" in result.columns

def test_<indicator>_metadata_valid():
    """Test metadata structure is valid"""
    validate_metadata_structure(indicator.metadata)
```

### 9.2 Integration Tests

```python
def test_<indicator>_api_returns_valid_format():
    """Test GET /indicators/{symbol}/{indicator} returns valid IndicatorOutput"""
    response = client.get("/api/v1/indicators/AAPL/rsi?interval=1d&period=14")
    assert response.status_code == 200
    data = response.json()
    assert "timestamps" in data
    assert "data" in data
    assert "metadata" in data
    assert len(data["timestamps"]) == len(data["data"]["rsi"])

def test_<indicator>_parameter_validation():
    """Test API validates parameter ranges"""
    response = client.get("/api/v1/indicators/AAPL/rsi?interval=1d&period=1")
    assert response.status_code == 400
    assert "must be >= 2" in response.json()["detail"]
```

### 9.3 Performance Tests

```python
def test_<indicator>_calculation_performance():
    """Test calculation completes within 2 seconds for 1000 candles"""
    df = create_test_dataframe(n=1000)
    start = time.time()
    result = indicator.calculate(df)
    elapsed = time.time() - start
    assert elapsed < 2.0, f"Calculation too slow: {elapsed:.2f}s"
```

## Summary

This data model defines:

1. **No new database tables** - All indicators calculated on-demand from existing candles
2. **Stable field names** - Map pandas-ta's dynamic names to fixed names
3. **Parameter name consistency** - UI-facing names in `parameter_definitions`, mapped in `calculate()`
4. **Metadata-driven rendering** - Frontend auto-discovers and renders indicators
5. **Array alignment requirement** - All data arrays match timestamps array length
6. **Comprehensive validation** - Parameter ranges, output format, metadata structure

**Next Step**: Generate API contracts in `contracts/` directory.
