from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CandleResponse(BaseModel):
    id: int
    ticker: str
    interval: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: Optional[int] = None

    class Config:
        from_attributes = True
