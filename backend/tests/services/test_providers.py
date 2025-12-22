import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.providers import YFinanceProvider, AlphaVantageProvider

@pytest.mark.asyncio
async def test_yfinance_provider_lookback_clamping():
    provider = YFinanceProvider()
    
    # 1m interval has a limit of 29 days
    interval = "1m"
    too_far_back = datetime.now() - timedelta(days=100)
    
    # Mock yf.download to avoid real network call
    with patch("yfinance.download") as mock_download:
        mock_df = MagicMock()
        mock_df.empty = True
        mock_download.return_value = mock_df
        
        await provider.fetch_candles("IBM", interval, start=too_far_back)
        
        # Check start date passed to download
        args, kwargs = mock_download.call_args
        passed_start = kwargs["start"]
        
        # Should be clamped to roughly 29 days ago
        earliest_possible = datetime.now() - timedelta(days=29)
        assert passed_start >= earliest_possible - timedelta(seconds=5)

@pytest.mark.asyncio
async def test_alphavantage_rate_limit_detection():
    provider = AlphaVantageProvider(api_key="demo")
    
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "Note": "Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day. Please visit https://www.alphavantage.co/premium/ if you would like to have a higher rate limit."
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        
        with pytest.raises(Exception) as excinfo:
            await provider.fetch_candles("IBM", "1d")
        
        assert "RATE_LIMIT_EXCEEDED" in str(excinfo.value)

@pytest.mark.asyncio
async def test_yfinance_provider_multiindex_handling():
    provider = YFinanceProvider()
    
    # Simulate the MultiIndex yfinance sometimes returns for single tickers
    import pandas as pd
    import numpy as np
    
    ts = pd.Timestamp('2023-10-27')
    # MultiIndex columns
    columns = pd.MultiIndex.from_tuples([
        ('Open', 'IBM'), ('High', 'IBM'), ('Low', 'IBM'), ('Close', 'IBM'), ('Volume', 'IBM')
    ])
    df = pd.DataFrame([[100.0, 110.0, 90.0, 105.0, 1000]], index=[ts], columns=columns)
    
    with patch("yfinance.download", return_value=df):
        candles = await provider.fetch_candles("IBM", "1d")
        assert len(candles) == 1
        assert candles[0]["close"] == 105.0
        assert candles[0]["timestamp"] == ts.to_pydatetime()
