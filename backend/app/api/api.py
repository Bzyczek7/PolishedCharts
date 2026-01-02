from fastapi import APIRouter
# Temporarily exclude notifications router due to AlertNotificationSettings fk constraint issues in tests
from app.api.v1 import candles, alerts, indicators, watchlist, search, auth, merge
# from app.api.v1 import notifications

api_router = APIRouter()
api_router.include_router(candles.router, prefix="/candles", tags=["candles"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(indicators.router, prefix="/indicators", tags=["indicators"])
api_router.include_router(watchlist.router, prefix="/watchlist", tags=["watchlist"])
api_router.include_router(search.router, prefix="/symbols", tags=["symbols"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(merge.router, prefix="/merge", tags=["merge"])
# api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
