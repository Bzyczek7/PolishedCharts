import pytest
import pandas as pd
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
from app.services.providers import YFinanceProvider

@pytest.mark.asyncio
async def test_yf_provider_chunking_logic():
    provider = YFinanceProvider()
    # Mock _fetch_chunk to return dummy data
    async def mock_fetch_chunk(symbol, interval, start, end):
        return [{"timestamp": start, "open": 1, "high": 2, "low": 0, "close": 1}]

    with patch.object(YFinanceProvider, '_fetch_chunk', side_effect=mock_fetch_chunk) as mock_chunk:
        # Use relative dates to stay within yfinance limits
        now = datetime.now(timezone.utc)
        
        # 1h chunk policy is 90 days
        start_1h = now - timedelta(days=10)
        await provider.fetch_candles("AAPL", "1h", start_1h, now)
        assert mock_chunk.call_count == 1

        mock_chunk.reset_mock()
        # 1m chunk policy is 7 days. Request 20 days.
        # Yahoo limit for 1m is 30 days total, so 20 days is fine if it's recent.
        start_1m = now - timedelta(days=20)
        await provider.fetch_candles("AAPL", "1m", start_1m, now)
        # 20 days / 7 days per chunk = 3 chunks
        assert mock_chunk.call_count >= 3

@pytest.mark.asyncio
async def test_yf_provider_window_shrinking():
    provider = YFinanceProvider()
    
    # First call fails, second call (with smaller window) succeeds
    call_count = 0
    async def mock_fetch_chunk(symbol, interval, start, end):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise Exception("Yahoo error: data too large")
        return [{"timestamp": start, "open": 1, "high": 2, "low": 0, "close": 1}]

    with patch.object(YFinanceProvider, '_fetch_chunk', side_effect=mock_fetch_chunk):
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=2)
        
        # This will trigger retry with smaller windows
        candles = await provider.fetch_candles("AAPL", "1h", start, now)
        assert len(candles) > 0
        assert call_count > 1