import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.alpha_vantage import AlphaVantageService

@pytest.fixture
def alpha_vantage_service():
    return AlphaVantageService(api_key="test_key")

@pytest.mark.asyncio
async def test_fetch_daily_candles(alpha_vantage_service):
    mock_response_data = {
        "Time Series (Daily)": {
            "2023-10-27": {
                "1. open": "100.00",
                "2. high": "110.00",
                "3. low": "90.00",
                "4. close": "105.00",
                "5. volume": "1000"
            }
        }
    }
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_response_data
    mock_response.raise_for_status = MagicMock() # Mock raise_for_status

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        
        candles = await alpha_vantage_service.fetch_daily_candles("IBM")
        
        assert len(candles) == 1
        assert candles[0]["close"] == 105.00
        assert candles[0]["date"] == "2023-10-27"
