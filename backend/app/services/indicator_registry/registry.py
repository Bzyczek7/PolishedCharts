"""Indicator Registry for managing technical indicators as plugins.

This module provides a plugin-based architecture for adding new technical
indicators without modifying core charting code. Each indicator provides:
- Calculation function
- Metadata for generic frontend rendering
- Optional alert condition templates

## IMPORTANT: Standard Field Names for Alert Engine Compatibility

When adding new indicators, ensure they return STANDARD field names that the
alert engine expects. The alert engine (alert_engine.py) looks for these
specific field names when evaluating alert conditions:

  - Bands: upper_band, lower_band (e.g., BBANDS, cRSI band extremes)
  - RSI-type: rsi, rsi_upper (overbought), rsi_lower (oversold)
  - General: value (main indicator value)

If your indicator uses custom field names, add standard field name mapping
in your calculate() method:

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        result_df = your_calculation_logic(df, **kwargs)

        # Add standard field names for alert engine compatibility
        if 'Custom_UpperBand' in result_df.columns:
            result_df['upper_band'] = result_df['Custom_UpperBand']
        if 'Custom_LowerBand' in result_df.columns:
            result_df['lower_band'] = result_df['Custom_LowerBand']

        return result_df

This ensures your indicator works with the alert engine out of the box.
"""

from typing import Callable, Dict, Any, Optional, List, List as ListType
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from enum import Enum

try:
    from app.schemas.indicator import (
        IndicatorMetadata,
        ParameterDefinition,
        IndicatorInfo,
    )
except ImportError:
    # Fallback for when schemas aren't available yet
    IndicatorMetadata = None
    ParameterDefinition = None
    IndicatorInfo = None

import pandas as pd


class IndicatorDisplayType(str, Enum):
    """Whether indicator draws on price chart or separate pane."""
    OVERLAY = "overlay"
    PANE = "pane"


class AlertTemplate:
    """Template for an alert condition that an indicator supports.

    Defines which alert conditions can be created for this indicator
    and which fields they apply to.
    """

    def __init__(
        self,
        condition_type: str,
        label: str,
        description: str,
        applicable_fields: List[str],
        requires_threshold: bool = True,
    ):
        self.condition_type = condition_type
        self.label = label
        self.description = description
        self.applicable_fields = applicable_fields
        self.requires_threshold = requires_threshold


class Indicator(ABC):
    """Base class for all indicators.

    All indicators must extend this class and implement the required properties.
    The metadata property enables generic frontend rendering without per-indicator code.

    ## ALERT ENGINE COMPATIBILITY

    CRITICAL: Your calculate() method MUST return standard field names for the
    alert engine to work correctly. The alert engine (alert_engine.py) expects:

        - Band indicators: upper_band, lower_band
        - RSI-type indicators: rsi, rsi_upper (overbought), rsi_lower (oversold)
        - General indicators: value (main indicator value)

    Example of proper field name mapping in calculate():

        def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
            result_df = your_calculation_logic(df, **kwargs)

            # Add standard field names for alert engine compatibility
            if 'MyCustom_Upper' in result_df.columns:
                result_df['upper_band'] = result_df['MyCustom_Upper']
            if 'MyCustom_Lower' in result_df.columns:
                result_df['lower_band'] = result_df['MyCustom_Lower']

            return result_df
    """

    def __init__(self, **default_params):
        """Initialize indicator with optional default parameters.

        Args:
            **default_params: Instance-specific parameter values (e.g., period=20)

        Raises:
            ValueError: If any parameter is invalid (out of bounds, wrong type, etc.)
        """
        self._default_params = default_params
        # Validate parameters if any were provided
        if default_params:
            self.validate_params(default_params)

    @property
    @abstractmethod
    def base_name(self) -> str:
        """Return the base indicator name (e.g., 'sma', 'ema', 'crsi').

        This is the unparameterized name used as the prefix for generating
        unique instance names.
        """
        pass

    @property
    def name(self) -> str:
        """Generate unique name based on base_name and parameters.

        Returns base_name for default instances (no parameters), or
        base_name with parameter suffix for custom instances.

        Examples:
            SMAIndicator() -> "sma"
            SMAIndicator(50) -> "sma_50"
            cRSIIndicator(25, 16, 12.0, 50) -> "crsi_25_16_12.0_50"
        """
        if not self._default_params:
            return self.base_name

        # Check for primary length parameter in priority order
        length_params = ['period', 'length', 'lookback', 'window']
        for param in length_params:
            if param in self._default_params:
                return f"{self.base_name}_{self._default_params[param]}"

        # Fallback: use all parameters concatenated
        param_str = "_".join(str(v) for v in self._default_params.values())
        return f"{self.base_name}_{param_str}"

    @property
    @abstractmethod
    def description(self) -> str:
        """Return the indicator description."""
        pass

    @property
    def parameters(self) -> Dict[str, Any]:
        """Return default parameters for the indicator.

        DEPRECATED: Use parameter_definitions property instead.
        This is maintained for backward compatibility.
        """
        return {}

    @property
    def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
        """Return structured parameter definitions.

        This provides type information, validation constraints, and descriptions
        for each parameter. Implementations should override this property.

        Example:
            return {
                "period": ParameterDefinition(
                    type="integer",
                    default=14,
                    min=2,
                    max=200,
                    description="RSI period for calculation"
                )
            }
        """
        # Convert old-style parameters dict to ParameterDefinition if needed
        old_params = self.parameters
        if old_params:
            from app.schemas.indicator import ParameterDefinition as PD
            return {
                k: PD(
                    type=v.get("type", "integer"),
                    default=v.get("default"),
                    min=v.get("min"),
                    max=v.get("max"),
                    description=v.get("description", "")
                )
                for k, v in old_params.items()
            }
        return {}

    @property
    def category(self) -> str:
        """Return the indicator category.

        Returns one of: overlay, oscillator, momentum, trend, volatility
        """
        return IndicatorDisplayType.OVERLAY.value

    @abstractmethod
    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        """Calculate the indicator on the given DataFrame.

        Args:
            df: DataFrame with OHLCV data (must have 'close' column at minimum)
            **kwargs: Indicator-specific parameters

        Returns:
            DataFrame with original columns plus indicator columns
        """
        pass

    @property
    def metadata(self) -> IndicatorMetadata:
        """Return the indicator metadata for frontend rendering.

        This property MUST be implemented by all indicator subclasses.
        The metadata drives the generic frontend rendering without requiring
        per-indicator frontend code.

        Implementations should construct an IndicatorMetadata object with:
        - display_type: overlay or pane
        - color_mode: single, threshold, or gradient
        - color_schemes: state -> hex color mapping
        - series_metadata: list of series to render
        - (optional) thresholds, scale_ranges, reference_levels
        """
        raise NotImplementedError(
            f"Indicator '{self.base_name}' must implement the metadata property. "
            "This is required for generic frontend rendering."
        )

    @property
    def alert_templates(self) -> List[AlertTemplate]:
        """Return alert condition templates for this indicator.

        Defines which alert conditions can be created for this indicator.
        Examples: crosses_upper, turns_positive, slope_bullish, etc.

        Returns:
            List of AlertTemplate objects defining supported conditions
        """
        return []

    def validate_params(self, params: Dict[str, Any]) -> None:
        """Validate parameters against their definitions.

        Args:
            params: Parameter values to validate

        Raises:
            ValueError: If any parameter is invalid (out of bounds, wrong type, etc.)
        """
        param_defs = self.parameter_definitions

        for param_name, param_value in params.items():
            if param_name not in param_defs:
                raise ValueError(
                    f"Invalid parameter '{param_name}' for indicator '{self.base_name}'. "
                    f"Valid parameters: {list(param_defs.keys())}"
                )

            param_def = param_defs[param_name]

            # Type validation
            expected_type = param_def.type
            if expected_type == "integer":
                if not isinstance(param_value, int):
                    raise ValueError(
                        f"Parameter '{param_name}' must be an integer, got {type(param_value).__name__}"
                    )
            elif expected_type == "number":
                if not isinstance(param_value, (int, float)):
                    raise ValueError(
                        f"Parameter '{param_name}' must be a number, got {type(param_value).__name__}"
                    )
            elif expected_type == "boolean":
                if not isinstance(param_value, bool):
                    raise ValueError(
                        f"Parameter '{param_name}' must be a boolean, got {type(param_value).__name__}"
                    )
            elif expected_type == "string":
                if not isinstance(param_value, str):
                    raise ValueError(
                        f"Parameter '{param_name}' must be a string, got {type(param_value).__name__}"
                    )

            # Min/max validation for numeric types
            if hasattr(param_def, 'min') and param_def.min is not None:
                if isinstance(param_value, (int, float)) and param_value < param_def.min:
                    raise ValueError(
                        f"Parameter '{param_name}' must be >= {param_def.min}, got {param_value}"
                    )

            if hasattr(param_def, 'max') and param_def.max is not None:
                if isinstance(param_value, (int, float)) and param_value > param_def.max:
                    raise ValueError(
                        f"Parameter '{param_name}' must be <= {param_def.max}, got {param_value}"
                    )

    def serialize_params(self) -> str:
        """Serialize indicator parameters to JSON string.

        Returns a JSON string containing:
        - base_name: The indicator type (e.g., "sma", "ema")
        - parameters: Dict of parameter values

        Returns:
            JSON string representation of the indicator configuration
        """
        import json
        return json.dumps({
            "base_name": self.base_name,
            "parameters": self._default_params
        })


class SMAIndicator(Indicator):
    """Simple Moving Average indicator."""

    _DEFAULT_PERIOD = 20

    def __init__(self, period: int = _DEFAULT_PERIOD):
        """Initialize SMA with optional period override.

        Args:
            period: The number of periods for the moving average (default: 20)
        """
        self._period = period
        # Only pass to parent if different from default (for name generation)
        if period != self._DEFAULT_PERIOD:
            super().__init__(period=period)
        else:
            super().__init__()

    @property
    def base_name(self) -> str:
        return "sma"

    @property
    def description(self) -> str:
        return f"Simple Moving Average (period={self._period})"

    @property
    def category(self) -> str:
        return "overlay"

    @property
    def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
        """Return structured parameter definitions for SMA."""
        from app.schemas.indicator import ParameterDefinition
        return {
            "period": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_PERIOD,
                min=2,
                max=500,
                description="Number of periods for the moving average"
            )
        }

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        from app.services import indicators as indicators_module
        # Use instance default, but allow override via kwargs
        period = kwargs.get('period', self._period)
        price_col = kwargs.get('price_col', 'close')
        return indicators_module.calculate_sma(df, period=period, price_col=price_col)

    @property
    def metadata(self) -> IndicatorMetadata:
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
                "bullish": "#2962ff",  # Blue
                "bearish": "#2962ff",
                "neutral": "#2962ff",
            },
            series_metadata=[
                SeriesMetadata(
                    field="sma",
                    role=SeriesRole.MAIN,
                    label="SMA",
                    line_color="#2962ff",
                    line_style=LineStyle.SOLID,
                    line_width=2,
                    display_type=DisplayType.LINE,
                )
            ],
        )

    @property
    def alert_templates(self) -> List[AlertTemplate]:
        return [
            AlertTemplate(
                condition_type="indicator_crosses_upper",
                label="Crosses Above",
                description="SMA crosses above threshold",
                applicable_fields=["sma"],
                requires_threshold=True,
            ),
            AlertTemplate(
                condition_type="indicator_crosses_lower",
                label="Crosses Below",
                description="SMA crosses below threshold",
                applicable_fields=["sma"],
                requires_threshold=True,
            ),
            AlertTemplate(
                condition_type="indicator_slope_bullish",
                label="Bullish Slope",
                description="SMA slope turns positive",
                applicable_fields=["sma"],
                requires_threshold=False,
            ),
            AlertTemplate(
                condition_type="indicator_slope_bearish",
                label="Bearish Slope",
                description="SMA slope turns negative",
                applicable_fields=["sma"],
                requires_threshold=False,
            ),
        ]


class TDFIIndicator(Indicator):
    """Trend Direction Force Index indicator.

    TDFI measures trend direction and momentum with threshold-based coloring.
    """

    _DEFAULT_LOOKBACK = 13
    _DEFAULT_FILTER_HIGH = 0.05
    _DEFAULT_FILTER_LOW = -0.05

    def __init__(self, lookback: int = _DEFAULT_LOOKBACK, filter_high: float = _DEFAULT_FILTER_HIGH, filter_low: float = _DEFAULT_FILTER_LOW):
        """Initialize TDFI with optional parameter overrides.

        Args:
            lookback: The lookback period for calculation (default: 13)
            filter_high: Upper threshold for bullish zone (default: 0.05)
            filter_low: Lower threshold for bearish zone (default: -0.05)
        """
        self._lookback = lookback
        self._filter_high = filter_high
        self._filter_low = filter_low
        # Only pass non-default params to parent (for name generation)
        params = {}
        if lookback != self._DEFAULT_LOOKBACK:
            params['lookback'] = lookback
        if filter_high != self._DEFAULT_FILTER_HIGH:
            params['filter_high'] = filter_high
        if filter_low != self._DEFAULT_FILTER_LOW:
            params['filter_low'] = filter_low
        super().__init__(**params)

    @property
    def base_name(self) -> str:
        return "tdfi"

    @property
    def description(self) -> str:
        return f"Trend Direction Force Index (lookback={self._lookback})"

    @property
    def category(self) -> str:
        return "oscillator"

    @property
    def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
        """Return structured parameter definitions for TDFI."""
        from app.schemas.indicator import ParameterDefinition
        return {
            "lookback": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_LOOKBACK,
                min=2,
                max=200,
                description="Lookback period for TDFI calculation"
            ),
            "filter_high": ParameterDefinition(
                type="float",
                default=self._DEFAULT_FILTER_HIGH,
                min=-1.0,
                max=1.0,
                description="Upper threshold for bullish zone"
            ),
            "filter_low": ParameterDefinition(
                type="float",
                default=self._DEFAULT_FILTER_LOW,
                min=-1.0,
                max=1.0,
                description="Lower threshold for bearish zone"
            )
        }

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        from app.services import indicators as indicators_module
        lookback = kwargs.get('lookback', self._lookback)
        filter_high = kwargs.get('filter_high', self._filter_high)
        filter_low = kwargs.get('filter_low', self._filter_low)
        return indicators_module.calculate_tdfi(
            df,
            lookback=lookback,
            filter_high=filter_high,
            filter_low=filter_low
        )

    @property
    def metadata(self) -> IndicatorMetadata:
        from app.schemas.indicator import (
            IndicatorMetadata,
            IndicatorDisplayType,
            ColorMode,
            SeriesMetadata,
            SeriesRole,
            LineStyle,
            DisplayType,
            ThresholdsConfig,
            ScaleRangesConfig,
            ReferenceLevel,
        )

        return IndicatorMetadata(
            display_type=IndicatorDisplayType.PANE,
            color_mode=ColorMode.THRESHOLD,
            color_schemes={
                "bullish": "#00FF00",    # Lime/Green (above 0.05)
                "bearish": "#ef5350",    # Red (below -0.05)
                "neutral": "#808080",    # Gray (between thresholds)
            },
            thresholds=ThresholdsConfig(high=0.05, low=-0.05),
            scale_ranges=ScaleRangesConfig(min=-1, max=1, auto=False),
            series_metadata=[
                SeriesMetadata(
                    field="TDFI",
                    role=SeriesRole.MAIN,
                    label="TDFI",
                    line_color="#808080",
                    line_style=LineStyle.SOLID,
                    line_width=2,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="TDFI_Signal",
                    role=SeriesRole.SIGNAL,
                    label="Signal",
                    line_color="#808080",
                    line_style=LineStyle.DOTTED,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
            ],
            reference_levels=[
                ReferenceLevel(
                    value=0.05,
                    line_color="#00FF00",  # Green line for upper threshold
                    line_label="0.05",
                    line_style=LineStyle.DASHED,
                ),
                ReferenceLevel(
                    value=-0.05,
                    line_color="#ef5350",  # Red line for lower threshold
                    line_label="-0.05",
                    line_style=LineStyle.DASHED,
                ),
                ReferenceLevel(
                    value=0.0,
                    line_color="#808080",  # Gray line for zero
                    line_label="0",
                    line_style=LineStyle.DASHED,
                ),
            ],
        )

    @property
    def alert_templates(self) -> List[AlertTemplate]:
        return [
            AlertTemplate(
                condition_type="indicator_turns_positive",
                label="Turns Positive",
                description="TDFI enters bullish zone (crosses above 0.05)",
                applicable_fields=["TDFI"],
                requires_threshold=False,
            ),
            AlertTemplate(
                condition_type="indicator_turns_negative",
                label="Turns Negative",
                description="TDFI enters bearish zone (crosses below -0.05)",
                applicable_fields=["TDFI"],
                requires_threshold=False,
            ),
            AlertTemplate(
                condition_type="indicator_signal_change",
                label="Signal Change",
                description="TDFI signal changes (bullish/bearish/neutral)",
                applicable_fields=["TDFI_Signal"],
                requires_threshold=False,
            ),
        ]


class cRSIIndicator(Indicator):
    """Cyclic RSI indicator with dynamic bands.

    cRSI is a modified RSI that incorporates cyclic analysis and
    dynamic upper/lower bands based on percentile levels.
    """

    _DEFAULT_DOMCYCLE = 20
    _DEFAULT_VIBRATION = 14
    _DEFAULT_LEVELING = 11.0
    _DEFAULT_CYCLICMEMORY = 40

    def __init__(self, domcycle: int = _DEFAULT_DOMCYCLE, vibration: int = _DEFAULT_VIBRATION, leveling: float = _DEFAULT_LEVELING, cyclicmemory: int = _DEFAULT_CYCLICMEMORY):
        """Initialize cRSI with optional parameter overrides.

        Args:
            domcycle: Dominant cycle period (default: 20)
            vibration: Vibration period (default: 14)
            leveling: Leveling value (default: 11.0)
            cyclicmemory: Cyclic memory period (default: 40)
        """
        self._domcycle = domcycle
        self._vibration = vibration
        self._leveling = leveling
        self._cyclicmemory = cyclicmemory
        # Only pass non-default params to parent (for name generation)
        params = {}
        if domcycle != self._DEFAULT_DOMCYCLE:
            params['domcycle'] = domcycle
        if vibration != self._DEFAULT_VIBRATION:
            params['vibration'] = vibration
        if leveling != self._DEFAULT_LEVELING:
            params['leveling'] = leveling
        if cyclicmemory != self._DEFAULT_CYCLICMEMORY:
            params['cyclicmemory'] = cyclicmemory
        super().__init__(**params)

    @property
    def base_name(self) -> str:
        return "crsi"

    @property
    def description(self) -> str:
        return f"Cyclic RSI with dynamic bands (domcycle={self._domcycle})"

    @property
    def category(self) -> str:
        return "oscillator"

    @property
    def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
        """Return structured parameter definitions for cRSI."""
        from app.schemas.indicator import ParameterDefinition
        return {
            "domcycle": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_DOMCYCLE,
                min=5,
                max=100,
                description="Dominant cycle period"
            ),
            "vibration": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_VIBRATION,
                min=2,
                max=50,
                description="Vibration period"
            ),
            "leveling": ParameterDefinition(
                type="float",
                default=self._DEFAULT_LEVELING,
                min=1.0,
                max=50.0,
                description="Leveling factor"
            ),
            "cyclicmemory": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_CYCLICMEMORY,
                min=10,
                max=100,
                description="Cyclic memory period"
            )
        }

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        from app.services import indicators as indicators_module
        domcycle = kwargs.get('domcycle', self._domcycle)
        vibration = kwargs.get('vibration', self._vibration)
        leveling = kwargs.get('leveling', self._leveling)
        cyclicmemory = kwargs.get('cyclicmemory', self._cyclicmemory)
        result_df = indicators_module.calculate_crsi(
            df,
            domcycle=domcycle,
            vibration=vibration,
            leveling=leveling,
            cyclicmemory=cyclicmemory
        )
        
        # Add standard field names for alert engine compatibility
        # Map cRSI-specific names to standard names expected by alert engine
        if 'cRSI_UpperBand' in result_df.columns and 'upper_band' not in result_df.columns:
            result_df['upper_band'] = result_df['cRSI_UpperBand']
        if 'cRSI_LowerBand' in result_df.columns and 'lower_band' not in result_df.columns:
            result_df['lower_band'] = result_df['cRSI_LowerBand']
        
        return result_df

    @property
    def metadata(self) -> IndicatorMetadata:
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
                "bullish": "#00bcd4",    # Cyan
                "bearish": "#00bcd4",
                "neutral": "#00bcd4",
            },
            scale_ranges=ScaleRangesConfig(min=0, max=100, auto=False),
            series_metadata=[
                SeriesMetadata(
                    field="cRSI",
                    role=SeriesRole.MAIN,
                    label="cRSI",
                    line_color="#00bcd4",      # Cyan
                    line_style=LineStyle.SOLID,
                    line_width=2,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="cRSI_UpperBand",
                    role=SeriesRole.BAND,
                    label="Upper Band",
                    line_color="#b2ebf2",     # Light cyan
                    line_style=LineStyle.DASHED,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="cRSI_LowerBand",
                    role=SeriesRole.BAND,
                    label="Lower Band",
                    line_color="#b2ebf2",     # Light cyan
                    line_style=LineStyle.DASHED,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
            ],
            reference_levels=[
                ReferenceLevel(
                    value=70,
                    line_color="#b2ebf2",
                    line_label="70",
                    line_style=LineStyle.DASHED,
                ),
                ReferenceLevel(
                    value=30,
                    line_color="#b2ebf2",
                    line_label="30",
                    line_style=LineStyle.DASHED,
                ),
                ReferenceLevel(
                    value=50,
                    line_color="#9e9e9e",
                    line_label="50",
                    line_style=LineStyle.DOTTED,
                ),
            ],
        )

    @property
    def alert_templates(self) -> List[AlertTemplate]:
        return [
            AlertTemplate(
                condition_type="indicator_above_upper",
                label="Above Upper Band",
                description="cRSI is above upper band - It's time to sell!",
                applicable_fields=["cRSI"],
                requires_threshold=False,  # Uses band value instead
            ),
            AlertTemplate(
                condition_type="indicator_below_lower",
                label="Below Lower Band",
                description="cRSI is below lower band - It's time to buy!",
                applicable_fields=["cRSI"],
                requires_threshold=False,  # Uses band value instead
            ),
        ]


class ADXVMAIndicator(Indicator):
    """ADX Volatility Moving Average indicator.

    ADXVMA is an adaptive moving average that adjusts its smoothing
    based on trend volatility and direction.
    """

    _DEFAULT_PERIOD = 15

    def __init__(self, adxvma_period: int = _DEFAULT_PERIOD):
        """Initialize ADXVMA with optional period override.

        Args:
            adxvma_period: The ADXVMA period (default: 15)
        """
        self._adxvma_period = adxvma_period
        # Only pass to parent if different from default (for name generation)
        if adxvma_period != self._DEFAULT_PERIOD:
            super().__init__(adxvma_period=adxvma_period)
        else:
            super().__init__()

    @property
    def base_name(self) -> str:
        return "adxvma"

    @property
    def description(self) -> str:
        return f"ADX Volatility Moving Average (period={self._adxvma_period})"

    @property
    def category(self) -> str:
        return "overlay"

    @property
    def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
        """Return structured parameter definitions for ADXVMA."""
        from app.schemas.indicator import ParameterDefinition
        return {
            "adxvma_period": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_PERIOD,
                min=2,
                max=100,
                description="ADXVMA period for calculation"
            )
        }

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        from app.services import indicators as indicators_module
        adxvma_period = kwargs.get('adxvma_period', self._adxvma_period)
        return indicators_module.calculate_adxvma(df, adxvma_period=adxvma_period)

    @property
    def metadata(self) -> IndicatorMetadata:
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
            color_mode=ColorMode.TREND,  # Changed from SINGLE to TREND for 3-color rendering
            color_schemes={
                "bullish": "#00FF00",   # Lime (up trend)
                "bearish": "#ef5350",   # Red (down trend)
                "neutral": "#FFFF00",   # Yellow (neutral)
            },
            series_metadata=[
                SeriesMetadata(
                    field="ADXVMA",
                    role=SeriesRole.MAIN,
                    label="ADXVMA",
                    line_color="#FFFF00",  # Yellow (default/neutral)
                    line_style=LineStyle.SOLID,
                    line_width=3,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="ADXVMA_Signal",
                    role=SeriesRole.SIGNAL,
                    label="Signal",
                    line_color="#FFFF00",
                    line_style=LineStyle.DOTTED,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
            ],
        )

    @property
    def alert_templates(self) -> List[AlertTemplate]:
        return [
            AlertTemplate(
                condition_type="indicator_slope_bullish",
                label="Bullish Slope",
                description="ADXVMA slope turns bullish (trend changes up)",
                applicable_fields=["ADXVMA"],
                requires_threshold=False,
            ),
            AlertTemplate(
                condition_type="indicator_slope_bearish",
                label="Bearish Slope",
                description="ADXVMA slope turns bearish (trend changes down)",
                applicable_fields=["ADXVMA"],
                requires_threshold=False,
            ),
        ]


class EMAIndicator(Indicator):
    """Exponential Moving Average indicator."""

    _DEFAULT_PERIOD = 20

    def __init__(self, period: int = _DEFAULT_PERIOD):
        """Initialize EMA with optional period override.

        Args:
            period: The number of periods for the moving average (default: 20)
        """
        self._period = period
        # Only pass to parent if different from default (for name generation)
        if period != self._DEFAULT_PERIOD:
            super().__init__(period=period)
        else:
            super().__init__()

    @property
    def base_name(self) -> str:
        return "ema"

    @property
    def description(self) -> str:
        return f"Exponential Moving Average (period={self._period})"

    @property
    def category(self) -> str:
        return "overlay"

    @property
    def parameter_definitions(self) -> Dict[str, "ParameterDefinition"]:
        """Return structured parameter definitions for EMA."""
        from app.schemas.indicator import ParameterDefinition
        return {
            "period": ParameterDefinition(
                type="integer",
                default=self._DEFAULT_PERIOD,
                min=2,
                max=500,
                description="Number of periods for the exponential moving average"
            )
        }

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        period = kwargs.get('period', self._period)
        price_col = kwargs.get('price_col', 'close')
        df_copy = df.copy()
        df_copy['ema'] = df_copy[price_col].ewm(span=period, adjust=False).mean()
        return df_copy

    @property
    def metadata(self) -> IndicatorMetadata:
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
                "bullish": "#ff9800",    # Orange
                "bearish": "#ff9800",
                "neutral": "#ff9800",
            },
            series_metadata=[
                SeriesMetadata(
                    field="ema",
                    role=SeriesRole.MAIN,
                    label="EMA",
                    line_color="#ff9800",
                    line_style=LineStyle.SOLID,
                    line_width=2,
                    display_type=DisplayType.LINE,
                )
            ],
        )

    @property
    def alert_templates(self) -> List[AlertTemplate]:
        return [
            AlertTemplate(
                condition_type="indicator_crosses_upper",
                label="Crosses Above",
                description="EMA crosses above threshold",
                applicable_fields=["ema"],
                requires_threshold=True,
            ),
            AlertTemplate(
                condition_type="indicator_crosses_lower",
                label="Crosses Below",
                description="EMA crosses below threshold",
                applicable_fields=["ema"],
                requires_threshold=True,
            ),
        ]


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
        return "oscillator"

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
        signal_val = kwargs.get('signal', self._signal)

        # Validate fast < slow constraint in calculate() as well
        if fast >= slow:
            raise ValueError(f"MACD fast period ({fast}) must be less than slow period ({slow})")

        # pandas_ta returns DataFrame with columns like "MACD_12_26_9", "MACDs_12_26_9", "MACDh_12_26_9"
        result = ta.macd(df['close'], fast=fast, slow=slow, signal=signal_val)

        # Map to stable field names
        df_copy = df.copy()
        # pandas-ta returns DataFrame with 3 columns: MACD line, Histogram, Signal line
        # We extract them by position to be robust across pandas-ta versions
        if isinstance(result, pd.DataFrame) and len(result.columns) >= 3:
            df_copy['macd'] = result.iloc[:, 0]      # MACD line (first column)
            df_copy['histogram'] = result.iloc[:, 1]  # Histogram (second column)
            df_copy['signal'] = result.iloc[:, 2]     # Signal line (third column)
        else:
            # Fallback if pandas-ta returns different format
            df_copy['macd'] = None
            df_copy['histogram'] = None
            df_copy['signal'] = None

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
        return "overlay"

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
        # pandas-ta returns DataFrame with columns: Lower, Middle, Upper (and optional BBB, BBP)
        if isinstance(result, pd.DataFrame) and len(result.columns) >= 3:
            df_copy['lower'] = result.iloc[:, 0]   # Lower Band (first column)
            df_copy['middle'] = result.iloc[:, 1]  # Middle Band (SMA) (second column)
            df_copy['upper'] = result.iloc[:, 2]   # Upper Band (third column)
        else:
            # Fallback if pandas-ta returns different format
            df_copy['lower'] = None
            df_copy['middle'] = None
            df_copy['upper'] = None

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
        return "oscillator"

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


class IndicatorRegistry:
    """Registry for managing technical indicators as plugins.

    Provides methods to register, retrieve, and list indicators with their
    full metadata for API consumption.
    """

    def __init__(self):
        self._indicators: Dict[str, Indicator] = {}

    def register(self, indicator: Indicator) -> None:
        """Register an indicator."""
        self._indicators[indicator.name] = indicator

    def get(self, name: str) -> Optional[Indicator]:
        """Get an indicator by name."""
        return self._indicators.get(name)


    def get_by_base_name(self, base_name: str) -> Optional[Indicator]:
        """Get an indicator by base name (case-insensitive).
        
        This allows looking up indicators by their base type name (e.g., 'sma', 'ema')
        instead of their instance name. This is useful for dynamic parameter configuration
        where the indicator type is known but specific parameter values are provided
        at request time.
        
        Args:
            base_name: The base indicator name (e.g., 'sma', 'ema', 'crsi')
            
        Returns:
            The Indicator if found, None otherwise
        """
        base_name_lower = base_name.lower()
        for indicator in self._indicators.values():
            if indicator.base_name.lower() == base_name_lower:
                return indicator
        return None

    def list_indicators(self) -> List[Dict[str, Any]]:
        """List all registered indicators with basic info.

        DEPRECATED: Use list_indicators_with_metadata() for full metadata.
        This is maintained for backward compatibility.
        """
        return [
            {
                "name": ind.name,
                "description": ind.description,
                "parameters": ind.parameters
            }
            for ind in self._indicators.values()
        ]

    def list_indicators_with_metadata(self) -> List[Dict[str, Any]]:
        """List all registered indicators with full metadata.

        Returns a list of dictionaries containing:
        - name: Indicator identifier
        - description: Human-readable description
        - display_type: overlay or pane (from metadata.display_type)
        - category: Indicator category
        - parameters: Parameter definitions
        - metadata: Full IndicatorMetadata object
        - alert_templates: Available alert conditions

        Used by GET /api/v1/indicators/supported endpoint.

        Feature 005: Fixed display_type to use metadata.display_type instead of category.
        """
        return [
            {
                "name": ind.name,
                "description": ind.description,
                "display_type": ind.metadata.display_type.value,  # Use metadata.display_type, not category
                "category": ind.category,
                "parameters": ind.parameter_definitions,
                "metadata": ind.metadata,
                "alert_templates": [
                    {
                        "condition_type": t.condition_type,
                        "label": t.label,
                        "description": t.description,
                        "applicable_fields": t.applicable_fields,
                        "requires_threshold": t.requires_threshold,
                    }
                    for t in ind.alert_templates
                ],
            }
            for ind in self._indicators.values()
        ]

    def calculate(self, name: str, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        """Calculate an indicator by name."""
        indicator = self.get(name)
        if indicator is None:
            raise ValueError(f"Indicator '{name}' not found")
        return indicator.calculate(df, **kwargs)


# Global registry instance
_registry = IndicatorRegistry()


def get_registry() -> IndicatorRegistry:
    """Get the global indicator registry."""
    return _registry


def register_indicator(indicator: Indicator) -> None:
    """Register an indicator to the global registry."""
    _registry.register(indicator)
