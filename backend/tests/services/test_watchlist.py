"""
Tests for WatchlistService (User Story 1)

TDD approach: Tests written before implementation.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone


# T015 [P] [US1] Unit test for WatchlistService.add_to_watchlist()
@pytest.mark.asyncio
async def test_add_to_watchlist_success():
    """Test successful add to watchlist with backfill."""
    from app.services.watchlist import WatchlistService

    mock_session = AsyncMock(spec=AsyncSession)

    # Mock symbol lookup
    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    # Mock backfill to return 100 candles
    with patch("app.services.watchlist.get_or_create_symbol") as mock_get_symbol:
        mock_get_symbol.return_value = mock_symbol

        with patch("app.services.watchlist.BackfillService") as mock_backfill_class:
            mock_backfill = AsyncMock()
            mock_backfill.backfill_historical.return_value = 100
            mock_backfill_class.return_value = mock_backfill

            service = WatchlistService(mock_session)
            result = await service.add_to_watchlist("AAPL")

            assert result['status'] == 'added'
            assert result['symbol'] == 'AAPL'
            assert result['candles_backfilled'] == 100
            mock_backfill.backfill_historical.assert_called_once()


@pytest.mark.asyncio
async def test_add_to_watchlist_already_present():
    """Test adding duplicate ticker returns 'already_present' status."""
    from app.services.watchlist import WatchlistService

    mock_session = AsyncMock(spec=AsyncSession)

    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    with patch("app.services.watchlist.get_or_create_symbol") as mock_get_symbol:
        mock_get_symbol.return_value = mock_symbol

        with patch("app.services.watchlist.BackfillService") as mock_backfill_class:
            mock_backfill = AsyncMock()
            mock_backfill_class.return_value = mock_backfill

            # Simulate duplicate entry (database integrity error)
            from sqlalchemy import IntegrityError
            mock_session.add.side_effect = IntegrityError("duplicate", {}, None)

            with patch("app.services.watchlist.select") as mock_select:
                mock_result = AsyncMock()
                mock_result.scalars.return_value.first.return_value = mock_symbol
                mock_session.execute.return_value = mock_result

                service = WatchlistService(mock_session)
                result = await service.add_to_watchlist("AAPL")

                # Should handle duplicate gracefully
                assert result['status'] == 'already_present'
                assert result['symbol'] == 'AAPL'


@pytest.mark.asyncio
async def test_add_to_watchlist_invalid_ticker():
    """Test adding invalid ticker raises appropriate error."""
    from app.services.watchlist import WatchlistService

    mock_session = AsyncMock(spec=AsyncSession)

    # Mock get_or_create_symbol to return None (not found)
    with patch("app.services.watchlist.get_or_create_symbol") as mock_get_symbol:
        mock_get_symbol.return_value = None

        service = WatchlistService(mock_session)

        with pytest.raises(ValueError, match="Invalid ticker"):
            await service.add_to_watchlist("INVALIDTICKER")


@pytest.mark.asyncio
async def test_add_to_watchlist_backfill_failure():
    """Test that backfill failure rolls back watchlist entry."""
    from app.services.watchlist import WatchlistService

    mock_session = AsyncMock(spec=AsyncSession)

    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    with patch("app.services.watchlist.get_or_create_symbol") as mock_get_symbol:
        mock_get_symbol.return_value = mock_symbol

        with patch("app.services.watchlist.BackfillService") as mock_backfill_class:
            mock_backfill = AsyncMock()
            # Backfill fails
            mock_backfill.backfill_historical.side_effect = ValueError("No data available")
            mock_backfill_class.return_value = mock_backfill

            service = WatchlistService(mock_session)

            with pytest.raises(ValueError, match="No data available"):
                await service.add_to_watchlist("AAPL")

            # Verify rollback was called
            assert mock_session.rollback.called


@pytest.mark.asyncio
async def test_add_to_watchlist_timeout():
    """Test that backfill timeout rolls back watchlist entry."""
    from app.services.watchlist import WatchlistService
    import asyncio

    mock_session = AsyncMock(spec=AsyncSession)

    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    with patch("app.services.watchlist.get_or_create_symbol") as mock_get_symbol:
        mock_get_symbol.return_value = mock_symbol

        with patch("app.services.watchlist.BackfillService") as mock_backfill_class:
            async def slow_backfill(*args, **kwargs):
                await asyncio.sleep(61)
                return 0

            mock_backfill = AsyncMock()
            mock_backfill.backfill_historical.side_effect = slow_backfill
            mock_backfill_class.return_value = mock_backfill

            service = WatchlistService(mock_session)

            with pytest.raises((asyncio.TimeoutError, ValueError)):
                await service.add_to_watchlist("AAPL")

            # Verify rollback was called
            assert mock_session.rollback.called


# T016 [P] [US1] Unit test for WatchlistService.remove_from_watchlist()
@pytest.mark.asyncio
async def test_remove_from_watchlist_success():
    """Test successful remove from watchlist."""
    from app.services.watchlist import WatchlistService

    mock_session = AsyncMock(spec=AsyncSession)

    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    with patch("app.services.watchlist.get_symbol_by_ticker") as mock_get_symbol:
        mock_get_symbol.return_value = mock_symbol

        with patch("app.services.watchlist.select") as mock_select:
            # Mock watchlist entry exists
            mock_entry = MagicMock()
            mock_entry.id = 1

            mock_result = AsyncMock()
            mock_result.scalars.return_value.first.return_value = mock_entry
            mock_session.execute.return_value = mock_result

            service = WatchlistService(mock_session)
            await service.remove_from_watchlist("AAPL")

            # Verify delete was called
            assert mock_session.delete.called
            assert mock_session.commit.called


@pytest.mark.asyncio
async def test_remove_from_watchlist_not_found():
    """Test removing ticker that is not in watchlist."""
    from app.services.watchlist import WatchlistService

    mock_session = AsyncMock(spec=AsyncSession)

    mock_symbol = MagicMock()
    mock_symbol.id = 1
    mock_symbol.ticker = "AAPL"

    with patch("app.services.watchlist.get_symbol_by_ticker") as mock_get_symbol:
        mock_get_symbol.return_value = mock_symbol

        with patch("app.services.watchlist.select") as mock_select:
            # Mock watchlist entry does not exist
            mock_result = AsyncMock()
            mock_result.scalars.return_value.first.return_value = None
            mock_session.execute.return_value = mock_result

            service = WatchlistService(mock_session)

            with pytest.raises(ValueError, match="not found in watchlist"):
                await service.remove_from_watchlist("AAPL")


@pytest.mark.asyncio
async def test_remove_from_watchlist_invalid_ticker():
    """Test removing invalid ticker raises appropriate error."""
    from app.services.watchlist import WatchlistService

    mock_session = AsyncMock(spec=AsyncSession)

    with patch("app.services.watchlist.get_symbol_by_ticker") as mock_get_symbol:
        mock_get_symbol.return_value = None  # Symbol not found

        service = WatchlistService(mock_session)

        with pytest.raises(ValueError, match="Invalid ticker"):
            await service.remove_from_watchlist("INVALID")


# T017 [P] [US1] Unit test for WatchlistService.list_watchlist()
@pytest.mark.asyncio
async def test_list_watchlist():
    """Test listing all watchlist entries."""
    from app.services.watchlist import WatchlistService

    mock_session = AsyncMock(spec=AsyncSession)

    # Mock watchlist entries
    mock_entry1 = MagicMock()
    mock_entry1.id = 1
    mock_entry1.symbol.ticker = "AAPL"
    mock_entry1.added_at = datetime(2023, 1, 1, tzinfo=timezone.utc)

    mock_entry2 = MagicMock()
    mock_entry2.id = 2
    mock_entry2.symbol.ticker = "MSFT"
    mock_entry2.added_at = datetime(2023, 1, 2, tzinfo=timezone.utc)

    with patch("app.services.watchlist.select") as mock_select:
        with patch("app.services.watchlist.joinedload") as mock_joinedload:
            mock_result = AsyncMock()
            mock_result.scalars.return_value.all.return_value = [mock_entry1, mock_entry2]
            mock_session.execute.return_value = mock_result

            service = WatchlistService(mock_session)
            result = await service.list_watchlist()

            assert len(result) == 2
            assert result[0]['symbol'] == 'AAPL'
            assert result[1]['symbol'] == 'MSFT'


@pytest.mark.asyncio
async def test_list_watchlist_empty():
    """Test listing empty watchlist returns empty list."""
    from app.services.watchlist import WatchlistService

    mock_session = AsyncMock(spec=AsyncSession)

    with patch("app.services.watchlist.select") as mock_select:
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        service = WatchlistService(mock_session)
        result = await service.list_watchlist()

        assert result == []
