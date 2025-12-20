from fastapi import APIRouter
from app.api.v1 import candles, alerts, indicators

api_router = APIRouter()
api_router.include_router(candles.router, prefix="/candles", tags=["candles"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(indicators.router, prefix="/indicators", tags=["indicators"])
