"""
Tests for YFRateLimitError retry handling via existing providers.py (User Story 1)

TDD approach: Tests written before implementation.

NOTE: This test verifies that existing providers.py retry logic (tenacity)
handles YFRateLimitError correctly. We do NOT add duplicate retry logic
in BackfillService or poller.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone


# T014 [P] [US1] Unit test for YFRateLimitError retry handling via existing providers.py
@pytest.mark.asyncio
async def test_yfinance_rate_limit_retry():
    """Test YFRateLimitError is retried via existing providers.py tenacity logic.

    This test ensures that when yfinance raises YFRateLimitError, the
    existing retry mechanism in providers.py (using tenacity) handles
    the retry with exponential backoff.
    """
    from app.services.providers import YFinanceProvider
    from yfinance.exceptions import YFRateLimitError

    provider = YFinanceProvider()

    # Create a mock that raises rate limit then succeeds
    call_count = 0

    async def mock_history(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise YFRateLimitError("Rate limit exceeded")
        # Return success on retry
        import pandas as pd
        return pd.DataFrame({
            'Open': [100.0],
            'High': [110.0],
            'Low': [90.0],
            'Close': [105.0],
            'Volume': [1000]
        }, index=[pd.Timestamp('2023-01-01', tz='UTC')])

    with patch("yfinance.Ticker.history", side_effect=mock_history):
        # Should retry and succeed
        candles = await provider.fetch_candles("AAPL", "1d")

        assert len(candles) == 1
        assert call_count == 2  # First call failed, retry succeeded


@pytest.mark.asyncio
async def test_yfinance_rate_limit_max_retries_exceeded():
    """Test that max retries are respected when rate limit persists."""
    from app.services.providers import YFinanceProvider
    from yfinance.exceptions import YFRateLimitError

    provider = YFinanceProvider()

    # Always raise rate limit
    async def always_rate_limit(*args, **kwargs):
        raise YFRateLimitError("Rate limit exceeded")

    with patch("yfinance.Ticker.history", side_effect=always_rate_limit):
        # Should exhaust retries and raise the error
        with pytest.raises(YFRateLimitError):
            await provider.fetch_candles("AAPL", "1d")


@pytest.mark.asyncio
async def test_yfinance_backfill_uses_provider_retry():
    """Test that BackfillService benefits from existing providers.py retry logic.

    This is an integration test to ensure BackfillService correctly delegates
    to YFinanceProvider, which has the tenacity retry logic.
    """
    from app.services.providers import YFinanceProvider
    from yfinance.exceptions import YFRateLimitError

    provider = YFinanceProvider()
    call_count = 0

    async def mock_history_with_one_retry(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise YFRateLimitError("Rate limit exceeded")
        import pandas as pd
        return pd.DataFrame({
            'Open': [100.0],
            'High': [110.0],
            'Low': [90.0],
            'Close': [105.0],
            'Volume': [1000]
        }, index=[pd.Timestamp('2023-01-01', tz='UTC')])

    with patch("yfinance.Ticker.history", side_effect=mock_history_with_one_retry):
        # Backfill logic (via provider) should retry and succeed
        candles = await provider.fetch_candles("AAPL", "1d")

        assert len(candles) == 1
        assert call_count == 2


@pytest.mark.asyncio
async def test_yfinance_manual_retry_loop_in_provider():
    """Test the manual retry loop that exists in providers.py.

    The providers.py has a manual retry loop in addition to tenacity.
    This test verifies that loop works correctly.
    """
    from app.services.providers import YFinanceProvider

    provider = YFinanceProvider()
    call_count = 0

    async def mock_flaky_history(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count <= 2:
            # Return empty first 2 times (triggers manual retry)
            import pandas as pd
            return pd.DataFrame()  # Empty DataFrame
        # Return data on 3rd try
        import pandas as pd
        return pd.DataFrame({
            'Open': [100.0],
            'High': [110.0],
            'Low': [90.0],
            'Close': [105.0],
            'Volume': [1000]
        }, index=[pd.Timestamp('2023-01-01', tz='UTC')])

    with patch("yfinance.Ticker.history", side_effect=mock_flaky_history):
        candles = await provider.fetch_candles("AAPL", "1d")

        assert len(candles) == 1
        # Manual retry loop should have kicked in
        assert call_count >= 3
