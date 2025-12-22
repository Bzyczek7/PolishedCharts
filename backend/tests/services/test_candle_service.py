import pytest
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from app.models.candle import Candle
from app.models.symbol import Symbol
from app.services.candles import CandleService

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
async def test_upsert_candles_inserts_new_data(db_session):
    service = CandleService()
    ticker = "TEST_UPSERT_" + str(datetime.now().timestamp())
    symbol_id = await get_test_symbol(db_session, ticker)
    interval = "1d"
    
    candles_data = [
        {
            "timestamp": datetime(2023, 10, 27, tzinfo=timezone.utc),
            "open": 100.0, "high": 110.0, "low": 90.0, "close": 105.0, "volume": 1000
        }
    ]

    await service.upsert_candles(db_session, symbol_id, interval, candles_data)

    stmt = select(Candle).where(Candle.symbol_id == symbol_id, Candle.interval == interval)
    result = await db_session.execute(stmt)
    inserted = result.scalars().all()
    assert len(inserted) == 1
    assert inserted[0].close == 105.0

@pytest.mark.asyncio
async def test_upsert_candles_is_idempotent(db_session):
    service = CandleService()
    ticker = "TEST_IDEMPOTENT_" + str(datetime.now().timestamp())
    symbol_id = await get_test_symbol(db_session, ticker)
    interval = "1d"
    timestamp = datetime(2023, 10, 27, tzinfo=timezone.utc)
    
    candles_data = [
        {
            "timestamp": timestamp,
            "open": 100.0, "high": 110.0, "low": 90.0, "close": 105.0, "volume": 1000
        }
    ]

    await service.upsert_candles(db_session, symbol_id, interval, candles_data)
    
    candles_data[0]["volume"] = 2000
    await service.upsert_candles(db_session, symbol_id, interval, candles_data)

    stmt = select(Candle).where(Candle.symbol_id == symbol_id, Candle.interval == interval)
    result = await db_session.execute(stmt)
    inserted = result.scalars().all()
    assert len(inserted) == 1
    assert inserted[0].volume == 2000

@pytest.mark.asyncio
async def test_upsert_candles_locking(db_session, db_session_factory):
    service = CandleService()
    ticker = "TEST_LOCK_" + str(datetime.now().timestamp())
    symbol_id = await get_test_symbol(db_session, ticker)
    interval = "1d"
    
    candles_data = [{"timestamp": datetime(2023, 10, 27, tzinfo=timezone.utc), "open": 1, "high": 2, "low": 0, "close": 1, "volume": 1}]
    
    async def call_upsert():
        async with db_session_factory() as session:
            await service.upsert_candles(session, symbol_id, interval, candles_data)

    await asyncio.gather(
        call_upsert(),
        call_upsert()
    )
    
    stmt = select(Candle).where(Candle.symbol_id == symbol_id, Candle.interval == interval)
    result = await db_session.execute(stmt)
    assert len(result.scalars().all()) == 1

@pytest.mark.asyncio
async def test_find_gaps_identifies_missing_data(db_session):
    service = CandleService()
    ticker = "TEST_GAPS_" + str(datetime.now().timestamp())
    symbol_id = await get_test_symbol(db_session, ticker)
    interval = "1d"
    
    # 1. Fill some data
    # Gaps:
    # 2023-10-20 to 2023-10-21 (Head gap)
    # 2023-10-23 (Middle gap)
    # 2023-10-26 to 2023-10-27 (Tail gap)
    
    candles_data = [
        {"timestamp": datetime(2023, 10, 22, tzinfo=timezone.utc), "open": 1, "high": 2, "low": 0, "close": 1},
        {"timestamp": datetime(2023, 10, 24, tzinfo=timezone.utc), "open": 1, "high": 2, "low": 0, "close": 1},
        {"timestamp": datetime(2023, 10, 25, tzinfo=timezone.utc), "open": 1, "high": 2, "low": 0, "close": 1},
    ]
    await service.upsert_candles(db_session, symbol_id, interval, candles_data)
    
    # Request range from 20th to 27th
    start = datetime(2023, 10, 20, tzinfo=timezone.utc)
    end = datetime(2023, 10, 27, tzinfo=timezone.utc)
    
    gaps = await service.find_gaps(db_session, symbol_id, interval, start, end)
    
    assert len(gaps) == 3
    assert gaps[0] == (datetime(2023, 10, 20, tzinfo=timezone.utc), datetime(2023, 10, 21, tzinfo=timezone.utc))
    assert gaps[1] == (datetime(2023, 10, 23, tzinfo=timezone.utc), datetime(2023, 10, 23, tzinfo=timezone.utc))
    assert gaps[2] == (datetime(2023, 10, 26, tzinfo=timezone.utc), datetime(2023, 10, 27, tzinfo=timezone.utc))