# Quickstart Guide: pandas-ta Indicator Pack Implementation

**Feature**: 010-pandas-ta-indicators
**Date**: 2025-12-28
**Status**: Phase 1 Design

This guide provides step-by-step instructions for implementing the 4 pandas-ta indicators (RSI, MACD, BBANDS, ATR) in the TradingAlert backend.

## Prerequisites

- Python 3.11+ installed
- Virtual environment activated
- Project dependencies installed: `pip install -r requirements.txt`

## Step 1: Add pandas-ta Dependency

**File**: `backend/requirements.txt`

Add to the end of the file:
```text
pandas-ta>=0.3.14b0
```

**Install the dependency**:
```bash
cd backend
pip install pandas-ta
```

**Verify installation**:
```python
import pandas_ta as ta
print(ta.__version__)  # Should print 0.3.14b or later
```

## Step 2: Create Indicator Classes

**File**: `backend/app/services/indicator_registry/registry.py`

Add the following indicator classes at the end of the file (before `IndicatorRegistry` class):

### 2.1 RSI Indicator

```python
class RSIIndicator(Indicator):
    """Relative Strength Index indicator using pandas-ta."""

    _DEFAULT_PERIOD = 14

    def __init__(self, period: int = _DEFAULT_PERIOD):
        """Initialize RSI with optional period override.

        Args:
            period: The number of periods for the RSI calculation (default: 14)

        Raises:
            ValueError: If period is out of valid range (2-200)
        """
        # Validate parameters
        if period < 2 or period > 200:
            raise ValueError(f"RSI period must be between 2 and 200, got {period}")

        self._period = period
        # Only pass to parent if different from default (for name generation)
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
    def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
        """Return structured parameter definitions for RSI."""
        from app.schemas.indicator import ParameterDefinition
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
        """Calculate RSI using pandas-ta.

        Args:
            df: DataFrame with OHLCV data (must have 'close' column)
            **kwargs: Indicator parameters (e.g., period=14)

        Returns:
            DataFrame with original columns plus 'rsi' column

        Note:
            Accepts UI parameter name 'period' and maps to pandas-ta's 'length' parameter.
        """
        import pandas_ta as ta

        # Accept UI parameter name 'period' and map to pandas-ta's 'length'
        period = kwargs.get('period', kwargs.get('length', self._period))

        # pandas_ta returns Series with dynamic name like "RSI_14"
        result = ta.rsi(df['close'], length=period)

        # Map to stable field name
        df_copy = df.copy()
        df_copy['rsi'] = result  # Stable name (matches metadata.series_metadata[0].field)

        return df_copy

    @property
    def metadata(self) -> IndicatorMetadata:
        """Return metadata for generic frontend rendering."""
        from app.schemas.indicator import (
            IndicatorMetadata,
            IndicatorDisplayType,
            ColorMode,
            SeriesMetadata,
            SeriesRole,
            LineStyle,
            DisplayType,
            ScaleRangesConfig,
            ReferenceLevel,
        )

        return IndicatorMetadata(
            display_type=IndicatorDisplayType.PANE,
            color_mode=ColorMode.SINGLE,
            color_schemes={
                "bullish": "#808080",
                "bearish": "#808080",
                "neutral": "#808080",
            },
            scale_ranges=ScaleRangesConfig(min=0, max=100, auto=False),
            series_metadata=[
                SeriesMetadata(
                    field="rsi",  # Must match calculate() output column
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

### 2.2 MACD Indicator

```python
class MACDIndicator(Indicator):
    """Moving Average Convergence Divergence indicator using pandas-ta."""

    _DEFAULT_FAST = 12
    _DEFAULT_SLOW = 26
    _DEFAULT_SIGNAL = 9

    def __init__(self, fast: int = _DEFAULT_FAST, slow: int = _DEFAULT_SLOW, signal: int = _DEFAULT_SIGNAL):
        """Initialize MACD with optional parameter overrides.

        Args:
            fast: Fast period for MACD (default: 12)
            slow: Slow period for MACD (default: 26)
            signal: Signal period for MACD (default: 9)

        Raises:
            ValueError: If parameters are out of valid ranges or fast >= slow
        """
        # Validate parameters
        if fast < 2 or fast > 200:
            raise ValueError(f"MACD fast period must be between 2 and 200, got {fast}")
        if slow < 2 or slow > 300:
            raise ValueError(f"MACD slow period must be between 2 and 300, got {slow}")
        if signal < 2 or signal > 100:
            raise ValueError(f"MACD signal period must be between 2 and 100, got {signal}")
        if fast >= slow:
            raise ValueError(f"MACD fast period ({fast}) must be less than slow period ({slow})")

        self._fast = fast
        self._slow = slow
        self._signal = signal

        # Only pass non-default params to parent (for name generation)
        params = {}
        if fast != self._DEFAULT_FAST:
            params['fast'] = fast
        if slow != self._DEFAULT_SLOW:
            params['slow'] = slow
        if signal != self._DEFAULT_SIGNAL:
            params['signal'] = signal

        if params:
            super().__init__(**params)
        else:
            super().__init__()

    @property
    def base_name(self) -> str:
        return "macd"

    @property
    def description(self) -> str:
        return f"Moving Average Convergence Divergence (fast={self._fast}, slow={self._slow}, signal={self._signal})"

    @property
    def category(self) -> str:
        return "momentum"

    @property
    def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
        """Return structured parameter definitions for MACD."""
        from app.schemas.indicator import ParameterDefinition
        return {
            "fast": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_FAST,
                min=2,
                max=200,
                description="Fast period for MACD"
            ),
            "slow": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_SLOW,
                min=2,
                max=300,
                description="Slow period for MACD"
            ),
            "signal": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_SIGNAL,
                min=2,
                max=100,
                description="Signal period for MACD"
            )
        }

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        """Calculate MACD using pandas-ta.

        Args:
            df: DataFrame with OHLCV data (must have 'close' column)
            **kwargs: Indicator parameters (e.g., fast=12, slow=26, signal=9)

        Returns:
            DataFrame with original columns plus 'macd', 'signal', 'histogram' columns
        """
        import pandas_ta as ta

        fast = kwargs.get('fast', self._fast)
        slow = kwargs.get('slow', self._slow)
        signal = kwargs.get('signal', self._signal)

        # pandas_ta returns DataFrame with columns like "MACD_12_26_9", "MACDs_12_26_9", "MACDh_12_26_9"
        result = ta.macd(df['close'], fast=fast, slow=slow, signal=signal)

        # Map to stable field names
        df_copy = df.copy()
        df_copy['macd'] = result.iloc[:, 0]      # MACD line
        df_copy['signal'] = result.iloc[:, 2]    # Signal line
        df_copy['histogram'] = result.iloc[:, 1]  # Histogram

        return df_copy

    @property
    def metadata(self) -> IndicatorMetadata:
        """Return metadata for generic frontend rendering."""
        from app.schemas.indicator import (
            IndicatorMetadata,
            IndicatorDisplayType,
            ColorMode,
            SeriesMetadata,
            SeriesRole,
            LineStyle,
            DisplayType,
            ScaleRangesConfig,
        )

        return IndicatorMetadata(
            display_type=IndicatorDisplayType.PANE,
            color_mode=ColorMode.SINGLE,
            color_schemes={
                "bullish": "#00bcd4",
                "bearish": "#00bcd4",
                "neutral": "#00bcd4",
            },
            scale_ranges=ScaleRangesConfig(min=-100, max=100, auto=True),
            series_metadata=[
                SeriesMetadata(
                    field="macd",
                    role=SeriesRole.MAIN,
                    label="MACD",
                    line_color="#00bcd4",
                    line_style=LineStyle.SOLID,
                    line_width=2,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="signal",
                    role=SeriesRole.SIGNAL,
                    label="Signal",
                    line_color="#ff9800",
                    line_style=LineStyle.SOLID,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="histogram",
                    role=SeriesRole.HISTOGRAM,
                    label="Histogram",
                    line_color="#808080",
                    line_style=LineStyle.SOLID,
                    line_width=2,
                    display_type=DisplayType.HISTOGRAM,
                ),
            ],
        )
```

### 2.3 BBANDS Indicator

```python
class BBANDSIndicator(Indicator):
    """Bollinger Bands indicator using pandas-ta."""

    _DEFAULT_LENGTH = 20
    _DEFAULT_STD = 2.0

    def __init__(self, length: int = _DEFAULT_LENGTH, std: float = _DEFAULT_STD):
        """Initialize BBANDS with optional parameter overrides.

        Args:
            length: Period for BBANDS (default: 20)
            std: Standard deviations (default: 2.0)

        Raises:
            ValueError: If parameters are out of valid ranges
        """
        # Validate parameters
        if length < 2 or length > 500:
            raise ValueError(f"BBANDS length must be between 2 and 500, got {length}")
        if std < 0.1 or std > 5.0:
            raise ValueError(f"BBANDS std must be between 0.1 and 5.0, got {std}")

        self._length = length
        self._std = std

        # Only pass non-default params to parent (for name generation)
        params = {}
        if length != self._DEFAULT_LENGTH:
            params['length'] = length
        if std != self._DEFAULT_STD:
            params['std'] = std

        if params:
            super().__init__(**params)
        else:
            super().__init__()

    @property
    def base_name(self) -> str:
        return "bbands"

    @property
    def description(self) -> str:
        return f"Bollinger Bands (length={self._length}, std={self._std})"

    @property
    def category(self) -> str:
        return "volatility"

    @property
    def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
        """Return structured parameter definitions for BBANDS."""
        from app.schemas.indicator import ParameterDefinition
        return {
            "length": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_LENGTH,
                min=2,
                max=500,
                description="BBANDS period"
            ),
            "std": ParameterDefinition(
                type="float",
                default=self._DEFAULT_STD,
                min=0.1,
                max=5.0,
                description="Standard deviations"
            )
        }

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        """Calculate BBANDS using pandas-ta.

        Args:
            df: DataFrame with OHLCV data (must have 'close' column)
            **kwargs: Indicator parameters (e.g., length=20, std=2.0)

        Returns:
            DataFrame with original columns plus 'lower', 'middle', 'upper' columns
        """
        import pandas_ta as ta

        length = kwargs.get('length', self._length)
        std = kwargs.get('std', self._std)

        # pandas_ta returns DataFrame with columns like "BBL_20_2.0", "BBM_20_2.0", "BBU_20_2.0"
        result = ta.bbands(df['close'], length=length, std=std)

        # Map to stable field names
        df_copy = df.copy()
        df_copy['lower'] = result.iloc[:, 0]   # Lower Band
        df_copy['middle'] = result.iloc[:, 1]  # Middle Band (SMA)
        df_copy['upper'] = result.iloc[:, 2]   # Upper Band

        return df_copy

    @property
    def metadata(self) -> IndicatorMetadata:
        """Return metadata for generic frontend rendering."""
        from app.schemas.indicator import (
            IndicatorMetadata,
            IndicatorDisplayType,
            ColorMode,
            SeriesMetadata,
            SeriesRole,
            LineStyle,
            DisplayType,
        )

        return IndicatorMetadata(
            display_type=IndicatorDisplayType.OVERLAY,
            color_mode=ColorMode.SINGLE,
            color_schemes={
                "bullish": "#2962ff",
                "bearish": "#2962ff",
                "neutral": "#2962ff",
            },
            series_metadata=[
                SeriesMetadata(
                    field="upper",
                    role=SeriesRole.BAND,
                    label="Upper Band",
                    line_color="#2962ff",
                    line_style=LineStyle.SOLID,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="middle",
                    role=SeriesRole.BAND,
                    label="Middle Band",
                    line_color="#808080",
                    line_style=LineStyle.DASHED,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="lower",
                    role=SeriesRole.BAND,
                    label="Lower Band",
                    line_color="#2962ff",
                    line_style=LineStyle.SOLID,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
            ],
        )
```

### 2.4 ATR Indicator

```python
class ATRIndicator(Indicator):
    """Average True Range indicator using pandas-ta."""

    _DEFAULT_PERIOD = 14

    def __init__(self, period: int = _DEFAULT_PERIOD):
        """Initialize ATR with optional period override.

        Args:
            period: The number of periods for ATR calculation (default: 14)

        Raises:
            ValueError: If period is out of valid range (2-200)
        """
        # Validate parameters
        if period < 2 or period > 200:
            raise ValueError(f"ATR period must be between 2 and 200, got {period}")

        self._period = period
        # Only pass to parent if different from default (for name generation)
        if period != self._DEFAULT_PERIOD:
            super().__init__(period=period)
        else:
            super().__init__()

    @property
    def base_name(self) -> str:
        return "atr"

    @property
    def description(self) -> str:
        return f"Average True Range (period={self._period})"

    @property
    def category(self) -> str:
        return "volatility"

    @property
    def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
        """Return structured parameter definitions for ATR."""
        from app.schemas.indicator import ParameterDefinition
        return {
            "period": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_PERIOD,
                min=2,
                max=200,
                description="ATR period for calculation"
            )
        }

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        """Calculate ATR using pandas-ta.

        Args:
            df: DataFrame with OHLCV data (must have 'high', 'low', 'close' columns)
            **kwargs: Indicator parameters (e.g., period=14)

        Returns:
            DataFrame with original columns plus 'atr' column

        Note:
            Accepts UI parameter name 'period' and maps to pandas-ta's 'length' parameter.
        """
        import pandas_ta as ta

        # Accept UI parameter name 'period' and map to pandas-ta's 'length'
        period = kwargs.get('period', kwargs.get('length', self._period))

        # pandas_ta returns Series with dynamic name like "ATR_14"
        result = ta.atr(df['high'], df['low'], df['close'], length=period)

        # Map to stable field name
        df_copy = df.copy()
        df_copy['atr'] = result  # Stable name (matches metadata.series_metadata[0].field)

        return df_copy

    @property
    def metadata(self) -> IndicatorMetadata:
        """Return metadata for generic frontend rendering."""
        from app.schemas.indicator import (
            IndicatorMetadata,
            IndicatorDisplayType,
            ColorMode,
            SeriesMetadata,
            SeriesRole,
            LineStyle,
            DisplayType,
            ScaleRangesConfig,
        )

        return IndicatorMetadata(
            display_type=IndicatorDisplayType.PANE,
            color_mode=ColorMode.SINGLE,
            color_schemes={
                "bullish": "#ff9800",
                "bearish": "#ff9800",
                "neutral": "#ff9800",
            },
            scale_ranges=ScaleRangesConfig(min=0, max=50, auto=True),
            series_metadata=[
                SeriesMetadata(
                    field="atr",
                    role=SeriesRole.MAIN,
                    label="ATR",
                    line_color="#ff9800",
                    line_style=LineStyle.SOLID,
                    line_width=2,
                    display_type=DisplayType.LINE,
                )
            ],
        )
```

## Step 3: Register Indicators

**File**: `backend/app/services/indicator_registry/initialization.py`

### 3.1 Import New Indicator Classes

Add to the imports section at the top of the file:
```python
from app.services.indicator_registry.registry import (
    get_registry,
    SMAIndicator,
    EMAIndicator,
    TDFIIndicator,
    cRSIIndicator,
    ADXVMAIndicator,
    Indicator,
    # NEW: Import pandas-ta indicators
    RSIIndicator,
    MACDIndicator,
    BBANDSIndicator,
    ATRIndicator,
)
```

### 3.2 Register in `initialize_standard_indicators()`

Add to the function (after ADXVMA registration):
```python
def initialize_standard_indicators() -> None:
    """Register all standard indicator variants."""
    registry = get_registry()

    # ... existing registrations (SMA, EMA, TDFI, cRSI, ADXVMA)

    # NEW: Register pandas-ta indicators
    registry.register(RSIIndicator())      # "rsi" (default: 14)
    registry.register(MACDIndicator())     # "macd" (default: 12, 26, 9)
    registry.register(BBANDSIndicator())   # "bbands" (default: 20, 2.0)
    registry.register(ATRIndicator())      # "atr" (default: 14)

    logger.info(f"Registered {len(registry._indicators)} standard indicator variants")
```

### 3.3 Add to `indicator_classes` Mapping

Add to the mapping in `deserialize_indicator_params()`:
```python
def deserialize_indicator_params(serialized: str) -> Indicator:
    """Deserialize indicator from JSON string."""
    data = json.loads(serialized)
    base_name = data["base_name"]
    params = data["parameters"]

    # Map base_name to indicator class
    indicator_classes = {
        "sma": SMAIndicator,
        "ema": EMAIndicator,
        "tdfi": TDFIIndicator,
        "crsi": cRSIIndicator,
        "adxvma": ADXVMAIndicator,
        # NEW: Add pandas-ta indicators
        "rsi": RSIIndicator,
        "macd": MACDIndicator,
        "bbands": BBANDSIndicator,
        "atr": ATRIndicator,
    }

    if base_name not in indicator_classes:
        raise ValueError(f"Unknown indicator base_name: {base_name}")

    indicator_class = indicator_classes[base_name]
    return indicator_class(**params)
```

## Step 4: Write Tests

**File**: `backend/tests/services/test_pandas_ta_indicators.py`

```python
"""Tests for pandas-ta indicators."""

import pytest
import pandas as pd
import numpy as np
from app.services.indicator_registry.registry import (
    RSIIndicator,
    MACDIndicator,
    BBANDSIndicator,
    ATRIndicator,
)


def create_test_dataframe(n=100):
    """Create a test DataFrame with OHLCV data."""
    np.random.seed(42)
    return pd.DataFrame({
        'open': np.linspace(100, 110, n) + np.random.randn(n) * 0.5,
        'high': np.linspace(101, 111, n) + np.random.randn(n) * 0.5,
        'low': np.linspace(99, 109, n) + np.random.randn(n) * 0.5,
        'close': np.linspace(100.5, 110.5, n) + np.random.randn(n) * 0.5,
        'volume': np.ones(n) * 1000
    })


# RSI Tests

def test_rsi_default_name():
    """Test that RSIIndicator() with no args returns name='rsi'."""
    indicator = RSIIndicator()
    assert indicator.name == "rsi"


def test_rsi_parameterized_name():
    """Test that RSIIndicator(50) returns name='rsi_50'."""
    indicator = RSIIndicator(period=50)
    assert indicator.name == "rsi_50"


def test_rsi_calculates_correctly():
    """Test that RSI calculation returns expected field."""
    df = create_test_dataframe()
    indicator = RSIIndicator()
    result = indicator.calculate(df)

    assert 'rsi' in result.columns
    assert len(result) == len(df)
    # RSI should be between 0 and 100
    assert result['rsi'].dropna().between(0, 100).all()


def test_rsi_parameter_validation():
    """Test that RSI validates period parameter."""
    with pytest.raises(ValueError, match="must be between 2 and 200"):
        RSIIndicator(period=1)

    with pytest.raises(ValueError, match="must be between 2 and 200"):
        RSIIndicator(period=201)


# MACD Tests

def test_macd_default_name():
    """Test that MACDIndicator() returns name='macd'."""
    indicator = MACDIndicator()
    assert indicator.name == "macd"


def test_macd_parameterized_name():
    """Test that MACDIndicator(fast=8, slow=21) returns name='macd_8_21'."""
    indicator = MACDIndicator(fast=8, slow=21)
    assert indicator.name == "macd_8_21"


def test_macd_calculates_correctly():
    """Test that MACD calculation returns expected fields."""
    df = create_test_dataframe()
    indicator = MACDIndicator()
    result = indicator.calculate(df)

    assert 'macd' in result.columns
    assert 'signal' in result.columns
    assert 'histogram' in result.columns
    assert len(result) == len(df)


def test_macd_parameter_validation():
    """Test that MACD validates parameters."""
    with pytest.raises(ValueError, match="fast period must be between 2 and 200"):
        MACDIndicator(fast=1)

    with pytest.raises(ValueError, match="fast period .* must be less than slow period"):
        MACDIndicator(fast=30, slow=20)


# BBANDS Tests

def test_bbands_default_name():
    """Test that BBANDSIndicator() returns name='bbands'."""
    indicator = BBANDSIndicator()
    assert indicator.name == "bbands"


def test_bbands_parameterized_name():
    """Test that BBANDSIndicator(length=50) returns name='bbands_50'."""
    indicator = BBANDSIndicator(length=50)
    assert indicator.name == "bbands_50"


def test_bbands_calculates_correctly():
    """Test that BBANDS calculation returns expected fields."""
    df = create_test_dataframe()
    indicator = BBANDSIndicator()
    result = indicator.calculate(df)

    assert 'upper' in result.columns
    assert 'middle' in result.columns
    assert 'lower' in result.columns
    assert len(result) == len(df)
    # Upper band should be >= middle >= lower band
    assert (result['upper'] >= result['middle']).all()
    assert (result['middle'] >= result['lower']).all()


def test_bbands_parameter_validation():
    """Test that BBANDS validates parameters."""
    with pytest.raises(ValueError, match="length must be between 2 and 500"):
        BBANDSIndicator(length=1)

    with pytest.raises(ValueError, match="std must be between 0.1 and 5.0"):
        BBANDSIndicator(std=0.05)


# ATR Tests

def test_atr_default_name():
    """Test that ATRIndicator() returns name='atr'."""
    indicator = ATRIndicator()
    assert indicator.name == "atr"


def test_atr_parameterized_name():
    """Test that ATRIndicator(period=20) returns name='atr_20'."""
    indicator = ATRIndicator(period=20)
    assert indicator.name == "atr_20"


def test_atr_calculates_correctly():
    """Test that ATR calculation returns expected field."""
    df = create_test_dataframe()
    indicator = ATRIndicator()
    result = indicator.calculate(df)

    assert 'atr' in result.columns
    assert len(result) == len(df)
    # ATR should always be non-negative
    assert (result['atr'] >= 0).all()


def test_atr_parameter_validation():
    """Test that ATR validates period parameter."""
    with pytest.raises(ValueError, match="period must be between 2 and 200"):
        ATRIndicator(period=1)


# Metadata Tests

def test_all_pandas_ta_indicators_have_valid_metadata():
    """Test that all pandas-ta indicators have valid metadata."""
    indicators = [
        RSIIndicator(),
        MACDIndicator(),
        BBANDSIndicator(),
        ATRIndicator(),
    ]

    for indicator in indicators:
        # Check metadata exists
        assert hasattr(indicator, 'metadata')
        metadata = indicator.metadata

        # Check display_type
        assert metadata.display_type in ['overlay', 'pane']

        # Check color_mode
        assert metadata.color_mode in ['single', 'threshold', 'gradient', 'trend']

        # Check color_schemes
        assert isinstance(metadata.color_schemes, dict)
        assert len(metadata.color_schemes) > 0
        for color in metadata.color_schemes.values():
            assert color.startswith('#')
            assert len(color) == 7

        # Check series_metadata
        assert isinstance(metadata.series_metadata, list)
        assert len(metadata.series_metadata) > 0
        for series in metadata.series_metadata:
            assert hasattr(series, 'field')
            assert hasattr(series, 'role')
            assert hasattr(series, 'label')
            assert hasattr(series, 'line_color')
            assert hasattr(series, 'line_style')
            assert hasattr(series, 'line_width')
            assert hasattr(series, 'display_type')


def test_indicator_fields_match_metadata():
    """Test that calculate() output fields match metadata.series_metadata[].field."""
    df = create_test_dataframe()
    indicators = [
        RSIIndicator(),
        MACDIndicator(),
        BBANDSIndicator(),
        ATRIndicator(),
    ]

    for indicator in indicators:
        result = indicator.calculate(df)

        # Check that all series_metadata fields exist in result
        for series in indicator.metadata.series_metadata:
            assert series.field in result.columns, \
                f"{indicator.name}: Field '{series.field}' from metadata not found in calculate() result"
```

## Step 5: Verify Implementation

### 5.1 Run Tests

```bash
cd backend
pytest tests/services/test_pandas_ta_indicators.py -v
```

All tests should pass.

### 5.2 Test API Endpoints

Start the backend server:
```bash
cd backend
uvicorn app.main:app --reload
```

Test the endpoints in a separate terminal:

```bash
# List all supported indicators (should include RSI, MACD, BBANDS, ATR)
curl http://localhost:8000/api/v1/indicators/supported | jq '.[] | select(.name | test("rsi|macd|bbands|atr"))'

# Calculate RSI for AAPL
curl "http://localhost:8000/api/v1/indicators/AAPL/rsi?interval=1d&period=14" | jq '.'

# Calculate MACD for AAPL
curl "http://localhost:8000/api/v1/indicators/AAPL/macd?interval=1d&fast=12&slow=26&signal=9" | jq '.'

# Calculate BBANDS for AAPL
curl "http://localhost:8000/api/v1/indicators/AAPL/bbands?interval=1d&length=20&std=2" | jq '.'

# Calculate ATR for AAPL
curl "http://localhost:8000/api/v1/indicators/AAPL/atr?interval=1d&period=14" | jq '.'
```

### 5.3 Verify Frontend Integration

1. Open the frontend application
2. Navigate to a chart with candle data
3. Open the **IndicatorDialog** (indicator picker)
4. Verify "RSI", "MACD", "BBANDS", and "ATR" appear in the list
5. Add each indicator to the chart
6. Verify that values render correctly

**Expected behavior**:
- Indicators appear in the picker automatically (no frontend code changes needed)
- Indicators render in appropriate panes or overlay
- Settings UI shows correct parameters (period, fast, slow, signal, length, std)
- Parameter validation works (e.g., entering period=1 shows error)

## Step 6: Common Implementation Patterns

### Pattern 1: Parameter Name Mapping

```python
# In parameter_definitions - define UI-facing name
@property
def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
    return {
        "period": ParameterDefinition(...)  # UI sends "period"
    }

# In calculate() - accept both UI and pandas-ta names
def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
    period = kwargs.get('period', kwargs.get('length', self._period))
    result = ta.rsi(df['close'], length=period)  # pandas-ta uses "length"
    df_copy['rsi'] = result  # Stable name
    return df_copy
```

### Pattern 2: Stable Field Naming

```python
# pandas-ta returns dynamic column names
result = ta.rsi(df['close'], length=14)  # Series with name "RSI_14"

# Map to stable name that matches metadata
df_copy['rsi'] = result  # Stable name

# Metadata must match
SeriesMetadata(field="rsi", ...)  # Same as output column name
```

### Pattern 3: Multi-Series Indicators

```python
# pandas-ta returns DataFrame with multiple columns
result = ta.macd(df['close'], fast=12, slow=26, signal=9)
# Columns: "MACD_12_26_9", "MACDs_12_26_9", "MACDh_12_26_9"

# Extract each series by position (reliable across pandas-ta versions)
df_copy['macd'] = result.iloc[:, 0]      # First column
df_copy['histogram'] = result.iloc[:, 1]  # Second column
df_copy['signal'] = result.iloc[:, 2]     # Third column

# Define all in metadata.series_metadata
series_metadata=[
    SeriesMetadata(field="macd", ...),
    SeriesMetadata(field="signal", ...),
    SeriesMetadata(field="histogram", ...),
]
```

### Pattern 4: Parameter Validation

```python
def __init__(self, period: int = 14):
    # Validate in __init__ for instance creation
    if period < 2 or period > 200:
        raise ValueError(f"Parameter 'period' must be between 2 and 200, got {period}")
    self._period = period

# API also validates request parameters
# (automatically handled by endpoint code)
```

## Step 7: Troubleshooting

### Issue: "Module 'pandas_ta' not found"

**Solution**:
```bash
pip install pandas-ta
```

### Issue: "Field 'rsi' not found in calculate() result"

**Solution**: Ensure you're mapping the pandas-ta output to a stable name:
```python
df_copy['rsi'] = result  # Not: df_copy['RSI_14'] = result
```

### Issue: "metadata.series_metadata[0].field does not match data keys"

**Solution**: Ensure field names match exactly:
```python
# In calculate()
df_copy['rsi'] = result

# In metadata
SeriesMetadata(field="rsi", ...)  # Must match
```

### Issue: "Indicator not found in /indicators/supported"

**Solution**: Ensure you registered the indicator in `initialize_standard_indicators()` and restarted the server.

### Issue: "Parameter 'period' not found"

**Solution**: Ensure `parameter_definitions` uses the same name you're sending in the API request, and `calculate()` accepts it.

## Summary

This quickstart guide covered:

1. ✅ Adding pandas-ta dependency
2. ✅ Creating 4 indicator classes (RSI, MACD, BBANDS, ATR)
3. ✅ Registering indicators in the registry
4. ✅ Writing comprehensive tests
5. ✅ Verifying API endpoints
6. ✅ Frontend integration verification

**Next Steps**:
- Run `/speckit.tasks` to generate the implementation task breakdown
- Implement the tasks in order
- Test thoroughly before user approval

**For Phase 2** (after approval):
- Reuse this pattern for remaining 130+ pandas-ta indicators
- Implement auto-discovery mechanism
- Test diverse indicator types
