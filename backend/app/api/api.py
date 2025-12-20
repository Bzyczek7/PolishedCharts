from fastapi import APIRouter
from app.api.v1 import candles

api_router = APIRouter()
api_router.include_router(candles.router, prefix="/candles", tags=["candles"])
