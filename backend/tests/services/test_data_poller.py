import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.data_poller import DataPoller
from app.services.providers import YFinanceProvider
from datetime import datetime, timezone

@pytest.mark.asyncio
async def test_poller_loop_runs():
    mock_provider = AsyncMock()
    # Mock market hours to return False (no skip) so polling happens
    mock_market_hours = MagicMock()
    mock_market_hours.should_skip_equity_polling.return_value = (False, "")

    poller = DataPoller(
        yf_provider=mock_provider,
        symbols=["IBM"],
        interval=0.1,
        market_hours_service=mock_market_hours
    )

    # Run the poller for a short time
    task = asyncio.create_task(poller.start())
    await asyncio.sleep(0.15)
    poller.stop()
    await task

    # Check if fetch_candles was called
    assert mock_provider.fetch_candles.called
    assert mock_provider.fetch_candles.call_count >= 1

@pytest.mark.asyncio
async def test_save_candles_to_db_logic():
    # Setup mocks
    mock_provider = AsyncMock()
    mock_session = AsyncMock()

    # Mock result for Symbol query (return None so it creates a new one)
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = None

    # Mock result for Candle query (return None for latest candle)
    mock_result_candle = MagicMock()
    mock_result_candle.scalars.return_value.first.return_value = None

    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candle]

    # Context manager mock for session
    mock_session_factory = MagicMock()
    mock_session_factory.return_value.__aenter__.return_value = mock_session
    mock_session_factory.return_value.__aexit__.return_value = AsyncMock()

    poller = DataPoller(
        yf_provider=mock_provider,
        symbols=["IBM"],
        db_session_factory=mock_session_factory
    )

    # Use timestamp format from YFinanceProvider instead of date string
    candles_data = [
        {"timestamp": datetime(2023, 10, 27, tzinfo=timezone.utc), "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000}
    ]

    await poller._save_candles_to_db("IBM", candles_data)

    # Verify Symbol creation
    assert mock_session.add.call_count >= 2 # Symbol + Candle
    assert mock_session.commit.call_count == 2

@pytest.mark.asyncio
async def test_poller_triggers_alert_engine():
    mock_provider = AsyncMock()

    # Provide multiple candles to ensure len(candles) > 1 so indicators are calculated
    mock_provider.fetch_candles.return_value = [
        {"timestamp": datetime(2023, 10, 26, tzinfo=timezone.utc), "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000},
        {"timestamp": datetime(2023, 10, 27, tzinfo=timezone.utc), "open": 105, "high": 115, "low": 95, "close": 155, "volume": 1000}
    ]

    mock_engine = AsyncMock()

    # Mock market hours to not skip
    mock_market_hours = MagicMock()
    mock_market_hours.should_skip_equity_polling.return_value = (False, "")

    # We need a db_session_factory so that _save_candles_to_db is called
    mock_factory = MagicMock()

    poller = DataPoller(
        yf_provider=mock_provider,
        symbols=["IBM"],
        interval=0.1,
        rate_limit_sleep=0.05,  # Lower rate limit for testing
        db_session_factory=mock_factory,
        alert_engine=mock_engine,
        market_hours_service=mock_market_hours
    )

    # Mock both _save_candles_to_db and load_watchlist_from_db
    with patch.object(poller, '_save_candles_to_db', new_callable=AsyncMock) as mock_save, \
         patch.object(poller, 'load_watchlist_from_db', new_callable=AsyncMock) as mock_load_watchlist:
        mock_save.return_value = 1
        # Don't let load_watchlist_from_db modify self.symbols during test
        # We want to keep the original ["IBM"] symbols for this test
        async def mock_load_watchlist_func():
            pass  # Do nothing, keep existing symbols
        mock_load_watchlist.side_effect = mock_load_watchlist_func

        # Run the poller for a short time
        task = asyncio.create_task(poller.start())
        await asyncio.sleep(0.5)  # Increase sleep time to ensure polling completes
        poller.stop()
        await task

        assert mock_engine.evaluate_symbol_alerts.called
        # The call now includes indicator_data
        args, kwargs = mock_engine.evaluate_symbol_alerts.call_args
        assert args[0] == 1
        assert args[1] == 155.0
        assert "indicator_data" in kwargs

@pytest.mark.asyncio
async def test_poller_calculates_indicators():
    mock_provider = AsyncMock()
    # Provide enough data for cRSI (need at least 2 rows for cross, and more for smoothing)
    # Use valid dates in a single month to avoid day-out-of-range errors
    mock_provider.fetch_candles.return_value = [
        {"timestamp": datetime(2023, 10, min(28, i), tzinfo=timezone.utc), "open": 100+i, "high": 110+i, "low": 90+i, "close": 105+i, "volume": 1000}
        for i in range(1, 20)  # Using days 1-19 in October to avoid issues
    ]

    mock_engine = AsyncMock()

    # Mock market hours to not skip
    mock_market_hours = MagicMock()
    mock_market_hours.should_skip_equity_polling.return_value = (False, "")

    # We need a db_session_factory so that _save_candles_to_db is called
    mock_factory = MagicMock()

    poller = DataPoller(
        yf_provider=mock_provider,
        symbols=["IBM"],
        interval=0.1,
        rate_limit_sleep=0.05,  # Lower rate limit for testing
        db_session_factory=mock_factory,
        alert_engine=mock_engine,
        market_hours_service=mock_market_hours
    )

    with patch.object(poller, '_save_candles_to_db', new_callable=AsyncMock) as mock_save, \
         patch.object(poller, 'load_watchlist_from_db', new_callable=AsyncMock):
        mock_save.return_value = 1

        task = asyncio.create_task(poller.start())
        await asyncio.sleep(0.5)  # Increase sleep time to ensure polling completes
        poller.stop()
        await task

        # Check if evaluate_symbol_alerts was called with indicator_data
        args, kwargs = mock_engine.evaluate_symbol_alerts.call_args
        assert "indicator_data" in kwargs
        assert "crsi" in kwargs["indicator_data"]
        assert "crsi_upper" in kwargs["indicator_data"]
        assert "crsi_lower" in kwargs["indicator_data"]
        assert "prev_crsi" in kwargs["indicator_data"]


@pytest.mark.asyncio
async def test_poller_loads_watchlist_from_database():
    """Test that poller loads symbols from database watchlist."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.services.data_poller import DataPoller

    # Create mock session factory
    mock_session = MagicMock()

    # Mock execute to return ticker list
    async def mock_execute(query):
        result = MagicMock()
        result.scalars.return_value.all.return_value = ["AAPL", "MSFT"]
        return result

    mock_session.execute = mock_execute

    # Mock the session factory to return our mock session
    class MockSessionFactory:
        async def __aenter__(self):
            return mock_session

        async def __aexit__(self, *args):
            pass

        def __call__(self):
            # Return self as an async context manager
            return self

    mock_session_factory = MockSessionFactory()

    # Create poller with mock provider
    mock_provider = AsyncMock()
    poller = DataPoller(
        yf_provider=mock_provider,
        symbols=[],  # Empty initially
        interval=0.1,
        db_session_factory=mock_session_factory
    )

    # Load watchlist from database
    await poller.load_watchlist_from_db()

    # Verify that symbols were loaded
    assert len(poller.symbols) == 2
    assert "AAPL" in poller.symbols
    assert "MSFT" in poller.symbols


@pytest.mark.asyncio
async def test_poller_market_hours_gating_on_weekend():
    """Test that poller skips equity polling on weekend with logged reason."""
    from unittest.mock import patch, MagicMock
    from app.services.market_hours import MarketHoursService

    # Saturday during daytime (should be skipped)
    saturday_dt = datetime(2024, 12, 21, 14, 0, 0, tzinfo=timezone.utc)

    mock_market_hours = MagicMock(spec=MarketHoursService)
    mock_market_hours.should_skip_equity_polling.return_value = (True, "weekend_or_holiday")

    mock_provider = AsyncMock()
    mock_factory = MagicMock()

    poller = DataPoller(
        yf_provider=mock_provider,
        symbols=["AAPL"],
        interval=0.1,
        db_session_factory=mock_factory,
        market_hours_service=mock_market_hours
    )

    # Patch datetime.now to return Saturday
    with patch('app.services.data_poller.datetime') as mock_datetime:
        mock_datetime.now.return_value = saturday_dt
        mock_datetime.timezone = timezone

        # Run one polling iteration
        task = asyncio.create_task(poller.start())
        await asyncio.sleep(0.15)
        poller.stop()
        await task

    # Verify that market-hours check was called
    assert mock_market_hours.should_skip_equity_polling.called

    # Verify that provider was NOT called (skipped due to weekend)
    assert not mock_provider.fetch_candles.called


@pytest.mark.asyncio
async def test_poller_market_hours_gating_outside_hours():
    """Test that poller skips equity polling outside market hours."""
    from unittest.mock import patch, MagicMock
    from app.services.market_hours import MarketHoursService

    # 6:00 AM ET (before market open)
    early_morning_dt = datetime(2024, 12, 17, 11, 0, 0, tzinfo=timezone.utc)

    mock_market_hours = MagicMock(spec=MarketHoursService)
    mock_market_hours.should_skip_equity_polling.return_value = (True, "outside_market_hours")

    mock_provider = AsyncMock()
    mock_factory = MagicMock()

    poller = DataPoller(
        yf_provider=mock_provider,
        symbols=["AAPL"],
        interval=0.1,
        db_session_factory=mock_factory,
        market_hours_service=mock_market_hours
    )

    with patch('app.services.data_poller.datetime') as mock_datetime:
        mock_datetime.now.return_value = early_morning_dt
        mock_datetime.timezone = timezone

        task = asyncio.create_task(poller.start())
        await asyncio.sleep(0.15)
        poller.stop()
        await task

    # Verify that provider was NOT called (skipped due to outside hours)
    assert not mock_provider.fetch_candles.called


@pytest.mark.asyncio
async def test_poller_polls_during_market_hours():
    """Test that poller DOES fetch data during market hours."""
    from unittest.mock import patch, MagicMock
    from app.services.market_hours import MarketHoursService

    # 10:30 AM ET (during market hours)
    market_hours_dt = datetime(2024, 12, 17, 15, 30, 0, tzinfo=timezone.utc)

    mock_market_hours = MagicMock(spec=MarketHoursService)
    mock_market_hours.should_skip_equity_polling.return_value = (False, "")

    mock_provider = AsyncMock()
    mock_provider.fetch_candles.return_value = [
        {"timestamp": datetime(2024, 12, 17, 15, 30, 0, tzinfo=timezone.utc),
         "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000}
    ]

    mock_factory = MagicMock()

    poller = DataPoller(
        yf_provider=mock_provider,
        symbols=["AAPL"],
        interval=0.1,
        db_session_factory=mock_factory,
        market_hours_service=mock_market_hours
    )

    with patch('app.services.data_poller.datetime') as mock_datetime:
        mock_datetime.now.return_value = market_hours_dt
        mock_datetime.timezone = timezone

        task = asyncio.create_task(poller.start())
        await asyncio.sleep(0.15)
        poller.stop()
        await task

    # Verify that provider WAS called (during market hours)
    assert mock_provider.fetch_candles.called


