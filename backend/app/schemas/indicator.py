from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class IndicatorMetadata(BaseModel):
    display_type: str # "overlay" or "pane"
    color_schemes: Dict[str, Any]
    scale_ranges: Optional[Dict[str, Any]] = None
    series_metadata: Optional[List[Dict[str, Any]]] = None
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
