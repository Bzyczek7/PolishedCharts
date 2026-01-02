"""
Integration tests for Feature 014 - Phase 5: Cache Sharing

Tests:
- Multiple users requesting the same indicator share cached results
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.db.session import get_db
from app.services.cache import indicator_cache


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

    app.state.orchestrator = mock_instance

    yield mock_instance

    if hasattr(app.state, 'orchestrator'):
        delattr(app.state, 'orchestrator')


@pytest.mark.asyncio
async def test_concurrent_users_share_cached_results(mock_orchestrator):
    """T047 [P] [US3]: Integration test - multiple users share cached results."""
    # Clear cache before test
    indicator_cache.clear()

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # First user requests SMA for IBM
        response1 = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&length=20")
        assert response1.status_code == 200

        # Get cache stats after first request
        stats_after_first = indicator_cache.get_stats()
        print(f"After first request: hits={stats_after_first['hits']}, misses={stats_after_first['misses']}")

        # Second and third users request the same indicator (should hit cache)
        response2 = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&length=20")
        response3 = await ac.get("/api/v1/indicators/IBM/sma?interval=1d&length=20")

        assert response2.status_code == 200
        assert response3.status_code == 200

        # Get final cache stats
        final_stats = indicator_cache.get_stats()
        print(f"Final stats: hits={final_stats['hits']}, misses={final_stats['misses']}")

        # Verify cache was hit for subsequent requests
        # Expected: 1 miss (first request) + 2 hits (subsequent requests)
        assert final_stats['misses'] == 1, "Expected exactly 1 cache miss (first request)"
        assert final_stats['hits'] >= 2, "Expected at least 2 cache hits (subsequent requests)"

        # Verify the data is the same for all requests (cache hit returns same data)
        data1 = response1.json()
        data2 = response2.json()
        data3 = response3.json()

        # Compare timestamps and data arrays
        assert data1['timestamps'] == data2['timestamps'] == data3['timestamps'], \
            "Cached results should have identical timestamps"
        assert data1['data'] == data2['data'] == data3['data'], \
            "Cached results should have identical data values"

    app.dependency_overrides.clear()
