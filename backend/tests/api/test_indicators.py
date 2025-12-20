from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock
import pytest
from datetime import datetime, timedelta
from app.main import app
from app.db.session import get_db

client = TestClient(app)

def create_mock_candles(count=100):
    base_time = datetime(2023, 10, 27)
    candles = []
    for i in range(count):
        mock_candle = MagicMock()
        mock_candle.id = i
        mock_candle.symbol_id = 1
        mock_candle.open = 100.0 + i
        mock_candle.high = 110.0 + i
        mock_candle.low = 90.0 + i
        mock_candle.close = 105.0 + i
        mock_candle.volume = 1000
        mock_candle.timestamp = base_time + timedelta(hours=i)
        candles.append(mock_candle)
    return candles

@pytest.mark.asyncio
async def test_get_tdfi_indicator_endpoint():
    mock_session = AsyncMock()
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = create_mock_candles()

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    response = client.get("/api/v1/indicators/IBM/tdfi")
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    assert "timestamps" in data
    assert "tdfi" in data
    assert "tdfi_signal" in data
    assert len(data["timestamps"]) == 100

@pytest.mark.asyncio
async def test_get_crsi_indicator_endpoint():
    mock_session = AsyncMock()
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = create_mock_candles()

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    response = client.get("/api/v1/indicators/IBM/crsi")
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    assert "timestamps" in data
    assert "crsi" in data
    assert "upper_band" in data
    assert "lower_band" in data

@pytest.mark.asyncio
async def test_get_adxvma_indicator_endpoint():
    mock_session = AsyncMock()
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = create_mock_candles()

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    response = client.get("/api/v1/indicators/IBM/adxvma")
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    assert "timestamps" in data
    assert "adxvma" in data

@pytest.mark.asyncio
async def test_get_indicator_invalid_name():
    mock_session = AsyncMock()
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = create_mock_candles()

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    response = client.get("/api/v1/indicators/IBM/invalid_indicator")
    app.dependency_overrides = {}
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Indicator not found"

@pytest.mark.asyncio
async def test_get_indicator_symbol_not_found():
    mock_session = AsyncMock()
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = None

    mock_session.execute.return_value = mock_result_symbol
    
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    response = client.get("/api/v1/indicators/NONEXISTENT/tdfi")
    app.dependency_overrides = {}
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Symbol not found"

@pytest.mark.asyncio
async def test_get_indicator_no_candles():
    mock_session = AsyncMock()
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = []

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    response = client.get("/api/v1/indicators/IBM/tdfi")
    app.dependency_overrides = {}
    
    assert response.status_code == 404
    assert response.json()["detail"] == "No candles found for symbol"
