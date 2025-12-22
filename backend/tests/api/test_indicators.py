import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import get_db
from unittest.mock import patch, MagicMock, AsyncMock
import numpy as np

# Mock DB dependency
async def override_get_db():
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_db.execute.return_value = mock_result
    
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"
    
    mock_result.scalars.return_value.first.return_value = mock_symbol
    yield mock_db

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture
def mock_orchestrator():
    with patch("app.api.v1.indicators.DataOrchestrator") as mock:
        instance = mock.return_value
        instance.get_candles = AsyncMock()
        instance.get_candles.return_value = [
            {"timestamp": "2023-10-27T00:00:00Z", "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000, "id": 1, "ticker": "IBM", "interval": "1d"}
        ]
        yield instance

@pytest.fixture
def mock_indicators():
    with patch("app.api.v1.indicators.indicators") as mock:
        # Mock TDFI result
        mock_df_tdfi = MagicMock()
        mock_df_tdfi.__getitem__.side_effect = lambda key: {
            "TDFI": np.array([0.1]),
            "TDFI_Signal": np.array([1])
        }[key]
        mock.calculate_tdfi.return_value = mock_df_tdfi
        
        # Mock cRSI result
        mock_df_crsi = MagicMock()
        mock_df_crsi.__getitem__.side_effect = lambda key: {
            "cRSI": np.array([50.0]),
            "cRSI_UpperBand": np.array([70.0]),
            "cRSI_LowerBand": np.array([30.0])
        }[key]
        mock.calculate_crsi.return_value = mock_df_crsi
        yield mock

@pytest.mark.asyncio
async def test_get_tdfi_metadata(mock_orchestrator, mock_indicators):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/tdfi?interval=1d")
    
    assert response.status_code == 200
    data = response.json()
    metadata = data["metadata"]
    assert metadata["color_mode"] == "threshold"
    assert "high" in metadata["thresholds"]
    assert metadata["series_metadata"][0]["line_style"] == "solid"

@pytest.mark.asyncio
async def test_get_crsi_metadata(mock_orchestrator, mock_indicators):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/crsi?interval=1d")
    
    assert response.status_code == 200
    data = response.json()
    metadata = data["metadata"]
    assert metadata["color_mode"] == "threshold"
    assert metadata["series_metadata"][1]["line_style"] == "dashed"

# Clean up overrides after tests
@pytest.fixture(autouse=True)
def cleanup():
    yield
    app.dependency_overrides.clear()
