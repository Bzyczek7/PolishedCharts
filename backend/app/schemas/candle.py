from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CandleResponse(BaseModel):
    ticker: str
    interval: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: Optional[int] = None

class BackfillRequest(BaseModel):
    symbol: str
    interval: str
    start_date: datetime
    end_date: datetime

class BackfillResponse(BaseModel):
    status: str
    job_id: Optional[int] = None
    message: Optional[str] = None

    class Config:
        from_attributes = True
