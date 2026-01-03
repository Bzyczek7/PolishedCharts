import logging
import time
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Union, Dict, Any
from datetime import datetime, timezone, timedelta
import asyncio

logger = logging.getLogger(__name__)

from app.db.session import get_db, AsyncSessionLocal
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.schemas.candle import CandleResponse, BackfillRequest, BackfillResponse
from app.schemas.common import ErrorDetail
from app.services.orchestrator import DataOrchestrator
from app.services.candles import CandleService
from app.services.backfill import BackfillService
from app.services.backfill_worker import BackfillWorker
from app.services.incremental_worker import IncrementalUpdateWorker
from app.services.alert_engine import AlertEngine
from app.services.providers import YFinanceProvider
from app.services.market_schedule import MarketSchedule
from app.core.config import settings
from app.api.decorators import public_endpoint
# T020a: Performance logging
from app.services.performance import performance_logger

router = APIRouter()

# --- Constants ---
MAX_RANGE_DAYS = {
    "1m": 7, "2m": 30, "5m": 30, "15m": 30,    # Intraday capped
    "30m": 60, "1h": 60, "4h": 120,
    "1d": 365 * 5,  # 5 years - matches backend CHUNK_POLICIES in providers.py
    "1wk": 365 * 10  # 10 years - matches backend CHUNK_POLICIES
}

# --- Helper Functions ---
def interval_to_timedelta(interval: str) -> timedelta:
    """Converts an interval string (e.g., '1m', '1h', '1d') to a timedelta object."""
    interval = interval.lower()
    if interval.endswith('m'):
        return timedelta(minutes=int(interval[:-1]))
    elif interval.endswith('h'):
        return timedelta(hours=int(interval[:-1]))
    elif interval.endswith('d'):
        return timedelta(days=int(interval[:-1]))
    elif interval.endswith('wk'):
        return timedelta(weeks=int(interval[:-2]))
    return timedelta(days=1) # Default fallback

def validate_interval_range(interval: str, from_ts: Optional[datetime], to_ts: Optional[datetime]):
    """Validate that the requested date range is within allowed limits for the interval."""
    if not from_ts or not to_ts:
        return  # Skip validation if range not specified

    max_days = MAX_RANGE_DAYS.get(interval, 365)
    days = (to_ts - from_ts).total_seconds() / 86400  # Use total_seconds for accuracy

    # Allow 1 day tolerance for time component (e.g., requesting "120 days" at 11:42 AM vs 12:42 PM)
    if days > max_days + 1:  # 1 day tolerance for time-of-day differences
        raise HTTPException(
            status_code=400,
            detail=f"Range too large for {interval}: max {max_days} days, got {days:.1f} days"
        )

# --- Dependency Providers ---

def get_orchestrator(request: Request) -> DataOrchestrator:
    """Dependency to get the singleton DataOrchestrator from app state (HTTP routes)."""
    return request.app.state.orchestrator

def get_orchestrator_ws(websocket: WebSocket) -> DataOrchestrator:
    """Dependency to get the singleton DataOrchestrator from app state (WebSocket routes)."""
    return websocket.app.state.orchestrator

def get_backfill_worker(orchestrator: DataOrchestrator = Depends(get_orchestrator)) -> BackfillWorker:
    """Dependency to get a BackfillWorker instance."""
    backfill_service = BackfillService()
    return BackfillWorker(backfill_service, orchestrator, AsyncSessionLocal)

def get_incremental_worker(db: AsyncSession = Depends(get_db), orchestrator: DataOrchestrator = Depends(get_orchestrator)) -> IncrementalUpdateWorker:
    """Dependency to get an IncrementalUpdateWorker instance."""
    # Pass a factory or the session directly if the worker manages its lifecycle
    engine = AlertEngine(db_session_factory=lambda: db)
    return IncrementalUpdateWorker(orchestrator, AsyncSessionLocal, alert_engine=engine)

# --- Helper Functions ---

async def _get_price_for_symbol(symbol_str: str, interval: str, orchestrator: DataOrchestrator):
    """
    Helper to get price for a single symbol, used by get_latest_prices.

    Creates its own database session to avoid concurrency issues with asyncio.gather.
    """
    from sqlalchemy import desc
    from app.db.session import AsyncSessionLocal
    from app.services.watchlist import get_or_create_symbol

    async with AsyncSessionLocal() as db:
        # Get or create symbol - ensures all requested symbols get a Symbol table entry
        symbol_obj = await get_or_create_symbol(db, symbol_str)

        if not symbol_obj:
            return {"symbol": symbol_str, "error": "Invalid ticker symbol"}

        try:
            latest_candle_q = await db.execute(
                select(Candle).where(Candle.symbol_id == symbol_obj.id, Candle.interval == interval)
                .order_by(desc(Candle.timestamp)).limit(1)
            )
            latest_candle = latest_candle_q.scalars().first()

            if latest_candle:
                prev_candle_q = await db.execute(
                    select(Candle).where(Candle.symbol_id == symbol_obj.id, Candle.interval == interval,
                                         Candle.timestamp < latest_candle.timestamp)
                    .order_by(desc(Candle.timestamp)).limit(1)
                )
                prev_candle = prev_candle_q.scalars().first()
                change = latest_candle.close - prev_candle.close if prev_candle else 0
                change_percent = (change / prev_candle.close) * 100 if prev_candle and prev_candle.close else 0
                return {
                    "symbol": symbol_str, "price": latest_candle.close, "change": round(change, 4),
                    "changePercent": round(change_percent, 4), "timestamp": latest_candle.timestamp.isoformat()
                }

            # Fallback to provider if no data in DB
            latest_data = await orchestrator.get_candles(
                db=db, symbol_id=symbol_obj.id, ticker=symbol_str, interval=interval,
                start=None, end=None, local_only=False
            )
            if latest_data:
                latest = latest_data[-1]
                prev = latest_data[-2] if len(latest_data) > 1 else None
                change = latest["close"] - prev["close"] if prev else 0
                change_percent = (change / prev["close"]) * 100 if prev and prev["close"] != 0 else 0
                ts_val = latest["timestamp"]
                ts_str = ts_val.isoformat() if hasattr(ts_val, 'isoformat') else str(ts_val)
                return {
                    "symbol": symbol_str, "price": latest["close"], "change": round(change, 4),
                    "changePercent": round(change_percent, 4), "timestamp": ts_str
                }
            return {"symbol": symbol_str, "error": "No data available"}

        except Exception as e:
            return {"symbol": symbol_str, "error": str(e)}

# --- API Endpoints ---

@router.get("/{symbol}", response_model=List[CandleResponse])
@public_endpoint
async def get_candles(
    symbol: str,
    interval: str = Query("1d", description="Timeframe (e.g. 1m, 5m, 1h, 1d)"),
    from_ts: Optional[datetime] = Query(None, alias="from", description="Start timestamp (UTC)"),
    to_ts: Optional[datetime] = Query(None, alias="to", description="End timestamp (UTC)"),
    local_only: bool = Query(False, description="If true, returns only data from DB"),
    db: AsyncSession = Depends(get_db),
    orchestrator: DataOrchestrator = Depends(get_orchestrator)
):
    # Only normalize trailing "w" to "wk" (fixes "1wk" → "1wkk" bug)
    interval = interval.lower()
    if interval.endswith("w") and not interval.endswith("wk"):
        interval = interval[:-1] + "wk"

    # DEBUG: Log first 5 candle timestamps to check for non-midnight times on 1d
    if interval == '1d':
        result = await db.execute(select(Symbol).filter(Symbol.ticker == symbol.upper()))
        symbol_obj = result.scalars().first()
        if symbol_obj:
            check_result = await db.execute(
                select(Candle)
                .where(Candle.symbol_id == symbol_obj.id)
                .where(Candle.interval == '1d')
                .order_by(Candle.timestamp.desc())
                .limit(10)
            )
            sample_candles = check_result.scalars().all()
            print(f"\n========== DEBUG {symbol} 1d timestamps ==========")
            for c in sample_candles:
                ts_str = c.timestamp.isoformat() if hasattr(c.timestamp, 'isoformat') else str(c.timestamp)
                print(f"  {ts_str}")
            print(f"==============================\n")

    # Validate range before orchestrator call (prevents 500 errors for large intraday requests)
    validate_interval_range(interval, from_ts, to_ts)

    # Auto-create symbol if it doesn't exist (helps new users get started with default symbols like SPY)
    from app.services.watchlist import get_or_create_symbol
    symbol_obj = await get_or_create_symbol(db, symbol.upper())
    if not symbol_obj:
        raise HTTPException(status_code=404, detail="Invalid ticker symbol")

    try:
        # T020a: Instrument only the expensive operation with performance logging
        start_time = time.time()
        candles_data = await orchestrator.get_candles(
            db=db, symbol_id=symbol_obj.id, ticker=symbol_obj.ticker,
            interval=interval, start=from_ts, end=to_ts, local_only=local_only
        )
        duration_ms = (time.time() - start_time) * 1000
        performance_logger.record(
            operation="fetch_candles",
            duration_ms=duration_ms,
            category="data_fetch",
            context={"symbol": symbol, "interval": interval}
        )
        if not candles_data:
            raise HTTPException(status_code=404, detail="No data available")
        return candles_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/backfill", response_model=BackfillResponse)
@public_endpoint
async def trigger_backfill(
    request: BackfillRequest,
    db: AsyncSession = Depends(get_db),
    worker: BackfillWorker = Depends(get_backfill_worker)
):
    job = await worker.backfill_service.create_job(
        db=db, symbol=request.symbol.upper(), interval=request.interval.lower(),
        start_date=request.start_date, end_date=request.end_date
    )
    from app.main import worker_manager
    worker_manager.start_task(f"backfill_{job.id}", worker.run_job(job.id))
    return {
        "status": "pending", "job_id": job.id,
        "message": f"Backfill job {job.id} created for {request.symbol}"
    }

@router.post("/update-latest", response_model=dict)
@public_endpoint
async def update_latest(
    symbol: str = Query(..., description="Ticker symbol"),
    interval: str = Query("1h", description="Timeframe"),
    worker: IncrementalUpdateWorker = Depends(get_incremental_worker)
):
    from app.main import worker_manager
    worker_manager.start_task(f"update_{symbol}_{interval}", worker.run_update(symbol, interval))
    return {"status": "success", "message": f"Incremental update for {symbol} ({interval}) triggered"}

@router.get("/latest_prices/{symbols:path}", response_model=List[Dict[str, Any]])
@public_endpoint
async def get_latest_prices(
    symbols: str,
    interval: str = Query("1d", description="Timeframe for latest data (default: 1d)"),
    orchestrator: DataOrchestrator = Depends(get_orchestrator)
):
    import asyncio
    symbol_list = [s.strip().upper() for s in symbols.split(',')]
    # Each task creates its own database session to avoid concurrency issues
    tasks = [_get_price_for_symbol(s, interval, orchestrator) for s in symbol_list]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    # Handle any exceptions that occurred during concurrent execution
    formatted_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            formatted_results.append({"symbol": symbol_list[i], "error": str(result)})
        else:
            formatted_results.append(result)
    return formatted_results

@router.websocket("/ws/{symbol}")
async def websocket_endpoint(
    websocket: WebSocket,
    symbol: str,
    interval: str = Query("1d", description="Timeframe (e.g. 1m, 5m, 1h, 1d)"),
    db: AsyncSession = Depends(get_db),
    orchestrator: DataOrchestrator = Depends(get_orchestrator_ws)
):
    # Only normalize trailing "w" to "wk" (fixes "1wk" → "1wkk" bug)
    interval = interval.lower()
    if interval.endswith("w") and not interval.endswith("wk"):
        interval = interval[:-1] + "wk"

    await websocket.accept()
    result = await db.execute(select(Symbol).filter(Symbol.ticker == symbol.upper()))
    symbol_obj = result.scalars().first()
    if not symbol_obj:
        await websocket.close(code=4000, reason="Symbol not found")
        return

    # Track the last sent candle to avoid sending duplicates
    last_sent_candle_key = None
    market_schedule = MarketSchedule()

    try:
        while True:
            # Skip polling when market is closed (weekends, holidays, after hours)
            # Only applies to US equity symbols with intraday intervals
            is_intraday = interval in ('1m', '2m', '5m', '15m', '30m', '1h', '4h')
            if is_intraday and not market_schedule.is_market_open():
                # Sleep longer when market is closed (check every minute instead of 5 seconds)
                await asyncio.sleep(60)
                continue

            lookback_delta = interval_to_timedelta(interval) * 2
            start_date = datetime.now(timezone.utc) - lookback_delta
            end_date = datetime.now(timezone.utc)

            latest_candles = await orchestrator.get_candles(
                db=db,
                symbol_id=symbol_obj.id,
                ticker=symbol_obj.ticker,
                interval=interval,
                start=start_date,
                end=end_date,
                local_only=False
            )

            if latest_candles:
                latest_candle = latest_candles[-1]
                # Create a unique key based on timestamp and close price to identify unique candles
                current_candle_key = (latest_candle['timestamp'], latest_candle['close'])

                if last_sent_candle_key != current_candle_key:
                    await websocket.send_json({
                        "timestamp": latest_candle['timestamp'].isoformat(),
                        "open": latest_candle['open'],
                        "high": latest_candle['high'],
                        "low": latest_candle['low'],
                        "close": latest_candle['close'],
                        "volume": latest_candle['volume'],
                    })
                    last_sent_candle_key = current_candle_key
                    logger.info(f"WebSocket sent update for {symbol} ({interval}): {latest_candle['timestamp']} - Close: {latest_candle['close']}")

            # Poll interval based on timeframe - daily/weekly candles don't change frequently
            # Intraday: 5 seconds, Daily: 1 hour, Weekly: 5 minutes
            if interval in ('1d', '1day'):
                poll_sleep = 3600  # 1 hour - daily candles only update at market close
            elif interval in ('1w', '1wk', '1week'):
                poll_sleep = 300  # 5 minutes
            else:
                poll_sleep = 5  # 5 seconds for intraday intervals
            await asyncio.sleep(poll_sleep)
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from WebSocket for {symbol}")
    except Exception as e:
        logger.error(f"Error in WebSocket for {symbol}: {e}")
        await websocket.close(code=1011, reason="Internal Server Error")
