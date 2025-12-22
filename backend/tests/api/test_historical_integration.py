import pytest
from httpx import AsyncClient
from datetime import datetime, timezone
from sqlalchemy import select, delete
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.models.backfill_job import BackfillJob
from app.db.session import get_db
from app.main import app
from app.db.base import Base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine

# Dedicated test engine/factory to ensure we are in the right loop
@pytest.fixture
async def local_db_session():
    engine = create_async_engine(settings.async_database_url, poolclass=NullPool)
    factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()

@pytest.mark.asyncio
async def test_api_local_data_retrieval_integration(async_client: AsyncClient, local_db_session):
    # 1. Prepare data
    db_session = local_db_session
    result = await db_session.execute(select(Symbol).filter(Symbol.ticker == "INTG"))
    symbol = result.scalars().first()
    if not symbol:
        symbol = Symbol(ticker="INTG", name="Integration Test")
        db_session.add(symbol)
        await db_session.commit()
        await db_session.refresh(symbol)
    
    ts = datetime(2025, 1, 1, 10, 0, tzinfo=timezone.utc)
    await db_session.execute(delete(Candle).where(Candle.symbol_id == symbol.id, Candle.timestamp == ts, Candle.interval == "1h"))
    await db_session.commit()
    
    candle = Candle(
        symbol_id=symbol.id,
        timestamp=ts,
        interval="1h",
        open=100.0, high=110.0, low=90.0, close=105.0, volume=1000
    )
    db_session.add(candle)
    await db_session.commit()
    
    # Override dependency to use our local session
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    
    # 2. Call API (local_only=true to avoid external API calls)
    response = await async_client.get(f"/api/v1/candles/INTG?interval=1h&from=2025-01-01T00:00:00Z&local_only=true")
    
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["ticker"] == "INTG"
    assert data[0]["close"] == 105.0

@pytest.mark.asyncio
async def test_api_backfill_trigger_integration(async_client: AsyncClient, local_db_session):
    # Ensure symbol exists
    db_session = local_db_session
    result = await db_session.execute(select(Symbol).filter(Symbol.ticker == "MSFT"))
    symbol = result.scalars().first()
    if not symbol:
        db_session.add(Symbol(ticker="MSFT", name="Microsoft"))
        await db_session.commit()

    # Override dependency to use our local session
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db

    payload = {
        "symbol": "MSFT",
        "interval": "1h",
        "start_date": "2025-01-01T00:00:00Z",
        "end_date": "2025-01-02T00:00:00Z"
    }
    response = await async_client.post("/api/v1/candles/backfill", json=payload)
    
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    job_id = data["job_id"]
    
    # Verify in DB
    result = await db_session.execute(select(BackfillJob).where(BackfillJob.id == job_id))
    job = result.scalars().first()
    assert job is not None
    assert job.symbol == "MSFT"
    assert job.status == "pending"