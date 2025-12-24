"""Indicator schemas for advanced indicators feature.

This module defines the Pydantic schemas for indicator metadata, output,
and related data structures following the metadata-driven indicator contract.
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum


class LineStyle(str, Enum):
    """Line style options for indicator series."""
    SOLID = "solid"
    DASHED = "dashed"
    DOTTED = "dotted"


class DisplayType(str, Enum):
    """How indicator is displayed on chart."""
    LINE = "line"
    HISTOGRAM = "histogram"
    AREA = "area"


class SeriesRole(str, Enum):
    """Role of a series within an indicator."""
    MAIN = "main"
    SIGNAL = "signal"
    BAND = "band"
    HISTOGRAM = "histogram"


class IndicatorDisplayType(str, Enum):
    """Whether indicator draws on price chart or separate pane."""
    OVERLAY = "overlay"
    PANE = "pane"


class ColorMode(str, Enum):
    """How colors are applied to indicator values."""
    SINGLE = "single"
    THRESHOLD = "threshold"
    GRADIENT = "gradient"


class ThresholdsConfig(BaseModel):
    """Threshold values for threshold-based coloring."""
    high: float = Field(..., description="Upper threshold value")
    low: float = Field(..., description="Lower threshold value")

    @field_validator('high')
    @classmethod
    def high_must_be_greater_than_low(cls, v: float, info) -> float:
        if 'low' in info.data and v <= info.data['low']:
            raise ValueError('high threshold must be greater than low threshold')
        return v


class ScaleRangesConfig(BaseModel):
    """Y-axis scale configuration for pane indicators."""
    min: float = Field(..., description="Minimum Y-axis value")
    max: float = Field(..., description="Maximum Y-axis value")
    auto: bool = Field(default=False, description="If True, auto-scale instead of using min/max")

    @field_validator('min')
    @classmethod
    def min_must_be_less_than_max(cls, v: float, info) -> float:
        if 'max' in info.data and v >= info.data['max']:
            raise ValueError('min scale must be less than max scale')
        return v


class SeriesMetadata(BaseModel):
    """Metadata for a single visual series (line, histogram, band)."""
    field: str = Field(..., description="Data field name in indicator output")
    role: SeriesRole = Field(..., description="Role of this series")
    label: str = Field(..., description="Human-readable name for legend/UI")
    line_color: str = Field(..., pattern=r'^#[0-9A-Fa-f]{6}$', description="Hex color code")
    line_style: LineStyle = Field(default=LineStyle.SOLID, description="Line style")
    line_width: int = Field(default=1, ge=1, le=5, description="Line width in pixels")
    display_type: DisplayType = Field(default=DisplayType.LINE, description="How to display this series")


class ReferenceLevel(BaseModel):
    """Horizontal reference line on indicator pane."""
    value: float = Field(..., description="Y-axis value for the reference line")
    line_color: str = Field(..., pattern=r'^#[0-9A-Fa-f]{6}$', description="Hex color code")
    line_label: str = Field(..., description="Text label shown next to the line")
    line_style: LineStyle = Field(default=LineStyle.DASHED, description="Line style")


class IndicatorMetadata(BaseModel):
    """Configuration for rendering an indicator.

    This is the core contract between backend and frontend that enables
    generic rendering without per-indicator frontend code.
    """
    display_type: IndicatorDisplayType = Field(
        ...,
        description="overlay: draws on price chart; pane: creates separate pane below"
    )
    color_mode: ColorMode = Field(
        ...,
        description="single: one color; threshold: color based on value ranges; gradient: color gradient"
    )
    color_schemes: Dict[str, str] = Field(
        ...,
        description="State to hex color mapping (bullish, bearish, neutral, etc.)"
    )
    thresholds: Optional[ThresholdsConfig] = Field(
        default=None,
        description="Threshold values for threshold-based coloring"
    )
    scale_ranges: Optional[ScaleRangesConfig] = Field(
        default=None,
        description="Y-axis scale configuration for pane indicators"
    )
    series_metadata: List[SeriesMetadata] = Field(
        ...,
        description="Metadata for each visual series (main line, bands, signals, histograms)"
    )
    reference_levels: Optional[List[ReferenceLevel]] = Field(
        default=None,
        description="Horizontal reference lines with labels"
    )


class IndicatorOutput(BaseModel):
    """Indicator calculation result with metadata for rendering.

    This is the standard response format for all indicator calculations,
    containing both the data values and the rendering metadata.
    """
    symbol: str = Field(..., description="Stock ticker symbol")
    interval: str = Field(..., description="Candle interval (1m, 5m, 1h, 1d, etc.)")

    timestamps: List[int] = Field(
        ...,
        description="Unix timestamps in seconds"
    )
    data: Dict[str, List[Optional[float]]] = Field(
        ...,
        description="Field name -> array of values (null for insufficient data)"
    )

    metadata: IndicatorMetadata = Field(
        ...,
        description="Rendering configuration for this indicator"
    )

    calculated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When calculation was performed"
    )
    data_points: int = Field(
        ...,
        description="Number of data points returned"
    )

    @field_validator('data')
    @classmethod
    def data_arrays_must_match_timestamps(cls, v: Dict[str, List[Optional[float]]], info) -> Dict[str, List[Optional[float]]]:
        """Ensure all data arrays have the same length as timestamps."""
        if 'timestamps' in info.data:
            expected_len = len(info.data['timestamps'])
            for field, values in v.items():
                if len(values) != expected_len:
                    raise ValueError(
                        f"Data array '{field}' has length {len(values)} "
                        f"but timestamps has length {expected_len}"
                    )
        return v


class ParameterDefinition(BaseModel):
    """Definition for an indicator parameter."""
    type: Literal["integer", "float", "string", "boolean"] = Field(..., description="Parameter type")
    default: Any = Field(..., description="Default value")
    min: Optional[float] = Field(None, description="Minimum value (for numeric types)")
    max: Optional[float] = Field(None, description="Maximum value (for numeric types)")
    description: str = Field(..., description="Human-readable parameter description")


class IndicatorInfo(BaseModel):
    """Information about an available indicator."""
    name: str = Field(..., description="Unique indicator identifier (e.g., 'crsi', 'tdfi')")
    description: str = Field(..., description="Human-readable indicator description")
    display_type: IndicatorDisplayType = Field(..., description="overlay or pane")
    category: Literal["overlay", "oscillator", "momentum", "trend", "volatility"] = Field(
        ..., description="Indicator category for grouping"
    )
    parameters: Dict[str, ParameterDefinition] = Field(
        default_factory=dict,
        description="Configurable parameters for this indicator"
    )
    metadata: Optional[IndicatorMetadata] = Field(
        default=None,
        description="Full metadata (returned by /supported endpoint)"
    )


# Legacy output schemas maintained for backward compatibility
# These will be deprecated in favor of generic IndicatorOutput

class TDFIOutput(BaseModel):
    """Legacy TDFI output - use IndicatorOutput instead."""
    timestamps: List[int]
    tdfi: List[Optional[float]]
    tdfi_signal: List[Optional[int]]
    metadata: IndicatorMetadata


class cRSIOutput(BaseModel):
    """Legacy cRSI output - use IndicatorOutput instead."""
    timestamps: List[int]
    crsi: List[Optional[float]]
    upper_band: List[Optional[float]]
    lower_band: List[Optional[float]]
    metadata: IndicatorMetadata


class ADXVMAOutput(BaseModel):
    """Legacy ADXVMA output - use IndicatorOutput instead."""
    timestamps: List[int]
    adxvma: List[Optional[float]]
    metadata: IndicatorMetadata
