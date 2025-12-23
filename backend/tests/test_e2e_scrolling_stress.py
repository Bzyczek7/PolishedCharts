import pytest
import time
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta
from app.models.symbol import Symbol
from app.models.candle import Candle
from sqlalchemy import select, func
from app.main import app
from app.db.session import get_db

@pytest.mark.asyncio
async def test_scrolling_stress_and_performance(async_client: AsyncClient, db_session):
    ticker = "STRESS_TEST"
    # 1. Setup symbol
    result = await db_session.execute(select(Symbol).filter(Symbol.ticker == ticker))
    symbol = result.scalars().first()
    if not symbol:
        symbol = Symbol(ticker=ticker, name="Stress Test")
        db_session.add(symbol)
        await db_session.commit()
        await db_session.refresh(symbol)

    # 2. Simulate repeated overlapping fetches (like scrolling)
    # We'll use the API directly with local_only=False to trigger dynamic fills
    # Since we want to test the full stack, we won't mock the provider here, 
    # but we'll use a ticker that might exist or just rely on the mocks we set up earlier?
    # Actually, for a TRUE stress test, let's just use the repository directly to ensure
    # that even with massive overlaps, it stays consistent.
    
    from app.services.candles import CandleService
    service = CandleService()
    
    base_ts = datetime(2025, 1, 1, tzinfo=timezone.utc)
    
    # 10 overlapping chunks of 100 candles
    for i in range(10):
        # Each chunk overlaps with the previous one by 50%
        start = base_ts + timedelta(days=i * 50)
        data = [
            {
                "timestamp": start + timedelta(days=j),
                "open": 100 + i + j, "high": 110 + i + j, "low": 90 + i + j, "close": 105 + i + j, "volume": 1000
            } for j in range(100)
        ]
        await service.upsert_candles(db_session, symbol.id, "1d", data)

    # 3. Verify zero duplicates
    # Total range is from base_ts to base_ts + 9*50 + 100 = 550 days
    stmt = select(func.count()).select_from(Candle).where(Candle.symbol_id == symbol.id)
    result = await db_session.execute(stmt)
    count = result.scalar()
    assert count == 550 # If duplicates existed, this would be higher
    
    # 4. Verify sub-second loading
    # Use API with local_only=True
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    
    start_time = time.perf_counter()
    response = await async_client.get(f"/api/v1/candles/{ticker}?interval=1d&local_only=true")
    end_time = time.perf_counter()
    
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    duration = end_time - start_time
    print(f"FETCH DURATION: {duration:.4f}s")
    assert duration < 0.2 # Well under 1 second
