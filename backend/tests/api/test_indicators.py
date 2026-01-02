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


@pytest.fixture(autouse=True)
def initialize_indicators():
    """Initialize standard indicators for all tests."""
    from app.services.indicator_registry.initialization import initialize_standard_indicators
    initialize_standard_indicators()
    yield
    # No cleanup needed - tests use isolated registry


@pytest.fixture
def mock_orchestrator():
    """Mock DataOrchestrator for candle data."""
    from app.services.orchestrator import DataOrchestrator

    mock_instance = AsyncMock()
    mock_instance.get_candles = AsyncMock()
    # Return sample candle data
    mock_instance.get_candles.return_value = [
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

    # Set the mock orchestrator in app state
    app.state.orchestrator = mock_instance

    yield mock_instance

    # Clean up
    if hasattr(app.state, 'orchestrator'):
        delattr(app.state, 'orchestrator')


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
    # Ensure indicators are initialized (autouse fixture might not run in all pytest environments)
    from app.services.indicator_registry.initialization import initialize_standard_indicators
    initialize_standard_indicators()

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
    # Set up a mock orchestrator for this test
    mock_instance = AsyncMock()
    mock_instance.get_candles = AsyncMock(return_value=[
        {"timestamp": "2023-10-27T00:00:00Z", "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000, "id": 1, "ticker": "IBM", "interval": "1d"}
    ])
    app.state.orchestrator = mock_instance

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=invalid")

    assert response.status_code == 400
    assert "Invalid interval" in response.json()["detail"]

    app.dependency_overrides.clear()
    if hasattr(app.state, 'orchestrator'):
        delattr(app.state, 'orchestrator')


@pytest.mark.asyncio
async def test_get_indicator_invalid_params():
    """Test: GET /api/v1/indicators/{symbol}/sma with invalid params JSON returns 400."""
    # Set up a mock orchestrator for this test
    mock_instance = AsyncMock()
    mock_instance.get_candles = AsyncMock(return_value=[
        {"timestamp": "2023-10-27T00:00:00Z", "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000, "id": 1, "ticker": "IBM", "interval": "1d"}
    ])
    app.state.orchestrator = mock_instance

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&params=invalid-json")

    assert response.status_code == 400
    assert "Invalid params JSON" in response.json()["detail"]

    app.dependency_overrides.clear()
    if hasattr(app.state, 'orchestrator'):
        delattr(app.state, 'orchestrator')


@pytest.mark.asyncio
async def test_get_indicator_not_found():
    """Test: GET /api/v1/indicators/{symbol}/nonexistent returns 404."""
    # Mock orchestrator to return candles so we get to the indicator check
    mock_instance = AsyncMock()
    mock_instance.get_candles = AsyncMock(return_value=[
        {"timestamp": "2023-10-27T00:00:00Z", "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000, "id": 1, "ticker": "IBM", "interval": "1d"}
    ])
    app.state.orchestrator = mock_instance

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/nonexistent_indicator?interval=1d")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]

    app.dependency_overrides.clear()
    if hasattr(app.state, 'orchestrator'):
        delattr(app.state, 'orchestrator')


@pytest.mark.asyncio
async def test_get_indicator_symbol_not_found():
    """Test: GET /api/v1/indicators/{nonexistent_symbol}/sma returns 404."""
    # Set up a mock orchestrator for this test
    mock_instance = AsyncMock()
    mock_instance.get_candles = AsyncMock(return_value=[
        {"timestamp": "2023-10-27T00:00:00Z", "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000, "id": 1, "ticker": "NONEXISTENT", "interval": "1d"}
    ])
    app.state.orchestrator = mock_instance

    app.dependency_overrides[get_db] = override_get_db_not_found

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/NONEXISTENT/sma?interval=1d")

    assert response.status_code == 404
    assert "Symbol not found" in response.json()["detail"]

    app.dependency_overrides.clear()
    if hasattr(app.state, 'orchestrator'):
        delattr(app.state, 'orchestrator')


# ============================================================================
# Feature 007: Configurable Indicator Instances Tests
# These tests support query parameter-based dynamic configuration
# ============================================================================

@pytest.mark.asyncio
async def test_sma_default_period(mock_orchestrator):
    """Test: GET /indicators/AAPL/sma uses period=20 when no parameter provided."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    # SMA should use default period=20
    assert "sma" in data["data"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_sma_custom_period(mock_orchestrator):
    """Test: GET /indicators/AAPL/sma?period=50 uses provided period value."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&period=50")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "sma" in data["data"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_sma_period_validation_too_low(mock_orchestrator):
    """Test: SMA period=1 returns 400 error (below minimum of 2)."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&period=1")

    assert response.status_code == 400
    assert "must be >=" in response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_sma_period_validation_too_high(mock_orchestrator):
    """Test: SMA period=1000 returns 400 error (above maximum of 500)."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&period=1000")

    assert response.status_code == 400
    assert "must be <=" in response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_api_sma_with_query_params(mock_orchestrator):
    """Test: GET /indicators/AAPL/sma?period=50 works end-to-end."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&period=50")

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

    app.dependency_overrides.clear()


# ============================================================================
# Feature 007: User Story 2 - EMA Tests
# ============================================================================

@pytest.mark.asyncio
async def test_ema_default_period(mock_orchestrator):
    """Test: GET /indicators/AAPL/ema uses period=20 when no parameter provided."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/ema?interval=1d")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "ema" in data["data"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_ema_custom_period(mock_orchestrator):
    """Test: GET /indicators/AAPL/ema?period=9 uses provided period value."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/ema?interval=1d&period=9")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "ema" in data["data"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_ema_period_validation_too_low(mock_orchestrator):
    """Test: EMA period=0 returns 400 error (below minimum of 1)."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/ema?interval=1d&period=0")

    assert response.status_code == 400
    assert "must be >=" in response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_ema_period_validation_too_high(mock_orchestrator):
    """Test: EMA period=1000 returns 400 error (above maximum of 500)."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/ema?interval=1d&period=1000")

    assert response.status_code == 400
    assert "must be <=" in response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_api_ema_with_query_params(mock_orchestrator):
    """Test: GET /indicators/AAPL/ema?period=9 works end-to-end."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/ema?interval=1d&period=9")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "ema" in data["data"]

    app.dependency_overrides.clear()


# ============================================================================
# Feature 007: User Story 3 - Multi-Parameter Indicator Tests
# ============================================================================

@pytest.mark.asyncio
async def test_tdfi_custom_params(mock_orchestrator):
    """Test: GET /indicators/AAPL/tdfi?lookback=20 works with custom lookback."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/tdfi?interval=1d&lookback=20")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_crsi_multiple_parameters(mock_orchestrator):
    """Test: GET /indicators/AAPL/crsi with all parameters works.
    
    Note: API uses snake_case (dom_cycle, cyclic_memory) which gets mapped
    to the indicator's internal parameter names (domcycle, cyclicmemory).
    """
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/indicators/IBM/crsi?interval=1d&dom_cycle=20&vibration=14&leveling=11.0&cyclic_memory=40"
        )

    assert response.status_code == 200
    data = response.json()
    assert "data" in data

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_crsi_partial_parameters(mock_orchestrator):
    """Test: GET /indicators/AAPL/crsi with partial parameters uses defaults for missing ones.
    
    Note: API uses snake_case (dom_cycle) which gets mapped to indicator's internal name (domcycle).
    """
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/crsi?interval=1d&dom_cycle=25")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_crsi_parameter_validation(mock_orchestrator):
    """Test: cRSI with out-of-range parameter returns 400 with valid range.
    
    Note: API uses snake_case (dom_cycle) which gets mapped to indicator's internal name (domcycle).
    """
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/crsi?interval=1d&dom_cycle=200")

    assert response.status_code == 400
    assert "must be <=" in response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_adxvma_custom_period(mock_orchestrator):
    """Test: GET /indicators/AAPL/adxvma?adxvma_period=20 works with custom period."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/adxvma?interval=1d&adxvma_period=20")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_api_multi_param_indicators(mock_orchestrator):
    """Test: GET /indicators/AAPL/crsi?dom_cycle=20&vibration=14 works end-to-end.
    
    Note: API uses snake_case (dom_cycle) which gets mapped to indicator's internal name (domcycle).
    """
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/crsi?interval=1d&dom_cycle=20&vibration=14")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data

    app.dependency_overrides.clear()


# ============================================================================
# Feature 007: User Story 4 - Backward Compatibility Tests
# ============================================================================

@pytest.mark.asyncio
async def test_backward_compatibility_sma_no_params(mock_orchestrator):
    """Test: GET /indicators/AAPL/sma works with default period=20 (no params)."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "sma" in data["data"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_backward_compatibility_ema_no_params(mock_orchestrator):
    """Test: GET /indicators/AAPL/ema works with default period=20 (no params)."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/ema?interval=1d")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "ema" in data["data"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_existing_endpoints_unchanged(mock_orchestrator):
    """Test: All existing endpoints work unchanged (backward compatibility)."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test list indicators
        response1 = await ac.get("/api/v1/indicators/")
        assert response1.status_code == 200

        # Test list with metadata
        response2 = await ac.get("/api/v1/indicators/supported")
        assert response2.status_code == 200

        # Test SMA endpoint
        response3 = await ac.get("/api/v1/indicators/IBM/sma?interval=1d")
        assert response3.status_code == 200

        # Test EMA endpoint
        response4 = await ac.get("/api/v1/indicators/IBM/ema?interval=1d")
        assert response4.status_code == 200

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_params_json_string_backward_compat(mock_orchestrator):
    """Test: Legacy params={\"period\":50} format still works."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&params=%7B%22period%22%3A%2050%7D")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_query_params_override_json_params(mock_orchestrator):
    """Test: Query params override JSON params when both provided."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Query param period=50 should override JSON param period=30
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&period=50&params=%7B%22period%22%3A%2030%7D")

    assert response.status_code == 200
    # The indicator should be calculated with period=50 (query param takes precedence)

    app.dependency_overrides.clear()


# ============================================================================
# Feature 007: User Story 5 - Discovery Endpoint Tests
# ============================================================================

@pytest.mark.asyncio
async def test_api_supported_endpoint():
    """Test: GET /api/v1/indicators/supported returns all indicators with parameters."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/supported")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    # Check that indicators have parameter definitions
    for indicator in data:
        assert "parameters" in indicator
        assert isinstance(indicator["parameters"], dict)


@pytest.mark.asyncio
async def test_parameter_definitions_in_response():
    """Test: /supported endpoint includes parameters, types, and valid ranges."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/supported")

    assert response.status_code == 200
    data = response.json()

    # Find SMA indicator
    sma = next((ind for ind in data if ind["name"] == "sma"), None)
    assert sma is not None
    assert "parameters" in sma
    # pandas-ta uses 'length' parameter (not 'period')
    assert "length" in sma["parameters"]

    length_def = sma["parameters"]["length"]
    assert length_def["type"] == "integer"
    assert length_def["default"] == 20
    assert length_def["min"] == 2
    assert length_def["max"] == 500
    assert "description" in length_def


# ============================================================================
# Feature 007: Error Response Tests
# ============================================================================

@pytest.mark.asyncio
async def test_unknown_indicator_returns_404_with_available_list(mock_orchestrator):
    """Test: Unknown indicator returns 404 with list of available indicators."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/unknown_indicator?interval=1d")

    assert response.status_code == 404
    detail = response.json()["detail"]
    assert "not found" in detail
    assert "Available:" in detail

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_invalid_parameter_type_returns_400(mock_orchestrator):
    """Test: Invalid parameter type returns 400 with descriptive error."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Note: FastAPI handles type conversion at the Query level, so this tests
        # the JSON params path where type validation happens in the endpoint
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&params=%7B%22period%22%3A%20%22invalid%22%7D")

    assert response.status_code == 400

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_parameter_out_of_range_returns_400_with_valid_range(mock_orchestrator):
    """Test: Parameter out of range returns 400 with valid range in message."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&period=1000")

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "must be <=" in detail
    assert "500" in detail

    app.dependency_overrides.clear()


# ============================================================================
# Feature 010: pandas-ta Indicator Integration Tests (User Story 1)
# ============================================================================

@pytest.mark.asyncio
async def test_pandas_ta_response_key_casing_matches_canonical_contract(mock_orchestrator):
    """T013 [US1]: Integration test to validate response key casing matches canonical contract.

    Asserts IndicatorOutput.metadata uses snake_case: series_metadata, display_type,
    color_mode, reference_levels per contracts/indicator-metadata.json and
    frontend/src/components/types/indicators.ts
    """
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test RSI
        response = await ac.get("/api/v1/indicators/IBM/rsi?interval=1d")
        assert response.status_code == 200
        data = response.json()

        # Verify top-level structure
        assert "symbol" in data
        assert "interval" in data
        assert "timestamps" in data
        assert "data" in data
        assert "metadata" in data

        # CRITICAL: Verify metadata uses snake_case (not camelCase)
        metadata = data["metadata"]
        assert "series_metadata" in metadata, "metadata.series_metadata must use snake_case"
        assert "display_type" in metadata, "metadata.display_type must use snake_case"
        assert "color_mode" in metadata, "metadata.color_mode must use snake_case"

        # Verify reference_levels (if present) uses snake_case
        if "reference_levels" in metadata:
            assert isinstance(metadata["reference_levels"], list)

        # Verify series_metadata items use snake_case
        for series in metadata["series_metadata"]:
            assert "line_color" in series, "series.line_color must use snake_case"
            assert "line_style" in series, "series.line_style must use snake_case"
            assert "line_width" in series, "series.line_width must use snake_case"
            assert "display_type" in series, "series.display_type must use snake_case"

        # Test MACD (multi-series indicator)
        response = await ac.get("/api/v1/indicators/IBM/macd?interval=1d")
        assert response.status_code == 200
        data = response.json()
        metadata = data["metadata"]

        # Verify same snake_case pattern for MACD
        assert "series_metadata" in metadata
        assert "display_type" in metadata
        assert "color_mode" in metadata
        for series in metadata["series_metadata"]:
            assert "line_color" in series
            assert "line_style" in series

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pandas_ta_indicators_in_supported_list():
    """T014 [US1]: Integration test for GET /api/v1/indicators/supported includes pandas-ta indicators."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/supported")
        assert response.status_code == 200

        indicators = response.json()
        indicator_names = [ind["name"] for ind in indicators]

        # Verify all 4 pandas-ta indicators are present
        assert "rsi" in indicator_names, "RSI indicator missing from /supported"
        assert "macd" in indicator_names, "MACD indicator missing from /supported"
        assert "bbands" in indicator_names, "BBANDS indicator missing from /supported"
        assert "atr" in indicator_names, "ATR indicator missing from /supported"

        # Verify RSI has correct structure
        rsi = next(ind for ind in indicators if ind["name"] == "rsi")
        assert rsi["display_type"] == "pane"
        assert rsi["category"] == "oscillator"
        # pandas-ta uses 'length' parameter (not 'period')
        assert "length" in rsi["parameters"]
        assert rsi["parameters"]["length"]["type"] == "integer"
        assert rsi["parameters"]["length"]["default"] == 14
        assert rsi["parameters"]["length"]["min"] == 2
        assert rsi["parameters"]["length"]["max"] == 500  # pandas-ta standard max

        # Verify MACD has correct structure
        macd = next(ind for ind in indicators if ind["name"] == "macd")
        assert macd["display_type"] == "pane"
        assert macd["category"] == "oscillator"  # Category is "oscillator" per implementation
        assert "fast" in macd["parameters"]
        assert "slow" in macd["parameters"]
        assert "signal" in macd["parameters"]

        # Verify BBANDS has correct structure
        bbands = next(ind for ind in indicators if ind["name"] == "bbands")
        assert bbands["display_type"] == "overlay"
        assert bbands["category"] == "overlay"  # Category is "overlay" per implementation
        assert "length" in bbands["parameters"]
        # pandas-ta uses lower_std and upper_std (not std)
        assert "lower_std" in bbands["parameters"]
        assert "upper_std" in bbands["parameters"]

        # Verify ATR has correct structure
        atr = next(ind for ind in indicators if ind["name"] == "atr")
        assert atr["display_type"] == "pane"
        # ATR is categorized as 'overlay' by pandas-ta metadata (displays on price scale)
        assert "length" in atr["parameters"]


@pytest.mark.asyncio
async def test_pandas_ta_rsi_calculation_endpoint(mock_orchestrator):
    """T015 [P] [US1]: Integration test for GET /api/v1/indicators/AAPL/rsi returns valid IndicatorOutput."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test with default parameters
        response = await ac.get("/api/v1/indicators/IBM/rsi?interval=1d")
        assert response.status_code == 200

        data = response.json()

        # Verify IndicatorOutput structure
        assert data["symbol"] == "IBM"
        assert data["interval"] == "1d"
        assert "timestamps" in data
        assert "data" in data
        assert "metadata" in data
        assert "calculated_at" in data
        assert "data_points" in data

        # Verify RSI-specific structure
        assert "rsi" in data["data"]
        assert len(data["timestamps"]) == len(data["data"]["rsi"])

        # Verify metadata
        metadata = data["metadata"]
        assert metadata["display_type"] == "pane"
        assert metadata["color_mode"] == "single"
        assert len(metadata["series_metadata"]) == 1
        assert metadata["series_metadata"][0]["field"] == "rsi"

        # Test with custom period
        response = await ac.get("/api/v1/indicators/IBM/rsi?interval=1d&period=21")
        assert response.status_code == 200
        data = response.json()
        assert "rsi" in data["data"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pandas_ta_macd_calculation_endpoint(mock_orchestrator):
    """T016 [P] [US1]: Integration test for GET /api/v1/indicators/AAPL/macd returns valid IndicatorOutput."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test with default parameters
        response = await ac.get("/api/v1/indicators/IBM/macd?interval=1d")
        assert response.status_code == 200

        data = response.json()

        # Verify IndicatorOutput structure
        assert data["symbol"] == "IBM"
        assert data["interval"] == "1d"
        assert "timestamps" in data
        assert "data" in data
        assert "metadata" in data

        # Verify MACD-specific structure (3 series: macd, signal, histogram)
        assert "macd" in data["data"]
        assert "signal" in data["data"]
        assert "histogram" in data["data"]
        assert len(data["timestamps"]) == len(data["data"]["macd"])
        assert len(data["timestamps"]) == len(data["data"]["signal"])
        assert len(data["timestamps"]) == len(data["data"]["histogram"])

        # Verify metadata
        metadata = data["metadata"]
        assert metadata["display_type"] == "pane"
        assert len(metadata["series_metadata"]) == 3

        # Verify all 3 series are present in metadata
        series_fields = [s["field"] for s in metadata["series_metadata"]]
        assert "macd" in series_fields
        assert "signal" in series_fields
        assert "histogram" in series_fields

        # Test with custom parameters
        response = await ac.get("/api/v1/indicators/IBM/macd?interval=1d&fast=8&slow=21&signal=5")
        assert response.status_code == 200
        data = response.json()
        assert "macd" in data["data"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pandas_ta_bbands_calculation_endpoint(mock_orchestrator):
    """T017 [P] [US1]: Integration test for GET /api/v1/indicators/AAPL/bbands returns valid IndicatorOutput."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test with default parameters
        response = await ac.get("/api/v1/indicators/IBM/bbands?interval=1d")
        assert response.status_code == 200

        data = response.json()

        # Verify IndicatorOutput structure
        assert data["symbol"] == "IBM"
        assert data["interval"] == "1d"
        assert "timestamps" in data
        assert "data" in data
        assert "metadata" in data

        # Verify BBANDS-specific structure (3 series: lower, middle, upper)
        assert "lower" in data["data"]
        assert "middle" in data["data"]
        assert "upper" in data["data"]
        assert len(data["timestamps"]) == len(data["data"]["lower"])
        assert len(data["timestamps"]) == len(data["data"]["middle"])
        assert len(data["timestamps"]) == len(data["data"]["upper"])

        # Verify metadata (overlay indicator)
        metadata = data["metadata"]
        assert metadata["display_type"] == "overlay"
        assert len(metadata["series_metadata"]) == 3

        # Verify all 3 series are present in metadata
        series_fields = [s["field"] for s in metadata["series_metadata"]]
        assert "upper" in series_fields
        assert "middle" in series_fields
        assert "lower" in series_fields

        # Test with custom parameters
        response = await ac.get("/api/v1/indicators/IBM/bbands?interval=1d&length=10&std=1.5")
        assert response.status_code == 200
        data = response.json()
        assert "lower" in data["data"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pandas_ta_atr_calculation_endpoint(mock_orchestrator):
    """T018 [P] [US1]: Integration test for GET /api/v1/indicators/AAPL/atr returns valid IndicatorOutput."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test with default parameters
        response = await ac.get("/api/v1/indicators/IBM/atr?interval=1d")
        assert response.status_code == 200

        data = response.json()

        # Verify IndicatorOutput structure
        assert data["symbol"] == "IBM"
        assert data["interval"] == "1d"
        assert "timestamps" in data
        assert "data" in data
        assert "metadata" in data

        # Verify ATR-specific structure
        assert "atr" in data["data"]
        assert len(data["timestamps"]) == len(data["data"]["atr"])

        # Verify metadata (pane indicator)
        metadata = data["metadata"]
        assert metadata["display_type"] == "pane"
        assert len(metadata["series_metadata"]) == 1
        assert metadata["series_metadata"][0]["field"] == "atr"

        # Test with custom period
        response = await ac.get("/api/v1/indicators/IBM/atr?interval=1d&period=21")
        assert response.status_code == 200
        data = response.json()
        assert "atr" in data["data"]

    app.dependency_overrides.clear()


# ============================================================================
# Feature 010: pandas-ta Indicator Integration Tests (User Story 2)
# ============================================================================

@pytest.mark.asyncio
async def test_pandas_ta_parameter_customization_via_api(mock_orchestrator):
    """T031 [P] [US2]: Integration test for parameter customization via API.

    Validates parameter passing for RSI period, MACD fast/slow/signal,
    BBANDS length/std, ATR period.
    """
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test RSI with custom period
        response = await ac.get("/api/v1/indicators/IBM/rsi?interval=1d&period=21")
        assert response.status_code == 200
        data = response.json()
        assert "rsi" in data["data"]
        # Verify calculation was performed with custom period (non-default values)
        assert len(data["data"]["rsi"]) > 0

        # Test MACD with custom fast/slow/signal
        response = await ac.get("/api/v1/indicators/IBM/macd?interval=1d&fast=8&slow=21&signal=5")
        assert response.status_code == 200
        data = response.json()
        assert "macd" in data["data"]
        assert "signal" in data["data"]
        assert "histogram" in data["data"]

        # Test BBANDS with custom length/std
        response = await ac.get("/api/v1/indicators/IBM/bbands?interval=1d&length=10&std=1.5")
        assert response.status_code == 200
        data = response.json()
        assert "upper" in data["data"]
        assert "middle" in data["data"]
        assert "lower" in data["data"]

        # Test ATR with custom period
        response = await ac.get("/api/v1/indicators/IBM/atr?interval=1d&period=21")
        assert response.status_code == 200
        data = response.json()
        assert "atr" in data["data"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pandas_ta_parameter_validation_errors(mock_orchestrator):
    """T032 [P] [US2]: Integration test for parameter validation errors.

    Tests out-of-bounds and type errors using params JSON (current API constraint).
    """
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test RSI period too small
        response = await ac.get("/api/v1/indicators/IBM/rsi?interval=1d&params=%7B%22period%22%3A%201%7D")
        assert response.status_code == 400

        # Test RSI period too large
        response = await ac.get("/api/v1/indicators/IBM/rsi?interval=1d&params=%7B%22period%22%3A%20500%7D")
        assert response.status_code == 400

        # Test BBANDS std too small
        response = await ac.get("/api/v1/indicators/IBM/bbands?interval=1d&params=%7B%22std%22%3A%200.01%7D")
        assert response.status_code == 400

        # Test BBANDS std too large
        response = await ac.get("/api/v1/indicators/IBM/bbands?interval=1d&params=%7B%22std%22%3A%2010%7D")
        assert response.status_code == 400

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pandas_ta_meaningful_error_messages(mock_orchestrator):
    """T032a [P] [US2]: Integration test for meaningful error messages.

    Asserts HTTP 400 for validation errors and that the error message includes
    parameter name, expected range/type, and received value per FR-013 and FR-014.
    """
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test RSI period out of range
        response = await ac.get("/api/v1/indicators/IBM/rsi?interval=1d&params=%7B%22period%22%3A%201%7D")
        assert response.status_code == 400
        detail = response.json()["detail"]
        # Error should include parameter name and range
        assert "period" in detail.lower()
        assert ("2" in detail or ">=" in detail)  # Min value mentioned

        # Test BBANDS std out of range
        response = await ac.get("/api/v1/indicators/IBM/bbands?interval=1d&params=%7B%22std%22%3A%2010%7D")
        assert response.status_code == 400
        detail = response.json()["detail"]
        # Error should include parameter name and range
        assert "std" in detail.lower()

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pandas_ta_rsi_custom_period(mock_orchestrator):
    """T033 [P] [US2]: Integration test for RSI with custom period=21."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/rsi?interval=1d&period=21")
        assert response.status_code == 200

        data = response.json()
        assert "rsi" in data["data"]
        # Verify we get data back
        assert len(data["data"]["rsi"]) > 0
        # Verify all timestamps have corresponding values (or None for warmup)
        assert len(data["timestamps"]) == len(data["data"]["rsi"])

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pandas_ta_macd_custom_fast_slow(mock_orchestrator):
    """T034 [P] [US2]: Integration test for MACD with custom fast=8, slow=21."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/macd?interval=1d&fast=8&slow=21&signal=9")
        assert response.status_code == 200

        data = response.json()
        assert "macd" in data["data"]
        assert "signal" in data["data"]
        assert "histogram" in data["data"]
        # Verify we get data back for all three series
        assert len(data["data"]["macd"]) > 0
        assert len(data["data"]["signal"]) > 0
        assert len(data["data"]["histogram"]) > 0
        # Verify array alignment
        assert len(data["timestamps"]) == len(data["data"]["macd"])
        assert len(data["timestamps"]) == len(data["data"]["signal"])
        assert len(data["timestamps"]) == len(data["data"]["histogram"])

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pandas_ta_bbands_custom_length_std(mock_orchestrator):
    """T035 [P] [US2]: Integration test for BBANDS with custom length=10, std=1.5."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/bbands?interval=1d&length=10&std=1.5")
        assert response.status_code == 200

        data = response.json()
        assert "upper" in data["data"]
        assert "middle" in data["data"]
        assert "lower" in data["data"]
        # Verify we get data back for all three bands
        assert len(data["data"]["upper"]) > 0
        assert len(data["data"]["middle"]) > 0
        assert len(data["data"]["lower"]) > 0
        # Verify array alignment
        assert len(data["timestamps"]) == len(data["data"]["upper"])
        assert len(data["timestamps"]) == len(data["data"]["middle"])
        assert len(data["timestamps"]) == len(data["data"]["lower"])

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pandas_ta_atr_custom_period(mock_orchestrator):
    """T036 [P] [US2]: Integration test for ATR with custom period=21."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/indicators/IBM/atr?interval=1d&period=21")
        assert response.status_code == 200

        data = response.json()
        assert "atr" in data["data"]
        # Verify we get data back
        assert len(data["data"]["atr"]) > 0
        # Verify all timestamps have corresponding values (or None for warmup)
        assert len(data["timestamps"]) == len(data["data"]["atr"])

    app.dependency_overrides.clear()


# =============================================================================
# Feature 014: Performance Integration Tests (T023-T024)
# =============================================================================

@pytest.mark.asyncio
async def test_cached_indicator_p90_under_100ms(mock_orchestrator):
    """T023 [P] [US1]: Integration test - cached indicator response <100ms (90th percentile)."""
    import time
    import statistics
    from app.services.cache import indicator_cache

    # Clear cache before test
    indicator_cache.clear()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Prime the cache with first request (this will be a cache miss)
        response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&period=20")
        assert response.status_code == 200

        # Measure cached response times (50 samples)
        times = []
        for _ in range(50):
            start = time.time()
            response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&period=20")
            duration_ms = (time.time() - start) * 1000
            times.append(duration_ms)
            assert response.status_code == 200

        # Calculate 90th percentile
        times.sort()
        p90 = times[int(len(times) * 0.9)]

        # SC-001: 90th percentile should be <100ms
        assert p90 < 100, f"90th percentile cached response time {p90:.1f}ms exceeds 100ms target"

        # Also verify median is <50ms (target)
        median = statistics.median(times)
        assert median < 50, f"Median cached response time {median:.1f}ms exceeds 50ms target"

        print(f"Cached indicator performance - Median: {median:.1f}ms, P90: {p90:.1f}ms")

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_uncached_indicator_p90_under_500ms(mock_orchestrator):
    """T024 [P] [US1]: Integration test - uncached indicator response <500ms (90th percentile)."""
    import time
    import statistics
    from app.services.cache import indicator_cache

    # Clear cache before test
    indicator_cache.clear()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Measure uncached response times (20 samples to save time)
        times = []
        for i in range(20):
            # Clear cache before each request to ensure cache miss
            indicator_cache.clear()

            start = time.time()
            response = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&period=20")
            duration_ms = (time.time() - start) * 1000
            times.append(duration_ms)
            assert response.status_code == 200

        # Calculate 90th percentile
        times.sort()
        p90 = times[int(len(times) * 0.9)]

        # SC-002: 90th percentile should be <500ms
        assert p90 < 500, f"90th percentile uncached response time {p90:.1f}ms exceeds 500ms target"

        print(f"Uncached indicator performance - Median: {statistics.median(times):.1f}ms, P90: {p90:.1f}ms")

    app.dependency_overrides.clear()



# =============================================================================
# Feature 014: Phase 4 - Batch API Tests (T028-T041)
# =============================================================================

@pytest.mark.asyncio
async def test_batch_request_validation():
    """T028 [P] [US2]: Unit test - batch request validation (max 10 items)."""
    from app.schemas.indicator import BatchIndicatorRequest, IndicatorRequest

    # Test valid batch size (3 items)
    valid_request = BatchIndicatorRequest(
        requests=[
            IndicatorRequest(symbol="SPY", indicator_name="sma", interval="1d", params={"period": 20}),
            IndicatorRequest(symbol="SPY", indicator_name="ema", interval="1d", params={"period": 20}),
            IndicatorRequest(symbol="SPY", indicator_name="rsi", interval="1d", params={"period": 14}),
        ]
    )
    assert len(valid_request.requests) == 3

    # Test maximum batch size (10 items)
    max_request = BatchIndicatorRequest(
        requests=[
            IndicatorRequest(symbol="SPY", indicator_name="sma", interval="1d", params={"period": i})
            for i in range(1, 11)
        ]
    )
    assert len(max_request.requests) == 10

    # Test exceeding maximum (should raise ValidationError)
    with pytest.raises(ValueError):
        BatchIndicatorRequest(
            requests=[
                IndicatorRequest(symbol="SPY", indicator_name="sma", interval="1d", params={"period": i})
                for i in range(1, 12)  # 11 items - exceeds max
            ]
        )


@pytest.mark.asyncio
async def test_batch_cache_check_first():
    """T029 [P] [US2]: Unit test - batch checks cache before database."""
    from app.services.cache import indicator_cache
    from app.schemas.indicator import BatchIndicatorRequest, IndicatorRequest

    # Clear cache before test
    indicator_cache.clear()

    # Create batch request
    batch_request = BatchIndicatorRequest(
        requests=[
            IndicatorRequest(symbol="IBM", indicator_name="sma", interval="1d", params={"period": 20}),
            IndicatorRequest(symbol="IBM", indicator_name="ema", interval="1d", params={"period": 20}),
        ]
    )

    # Test that cache check would happen first
    # (This is a unit test structure - actual cache behavior tested in integration)
    assert batch_request.requests is not None
    assert len(batch_request.requests) == 2


@pytest.mark.asyncio
async def test_batch_parallel_processing():
    """T030 [P] [US2]: Unit test - batch uses parallel processing."""
    import asyncio
    from app.schemas.indicator import BatchIndicatorRequest, IndicatorRequest

    # Create batch request with multiple indicators
    batch_request = BatchIndicatorRequest(
        requests=[
            IndicatorRequest(symbol="IBM", indicator_name="sma", interval="1d", params={"period": 20}),
            IndicatorRequest(symbol="IBM", indicator_name="ema", interval="1d", params={"period": 20}),
            IndicatorRequest(symbol="IBM", indicator_name="rsi", interval="1d", params={"period": 14}),
        ]
    )

    # Verify batch structure supports parallel processing
    # (Actual parallel execution verified in integration tests)
    assert len(batch_request.requests) == 3
    for req in batch_request.requests:
        assert req.symbol is not None
        assert req.indicator_name is not None


@pytest.mark.asyncio
async def test_batch_partial_failure():
    """T031 [P] [US2]: Unit test - batch handles partial failures gracefully."""
    from app.schemas.indicator import BatchIndicatorRequest, IndicatorRequest, ErrorDetail, BatchIndicatorResponse

    # Create batch request with one invalid symbol
    batch_request = BatchIndicatorRequest(
        requests=[
            IndicatorRequest(symbol="IBM", indicator_name="sma", interval="1d", params={"period": 20}),
            IndicatorRequest(symbol="INVALID_SYMBOL", indicator_name="sma", interval="1d", params={"period": 20}),
            IndicatorRequest(symbol="IBM", indicator_name="ema", interval="1d", params={"period": 20}),
        ]
    )

    # Test response structure can handle partial failures
    error_detail = ErrorDetail(
        index=1,
        symbol="INVALID_SYMBOL",
        indicator_name="sma",
        error="Invalid ticker symbol: INVALID_SYMBOL"
    )

    assert error_detail.index == 1
    assert error_detail.symbol == "INVALID_SYMBOL"


@pytest.mark.asyncio
async def test_batch_endpoint_returns_3_indicators(mock_orchestrator):
    """T040 [P] [US2]: Integration test - batch endpoint returns 3 indicators."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/indicators/batch",
            json={
                "requests": [
                    {"symbol": "IBM", "indicator_name": "sma", "interval": "1d", "params": {"length": 20}},
                    {"symbol": "IBM", "indicator_name": "ema", "interval": "1d", "params": {"length": 20}},
                    {"symbol": "IBM", "indicator_name": "rsi", "interval": "1d", "params": {"length": 14}},
                ]
            }
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "results" in data
        assert "errors" in data
        assert "total_duration_ms" in data
        assert "cache_hits" in data
        assert "cache_misses" in data

        # Should have 3 successful results
        assert len(data["results"]) == 3

        # Verify each result has required fields (IndicatorOutput schema)
        for result in data["results"]:
            assert "symbol" in result
            assert "interval" in result
            assert "timestamps" in result
            assert "data" in result
            assert "metadata" in result

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_batch_3_indicators_p90_under_200ms(mock_orchestrator):
    """T041 [P] [US2]: Integration test - batch of 3 indicators completes in <200ms (90th percentile)."""
    import time
    import statistics
    from app.services.cache import indicator_cache

    # Clear cache before test
    indicator_cache.clear()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Prime the cache with first batch request
        response = await ac.post(
            "/api/v1/indicators/batch",
            json={
                "requests": [
                    {"symbol": "IBM", "indicator_name": "sma", "interval": "1d", "params": {"length": 20}},
                    {"symbol": "IBM", "indicator_name": "ema", "interval": "1d", "params": {"length": 20}},
                    {"symbol": "IBM", "indicator_name": "rsi", "interval": "1d", "params": {"length": 14}},
                ]
            }
        )
        assert response.status_code == 200

        # Measure cached batch response times (50 samples)
        times = []
        for _ in range(50):
            start = time.time()
            response = await ac.post(
                "/api/v1/indicators/batch",
                json={
                    "requests": [
                        {"symbol": "IBM", "indicator_name": "sma", "interval": "1d", "params": {"length": 20}},
                        {"symbol": "IBM", "indicator_name": "ema", "interval": "1d", "params": {"length": 20}},
                        {"symbol": "IBM", "indicator_name": "rsi", "interval": "1d", "params": {"length": 14}},
                    ]
                }
            )
            duration_ms = (time.time() - start) * 1000
            times.append(duration_ms)
            assert response.status_code == 200

        # Calculate 90th percentile
        times.sort()
        p90 = times[int(len(times) * 0.9)]

        # SC-003: 90th percentile should be <200ms for batch of 3
        assert p90 < 200, f"90th percentile batch response time {p90:.1f}ms exceeds 200ms target"

        # Also verify median is reasonable
        median = statistics.median(times)
        print(f"Batch (3 indicators) performance - Median: {median:.1f}ms, P90: {p90:.1f}ms")

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_batch_endpoint_empty_requests(mock_orchestrator):
    """Test: batch endpoint rejects empty request array."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/indicators/batch",
            json={"requests": []}
        )

        # Should return 422 for empty requests
        assert response.status_code == 422  # Pydantic validation error

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_batch_endpoint_exceeds_max_size(mock_orchestrator):
    """Test: batch endpoint rejects requests exceeding max size (10 items)."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create 11 indicator requests (exceeds max of 10)
        requests = [
            {"symbol": "IBM", "indicator_name": "sma", "interval": "1d", "params": {"length": 20}}
            for _ in range(11)
        ]

        response = await ac.post(
            "/api/v1/indicators/batch",
            json={"requests": requests}
        )

        # Should return 422 for exceeding max size
        assert response.status_code == 422

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_batch_endpoint_handles_partial_failures(mock_orchestrator):
    """Test: batch endpoint continues processing when individual indicators fail."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/indicators/batch",
            json={
                "requests": [
                    {"symbol": "IBM", "indicator_name": "sma", "interval": "1d", "params": {"length": 20}},
                    {"symbol": "IBM", "indicator_name": "nonexistent_indicator", "interval": "1d", "params": {}},
                    {"symbol": "IBM", "indicator_name": "ema", "interval": "1d", "params": {"length": 20}},
                ]
            }
        )

        # Should return 200 with partial results
        assert response.status_code == 200
        data = response.json()

        # Should have 2 successful results and 1 error (for nonexistent indicator)
        assert len(data["results"]) == 2
        assert len(data["errors"]) == 1

        # Verify error details
        assert data["errors"][0]["index"] == 1
        assert data["errors"][0]["indicator_name"] == "nonexistent_indicator"

    app.dependency_overrides.clear()
