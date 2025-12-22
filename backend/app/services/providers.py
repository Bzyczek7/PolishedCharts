import asyncio
import logging
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class MarketDataProvider(ABC):
    @abstractmethod
    async def fetch_candles(
        self, 
        symbol: str, 
        interval: str, 
        start: Optional[datetime] = None, 
        end: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        pass

class YFinanceProvider(MarketDataProvider):
    # Mapping yfinance intervals to chunk sizes (in days) to avoid data limits/timeouts
    CHUNK_POLICIES = {
        "1m": 7,    # Yahoo limit is ~7 days for 1m
        "2m": 30,
        "5m": 30,
        "15m": 30,
        "30m": 30,
        "60m": 60,
        "1h": 90,
        "1d": 365 * 5, # 5 years
        "1wk": 365 * 10,
        "1mo": 365 * 20,
    }

    # Hard limits per interval (library/Yahoo constraints)
    LOOKBACK_LIMITS = {
        "1m": timedelta(days=29), # Actually ~7 often, but docs say up to 30 for some
        "1h": timedelta(days=729), # ~2 years
    }

    async def fetch_candles(
        self, 
        symbol: str, 
        interval: str, 
        start: Optional[datetime] = None, 
        end: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch candles from yfinance with chunking and limit enforcement.
        """
        if not start:
            # Default to last 300 bars approximately if no start
            delta = self._get_default_lookback(interval)
            start = datetime.now() - delta

        if not end:
            end = datetime.now()

        # Enforce hard limits
        limit = self.LOOKBACK_LIMITS.get(interval)
        if limit:
            earliest_possible = datetime.now() - limit
            if start < earliest_possible:
                logger.warning(f"Start date {start} exceeds limit for {interval}. Clamping to {earliest_possible}")
                start = earliest_possible

        # If start >= end, nothing to fetch
        if start >= end:
            return []

        # Execute in thread pool since yfinance is blocking
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(
            None, 
            lambda: yf.download(
                tickers=symbol,
                start=start.strftime('%Y-%m-%d') if interval in ['1d', '1wk', '1mo'] else start,
                end=end.strftime('%Y-%m-%d') if interval in ['1d', '1wk', '1mo'] else end,
                interval=interval,
                progress=False,
                threads=False
            )
        )

        if df.empty:
            return []

        # Standardize format
        candles = []
        for timestamp, row in df.iterrows():
            # yf returns a MultiIndex if single ticker sometimes? 
            # With latest yfinance, it's usually just columns.
            # But let's handle the case where columns might be a MultiIndex
            try:
                open_val = float(row['Open'])
                high_val = float(row['High'])
                low_val = float(row['Low'])
                close_val = float(row['Close'])
                volume_val = int(row['Volume'])
            except (KeyError, TypeError):
                # Handle MultiIndex case if it occurs
                open_val = float(row[('Open', symbol)])
                high_val = float(row[('High', symbol)])
                low_val = float(row[('Low', symbol)])
                close_val = float(row[('Close', symbol)])
                volume_val = int(row[('Volume', symbol)])

            candles.append({
                "timestamp": timestamp.to_pydatetime(),
                "open": open_val,
                "high": high_val,
                "low": low_val,
                "close": close_val,
                "volume": volume_val
            })

        return candles

    def _get_default_lookback(self, interval: str) -> timedelta:
        mapping = {
            "1m": timedelta(hours=5),
            "5m": timedelta(days=1),
            "15m": timedelta(days=3),
            "1h": timedelta(days=12),
            "1d": timedelta(days=300),
        }
        return mapping.get(interval, timedelta(days=30))

class AlphaVantageProvider(MarketDataProvider):
    BASE_URL = "https://www.alphavantage.co/query"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def fetch_candles(
        self, 
        symbol: str, 
        interval: str, 
        start: Optional[datetime] = None, 
        end: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch incremental candles from Alpha Vantage.
        """
        # Mapping standard intervals to AV functions/intervals
        # AV functions: TIME_SERIES_INTRADAY, TIME_SERIES_DAILY, TIME_SERIES_WEEKLY, TIME_SERIES_MONTHLY
        
        if interval in ["1m", "5m", "15m", "30m", "60m"]:
            func = "TIME_SERIES_INTRADAY"
            av_interval = interval
        elif interval == "1h":
            func = "TIME_SERIES_INTRADAY"
            av_interval = "60min"
        elif interval == "1d":
            func = "TIME_SERIES_DAILY"
            av_interval = None
        elif interval == "1wk":
            func = "TIME_SERIES_WEEKLY"
            av_interval = None
        elif interval == "1mo":
            func = "TIME_SERIES_MONTHLY"
            av_interval = None
        else:
            raise ValueError(f"Interval {interval} not supported by Alpha Vantage provider")

        params = {
            "function": func,
            "symbol": symbol,
            "apikey": self.api_key,
            "outputsize": "compact" # Default to latest 100
        }
        if av_interval:
            params["interval"] = av_interval

        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(self.BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

            # Robust detection of rate limit or error
            if "Note" in data and "rate limit" in data["Note"]:
                logger.error(f"Alpha Vantage rate limit exceeded for {symbol}")
                raise Exception("RATE_LIMIT_EXCEEDED")
            
            if "Error Message" in data:
                logger.error(f"Alpha Vantage error for {symbol}: {data['Error Message']}")
                return []

            # Extract time series data
            # Key varies by function: "Time Series (1min)", "Time Series (Daily)", etc.
            ts_key = None
            for key in data.keys():
                if "Time Series" in key:
                    ts_key = key
                    break
            
            if not ts_key:
                return []

            time_series = data[ts_key]
            candles = []
            for ts_str, values in time_series.items():
                try:
                    # Handle both "2023-10-27" and "2023-10-27 15:00:00"
                    if " " in ts_str:
                        dt = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
                    else:
                        dt = datetime.strptime(ts_str, "%Y-%m-%d")
                    
                    # Ensure UTC (AV is typically US Eastern, but let's treat as naive/local for now
                    # and assume it matches the app's naive datetime usage elsewhere)
                    
                    # Filter by range if provided
                    if start and dt < start:
                        continue
                    if end and dt > end:
                        continue

                    candles.append({
                        "timestamp": dt,
                        "open": float(values["1. open"]),
                        "high": float(values["2. high"]),
                        "low": float(values["3. low"]),
                        "close": float(values["4. close"]),
                        "volume": int(values["5. volume"])
                    })
                except Exception as e:
                    logger.warning(f"Failed to parse AV candle at {ts_str}: {e}")

            return sorted(candles, key=lambda x: x["timestamp"])
