from pydantic import BaseModel
from datetime import datetime

class CandleResponse(BaseModel):
    id: int
    ticker: str
    interval: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

    class Config:
        from_attributes = True
