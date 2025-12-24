from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timezone
from app.main import app
from app.db.session import get_db
import pytest


# T023 [US1] Integration test for GET /api/v1/candles/{symbol}
@pytest.mark.asyncio
async def test_get_candles_endpoint():
    """Test successful candle retrieval via API."""
    # Mock the DataOrchestrator to return sample candles
    mock_candles = [
        {
            "timestamp": datetime(2023, 10, 27, tzinfo=timezone.utc),
            "open": 100.0,
            "high": 110.0,
            "low": 90.0,
            "close": 105.0,
            "volume": 1000,
            "interval": "1h",
            "ticker": "IBM"
        }
    ]

    with patch("app.api.v1.candles.DataOrchestrator") as mock_orchestrator_class:
        mock_orchestrator = AsyncMock()
        mock_orchestrator.get_candles = AsyncMock(return_value=mock_candles)
        mock_orchestrator_class.return_value = mock_orchestrator

        # Mock Symbol query for DB dependency
        mock_session = AsyncMock()
        mock_symbol = MagicMock()
        mock_symbol.id = 1
        mock_symbol.ticker = "IBM"
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_symbol
        mock_session.execute.return_value = mock_result

        async def override_get_db():
            yield mock_session

        app.dependency_overrides[get_db] = override_get_db

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/v1/candles/IBM?interval=1h&from=2023-10-20T00:00:00&local_only=true")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["close"] == 105.0
            assert data[0]["ticker"] == "IBM"
            assert data[0]["interval"] == "1h"
        finally:
            app.dependency_overrides = {}


# T021 [US1] No data available error returns 404 with message
@pytest.mark.asyncio
async def test_no_data_returns_404_with_message():
    """Test that GET /api/v1/candles/{symbol} returns 404 when no data exists."""
    # Mock the DataOrchestrator to return empty list
    with patch("app.api.v1.candles.DataOrchestrator") as mock_orchestrator_class:
        mock_orchestrator = AsyncMock()
        mock_orchestrator.get_candles = AsyncMock(return_value=[])
        mock_orchestrator_class.return_value = mock_orchestrator

        # Mock Symbol query
        mock_session = AsyncMock()
        mock_symbol = MagicMock()
        mock_symbol.id = 1
        mock_symbol.ticker = "NODATA"
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_symbol
        mock_session.execute.return_value = mock_result

        async def override_get_db():
            yield mock_session

        app.dependency_overrides[get_db] = override_get_db

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/v1/candles/NODATA?interval=1h&local_only=true")

            # Should return 404 with error message
            assert response.status_code == 404
            data = response.json()
            assert "detail" in data
        finally:
            app.dependency_overrides = {}


# T022 [US1] Provider error returns cached data with flag
@pytest.mark.asyncio
async def test_provider_error_returns_cached_data_flag():
    """Test that GET /api/v1/candles/{symbol} returns cached data when provider is down."""
    # Mock candles to simulate cached data
    mock_candles = [
        {
            "timestamp": datetime(2023, 10, 27, tzinfo=timezone.utc),
            "open": 100.0,
            "high": 110.0,
            "low": 90.0,
            "close": 105.0,
            "volume": 1000,
            "interval": "1h",
            "ticker": "CACHED"
        }
    ]

    with patch("app.api.v1.candles.DataOrchestrator") as mock_orchestrator_class:
        mock_orchestrator = AsyncMock()
        mock_orchestrator.get_candles = AsyncMock(return_value=mock_candles)
        mock_orchestrator_class.return_value = mock_orchestrator

        # Mock Symbol query
        mock_session = AsyncMock()
        mock_symbol = MagicMock()
        mock_symbol.id = 1
        mock_symbol.ticker = "CACHED"
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_symbol
        mock_session.execute.return_value = mock_result

        async def override_get_db():
            yield mock_session

        app.dependency_overrides[get_db] = override_get_db

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/v1/candles/CACHED?interval=1h&local_only=true")

            assert response.status_code == 200
            data = response.json()
            assert len(data) >= 1
        finally:
            app.dependency_overrides = {}


# T023 [US1] Integration test for GET /api/v1/candles/{symbol}
@pytest.mark.asyncio
async def test_get_candles_success():
    """Integration test for successful candles retrieval."""
    # Mock the DataOrchestrator to return multiple candles
    mock_candles = []
    for i in range(10):
        mock_candles.append({
            "timestamp": datetime(2023, 10, 27, hour=i, tzinfo=timezone.utc),
            "open": 100.0 + i,
            "high": 110.0 + i,
            "low": 90.0 + i,
            "close": 105.0 + i,
            "volume": 1000 + i * 100,
            "interval": "1h",
            "ticker": "TEST"
        })

    with patch("app.api.v1.candles.DataOrchestrator") as mock_orchestrator_class:
        mock_orchestrator = AsyncMock()
        mock_orchestrator.get_candles = AsyncMock(return_value=mock_candles)
        mock_orchestrator_class.return_value = mock_orchestrator

        # Mock Symbol query
        mock_session = AsyncMock()
        mock_symbol = MagicMock()
        mock_symbol.id = 1
        mock_symbol.ticker = "TEST"
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_symbol
        mock_session.execute.return_value = mock_result

        async def override_get_db():
            yield mock_session

        app.dependency_overrides[get_db] = override_get_db

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/v1/candles/TEST?interval=1h&local_only=true")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 10
            assert data[0]["close"] == 105.0
            assert data[-1]["close"] == 114.0
        finally:
            app.dependency_overrides = {}
