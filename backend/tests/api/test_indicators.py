"""Tests for indicators API endpoints.

Tests for:
- GET /api/v1/indicators - list all indicators
- GET /api/v1/indicators/supported - list with full metadata
- GET /api/v1/indicators/{symbol}/{name} - get indicator data
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import get_db
from unittest.mock import patch, MagicMock, AsyncMock
import numpy as np
import pandas as pd


async def override_get_db():
    """Mock DB dependency that returns a test symbol."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_db.execute.return_value = mock_result

    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "IBM"

    mock_result.scalars.return_value.first.return_value = mock_symbol
    yield mock_db


async def override_get_db_not_found():
    """Mock DB dependency that returns None (symbol not found)."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_db.execute.return_value = mock_result
    mock_result.scalars.return_value.first.return_value = None
    yield mock_db


@pytest.fixture
def mock_orchestrator():
    """Mock DataOrchestrator for candle data."""
    with patch("app.api.v1.indicators.DataOrchestrator") as mock:
        instance = mock.return_value
        instance.get_candles = AsyncMock()
        # Return sample candle data
        instance.get_candles.return_value = [
            {
                "timestamp": "2023-10-27T00:00:00Z",
                "open": 100,
                "high": 110,
                "low": 90,
                "close": 105,
                "volume": 1000,
                "id": 1,
                "ticker": "IBM",
                "interval": "1d"
            },
            {
                "timestamp": "2023-10-28T00:00:00Z",
                "open": 105,
                "high": 115,
                "low": 100,
                "close": 110,
                "volume": 1100,
                "id": 2,
                "ticker": "IBM",
                "interval": "1d"
            },
        ]
        yield instance


# T020 [US1] [P] Write API tests for GET /api/v1/indicators
@pytest.mark.asyncio
async def test_list_indicators():
    """Test: GET /api/v1/indicators/ lists all available indicators with basic info."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    # Should include registered indicators
    indicator_names = [ind.get("name") for ind in data]
    assert "sma" in indicator_names
    assert "ema" in indicator_names
    assert "tdfi" in indicator_names
    assert "crsi" in indicator_names
    assert "adxvma" in indicator_names

    # Check SMA has required fields
    sma_indicators = [ind for ind in data if ind.get("name") == "sma"]
    assert len(sma_indicators) > 0
    sma = sma_indicators[0]
    assert "description" in sma
    assert "parameters" in sma


# T020 [US1] [P] Write API tests for GET /api/v1/indicators/supported
@pytest.mark.asyncio
async def test_list_indicators_with_metadata():
    """Test: GET /api/v1/indicators/supported returns full metadata for all indicators."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/supported")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    # Check SMA has full metadata
    sma_indicators = [ind for ind in data if ind.get("name") == "sma"]
    assert len(sma_indicators) > 0
    sma = sma_indicators[0]

    # Verify metadata structure
    assert "metadata" in sma
    metadata = sma["metadata"]
    assert "display_type" in metadata
    assert "color_mode" in metadata
    assert "color_schemes" in metadata
    assert "series_metadata" in metadata


# T021 [US1] [P] Write API tests for GET /api/v1/indicators/{symbol}/{name}
@pytest.mark.asyncio
async def test_get_indicator_sma(mock_orchestrator):
    """Test: GET /api/v1/indicators/{symbol}/sma returns IndicatorOutput."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d")

    assert response.status_code == 200
    data = response.json()

    # Verify IndicatorOutput structure
    assert "symbol" in data
    assert "interval" in data
    assert "timestamps" in data
    assert "data" in data
    assert "metadata" in data
    assert "calculated_at" in data
    assert "data_points" in data

    # Check metadata
    metadata = data["metadata"]
    assert metadata["display_type"] == "overlay"
    assert metadata["color_mode"] == "single"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_indicator_with_params(mock_orchestrator):
    """Test: GET /api/v1/indicators/{symbol}/sma with custom period parameter."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&params=%7B%22period%22%3A%2050%7D")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_indicator_invalid_interval():
    """Test: GET /api/v1/indicators/{symbol}/sma with invalid interval returns 400."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=invalid")

    assert response.status_code == 400
    assert "Invalid interval" in response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_indicator_invalid_params():
    """Test: GET /api/v1/indicators/{symbol}/sma with invalid params JSON returns 400."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&params=invalid-json")

    assert response.status_code == 400
    assert "Invalid params JSON" in response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_indicator_not_found():
    """Test: GET /api/v1/indicators/{symbol}/nonexistent returns 404."""
    # Mock orchestrator to return candles so we get to the indicator check
    with patch("app.api.v1.indicators.DataOrchestrator") as mock_orchestrator:
        instance = mock_orchestrator.return_value
        instance.get_candles = AsyncMock(return_value=[
            {"timestamp": "2023-10-27T00:00:00Z", "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000}
        ])

        app.dependency_overrides[get_db] = override_get_db

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/api/v1/indicators/IBM/nonexistent_indicator?interval=1d")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_indicator_symbol_not_found():
    """Test: GET /api/v1/indicators/{nonexistent_symbol}/sma returns 404."""
    app.dependency_overrides[get_db] = override_get_db_not_found

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/NONEXISTENT/sma?interval=1d")

    assert response.status_code == 404
    assert "Symbol not found" in response.json()["detail"]

    app.dependency_overrides.clear()
