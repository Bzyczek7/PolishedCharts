from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from app.core.config import settings
from app.api.api import api_router
from app.services.data_poller import DataPoller
from app.services.alert_engine import AlertEngine
from app.services.alpha_vantage import AlphaVantageService
from app.db.session import AsyncSessionLocal
import asyncio
import traceback
import logging

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    default_response_class=ORJSONResponse
)

logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception handler caught: {exc}")
    logger.error(traceback.format_exc())
    return ORJSONResponse(
        status_code=500,
        content={
            "message": "Internal Server Error", 
            "detail": str(exc), 
            "traceback": traceback.format_exc()
        },
    )

@app.on_event("startup")
async def startup_event():
    print("Starting up and initializing poller...")
    av_service = AlphaVantageService(api_key=settings.ALPHA_VANTAGE_API_KEY)
    engine = AlertEngine(db_session_factory=AsyncSessionLocal)
    
    app.state.poller = DataPoller(
        alpha_vantage_service=av_service,
        symbols=["IBM", "AAPL", "BTC/USD", "TSLA", "MSFT", "GOOGL", "AMZN", "NVDA"],
        db_session_factory=AsyncSessionLocal,
        alert_engine=engine,
        interval=3600
    )
    app.state.poller_task = asyncio.create_task(app.state.poller.start())

@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down poller...")
    if hasattr(app.state, "poller") and app.state.poller:
        app.state.poller.stop()
    if hasattr(app.state, "poller_task") and app.state.poller_task:
        await app.state.poller_task

app.include_router(api_router, prefix=settings.API_V1_STR)

# Set all CORS enabled origins - MUST BE ADDED LAST TO BE OUTERMOST
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Welcome to TradingAlert API"}
