"""Pandas-ta Indicator Wrapper and Auto-Discovery Module.

This module provides generic wrapper classes for pandas-ta indicators and
auto-discovers all available indicators at startup.

Architecture:
- PandasTAIndicator: Generic wrapper for any pandas-ta indicator function
- create_pandas_ta_indicator: Factory function to create indicator wrappers
- discover_pandas_ta_indicators: Auto-discovers all available indicators
- PANDAS_TA_CONFIG: Metadata overrides for indicators requiring custom config
"""

import inspect
import logging
from typing import Any, Dict, List, Optional, Type, Union, Callable
from dataclasses import dataclass, field

import pandas as pd
import numpy as np
try:
    import pandas_ta as pta
except:
    try:
        import pandas_ta_remake as pta
    except:
        import pandas_ta_classic as pta

from app.schemas.indicator import (
    IndicatorMetadata, IndicatorDisplayType, ColorMode,
    SeriesMetadata, SeriesRole, LineStyle, DisplayType,
    ScaleRangesConfig, ReferenceLevel, ParameterDefinition,
)
from app.services.indicator_registry.registry import Indicator

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration: Metadata Overrides for Specific Indicators
# ============================================================================

# Indicators that need custom metadata (not auto-detectable)
PANDAS_TA_CONFIG: Dict[str, Dict[str, Any]] = {
    # RSI - bounded 0-100 with reference levels
    "rsi": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=0.0, max=100.0, auto=False),
        "reference_levels": [
            ReferenceLevel(value=30, line_color="#b2ebf2", line_label="30", line_style=LineStyle.DASHED),
            ReferenceLevel(value=70, line_color="#ef5350", line_label="70", line_style=LineStyle.DASHED),
        ],
    },
    # MACD - multi-series with histogram
    "macd": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "histogram": True,
    },
    # BBANDS - overlay bands
    "bbands": {
        "display_type": IndicatorDisplayType.OVERLAY,
        "color_mode": ColorMode.SINGLE,
        "band_fields": ["lower", "middle", "upper"],
    },
    # ATR - volatility pane
    "atr": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
    },
    # Stochastic - bounded 0-100
    "stoch": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=0.0, max=100.0, auto=False),
        "reference_levels": [
            ReferenceLevel(value=20, line_color="#b2ebf2", line_label="20", line_style=LineStyle.DASHED),
            ReferenceLevel(value=80, line_color="#ef5350", line_label="80", line_style=LineStyle.DASHED),
        ],
    },
    # Stochastic RSI - bounded 0-100
    "stochrsi": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=0.0, max=100.0, auto=False),
    },
    # CCI - typically -100 to 100
    "cci": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=-100.0, max=100.0, auto=False),
        "reference_levels": [
            ReferenceLevel(value=0, line_color="#808080", line_label="0", line_style=LineStyle.DASHED),
        ],
    },
    # Williams %R - bounded -100 to 0
    "willr": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=-100.0, max=0.0, auto=False),
    },
    # CMO - bounded -100 to 100
    "cmo": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=-100.0, max=100.0, auto=False),
        "reference_levels": [
            ReferenceLevel(value=0, line_color="#808080", line_label="0", line_style=LineStyle.DASHED),
        ],
    },
    # Money Flow Index - bounded 0-100
    "mfi": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=0.0, max=100.0, auto=False),
        "reference_levels": [
            ReferenceLevel(value=20, line_color="#b2ebf2", line_label="20", line_style=LineStyle.DASHED),
            ReferenceLevel(value=80, line_color="#ef5350", line_label="80", line_style=LineStyle.DASHED),
        ],
    },
    # ADX - trend strength 0-100
    "adx": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=0.0, max=100.0, auto=False),
    },
    # Aroon - bounded 0-100
    "aroon": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=0.0, max=100.0, auto=False),
        "reference_levels": [
            ReferenceLevel(value=50, line_color="#808080", line_label="50", line_style=LineStyle.DASHED),
        ],
    },
    # Bollinger Band %B - bounded 0-1
    "bbp": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=0.0, max=1.0, auto=False),
    },
    # Keltner Channels
    "kc": {
        "display_type": IndicatorDisplayType.OVERLAY,
        "color_mode": ColorMode.SINGLE,
        "band_fields": ["lower", "middle", "upper"],
    },
    # Donchian Channels
    "donchian": {
        "display_type": IndicatorDisplayType.OVERLAY,
        "color_mode": ColorMode.SINGLE,
        "band_fields": ["lower", "middle", "upper"],
    },
    # Ultimate Oscillator
    "uo": {
        "display_type": IndicatorDisplayType.PANE,
        "color_mode": ColorMode.SINGLE,
        "scale_ranges": ScaleRangesConfig(min=0.0, max=100.0, auto=False),
        "reference_levels": [
            ReferenceLevel(value=30, line_color="#b2ebf2", line_label="30", line_style=LineStyle.DASHED),
            ReferenceLevel(value=70, line_color="#ef5350", line_label="70", line_style=LineStyle.DASHED),
        ],
    },
}

# ============================================================================
# Column Name Mappings for Multi-Output Indicators
# ============================================================================

# Maps pandas-ta output columns to stable field names
COLUMN_MAPPINGS: Dict[str, Dict[str, str]] = {
    # MACD family
    "macd": {
        "MACD_": "macd",
        "MACDs_": "signal",
        "MACDh_": "histogram",
    },
    # Bollinger Bands
    "bbands": {
        "BBL_": "lower",
        "BBM_": "middle",
        "BBU_": "upper",
        "BBB_": "bandwidth",
        "BBP_": "percent_b",
    },
    # Keltner Channels
    "kc": {
        "KCL_": "lower",
        "KCM_": "middle",
        "KCU_": "upper",
    },
    # Donchian Channels
    "donchian": {
        "DCL_": "lower",
        "DCM_": "middle",
        "DCU_": "upper",
    },
    # Stochastic
    "stoch": {
        "STOCHk_": "stoch_k",
        "STOCHd_": "stoch_d",
        "STOCHh_": "stoch_h",
    },
    # Stochastic RSI
    "stochrsi": {
        "STOCHRSIk_": "stoch_rsi_k",
        "STOCHRSId_": "stoch_rsi_d",
    },
    # ADX
    "adx": {
        "ADX_": "adx",
        "DIP_": "dip",
        "DIN_": "din",
    },
    # Aroon
    "aroon": {
        "AROON_": "aroon",
        "AROONUp_": "aroon_up",
        "AROONDn_": "aroon_down",
    },
    # Ichimoku (deferred - complex)
    "ichimoku": {
        "ITS_": "tenkan",
        "IKS_": "kijun",
        "ISA_": "senkou_a",
        "ISB_": "senkou_b",
        "ICS_": "chikou",
    },
    # Volume Profile
    "vp": {
        "VP_": "vp",
    },
}

# ============================================================================
# Excluded Indicators (not suitable for auto-exposure)
# ============================================================================

EXCLUDED_INDICATORS = {
    # Price type helpers - not standalone indicators
    "hl2", "hlc3", "ohlc4", "wcp", "hilo",
    # Composite/confusing outputs
    "pivots", "pivot", "pivotfl", "pivotrf", "hl2", "hlc3", "ohlc4", "wcp", "hilo",
    # Rarely used or non-standard
    "alma", "crsi", "fisher", "ifisher", "kdj", "inertia", "decay",
    # Repainting indicators
    "zigzag", "zz",
    # Building blocks (used by other indicators)
    "true_range", "aberration",
    # Non-indicator functions (return non-Series/DataFrame or are helpers)
    "above", "above_value", "below", "below_value",
    "candle_color", "category_files", "cdl_pattern",
    # Non-standard outputs or numpy defaults
    "amat", "hampel", "v_array",
    # Internal/helper functions
    "cat", "scat", "constant", "camelCase2Title", "extension",
    # Utility functions (not technical indicators)
    "v_bool", "v_float", "v_int", "v_list", "v_lowerbound", "v_pos_default",
    "v_scalar", "v_series", "v_upperbound",
    "combination", "create_dir", "cross", "cross_value", "df_error_analysis",
    "fibonacci", "get_time", "help", "import_dir", "pascals_triangle",
    "simplify_columns", "speed_test", "sum_signed_rolling_deltas",
    "symmetric_triangle", "total_time", "xsignals",
    "cdl",  # Candle patterns - too many to display meaningfully
    "dpo",  # Detrended Price Oscillator - unusual output
    "ichimoku",  # Complex multi-output indicator
    "psar",  # Parabolic SAR - unusual defaults
    "nb_prenan", "nb_prepend", "nb_shift",  # Internal helpers
}

# ============================================================================
# Default Parameters for Common Indicators
# ============================================================================

DEFAULT_PARAMS: Dict[str, Dict[str, Any]] = {
    # Moving averages
    "sma": {"length": 20},
    "ema": {"length": 20},
    "dema": {"length": 20},
    "tema": {"length": 20},
    "wma": {"length": 20},
    "hma": {"length": 20},
    "vwma": {"length": 20},
    "vwap": {},
    "kama": {"length": 10, "fast": 2, "slow": 30},
    "mama": {"fastlimit": 0.5, "slowlimit": 0.05},
    "t3": {"length": 5, "a": 0.7},
    "vwap": {},
    # Momentum
    "rsi": {"length": 14},
    "macd": {"fast": 12, "slow": 26, "signal": 9},
    "stoch": {"k": 14, "d": 3, "smooth_k": 3},
    "stochrsi": {"length": 14, "rsi_length": 14, "k": 3, "d": 3},
    # Volatility
    "bbands": {"length": 20, "lower_std": 2.0, "upper_std": 2.0},
    "atr": {"length": 14},
    "kc": {"length": 20, "scalar": 2},
    "donchian": {"lower_length": 20, "upper_length": 20},
    # Trend
    "cci": {"length": 20},
    "adx": {"length": 14},
    "aroon": {"length": 25},
    # Volume
    "mfi": {"length": 14},
    "obv": {},
    # Other momentum/trend
    "willr": {"length": 14},
    "cmo": {"length": 14},
    "ao": {},
    "apo": {"fast": 12, "slow": 26},
    "ppo": {"fast": 12, "slow": 26},
    "pgo": {},
    "tsi": {"fast": 13, "slow": 25, "signal": 13},
    "uo": {"fast": 7, "medium": 14, "slow": 28},
    "roc": {"length": 10},
    "mom": {"length": 10},
    "fi": {"length": 13, "drift": 1},
    "eri": {"length": 13},
    "cog": {"length": 10},
    "mid_price": {"length": 14},
    "mid_point": {"length": 14},
    "pvo": {"fast": 12, "slow": 26, "signal": 9},
    # Statistical
    "zscore": {"length": 20, "std": 2.0},
    "percent_rank": {"length": 20},
}


# ============================================================================
# Utility Functions
# ============================================================================

def get_pandas_ta_function(name: str) -> Optional[Callable]:
    """Get a pandas-ta function by name."""
    return getattr(pta, name, None)


def is_valid_indicator(name: str, func: Callable) -> bool:
    """Check if a pandas-ta function is a valid indicator for auto-exposure."""
    # Must be callable
    if not callable(func):
        return False

    # Must not be excluded
    if name.lower() in EXCLUDED_INDICATORS:
        return False

    # Must not start with underscore (private/internal)
    if name.startswith("_"):
        return False

    # Must not be all uppercase (constants/classes)
    if name.isupper():
        return False

    # Skip non-indicator functions
    skip_names = {
        "pta", "ta", "core", "Imports", "Strategy", "Study", "Category",
        "AnalysisIndicators", "CommonStudy", "AllStudy",
        "cat", "scat", "camelCase2Title", "constant", "extension",
    }
    if name in skip_names:
        return False

    # Try to get the function signature - indicators typically take price data
    try:
        sig = inspect.signature(func)
        params = list(sig.parameters.keys())
        # Indicators should have at least one parameter
        if len(params) == 0:
            return False
    except (ValueError, TypeError):
        # Some functions don't have inspectable signatures
        # Fall back to checking if it looks like an indicator
        pass

    return True


def discover_available_indicators() -> List[str]:
    """Discover all available pandas-ta indicators for auto-exposure.

    Returns:
        List of indicator names that can be auto-registered
    """
    indicators = []

    for name in dir(pta):
        if not name.startswith("_") and not name.isupper():
            func = getattr(pta, name)
            if is_valid_indicator(name, func):
                indicators.append(name)

    logger.info(f"Discovered {len(indicators)} pandas-ta indicators")
    return sorted(indicators)


# ============================================================================
# PandasTAIndicator Generic Wrapper Class
# ============================================================================

class PandasTAIndicator(Indicator):
    """Generic wrapper for pandas-ta indicators.

    This class wraps any pandas-ta indicator function and provides
    a consistent interface for the Indicator Registry system.

    Example:
        indicator = PandasTAIndicator("rsi", length=14)
        result = indicator.calculate(df)
        metadata = indicator.metadata
    """

    # Class-level cache of indicator functions
    _func_cache: Dict[str, Callable] = {}

    def __init__(
        self,
        indicator_name: str,
        length: Optional[int] = None,
        period: Optional[int] = None,
        **kwargs
    ):
        """Initialize the indicator wrapper.

        Args:
            indicator_name: Name of the pandas-ta indicator function
            length: Standard length parameter (passed as-is to pandas-ta)
            period: Alias for length (passed as length to pandas-ta)
            **kwargs: Additional indicator-specific parameters
        """
        # Handle length/period aliasing - period is an alias for length
        params = kwargs.copy()
        if period is not None:
            params['period'] = period
        if length is not None:
            params['length'] = length

        # Apply defaults if no params provided
        if not params and indicator_name in DEFAULT_PARAMS:
            params = DEFAULT_PARAMS[indicator_name].copy()

        # Initialize _func before calling super().__init__ to avoid issues
        self._indicator_name = indicator_name
        self._func: Optional[Callable] = None

        super().__init__(**params)
        self._column_mapping: Dict[str, str] = COLUMN_MAPPINGS.get(indicator_name, {})
        # Store params for serialization
        self._init_params = params.copy()

    def serialize_params(self) -> str:
        """Serialize indicator parameters to JSON string."""
        import json
        return json.dumps({
            "base_name": self.base_name,
            "parameters": self._init_params
        })

    @property
    def base_name(self) -> str:
        """Return the base indicator name."""
        return self._indicator_name.lower()

    @property
    def name(self) -> str:
        """Return clean indicator name (base_name only, no parameter suffix).

        For pandas-ta indicators, we use just the base_name to keep names clean.
        The parameter values are available via parameter_definitions() for
        frontend configuration if needed.
        """
        return self.base_name

    @property
    def description(self) -> str:
        """Return the indicator description."""
        # Try to get docstring from pandas-ta function
        func = self._get_func()
        if func and func.__doc__:
            # Clean up docstring - take first line
            doc_lines = func.__doc__.strip().split("\n")
            desc = doc_lines[0].strip() if doc_lines else f"{self.base_name} indicator"
            # Limit length
            if len(desc) > 100:
                desc = desc[:97] + "..."
            return desc

        return f"{self.base_name.replace('_', ' ').title()} indicator"

    @property
    def category(self) -> str:
        """Return the indicator category based on name patterns."""
        name = self.base_name

        # Overlay indicators
        if name in ["sma", "ema", "dema", "tema", "wma", "hma", "kama", "mama",
                    "vwma", "swma", "fwma", "linreg", "vwap", "bbands", "kc",
                    "donchian", "atr", "natr"]:
            return "overlay"

        # Oscillators/Momentum
        if name in ["rsi", "macd", "stoch", "stochrsi", "cci", "mfi", "adx",
                    "aroon", "willr", "cmo", "mom", "roc", "ppo", "apo",
                    "uo", "tsi", "pgo", "ao", "bias", "cti", "ERI", "fi"]:
            return "oscillator"

        # Volume
        if name in ["obv", "ad", "adosc", "aobv", "cmf", "mfi", "eom",
                    "kvo", "nvi", "pvi", "pvo", "pvol", "vwap"]:
            return "volume"

        return "oscillator"  # Default category

    @property
    def parameter_definitions(self) -> Dict[str, ParameterDefinition]:
        """Return parameter definitions based on pandas-ta function signature.

        Uses DEFAULT_PARAMS for known indicators when function signature has no default.
        """
        func = self._get_func()
        if not func:
            return {}

        param_defs = {}
        sig = None

        try:
            sig = inspect.signature(func)
        except (ValueError, TypeError):
            pass

        # Get default params for this indicator (if any)
        indicator_defaults = DEFAULT_PARAMS.get(self.base_name, {})

        if sig:
            for param_name, param in sig.parameters.items():
                # Skip 'kwargs' and '*args' style parameters
                if param.kind in (inspect.Parameter.VAR_POSITIONAL,
                                  inspect.Parameter.VAR_KEYWORD):
                    continue

                # Map common parameter names (keep original for validation)
                mapped_name = param_name

                # Determine default value - prefer DEFAULT_PARAMS, then function default
                # NOTE: pandas-ta functions often have default=None in their signature,
                # so we check for both None and empty to apply our sensible defaults
                default = param.default
                if default is None or default is inspect.Parameter.empty:
                    # Use default from DEFAULT_PARAMS if available, otherwise skip this param
                    if param_name in indicator_defaults:
                        default = indicator_defaults[param_name]
                    else:
                        # Skip parameters without a sensible default (None or empty)
                        # This filters out optional pandas-ta params like scalar, mamode, etc.
                        continue

                # Set bounds based on parameter name
                min_val = None
                max_val = None

                if "length" in param_name or "period" in param_name:
                    min_val = 2
                    max_val = 500
                elif "std" in param_name or "scalar" in param_name:
                    min_val = 0.1
                    max_val = 5.0
                elif "limit" in param_name:
                    # For MAMA fastlimit/slowlimit (0-1 range)
                    min_val = 0.0
                    max_val = 1.0
                elif "fast" in param_name:
                    min_val = 2
                    max_val = 200
                elif "slow" in param_name:
                    min_val = 2
                    max_val = 300
                elif "signal" in param_name:
                    min_val = 2
                    max_val = 100

                # Determine type based on actual default value
                if isinstance(default, bool):
                    param_type = "boolean"
                elif isinstance(default, int):
                    param_type = "integer"
                elif isinstance(default, float):
                    param_type = "float"
                else:
                    param_type = "integer"  # Default to integer for numeric params

                param_defs[mapped_name] = ParameterDefinition(
                    type=param_type,
                    default=default,
                    min=min_val,
                    max=max_val,
                    description=f"{param_name} parameter for {self.base_name}"
                )

        return param_defs

    def _get_func(self) -> Optional[Callable]:
        """Get the pandas-ta function, with caching."""
        if self._func is None:
            if self._indicator_name in PandasTAIndicator._func_cache:
                self._func = PandasTAIndicator._func_cache[self._indicator_name]
            else:
                self._func = get_pandas_ta_function(self._indicator_name)
                if self._func:
                    PandasTAIndicator._func_cache[self._indicator_name] = self._func
        return self._func

    def calculate(self, df: pd.DataFrame, **kwargs) -> pd.DataFrame:
        """Calculate the indicator on the given DataFrame.

        Args:
            df: DataFrame with OHLCV data (must have 'close' column at minimum)
            **kwargs: Indicator-specific parameters

        Returns:
            DataFrame with original columns plus indicator columns
        """
        func = self._get_func()
        if func is None:
            raise ValueError(f"pandas-ta function not found: {self._indicator_name}")

        # Prepare input based on what the function expects
        # pandas-ta indicators use keyword arguments for all parameters including 'close'
        try:
            # Build keyword arguments for the pandas-ta function
            pandas_ta_kwargs = {'close': df['close']}

            # Add other OHLCV columns if needed
            if 'high' in kwargs or self._needs_high(df, func):
                pandas_ta_kwargs['high'] = df['high']
            if 'low' in kwargs or self._needs_low(df, func):
                pandas_ta_kwargs['low'] = df['low']
            if 'volume' in kwargs or self._needs_volume(df, func):
                pandas_ta_kwargs['volume'] = df['volume']

            # Add indicator-specific parameters (length, fast, slow, etc.)
            pandas_ta_kwargs.update(kwargs)

            result = func(**pandas_ta_kwargs)
        except Exception as e:
            logger.error(f"Error calculating {self._indicator_name}: {e}")
            raise ValueError(f"Indicator calculation failed: {e}")

        # Handle None result (pandas-ta returns None when insufficient data)
        if result is None:
            # Return a DataFrame with NaN columns for the indicator
            df_copy = df.copy()
            for series_meta in self.metadata.series_metadata:
                df_copy[series_meta.field] = pd.NA
            return df_copy

        # Convert result to DataFrame if it's a Series
        if isinstance(result, pd.Series):
            result = result.to_frame()

        # Map column names to stable field names
        df_copy = df.copy()
        result = self._map_columns(result)
        return df_copy.join(result)

    def _needs_high(self, df: pd.DataFrame, func: Callable) -> bool:
        """Check if function likely needs high prices."""
        sig = None
        try:
            sig = inspect.signature(func)
        except (ValueError, TypeError):
            pass
        if sig:
            params = list(sig.parameters.keys())
            return 'high' in params or len(params) >= 2
        return False

    def _needs_low(self, df: pd.DataFrame, func: Callable) -> bool:
        """Check if function likely needs low prices."""
        sig = None
        try:
            sig = inspect.signature(func)
        except (ValueError, TypeError):
            pass
        if sig:
            params = list(sig.parameters.keys())
            return 'low' in params or len(params) >= 3
        return False

    def _needs_volume(self, df: pd.DataFrame, func: Callable) -> bool:
        """Check if function likely needs volume."""
        sig = None
        try:
            sig = inspect.signature(func)
        except (ValueError, TypeError):
            pass
        if sig:
            params = list(sig.parameters.keys())
            return 'volume' in params
        return False

    def _map_columns(self, result: pd.DataFrame) -> pd.DataFrame:
        """Map dynamic pandas-ta column names to stable field names."""
        if len(result.columns) == 1:
            # Single output - use base_name as field
            stable_name = self.base_name
            result.columns = [stable_name]
            return result

        # Multi-output - map each column
        mapping = self._column_mapping
        new_columns = {}

        for col in result.columns:
            # Try pattern matching
            matched = False
            for pattern, field_name in mapping.items():
                if col.startswith(pattern):
                    new_columns[col] = field_name
                    matched = True
                    break

            if not matched:
                # Fallback: use cleaned column name
                # Remove parameter suffixes like "_20", "_2.0", etc.
                import re
                clean = re.sub(r'[\d._]+$', '', col).lower()
                # Remove common prefixes
                for prefix in [f"{self.base_name}_", f"{self.base_name.upper()}_"]:
                    if clean.startswith(prefix):
                        clean = clean[len(prefix):]
                if not clean:
                    clean = self.base_name
                new_columns[col] = clean

        result.columns = [new_columns.get(c, c) for c in result.columns]
        return result

    @property
    def metadata(self) -> IndicatorMetadata:
        """Generate metadata for the indicator."""
        name = self.base_name
        config = PANDAS_TA_CONFIG.get(name, {})

        # Determine display type
        if "display_type" in config:
            display_type = config["display_type"]
        else:
            display_type = self._infer_display_type()

        # Determine color mode
        if "color_mode" in config:
            color_mode = config["color_mode"]
        else:
            color_mode = ColorMode.SINGLE

        # Get color schemes
        color_schemes = config.get("color_schemes", {
            "bullish": "#00FF00",
            "bearish": "#FF0000",
            "neutral": "#808080",
        })

        # Get scale ranges (use config if available, otherwise auto-generate)
        if "scale_ranges" in config:
            scale_ranges = config["scale_ranges"]
        else:
            scale_ranges = self._generate_scale_ranges()

        # Generate series metadata
        series_metadata = self._generate_series_metadata(config)

        # Get reference levels
        reference_levels = config.get("reference_levels", [])

        return IndicatorMetadata(
            display_type=display_type,
            color_mode=color_mode,
            color_schemes=color_schemes,
            scale_ranges=scale_ranges,
            series_metadata=series_metadata,
            reference_levels=reference_levels,
        )

    def _infer_display_type(self) -> IndicatorDisplayType:
        """Infer display type based on indicator characteristics."""
        name = self.base_name

        # Overlay indicators
        overlays = ["sma", "ema", "dema", "tema", "wma", "hma", "kama", "mama",
                    "vwma", "swma", "fwma", "linreg", "vwap", "bbands", "kc",
                    "donchian", "atr", "natr"]
        if name in overlays:
            return IndicatorDisplayType.OVERLAY

        return IndicatorDisplayType.PANE

    def _generate_scale_ranges(self) -> ScaleRangesConfig:
        """Generate scale ranges based on indicator type."""
        name = self.base_name

        # Indicators with fixed 0-100 range
        bounded_100 = ["rsi", "stoch", "stochrsi", "mfi", "willr", "cmo", "uo",
                       "adx", "aroon", "mom", "roc", "ppo", "apo", "cci"]
        if name in bounded_100:
            return ScaleRangesConfig(min=0.0, max=100.0, auto=False)

        # Indicators with fixed -100 to 100 range
        bounded_100_center = ["cci"]
        if name in bounded_100_center:
            return ScaleRangesConfig(min=-100.0, max=100.0, auto=False)

        # Default: auto-scale
        return ScaleRangesConfig(min=0.0, max=1.0, auto=True)

    def _generate_series_metadata(self, config: Dict[str, Any]) -> List[SeriesMetadata]:
        """Generate series metadata for the indicator."""
        name = self.base_name

        # Check for band fields (multi-line overlays)
        if "band_fields" in config:
            return [
                SeriesMetadata(
                    field="upper",
                    role=SeriesRole.BAND,
                    label="Upper",
                    line_color="#808080",
                    line_style=LineStyle.SOLID,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="middle",
                    role=SeriesRole.BAND,
                    label="Middle",
                    line_color="#808080",
                    line_style=LineStyle.DASHED,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="lower",
                    role=SeriesRole.BAND,
                    label="Lower",
                    line_color="#808080",
                    line_style=LineStyle.SOLID,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
            ]

        # Check for histogram
        if config.get("histogram"):
            return [
                SeriesMetadata(
                    field=self.base_name,
                    role=SeriesRole.MAIN,
                    label=name.upper(),
                    line_color="#2196F3",
                    line_style=LineStyle.SOLID,
                    line_width=2,
                    display_type=DisplayType.LINE,
                ),
                SeriesMetadata(
                    field="signal",
                    role=SeriesRole.SIGNAL,
                    label="Signal",
                    line_color="#FF9800",
                    line_style=LineStyle.SOLID,
                    line_width=1,
                    display_type=DisplayType.LINE,
                ),
            ]

        # Single series
        return [
            SeriesMetadata(
                field=name,
                role=SeriesRole.MAIN,
                label=name.replace("_", " ").upper(),
                line_color="#2196F3",
                line_style=LineStyle.SOLID,
                line_width=2,
                display_type=DisplayType.LINE,
            ),
        ]


# ============================================================================
# Factory Functions
# ============================================================================

def create_pandas_ta_indicator(indicator_name: str, **params) -> PandasTAIndicator:
    """Factory function to create a pandas-ta indicator wrapper.

    Args:
        indicator_name: Name of the pandas-ta indicator
        **params: Indicator parameters

    Returns:
        Configured PandasTAIndicator instance
    """
    return PandasTAIndicator(indicator_name, **params)


def create_indicator_with_params(indicator_name: str, params: Dict[str, Any]) -> Indicator:
    """Create an indicator from serialized parameters.

    Args:
        indicator_name: Base name of the indicator
        params: Parameter dictionary

    Returns:
        Indicator instance
    """
    return create_pandas_ta_indicator(indicator_name, **params)


def register_all_pandas_ta_indicators(registry: "IndicatorRegistry") -> int:
    """Auto-register all available pandas-ta indicators with the registry.

    Args:
        registry: The indicator registry to register with

    Returns:
        Number of indicators registered
    """
    indicators = discover_available_indicators()
    registered = 0

    for name in indicators:
        try:
            indicator = create_pandas_ta_indicator(name)
            registry.register(indicator)
            registered += 1
            logger.debug(f"Registered pandas-ta indicator: {name}")
        except Exception as e:
            logger.warning(f"Failed to register indicator '{name}': {e}")

    logger.info(f"Auto-registered {registered} pandas-ta indicators")
    return registered
