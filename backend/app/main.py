from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.api import api_router
from app.services.data_poller import DataPoller
from app.services.alert_engine import AlertEngine
from app.services.alpha_vantage import AlphaVantageService
from app.db.session import AsyncSessionLocal
import asyncio

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

@app.on_event("startup")
async def startup_event():
    print("Starting up and initializing poller...")
    av_service = AlphaVantageService(api_key=settings.ALPHA_VANTAGE_API_KEY)
    engine = AlertEngine(db_session_factory=AsyncSessionLocal)
    
    app.state.poller = DataPoller(
        alpha_vantage_service=av_service,
        symbols=["IBM"],
        db_session_factory=AsyncSessionLocal,
        alert_engine=engine,
        interval=3600
    )
    app.state.poller_task = asyncio.create_task(app.state.poller.start())

@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down poller...")
    if app.state.poller:
        app.state.poller.stop()
    if app.state.poller_task:
        await app.state.poller_task

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Welcome to TradingAlert API"}