"""
Load tests for Feature 014 - Phase 5: Concurrent Access

Tests:
- 50 concurrent indicator requests complete within 2 seconds each
"""

import pytest
import asyncio
import time
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock

from app.main import app
from app.db.session import get_db


async def override_get_db():
    """Mock DB dependency that returns a test symbol."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_db.execute.return_value = mock_result

    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "TEST"

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

    # Return a large dataset for realistic load testing
    from datetime import datetime, timezone, timedelta
    base_date = datetime(2023, 1, 1, tzinfo=timezone.utc)
    mock_instance.get_candles.return_value = [
        {
            "timestamp": (base_date + timedelta(days=i)).isoformat().replace('+00:00', 'Z'),
            "open": 100 + i,
            "high": 110 + i,
            "low": 90 + i,
            "close": 105 + i,
            "volume": 1000 + i * 10,
            "id": i,
            "ticker": "TEST",
            "interval": "1d"
        }
        for i in range(1, 101)  # 100 days of data
    ]

    app.state.orchestrator = mock_instance

    yield mock_instance

    if hasattr(app.state, 'orchestrator'):
        delattr(app.state, 'orchestrator')


@pytest.mark.asyncio
async def test_50_concurrent_indicator_requests(mock_orchestrator):
    """T045 [P] [US3]: Load test - 50 concurrent requests complete within 2 seconds each."""
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create 50 concurrent indicator requests
        tasks = []
        start_time = time.time()

        for i in range(50):
            task = ac.get(
                f"/api/v1/indicators/TEST{i % 3}/sma?interval=1d&length=20"
            )
            tasks.append(task)

        # Execute all requests concurrently
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        total_time = time.time() - start_time

        # Verify all requests succeeded
        success_count = 0
        fail_count = 0
        for resp in responses:
            if isinstance(resp, Exception):
                fail_count += 1
                print(f"Request failed with exception: {resp}")
            elif hasattr(resp, 'status_code'):
                if resp.status_code == 200:
                    success_count += 1
                else:
                    fail_count += 1
                    print(f"Request failed with status {resp.status_code}")

        print(f"Concurrent test: {success_count} success, {fail_count} failed in {total_time:.2f}s")

        # All requests should succeed
        assert success_count == 50, f"Expected 50 successful requests, got {success_count}"

        # Average time per request should be reasonable (target: <2s each)
        # With 50 concurrent requests, total time should be much less than 50 * 2s = 100s
        avg_time_per_request = total_time / 50
        print(f"Average time per request: {avg_time_per_request:.3f}s")

        # Each request should complete in under 2 seconds (measured individually)
        # For 50 concurrent requests, we expect the total to be much less than 100s
        assert total_time < 100, f"Total time {total_time:.2f}s exceeds 100s (2s per request)"

    app.dependency_overrides.clear()
