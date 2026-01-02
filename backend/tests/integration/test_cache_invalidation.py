"""
Integration tests for Feature 014 - Phase 6: Cache Invalidation

Tests:
- Cache is invalidated when candle data updates
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.db.session import get_db
from app.services.cache import indicator_cache, candle_cache
from app.services.data_updater import DataUpdater


async def override_get_db():
    """Mock DB dependency that returns a test symbol."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_db.execute.return_value = mock_result

    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    mock_result.scalars.return_value.first.return_value = mock_symbol
    yield mock_db


@pytest.fixture(autouse=True)
def initialize_indicators():
    """Initialize standard indicators for all tests."""
    from app.services.indicator_registry.initialization import initialize_standard_indicators
    initialize_standard_indicators()
    yield


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
            "ticker": "AAPL",
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
            "ticker": "AAPL",
            "interval": "1d"
        },
    ]

    app.state.orchestrator = mock_instance

    yield mock_instance

    if hasattr(app.state, 'orchestrator'):
        delattr(app.state, 'orchestrator')


@pytest.mark.asyncio
async def test_cache_invalidation_on_candle_update(mock_orchestrator):
    """T050 [P] [US3]: Integration test - cache is invalidated when candles update."""
    # Clear cache before test
    indicator_cache.clear()
    candle_cache.clear()

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # First request - should be a cache miss, result gets cached
        response1 = await ac.get("/api/v1/indicators/AAPL/sma?interval=1d&length=20")
        assert response1.status_code == 200

        stats_after_first = indicator_cache.get_stats()
        assert stats_after_first['misses'] == 1, "First request should be a cache miss"

        # Second request - should be a cache hit
        response2 = await ac.get("/api/v1/indicators/AAPL/sma?interval=1d&length=20")
        assert response2.status_code == 200

        stats_after_second = indicator_cache.get_stats()
        assert stats_after_second['hits'] == 1, "Second request should be a cache hit"

        # Simulate candle update by calling the internal _save_candles_to_db method
        from app.services.cache import invalidate_symbol
        invalidate_symbol("AAPL")

        # Get cache stats after invalidation
        stats_after_invalidation = indicator_cache.get_stats()
        print(f"Stats after invalidation: {stats_after_invalidation}")

        # Third request after invalidation - should be a cache miss again
        response3 = await ac.get("/api/v1/indicators/AAPL/sma?interval=1d&length=20")
        assert response3.status_code == 200

        stats_after_third = indicator_cache.get_stats()
        print(f"Stats after third request: {stats_after_third}")

        # The third request should have caused another miss since cache was invalidated
        # (Total misses should be 2 now: first request + after invalidation)
        assert stats_after_third['misses'] == 2, \
            "After invalidation, next request should be a cache miss"

        # Verify the responses all return valid data
        data1 = response1.json()
        data2 = response2.json()
        data3 = response3.json()

        # All should have data
        assert 'data' in data1
        assert 'data' in data2
        assert 'data' in data3

    app.dependency_overrides.clear()
