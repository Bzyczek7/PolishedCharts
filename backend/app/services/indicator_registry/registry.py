"""Indicator Registry for managing technical indicators as plugins.

This module provides a plugin-based architecture for adding new technical
indicators without modifying core charting code. Each indicator provides:
- Calculation function
- Metadata for generic frontend rendering
- Optional alert condition templates
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
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the indicator name (e.g., 'crsi', 'tdfi', 'sma')."""
        pass

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
            f"Indicator '{self.name}' must implement the metadata property. "
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


class SMAIndicator(Indicator):
    """Simple Moving Average indicator."""

    @property
    def name(self) -> str:
        return "sma"

    @property
    def description(self) -> str:
        return "Simple Moving Average - averages price over specified period"

    @property
    def category(self) -> str:
        return "overlay"

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        from app.services import indicators as indicators_module
        period = kwargs.get('period', 20)
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

    @property
    def name(self) -> str:
        return "tdfi"

    @property
    def description(self) -> str:
        return "Trend Direction Force Index - measures trend direction with signal threshold"

    @property
    def category(self) -> str:
        return "oscillator"

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        from app.services import indicators as indicators_module
        lookback = kwargs.get('lookback', 13)
        filter_high = kwargs.get('filter_high', 0.05)
        filter_low = kwargs.get('filter_low', -0.05)
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
                "bullish": "#26a69a",    # Green (positive)
                "bearish": "#ef5350",    # Red (negative)
                "neutral": "#9e9e9e",     # Gray (between thresholds)
            },
            thresholds=ThresholdsConfig(high=0.05, low=-0.05),
            scale_ranges=ScaleRangesConfig(min=-1, max=1, auto=False),
            series_metadata=[
                SeriesMetadata(
                    field="TDFI",
                    role=SeriesRole.MAIN,
                    label="TDFI",
                    line_color="#9e9e9e",
                    line_style=LineStyle.SOLID,
                    line_width=2,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="TDFI_Signal",
                    role=SeriesRole.SIGNAL,
                    label="Signal",
                    line_color="#9e9e9e",
                    line_style=LineStyle.DOTTED,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
            ],
            reference_levels=[
                ReferenceLevel(
                    value=0.05,
                    line_color="#26a69a",
                    line_label="0.05",
                    line_style=LineStyle.DASHED,
                ),
                ReferenceLevel(
                    value=-0.05,
                    line_color="#ef5350",
                    line_label="-0.05",
                    line_style=LineStyle.DASHED,
                ),
                ReferenceLevel(
                    value=0.0,
                    line_color="#9e9e9e",
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

    @property
    def name(self) -> str:
        return "crsi"

    @property
    def description(self) -> str:
        return "Cyclic RSI with dynamic bands - RSI with cyclic smoothing and adaptive bands"

    @property
    def category(self) -> str:
        return "oscillator"

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        from app.services import indicators as indicators_module
        domcycle = kwargs.get('domcycle', 20)
        vibration = kwargs.get('vibration', 14)
        leveling = kwargs.get('leveling', 11.0)
        cyclicmemory = kwargs.get('cyclicmemory', 40)
        return indicators_module.calculate_crsi(
            df,
            domcycle=domcycle,
            vibration=vibration,
            leveling=leveling,
            cyclicmemory=cyclicmemory
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
                condition_type="indicator_crosses_upper",
                label="Crosses Upper Band",
                description="cRSI crosses above upper band",
                applicable_fields=["cRSI"],
                requires_threshold=False,  # Uses band value instead
            ),
            AlertTemplate(
                condition_type="indicator_crosses_lower",
                label="Crosses Lower Band",
                description="cRSI crosses below lower band",
                applicable_fields=["cRSI"],
                requires_threshold=False,  # Uses band value instead
            ),
        ]


class ADXVMAIndicator(Indicator):
    """ADX Volatility Moving Average indicator.

    ADXVMA is an adaptive moving average that adjusts its smoothing
    based on trend volatility and direction.
    """

    @property
    def name(self) -> str:
        return "adxvma"

    @property
    def description(self) -> str:
        return "ADX Volatility Moving Average - adaptive MA based on trend volatility"

    @property
    def category(self) -> str:
        return "overlay"

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        from app.services import indicators as indicators_module
        adxvma_period = kwargs.get('adxvma_period', 15)
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
            color_mode=ColorMode.SINGLE,
            color_schemes={
                "bullish": "#2962ff",    # Blue
                "bearish": "#ef5350",    # Red (slope bearish)
                "neutral": "#9e9e9e",   # Gray (slope flat)
            },
            series_metadata=[
                SeriesMetadata(
                    field="ADXVMA",
                    role=SeriesRole.MAIN,
                    label="ADXVMA",
                    line_color="#2962ff",
                    line_style=LineStyle.SOLID,
                    line_width=3,
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

    @property
    def name(self) -> str:
        return "ema"

    @property
    def description(self) -> str:
        return "Exponential Moving Average - weights recent prices more heavily"

    @property
    def category(self) -> str:
        return "overlay"

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        period = kwargs.get('period', 20)
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
        - display_type: overlay or pane
        - category: Indicator category
        - parameters: Parameter definitions
        - metadata: Full IndicatorMetadata object
        - alert_templates: Available alert conditions

        Used by GET /api/v1/indicators/supported endpoint.
        """
        return [
            {
                "name": ind.name,
                "description": ind.description,
                "display_type": ind.category,
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
