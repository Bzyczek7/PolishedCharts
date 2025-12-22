from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock
from app.main import app
from app.db.session import get_db

client = TestClient(app)

def test_get_candles_endpoint():
    # Mock DB dependency
    mock_session = AsyncMock()
    
    # Mock Symbol Query
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol

    # Mock Candles Query
    mock_candle = MagicMock()
    mock_candle.id = 1
    mock_candle.symbol_id = 1
    mock_candle.interval = "1d"
    mock_candle.open = 100.0
    mock_candle.high = 110.0
    mock_candle.low = 90.0
    mock_candle.close = 105.0
    mock_candle.volume = 1000
    mock_candle.timestamp = "2023-10-27T00:00:00"
    
    mock_result_candles = MagicMock()
    mock_result_candles.scalars.return_value.all.return_value = [mock_candle]

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candles]
    
    # Override dependency
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    
    response = client.get("/api/v1/candles/IBM?interval=1h&from=2023-10-20T00:00:00")
    
    # Clean up
    app.dependency_overrides = {}
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["close"] == 105.0
    assert data[0]["ticker"] == "IBM"
    assert data[0]["interval"] == "1d" # From mock
