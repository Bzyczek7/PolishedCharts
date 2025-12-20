from fastapi import APIRouter
from app.api.v1 import candles, alerts

api_router = APIRouter()
api_router.include_router(candles.router, prefix="/candles", tags=["candles"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
