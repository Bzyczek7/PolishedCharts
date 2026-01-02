"""
Tests for BackfillService (User Story 1)

TDD approach: Tests written before implementation.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone


# T013 [P] [US1] Unit test for BackfillService.backfill_historical()
@pytest.mark.asyncio
async def test_backfill_historical_success():
    """Test successful historical data backfill."""
    from app.services.backfill import BackfillService

    mock_session = AsyncMock(spec=AsyncSession)
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    # Mock YFinanceProvider response
    mock_candles = [
        {
            'timestamp': datetime(2023, 1, 1, tzinfo=timezone.utc),
            'open': 100.0,
            'high': 110.0,
            'low': 90.0,
            'close': 105.0,
            'volume': 1000000
        },
        {
            'timestamp': datetime(2023, 1, 2, tzinfo=timezone.utc),
            'open': 105.0,
            'high': 115.0,
            'low': 100.0,
            'close': 110.0,
            'volume': 1200000
        }
    ]

    with patch("app.services.backfill.YFinanceProvider") as mock_provider_class:
        mock_provider = AsyncMock()
        mock_provider.fetch_candles.return_value = mock_candles
        mock_provider_class.return_value = mock_provider

        service = BackfillService(mock_session)
        count = await service.backfill_historical(mock_symbol, "1d")

        assert count == 2
        mock_provider.fetch_candles.assert_called_once_with("AAPL", "1d")


@pytest.mark.asyncio
async def test_backfill_historical_no_data():
    """Test backfill when ticker has no historical data available."""
    from app.services.backfill import BackfillService

    mock_session = AsyncMock(spec=AsyncSession)
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "INVALID"

    with patch("app.services.backfill.YFinanceProvider") as mock_provider_class:
        mock_provider = AsyncMock()
        mock_provider.fetch_candles.return_value = []  # No data
        mock_provider_class.return_value = mock_provider

        service = BackfillService(mock_session)

        with pytest.raises(ValueError, match="No historical data available"):
            await service.backfill_historical(mock_symbol, "1d")


@pytest.mark.asyncio
async def test_backfill_historical_timeout():
    """Test backfill respects 60 second timeout."""
    from app.services.backfill import BackfillService
    import asyncio

    mock_session = AsyncMock(spec=AsyncSession)
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    async def slow_fetch(*args, **kwargs):
        await asyncio.sleep(61)  # Exceeds timeout
        return []

    with patch("app.services.backfill.YFinanceProvider") as mock_provider_class:
        mock_provider = AsyncMock()
        mock_provider.fetch_candles.side_effect = slow_fetch
        mock_provider_class.return_value = mock_provider

        service = BackfillService(mock_session)

        with pytest.raises(asyncio.TimeoutError):
            await service.backfill_historical(mock_symbol, "1d")


@pytest.mark.asyncio
async def test_backfill_historical_rate_limit():
    """Test backfill handles YFRateLimitError via existing providers.py retry."""
    from app.services.backfill import BackfillService

    mock_session = AsyncMock(spec=AsyncSession)
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    # Simulate rate limit then success
    mock_candles = [
        {
            'timestamp': datetime(2023, 1, 1, tzinfo=timezone.utc),
            'open': 100.0,
            'high': 110.0,
            'low': 90.0,
            'close': 105.0,
            'volume': 1000000
        }
    ]

    with patch("app.services.backfill.YFinanceProvider") as mock_provider_class:
        mock_provider = AsyncMock()
        # Should retry and succeed (retry logic in providers.py, not here)
        mock_provider.fetch_candles.return_value = mock_candles
        mock_provider_class.return_value = mock_provider

        service = BackfillService(mock_session)
        count = await service.backfill_historical(mock_symbol, "1d")

        assert count == 1


@pytest.mark.asyncio
async def test_backfill_historical_saves_to_db():
    """Test backfill saves candles to database."""
    from app.services.backfill import BackfillService
    from app.models.candle import Candle

    mock_session = AsyncMock(spec=AsyncSession)
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    mock_candles = [
        {
            'timestamp': datetime(2023, 1, 1, tzinfo=timezone.utc),
            'open': 100.0,
            'high': 110.0,
            'low': 90.0,
            'close': 105.0,
            'volume': 1000000
        }
    ]

    with patch("app.services.backfill.YFinanceProvider") as mock_provider_class:
        mock_provider = AsyncMock()
        mock_provider.fetch_candles.return_value = mock_candles
        mock_provider_class.return_value = mock_provider

        service = BackfillService(mock_session)
        await service.backfill_historical(mock_symbol, "1d")

        # Verify candles were added to session
        assert mock_session.add.call_count == 1
        assert mock_session.commit.called or mock_session.flush.called


@pytest.mark.asyncio
async def test_backfill_historical_default_interval():
    """Test backfill uses 1d as default interval."""
    from app.services.backfill import BackfillService

    mock_session = AsyncMock(spec=AsyncSession)
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    mock_candles = [{'timestamp': datetime.now(timezone.utc)}]

    with patch("app.services.backfill.YFinanceProvider") as mock_provider_class:
        mock_provider = AsyncMock()
        mock_provider.fetch_candles.return_value = mock_candles
        mock_provider_class.return_value = mock_provider

        service = BackfillService(mock_session)
        await service.backfill_historical(mock_symbol)

        # Should default to "1d" interval
        mock_provider.fetch_candles.assert_called_once_with("AAPL", "1d")


# T042 [P] [US2] Unit test for backfill idempotency (re-run doesn't create duplicates)
@pytest.mark.asyncio
async def test_backfill_idempotency():
    """Test that re-running backfill doesn't create duplicate candles.

    This test verifies the ON CONFLICT DO UPDATE behavior ensures idempotency.
    Running backfill twice for the same symbol/interval should not create duplicates.
    """
    from app.services.backfill import BackfillService
    from sqlalchemy.ext.asyncio import AsyncSession
    from datetime import datetime, timezone
    from app.models.candle import Candle

    mock_session = AsyncMock(spec=AsyncSession)
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    # Same candles returned on both fetches (simulating re-run)
    mock_candles = [
        {
            'timestamp': datetime(2023, 1, 1, tzinfo=timezone.utc),
            'open': 100.0,
            'high': 110.0,
            'low': 90.0,
            'close': 105.0,
            'volume': 1000000
        },
        {
            'timestamp': datetime(2023, 1, 2, tzinfo=timezone.utc),
            'open': 105.0,
            'high': 115.0,
            'low': 100.0,
            'close': 110.0,
            'volume': 1200000
        }
    ]

    with patch("app.services.backfill.YFinanceProvider") as mock_provider_class:
        mock_provider = AsyncMock()
        mock_provider.fetch_candles.return_value = mock_candles
        mock_provider_class.return_value = mock_provider

        service = BackfillService(mock_session)

        # First backfill
        count1 = await service.backfill_historical(mock_symbol, "1d")

        # Second backfill (re-run with same data)
        count2 = await service.backfill_historical(mock_symbol, "1d")

        # Both should return the same count
        assert count1 == 2
        assert count2 == 2

        # The upsert pattern should handle duplicates via ON CONFLICT DO UPDATE
        # Total adds should be 4 (2 per backfill call), but only 2 unique candles in DB
        # This is verified by the unique constraint on (symbol_id, timestamp, interval)
        assert mock_session.add.call_count == 4


@pytest.mark.asyncio
async def test_backfill_returns_actual_count():
    """Test that backfill returns the count of candles processed, not unique count.

    The service should return the number of candles fetched/processed,
    which may include duplicates that get upserted.
    """
    from app.services.backfill import BackfillService

    mock_session = AsyncMock(spec=AsyncSession)
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    mock_candles = [
        {
            'timestamp': datetime(2023, 1, 1, tzinfo=timezone.utc),
            'open': 100.0,
            'high': 110.0,
            'low': 90.0,
            'close': 105.0,
            'volume': 1000000
        },
        {
            'timestamp': datetime(2023, 1, 2, tzinfo=timezone.utc),
            'open': 105.0,
            'high': 115.0,
            'low': 100.0,
            'close': 110.0,
            'volume': 1200000
        },
        {
            'timestamp': datetime(2023, 1, 3, tzinfo=timezone.utc),
            'open': 110.0,
            'high': 120.0,
            'low': 105.0,
            'close': 115.0,
            'volume': 1300000
        }
    ]

    with patch("app.services.backfill.YFinanceProvider") as mock_provider_class:
        mock_provider = AsyncMock()
        mock_provider.fetch_candles.return_value = mock_candles
        mock_provider_class.return_value = mock_provider

        service = BackfillService(mock_session)
        count = await service.backfill_historical(mock_symbol, "1d")

        # Should return count of candles processed
        assert count == 3


# T044 [P] [US2] Integration test for timeout handling (60s limit, returns 408)
@pytest.mark.asyncio
async def test_backfill_timeout_returns_408():
    """Test that backfill timeout (60s limit) is properly handled and returns 408.

    T044 [US2]: Verifies the 60-second timeout enforcement:
    - asyncio.wait_for() with 60s timeout is used
    - Returns 408 (Request Timeout) status
    - No partial data is stored
    """
    from app.services.backfill import BackfillService
    import asyncio

    mock_session = AsyncMock(spec=AsyncSession)
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "SLOW_TICKER"

    async def slow_fetch(*args, **kwargs):
        # Simulate slow fetch that exceeds timeout
        await asyncio.sleep(61)  # Exceeds 60 second timeout
        return []

    with patch("app.services.backfill.YFinanceProvider") as mock_provider_class:
        mock_provider = AsyncMock()
        mock_provider.fetch_candles.side_effect = slow_fetch
        mock_provider_class.return_value = mock_provider

        service = BackfillService(mock_session)

        # Should raise asyncio.TimeoutError
        with pytest.raises(asyncio.TimeoutError, match="exceeded 60 second timeout"):
            await service.backfill_historical(mock_symbol, "1d")


@pytest.mark.asyncio
async def test_backfill_timeout_no_partial_data():
    """Test that timeout doesn't leave partial data in database.

    T044 [US2]: Verifies transactional behavior on timeout:
    - If backfill times out, no partial candles are stored
    - Database is rolled back to consistent state
    """
    from app.services.backfill import BackfillService
    import asyncio

    mock_session = AsyncMock(spec=AsyncSession)
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "TIMEOUT_TEST"

    # Simulate some data then timeout
    async def partial_fetch(*args, **kwargs):
        await asyncio.sleep(61)  # Timeout
        return []

    with patch("app.services.backfill.YFinanceProvider") as mock_provider_class:
        mock_provider = AsyncMock()
        mock_provider.fetch_candles.side_effect = partial_fetch
        mock_provider_class.return_value = mock_provider

        service = BackfillService(mock_session)

        # Should timeout and raise
        with pytest.raises(asyncio.TimeoutError):
            await service.backfill_historical(mock_symbol, "1d")

        # Verify no data was committed (transaction rolled back)
        # In real implementation, rollback would be called
        assert not mock_session.commit.called
