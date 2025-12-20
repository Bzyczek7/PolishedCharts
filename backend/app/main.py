from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.core.config import settings
from app.api.api import api_router
from app.services.data_poller import DataPoller
from app.services.alert_engine import AlertEngine
from app.services.alpha_vantage import AlphaVantageService
from app.db.session import AsyncSessionLocal
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up...")
    av_service = AlphaVantageService(api_key=settings.ALPHA_VANTAGE_API_KEY)
    engine = AlertEngine(db_session_factory=AsyncSessionLocal)
    
    # We will poll for 'IBM' as a default for now
    app.state.poller = DataPoller(
        alpha_vantage_service=av_service,
        symbols=["IBM"],
        db_session_factory=AsyncSessionLocal,
        alert_engine=engine,
        interval=3600 # Poll every hour
    )
    # Run the poller in the background
    app.state.poller_task = asyncio.create_task(app.state.poller.start())
    
    yield
    
    # Shutdown
    print("Shutting down...")
    if app.state.poller:
        app.state.poller.stop()
    if app.state.poller_task:
        await app.state.poller_task


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# ... (rest of the file remains the same)