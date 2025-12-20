from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class IndicatorMetadata(BaseModel):
    display_type: str # "overlay" or "pane"
    color_schemes: Dict[str, Any]
    scale_ranges: Optional[Dict[str, Any]] = None

class TDFIOutput(BaseModel):
    tdfi: List[float]
    tdfi_signal: List[int]
    metadata: IndicatorMetadata

class cRSIOutput(BaseModel):
    crsi: List[float]
    upper_band: List[float]
    lower_band: List[float]
    metadata: IndicatorMetadata

class ADXVMAOutput(BaseModel):
    adxvma: List[float]
    metadata: IndicatorMetadata
