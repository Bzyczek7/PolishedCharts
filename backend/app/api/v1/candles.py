from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Union, Dict, Any
from datetime import datetime, timezone, timedelta
import asyncio

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
from app.services.providers import YFinanceProvider, AlphaVantageProvider
from app.core.config import settings

router = APIRouter()

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

# --- Dependency Providers ---

def get_orchestrator() -> DataOrchestrator:
    """Dependency to get a DataOrchestrator instance."""
    candle_service = CandleService()
    yf_provider = YFinanceProvider()
    av_provider = AlphaVantageProvider(api_key=settings.ALPHA_VANTAGE_API_KEY)
    return DataOrchestrator(candle_service, yf_provider, av_provider)

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

async def _get_price_for_symbol(symbol_str: str, interval: str, db: AsyncSession, orchestrator: DataOrchestrator):
    """Helper to get price for a single symbol, used by get_latest_prices."""
    from sqlalchemy import desc
    result = await db.execute(select(Symbol).where(Symbol.ticker == symbol_str))
    symbol_obj = result.scalars().first()

    if not symbol_obj:
        return {"symbol": symbol_str, "error": "Symbol not found"}

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
async def get_candles(
    symbol: str,
    interval: str = Query("1d", description="Timeframe (e.g. 1m, 5m, 1h, 1d)"),
    from_ts: Optional[datetime] = Query(None, alias="from", description="Start timestamp (UTC)"),
    to_ts: Optional[datetime] = Query(None, alias="to", description="End timestamp (UTC)"),
    local_only: bool = Query(False, description="If true, returns only data from DB"),
    db: AsyncSession = Depends(get_db),
    orchestrator: DataOrchestrator = Depends(get_orchestrator)
):
    interval = interval.lower().replace("w", "wk")
    result = await db.execute(select(Symbol).filter(Symbol.ticker == symbol.upper()))
    symbol_obj = result.scalars().first()
    if not symbol_obj:
        raise HTTPException(status_code=404, detail="Symbol not found")

    try:
        candles_data = await orchestrator.get_candles(
            db=db, symbol_id=symbol_obj.id, ticker=symbol_obj.ticker,
            interval=interval, start=from_ts, end=to_ts, local_only=local_only
        )
        if not candles_data:
            raise HTTPException(status_code=404, detail="No data available")
        return candles_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/backfill", response_model=BackfillResponse)
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
async def update_latest(
    symbol: str = Query(..., description="Ticker symbol"),
    interval: str = Query("1h", description="Timeframe"),
    worker: IncrementalUpdateWorker = Depends(get_incremental_worker)
):
    from app.main import worker_manager
    worker_manager.start_task(f"update_{symbol}_{interval}", worker.run_update(symbol, interval))
    return {"status": "success", "message": f"Incremental update for {symbol} ({interval}) triggered"}

@router.get("/latest_prices/{symbols:path}", response_model=List[Dict[str, Any]])
async def get_latest_prices(
    symbols: str,
    interval: str = Query("1d", description="Timeframe for latest data (default: 1d)"),
    db: AsyncSession = Depends(get_db),
    orchestrator: DataOrchestrator = Depends(get_orchestrator)
):
    symbol_list = [s.strip().upper() for s in symbols.split(',')]
    tasks = [_get_price_for_symbol(s, interval, db, orchestrator) for s in symbol_list]
    results = await asyncio.gather(*tasks)
    return results

@router.websocket("/ws/{symbol}")
async def websocket_endpoint(
    websocket: WebSocket,
    symbol: str,
    interval: str = Query("1d", description="Timeframe (e.g. 1m, 5m, 1h, 1d)"),
    db: AsyncSession = Depends(get_db),
    orchestrator: DataOrchestrator = Depends(get_orchestrator)
):
    await websocket.accept()
    result = await db.execute(select(Symbol).filter(Symbol.ticker == symbol.upper()))
    symbol_obj = result.scalars().first()
    if not symbol_obj:
        await websocket.close(code=4000, reason="Symbol not found")
        return

    last_candle_timestamp = None

    try:
        while True:
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
                if last_candle_timestamp is None or latest_candle['timestamp'] > last_candle_timestamp:
                    await websocket.send_json({
                        "timestamp": latest_candle['timestamp'].isoformat(),
                        "open": latest_candle['open'],
                        "high": latest_candle['high'],
                        "low": latest_candle['low'],
                        "close": latest_candle['close'],
                        "volume": latest_candle['volume'],
                    })
                    last_candle_timestamp = latest_candle['timestamp']

            await asyncio.sleep(5)
    except WebSocketDisconnect:
        print(f"Client disconnected from WebSocket for {symbol}")
    except Exception as e:
        print(f"Error in WebSocket for {symbol}: {e}")
        await websocket.close(code=1011, reason="Internal Server Error")
