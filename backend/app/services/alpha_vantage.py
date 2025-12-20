import httpx
from typing import List, Dict, Any

class AlphaVantageService:
    BASE_URL = "https://www.alphavantage.co/query"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def fetch_daily_candles(self, symbol: str) -> List[Dict[str, Any]]:
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "apikey": self.api_key,
            "outputsize": "compact" # Just latest 100 data points
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(self.BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            if "Error Message" in data:
                raise ValueError(f"Error fetching data from Alpha Vantage: {data['Error Message']}")
            
            time_series = data.get("Time Series (Daily)", {})
            candles = []
            
            for date, values in time_series.items():
                candles.append({
                    "date": date,
                    "open": float(values["1. open"]),
                    "high": float(values["2. high"]),
                    "low": float(values["3. low"]),
                    "close": float(values["4. close"]),
                    "volume": int(values["5. volume"])
                })
            
            # Sort by date ascending
            return sorted(candles, key=lambda x: x["date"])
