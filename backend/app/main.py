from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, Response
from app.core.config import settings
from app.api.api import api_router
from app.services.data_poller import DataPoller
from app.services.alert_engine import AlertEngine
from app.services.indicator_service import IndicatorService
from app.services.worker_manager import WorkerManager
from app.db.session import AsyncSessionLocal
import asyncio
import traceback
import logging

# Configure logging to show INFO level messages
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://bzyczek7.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "Authorization"],  # Explicitly include Authorization
)


logger = logging.getLogger(__name__)

# Initialize WorkerManager
worker_manager = WorkerManager()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception handler caught: {exc}")
    logger.error(traceback.format_exc())

    # Get origin from request for CORS - allows browser to read error responses
    origin = request.headers.get("origin", "http://localhost:5173")

    return ORJSONResponse(
        status_code=500,
        content={
            "message": "Internal Server Error",
            "detail": str(exc),
        },
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    )


@app.get("/health")
async def health_check():
    """Health check endpoint that verifies critical services."""
    from app.services.firebase_admin import is_firebase_initialized

    status = {
        "status": "ok",
        "firebase": "initialized" if is_firebase_initialized() else "not_initialized"
    }

    # Try importing pandas-ta
    try:
        import pandas_ta
        status["pandas_ta"] = "ok"
    except ImportError:
        status["pandas_ta"] = "missing"
        status["status"] = "degraded"

    # Check database connectivity
    try:
        async with AsyncSessionLocal() as db:
            # Simple query to test connection
            from sqlalchemy import text
            await db.execute(text("SELECT 1"))
            status["database"] = "ok"
    except Exception as e:
        status["database"] = f"error: {str(e)[:100]}"
        status["status"] = "unhealthy"

    return status


@app.on_event("startup")
async def startup_event():
    print("Starting up and initializing poller...")

    # Auto-migrate database schema (synchronous - wait for completion)
    from alembic.config import Config
    from alembic import command
    import asyncio

    try:
        alembic_cfg = Config("alembic.ini")
        print("Running database migrations...")
        await asyncio.to_thread(command.upgrade, alembic_cfg, "head")
        print("✅ Database migrations completed")
    except Exception as e:
        print(f"❌ WARNING: Database migration failed: {e}")
        import traceback
        traceback.print_exc()

    # Initialize Firebase Admin SDK (T020) - CRITICAL for auth
    from app.services.firebase_admin import initialize_firebase, is_firebase_initialized
    try:
        initialize_firebase()
        if not is_firebase_initialized():
            raise RuntimeError("Firebase initialization completed but SDK not ready")
        print("✅ Firebase Admin SDK initialized successfully")
    except Exception as e:
        print(f"❌ CRITICAL: Firebase Admin SDK initialization failed: {e}")
        print("Authentication will NOT work. Please set FIREBASE_SERVICE_ACCOUNT_KEY environment variable.")
        print("Get service account key from: https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk")
        # Don't fail startup - allow app to run in guest mode

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

    # Initialize IndicatorService for custom indicator calculation
    indicator_service = IndicatorService(orchestrator=app.state.orchestrator)
    print("IndicatorService initialized")

    # Initialize DataPoller with market-hours gating
    # Crypto assets (24/7) are kept as base symbols; watchlist equities are loaded from DB
    from app.services.data_poller import DataPoller
    app.state.poller = DataPoller(
        yf_provider=app.state.yf_provider,
        symbols=[],  # Load watchlist from DB instead of hardcoding symbols
        db_session_factory=AsyncSessionLocal,
        alert_engine=engine,
        indicator_service=indicator_service,
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

@app.get("/")
def root():
    return {"message": "Welcome to TradingAlert API"}
