import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.providers import YFinanceProvider


# T016 [US1] UTC timestamp normalization test
@pytest.mark.asyncio
async def test_yfinance_utc_normalization():
    """Test that YFinanceProvider normalizes timestamps to UTC."""
    provider = YFinanceProvider()
    import pandas as pd

    # Create a mock DataFrame with naive timestamp
    ts = pd.Timestamp('2023-10-27 14:30:00')  # Naive timestamp
    df = pd.DataFrame({
        'Open': [100.0],
        'High': [110.0],
        'Low': [90.0],
        'Close': [105.0],
        'Volume': [1000]
    }, index=[ts])

    with patch("yfinance.Ticker.history", return_value=df):
        candles = await provider.fetch_candles("IBM", "1h")

        assert len(candles) == 1
        # Timestamp should be in UTC
        assert candles[0]["timestamp"].tzinfo == timezone.utc


@pytest.mark.asyncio
async def test_yfinance_utc_normalization_with_tz():
    """Test that YFinanceProvider converts non-UTC timestamps to UTC."""
    provider = YFinanceProvider()
    import pandas as pd

    # Create a mock DataFrame with non-UTC timestamp (EST)
    ts = pd.Timestamp('2023-10-27 14:30:00', tz='US/Eastern')
    df = pd.DataFrame({
        'Open': [100.0],
        'High': [110.0],
        'Low': [90.0],
        'Close': [105.0],
        'Volume': [1000]
    }, index=[ts])

    with patch("yfinance.Ticker.history", return_value=df):
        candles = await provider.fetch_candles("IBM", "1h")

        assert len(candles) == 1
        # Timestamp should be converted to UTC
        assert candles[0]["timestamp"].tzinfo == timezone.utc


@pytest.mark.asyncio
async def test_yfinance_provider_lookback_clamping():
    provider = YFinanceProvider()

    # 1m interval has a limit of 29 days
    interval = "1m"
    too_far_back = datetime.now(timezone.utc) - timedelta(days=100)

    # Mock yf.Ticker.history to avoid real network call
    with patch("yfinance.Ticker.history") as mock_history:
        mock_history.return_value = MagicMock(empty=True)

        await provider.fetch_candles("IBM", interval, start=too_far_back)

        # Check start date passed to history
        args, kwargs = mock_history.call_args
        passed_start = kwargs["start"]

        # Should be clamped to roughly 29 days ago
        earliest_possible = datetime.now(timezone.utc) - timedelta(days=29)
        assert passed_start >= earliest_possible - timedelta(seconds=5)

@pytest.mark.asyncio
async def test_yfinance_provider_lookback_clamping_1h():
    provider = YFinanceProvider()

    # 1h interval has a limit of 729 days
    interval = "1h"
    too_far_back = datetime.now(timezone.utc) - timedelta(days=1000)

    with patch("yfinance.Ticker.history") as mock_history:
        mock_history.return_value = MagicMock(empty=True)

        await provider.fetch_candles("IBM", interval, start=too_far_back)

        args, kwargs = mock_history.call_args
        passed_start = kwargs["start"]

        # Should be clamped to roughly 729 days ago
        earliest_possible = datetime.now(timezone.utc) - timedelta(days=729)
        assert passed_start >= earliest_possible - timedelta(seconds=5)

@pytest.mark.asyncio
async def test_yfinance_provider_multiindex_handling():
    provider = YFinanceProvider()

    # Simulate the MultiIndex yfinance sometimes returns for single tickers
    import pandas as pd
    import numpy as np

    ts = pd.Timestamp('2023-10-27', tz='UTC')
    # MultiIndex columns
    columns = pd.MultiIndex.from_tuples([
        ('Open', 'IBM'), ('High', 'IBM'), ('Low', 'IBM'), ('Close', 'IBM'), ('Volume', 'IBM')
    ])
    df = pd.DataFrame([[100.0, 110.0, 90.0, 105.0, 1000]], index=[ts], columns=columns)

    with patch("yfinance.Ticker.history", return_value=df):
        candles = await provider.fetch_candles("IBM", "1d")
        assert len(candles) == 1
        assert candles[0]["close"] == 105.0
        # Provider normalizes 1d to midnight
        expected_ts = ts.to_pydatetime().replace(hour=0, minute=0, second=0, microsecond=0)
        assert candles[0]["timestamp"] == expected_ts
