import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from app.models.candle import Candle
from app.models.symbol import Symbol
from app.models.backfill_job import BackfillJob
from app.services.candles import CandleService
from app.services.backfill import BackfillService

async def get_test_symbol(db_session, ticker):
    stmt = select(Symbol).where(Symbol.ticker == ticker)
    result = await db_session.execute(stmt)
    symbol = result.scalars().first()
    if not symbol:
        symbol = Symbol(ticker=ticker, name="Test Symbol")
        db_session.add(symbol)
        await db_session.commit()
        await db_session.refresh(symbol)
    return symbol.id

@pytest.mark.asyncio
async def test_candle_idempotency_and_duplicate_prevention(db_session):
    service = CandleService()
    ticker = "TEST_ADV_IDEMPOTENT"
    symbol_id = await get_test_symbol(db_session, ticker)
    interval = "1h"
    ts = datetime(2025, 1, 1, 10, 0, tzinfo=timezone.utc)
    
    # 1. First insert
    data1 = [{"timestamp": ts, "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000}]
    await service.upsert_candles(db_session, symbol_id, interval, data1)
    
    # 2. Verify count is 1
    count_stmt = select(func.count()).select_from(Candle).where(Candle.symbol_id == symbol_id)
    result = await db_session.execute(count_stmt)
    assert result.scalar() == 1
    
    # 3. Upsert same timestamp with different values
    data2 = [{"timestamp": ts, "open": 100, "high": 120, "low": 90, "close": 115, "volume": 2000}]
    await service.upsert_candles(db_session, symbol_id, interval, data2)
    
    # 4. Verify count is still 1 (duplicate prevention)
    result = await db_session.execute(count_stmt)
    assert result.scalar() == 1
    
    # 5. Verify values updated (idempotency)
    stmt = select(Candle).where(Candle.symbol_id == symbol_id, Candle.timestamp == ts)
    result = await db_session.execute(stmt)
    candle = result.scalars().first()
    assert candle.close == 115
    assert candle.high == 120
    assert candle.volume == 2000

@pytest.mark.asyncio
async def test_candle_range_read_ordering(db_session):
    service = CandleService()
    ticker = "TEST_ORDERING"
    symbol_id = await get_test_symbol(db_session, ticker)
    interval = "1h"
    
    base_ts = datetime(2025, 1, 1, 10, 0, tzinfo=timezone.utc)
    # Insert out of order
    data = [
        {"timestamp": base_ts + timedelta(hours=2), "open": 3, "high": 3, "low": 3, "close": 3},
        {"timestamp": base_ts, "open": 1, "high": 1, "low": 1, "close": 1},
        {"timestamp": base_ts + timedelta(hours=1), "open": 2, "high": 2, "low": 2, "close": 2},
    ]
    await service.upsert_candles(db_session, symbol_id, interval, data)
    
    # Read back (DataOrchestrator handles sorting, but let's check basic query)
    stmt = select(Candle).where(Candle.symbol_id == symbol_id).order_by(Candle.timestamp.asc())
    result = await db_session.execute(stmt)
    candles = result.scalars().all()
    
    assert len(candles) == 3
    assert candles[0].timestamp == base_ts
    assert candles[1].timestamp == base_ts + timedelta(hours=1)
    assert candles[2].timestamp == base_ts + timedelta(hours=2)

@pytest.mark.asyncio
async def test_backfill_job_lifecycle(db_session):
    service = BackfillService()
    symbol = "AAPL"
    interval = "1h"
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    end = datetime(2025, 1, 2, tzinfo=timezone.utc)
    
    # 1. Create
    job = await service.create_job(db_session, symbol, interval, start, end)
    assert job.id is not None
    assert job.status == "pending"
    
    # 2. Update status
    updated = await service.update_job_status(db_session, job.id, "in_progress")
    assert updated.status == "in_progress"
    
    # 3. Get active jobs
    active = await service.get_active_jobs(db_session, symbol, interval)
    assert len(active) == 1
    assert active[0].id == job.id
    
    # 4. Fail job
    failed = await service.update_job_status(db_session, job.id, "failed", "Rate limited")
    assert failed.status == "failed"
    assert failed.error_message == "Rate limited"
    
    # 5. Verify no longer active
    active = await service.get_active_jobs(db_session, symbol, interval)
    assert len(active) == 0
