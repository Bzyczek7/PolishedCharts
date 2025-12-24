import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch
from app.main import app
from app.db.session import get_db
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_get_candles_local_only():
    """Test local_only flag returns only cached data."""
    # Mock the DataOrchestrator to return sample candles
    mock_candles = [
        {
            "timestamp": datetime(2025, 1, 1, tzinfo=timezone.utc),
            "open": 100.0,
            "high": 110.0,
            "low": 90.0,
            "close": 105.0,
            "volume": 1000,
            "interval": "1h",
            "ticker": "AAPL"
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
        mock_symbol.ticker = "AAPL"
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_symbol
        mock_session.execute.return_value = mock_result

        async def override_get_db():
            yield mock_session

        app.dependency_overrides[get_db] = override_get_db

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/v1/candles/AAPL?interval=1h&from=2025-01-01T00:00:00Z&local_only=true")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert "id" not in data[0]
            assert data[0]["close"] == 105.0
        finally:
            app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_trigger_backfill(async_client: AsyncClient, db_session):
    """Test triggering backfill via API."""
    # Override dependency to use test db_session
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    try:
        response = await async_client.post("/api/v1/candles/backfill", json={
            "symbol": "AAPL",
            "interval": "1h",
            "start_date": "2025-01-01",
            "end_date": "2025-01-02"
        })

        # Should accept the request and return job info
        assert response.status_code in [200, 202]
        data = response.json()
        assert "job_id" in data or "status" in data
    finally:
        app.dependency_overrides = {}
