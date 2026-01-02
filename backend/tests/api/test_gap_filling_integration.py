import pytest
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, delete
from unittest.mock import patch, AsyncMock
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.db.session import get_db
from app.main import app
from app.services.providers import YFinanceProvider

@pytest.mark.asyncio
async def test_transparent_gap_filling_integration(async_client: AsyncClient, db_session):
    # 1. Setup Symbol
    ticker = "GAP_TEST"
    result = await db_session.execute(select(Symbol).filter(Symbol.ticker == ticker))
    symbol = result.scalars().first()
    if not symbol:
        symbol = Symbol(ticker=ticker, name="Gap Integration Test")
        db_session.add(symbol)
        await db_session.commit()
        await db_session.refresh(symbol)

    # 2. Add partial data (leave a gap)
    await db_session.execute(delete(Candle).where(Candle.symbol_id == symbol.id))
    await db_session.commit()

    ts1 = datetime(2025, 1, 1, 0, 0, tzinfo=timezone.utc)
    ts2 = datetime(2025, 1, 2, 0, 0, tzinfo=timezone.utc) # Gap
    ts3 = datetime(2025, 1, 3, 0, 0, tzinfo=timezone.utc)
    
    db_session.add(Candle(symbol_id=symbol.id, timestamp=ts1, interval="1d", open=1, high=1, low=1, close=1))
    db_session.add(Candle(symbol_id=symbol.id, timestamp=ts3, interval="1d", open=3, high=3, low=3, close=3))
    await db_session.commit()

    mock_candles = [
        {"timestamp": ts2, "open": 2.0, "high": 2.0, "low": 2.0, "close": 2.0, "volume": 100}
    ]
    
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db

    # Mock YFinanceProvider since orchestrator now only uses YFinance
    with patch.object(YFinanceProvider, 'fetch_candles', AsyncMock(return_value=mock_candles)) as mock_yf:
        response = await async_client.get(f"/api/v1/candles/{ticker}?interval=1d&from=2025-01-01T00:00:00Z&to=2025-01-03T00:00:00Z")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert mock_yf.called

        result = await db_session.execute(select(Candle).where(Candle.symbol_id == symbol.id, Candle.timestamp == ts2))
        assert result.scalars().first() is not None

    app.dependency_overrides = {}