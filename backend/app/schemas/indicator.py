from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class SeriesMetadata(BaseModel):
    field: str
    role: str # "main", "signal", "band"
    label: str
    line_color: str
    line_style: str = "solid" # "solid", "dashed"
    line_width: int = 2
    display_type: str = "line" # "line", "histogram"

class IndicatorMetadata(BaseModel):
    display_type: str # "overlay" or "pane"
    color_schemes: Dict[str, Any]
    color_mode: Optional[str] = "single" # "single", "threshold"
    thresholds: Optional[Dict[str, float]] = None
    scale_ranges: Optional[Dict[str, Any]] = None
    series_metadata: Optional[List[SeriesMetadata]] = None
    reference_levels: Optional[List[Dict[str, Any]]] = None

class TDFIOutput(BaseModel):
    timestamps: List[str]
    tdfi: List[Optional[float]]
    tdfi_signal: List[Optional[int]]
    metadata: IndicatorMetadata

class cRSIOutput(BaseModel):
    timestamps: List[str]
    crsi: List[Optional[float]]
    upper_band: List[Optional[float]]
    lower_band: List[Optional[float]]
    metadata: IndicatorMetadata

class ADXVMAOutput(BaseModel):
    timestamps: List[str]
    adxvma: List[Optional[float]]
    metadata: IndicatorMetadata