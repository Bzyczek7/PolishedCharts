from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, Response
from app.core.config import settings
from app.api.api import api_router
from app.services.data_poller import DataPoller
from app.services.alert_engine import AlertEngine
from app.services.worker_manager import WorkerManager
from app.db.session import AsyncSessionLocal
import asyncio
import traceback
import logging

# Set all CORS enabled origins - MUST BE ADDED BEFORE ROUTER
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    default_response_class=ORJSONResponse
)

# Add CORS middleware FIRST (before router) so it applies to all responses
# Note: Authorization header must be explicitly listed (wildcard * doesn't cover it in Chrome 97+)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "Authorization"],  # Explicitly include Authorization
)


# Handle CORS preflight (OPTIONS) requests before they reach auth middleware
@app.middleware("http")
async def handle_cors_preflight(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": "http://localhost:5173",
                "Access-Control-Allow-Methods": "*",
                # Note: Chrome requires explicit Authorization header listing (wildcard * insufficient)
                "Access-Control-Allow-Headers": "*, Authorization",
                "Access-Control-Allow-Credentials": "true",
            }
        )
    response = await call_next(request)
    return response

logger = logging.getLogger(__name__)

# Initialize WorkerManager
worker_manager = WorkerManager()

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

    # Initialize Firebase Admin SDK (T020)
    from app.services.firebase_admin import initialize_firebase
    try:
        initialize_firebase()
        print("Firebase Admin SDK initialized")
    except Exception as e:
        print(f"WARNING: Firebase Admin SDK initialization failed: {e}")
        print("Authentication endpoints will not be available")

    engine = AlertEngine(db_session_factory=AsyncSessionLocal)

    # Initialize indicator registry with standard variants
    from app.services.indicator_registry.initialization import initialize_standard_indicators, load_registered_indicators
    from app.services.indicator_registry import get_registry

    initialize_standard_indicators()
    print("Indicator registry initialized with standard variants")

    # Load user-defined indicator configurations
    registry = get_registry()
    load_registered_indicators(registry)
    print("User-defined indicator configurations loaded")

    # Create singleton orchestrator (shared across all requests for locks and provider caching)
    from app.services.orchestrator import DataOrchestrator
    from app.services.candles import CandleService
    from app.services.providers import YFinanceProvider
    from app.services.market_hours import MarketHoursService

    app.state.candle_service = CandleService()
    app.state.yf_provider = YFinanceProvider()
    app.state.orchestrator = DataOrchestrator(
        app.state.candle_service,
        app.state.yf_provider
    )
    print("Singleton orchestrator initialized")

    # Initialize MarketHoursService for market-hours gating
    app.state.market_hours_service = MarketHoursService()
    print("MarketHoursService initialized")

    # Initialize DataPoller with market-hours gating
    # Crypto assets (24/7) are kept as base symbols; watchlist equities are loaded from DB
    from app.services.data_poller import DataPoller
    app.state.poller = DataPoller(
        yf_provider=app.state.yf_provider,
        symbols=["BTC/USD"],  # Crypto assets (24/7) - equities loaded from DB via load_watchlist_from_db()
        db_session_factory=AsyncSessionLocal,
        alert_engine=engine,
        interval=3600,
        market_hours_service=app.state.market_hours_service
    )
    # Use worker_manager to start the poller task
    app.state.poller_task = worker_manager.start_task("data_poller", app.state.poller.start())
    print("DataPoller started with market-hours gating")

@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down workers...")
    if hasattr(app.state, "poller") and app.state.poller:
        app.state.poller.stop()

    await worker_manager.stop_all(timeout=5.0)

# Include API router AFTER CORS middleware
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Welcome to TradingAlert API"}
