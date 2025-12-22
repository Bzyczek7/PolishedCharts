import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock
from app.main import app
from app.db.session import get_db
from datetime import datetime, timezone

@pytest.mark.asyncio
async def test_get_candles_local_only(async_client: AsyncClient):
    # Mock DB dependency
    mock_session = AsyncMock()
    
    # Mock Symbol Query
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol

    # Mock Candles
    mock_candle = MagicMock()
    mock_candle.ticker = "AAPL"
    mock_candle.interval = "1h"
    mock_candle.open = 100.0
    mock_candle.high = 110.0
    mock_candle.low = 90.0
    mock_candle.close = 105.0
    mock_candle.volume = 1000
    mock_candle.timestamp = datetime(2025, 1, 1, tzinfo=timezone.utc)
    
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = [mock_candle]

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    # Override dependency
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    
    response = await async_client.get("/api/v1/candles/AAPL?interval=1h&from=2025-01-01T00:00:00Z&local_only=true")
    
    # Clean up
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert "id" not in data[0]
    assert data[0]["close"] == 105.0

@pytest.mark.asyncio
async def test_trigger_backfill(async_client: AsyncClient, db_session):
    # Override dependency to use test db_session
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
    
    # Clean up
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"
    assert "job_id" in data
    assert "MSFT" in data["message"]

@pytest.mark.asyncio
async def test_update_latest(async_client: AsyncClient):
    response = await async_client.post("/api/v1/candles/update-latest?symbol=TSLA&interval=1h")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "TSLA" in data["message"]