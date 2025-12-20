from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock
import pytest
from app.main import app
from app.db.session import get_db

client = TestClient(app)

@pytest.mark.asyncio
async def test_get_tdfi_indicator_endpoint():
    # Mock DB dependency
    mock_session = AsyncMock()
    
    # Mock Symbol Query
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol

    # Mock Candles Query - enough for rolling windows
    candles = []
    for i in range(100):
        mock_candle = MagicMock()
        mock_candle.id = i
        mock_candle.symbol_id = 1
        mock_candle.open = 100.0 + i
        mock_candle.high = 110.0 + i
        mock_candle.low = 90.0 + i
        mock_candle.close = 105.0 + i
        mock_candle.volume = 1000
        mock_candle.timestamp = f"2023-10-27T{i:02d}:00:00"
        candles.append(mock_candle)
    
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = candles

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    # Override dependency
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    
    response = client.get("/api/v1/indicators/IBM/tdfi")
    
    # Clean up
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    assert "tdfi" in data
    assert "tdfi_signal" in data
    assert "metadata" in data
    assert data["metadata"]["display_type"] == "pane"

@pytest.mark.asyncio
async def test_get_crsi_indicator_endpoint():
    # Mock DB dependency
    mock_session = AsyncMock()
    
    # Mock Symbol Query
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol

    # Mock Candles Query
    candles = []
    for i in range(100):
        mock_candle = MagicMock()
        mock_candle.id = i
        mock_candle.symbol_id = 1
        mock_candle.open = 100.0 + i
        mock_candle.high = 110.0 + i
        mock_candle.low = 90.0 + i
        mock_candle.close = 105.0 + i
        mock_candle.volume = 1000
        mock_candle.timestamp = f"2023-10-27T{i:02d}:00:00"
        candles.append(mock_candle)
    
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = candles

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    # Override dependency
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    
    response = client.get("/api/v1/indicators/IBM/crsi")
    
    # Clean up
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    assert "crsi" in data
    assert "upper_band" in data
    assert "lower_band" in data
    assert "metadata" in data
    assert data["metadata"]["display_type"] == "pane"

@pytest.mark.asyncio
async def test_get_adxvma_indicator_endpoint():
    # Mock DB dependency
    mock_session = AsyncMock()
    
    # Mock Symbol Query
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol

    # Mock Candles Query
    candles = []
    for i in range(100):
        mock_candle = MagicMock()
        mock_candle.id = i
        mock_candle.symbol_id = 1
        mock_candle.open = 100.0 + i
        mock_candle.high = 110.0 + i
        mock_candle.low = 90.0 + i
        mock_candle.close = 105.0 + i
        mock_candle.volume = 1000
        mock_candle.timestamp = f"2023-10-27T{i:02d}:00:00"
        candles.append(mock_candle)
    
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = candles

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    # Override dependency
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    
    response = client.get("/api/v1/indicators/IBM/adxvma")
    
    # Clean up
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    assert "adxvma" in data
    assert "metadata" in data
    assert data["metadata"]["display_type"] == "overlay"

@pytest.mark.asyncio
async def test_get_indicator_invalid_name():
    # Mock DB dependency
    mock_session = AsyncMock()
    
    # Mock Symbol Query
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol

    mock_session.execute.return_value = mock_result_symbol
    
    # Override dependency
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    
    response = client.get("/api/v1/indicators/IBM/invalid_indicator")
    
    # Clean up
    app.dependency_overrides = {}
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Indicator not found"

@pytest.mark.asyncio
async def test_get_indicator_symbol_not_found():
    # Mock DB dependency
    mock_session = AsyncMock()
    
    # Mock Symbol Query returning None
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = None

    mock_session.execute.return_value = mock_result_symbol
    
    # Override dependency
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    
    response = client.get("/api/v1/indicators/NONEXISTENT/tdfi")
    
    # Clean up
    app.dependency_overrides = {}
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Symbol not found"

@pytest.mark.asyncio
async def test_get_indicator_no_candles():
    # Mock DB dependency
    mock_session = AsyncMock()
    
    # Mock Symbol Query
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol

    # Mock Candles Query returning empty list
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = []

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    # Override dependency
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    
    response = client.get("/api/v1/indicators/IBM/tdfi")
    
    # Clean up
    app.dependency_overrides = {}
    
    assert response.status_code == 404
    assert response.json()["detail"] == "No candles found for symbol"