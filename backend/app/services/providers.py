import asyncio
import logging
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type, wait_random_exponential
from app.services.rate_limiter import RateLimiter, rate_limit

logger = logging.getLogger(__name__)

# Global rate limiter for yfinance (e.g. 2 requests per second)
yf_limiter = RateLimiter(2, 1.0)

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
        if not start or not end:
            # Fallback to single non-chunked call for default period
            return await self._fetch_chunk(symbol, interval, start, end)

        # Enforce hard limits
        limit = self.LOOKBACK_LIMITS.get(interval)
        if start and limit:
            earliest_possible = datetime.now(timezone.utc) - limit
            if start < earliest_possible:
                logger.warning(f"Start date {start} exceeds limit for {interval}. Clamping to {earliest_possible}")
                start = earliest_possible

        chunk_days = self.CHUNK_POLICIES.get(interval, 30)
        chunk_delta = timedelta(days=chunk_days)
        
        all_candles = []
        current_start = start
        
        while current_start < end:
            current_end = min(current_start + chunk_delta, end)
            
            try:
                candles = await self._fetch_with_retries(symbol, interval, current_start, current_end)
                all_candles.extend(candles)
            except Exception as e:
                logger.error(f"Failed to fetch chunk {current_start} to {current_end} for {symbol}: {e}")
                # We continue to next chunk or stop? 
                # For historical backfill, we might want to collect what we can.
            
            current_start = current_end

        # Deduplicate and sort
        unique_candles = {c["timestamp"]: c for c in all_candles}
        return sorted(unique_candles.values(), key=lambda x: x["timestamp"])

    async def _fetch_with_retries(
        self,
        symbol: str,
        interval: str,
        start: datetime,
        end: datetime,
        max_retries: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Fetch a single chunk with retries and window shrinking.
        Uses tenacity for backoff.
        """
        @retry(
            stop=stop_after_attempt(max_retries),
            wait=wait_random_exponential(multiplier=1, max=30),
            retry=retry_if_exception_type(Exception),
            reraise=True
        )
        async def _attempt():
            return await self._fetch_chunk(symbol, interval, start, end)

        try:
            return await _attempt()
        except Exception as e:
            # Window shrinking: if it failed after all retries, try a smaller range
            duration = end - start
            if duration > timedelta(hours=1):
                mid = start + (duration / 2)
                logger.warning(f"All retries failed for {symbol} range {start} to {end}. Shrinking window.")
                first_half = await self._fetch_with_retries(symbol, interval, start, mid, max_retries=2)
                second_half = await self._fetch_with_retries(symbol, interval, mid, end, max_retries=2)
                return first_half + second_half
            else:
                logger.error(f"Failed to fetch minimal window for {symbol}: {e}")
                return []

    @rate_limit(yf_limiter)
    async def _fetch_chunk(
        self, 
        symbol: str, 
        interval: str, 
        start: Optional[datetime] = None, 
        end: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        # Execute in thread pool since yfinance is blocking
        loop = asyncio.get_event_loop()
        
        def _fetch():
            ticker = yf.Ticker(symbol)
            
            if start:
                # yfinance supports datetime objects
                if interval == "1d":
                    s_str = start.strftime('%Y-%m-%d')
                    e_str = end.strftime('%Y-%m-%d')
                    df = ticker.history(start=s_str, end=e_str, interval=interval)
                else:
                    df = ticker.history(start=start, end=end, interval=interval)
            else:
                # Get a default period
                period_map = {
                    "1m": "7d",
                    "2m": "30d",
                    "5m": "60d",
                    "15m": "60d",
                    "1h": "730d",
                    "1d": "max",
                    "1wk": "max",
                }
                p = period_map.get(interval, "1mo")
                df = ticker.history(period=p, interval=interval)
            return df

        try:
            # Add retry mechanism with exponential backoff for network issues
            import time
            import random
            max_retries = 3
            retry_count = 0

            while retry_count < max_retries:
                try:
                    df = await loop.run_in_executor(None, _fetch)
                    break  # Success, exit retry loop
                except Exception as fetch_error:
                    retry_count += 1
                    if retry_count >= max_retries:
                        logger.error(f"Failed to fetch data from yfinance for {symbol} after {max_retries} retries: {fetch_error}")
                        return []

                    wait_time = (2 ** retry_count) + random.uniform(0.1, 0.5)  # Exponential backoff with jitter
                    logger.warning(f"Retry {retry_count}/{max_retries} for {symbol} after error: {fetch_error}. Waiting {wait_time:.2f}s...")
                    await asyncio.sleep(wait_time)

            if df is None or df.empty:
                logger.warning(f"No data returned from yfinance for {symbol}")
                return []

            if isinstance(df.columns, pd.MultiIndex):
                try:
                    df = df.xs(symbol, axis=1, level=1)
                except (KeyError, ValueError):
                    df.columns = df.columns.get_level_values(0)

            candles = []
            for timestamp, row in df.iterrows():
                try:
                    # Ensure timestamp is aware UTC and rounded to midnight for non-intraday
                    dt = timestamp.to_pydatetime()
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    else:
                        dt = dt.astimezone(timezone.utc)

                    # Normalize to midnight for 1d+ intervals
                    if interval in ["1d", "1wk", "1w", "1mo", "3mo"]:
                        dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)

                    if interval in ["1wk", "1w"]:
                        # Normalize to Monday 00:00
                        dt = dt - timedelta(days=dt.weekday())
                    elif interval == "1mo":
                        # Normalize to 1st of the month 00:00
                        dt = dt.replace(day=1)

                    vol = row.get('Volume')
                    vol = int(vol) if vol is not None and not pd.isna(vol) else None

                    # Ensure all required values are not NaN before adding
                    open_val = row.get('Open')
                    high_val = row.get('High')
                    low_val = row.get('Low')
                    close_val = row.get('Close')

                    if all(pd.notna(v) for v in [open_val, high_val, low_val, close_val]):
                        candles.append({
                            "timestamp": dt,
                            "open": float(open_val),
                            "high": float(high_val),
                            "low": float(low_val),
                            "close": float(close_val),
                            "volume": vol
                        })
                except Exception as e:
                    logger.warning(f"Error processing row for {symbol}: {e}")
                    continue

            logger.info(f"Successfully fetched {len(candles)} candles for {symbol}")
            return candles
        except Exception as e:
            logger.error(f"Error fetching data from yfinance for {symbol}: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _get_default_lookback(self, interval: str) -> timedelta:
        mapping = {
            "1m": timedelta(days=7),
            "2m": timedelta(days=30),
            "5m": timedelta(days=30),
            "15m": timedelta(days=30),
            "30m": timedelta(days=30),
            "60m": timedelta(days=60),
            "1h": timedelta(days=730),
            "1d": timedelta(days=365 * 2),
            "1wk": timedelta(days=365 * 5),
        }
        return mapping.get(interval, timedelta(days=365))

class AlphaVantageProvider(MarketDataProvider):
    BASE_URL = "https://www.alphavantage.co/query"

    def __init__(self, api_key: str, calls_per_minute: int = 5, calls_per_day: int = 500):
        self.api_key = api_key
        self.calls_per_minute = calls_per_minute
        self.calls_per_day = calls_per_day
        self._last_call_ts = 0
        self._min_interval = 60.0 / calls_per_minute

    async def fetch_candles(
        self, 
        symbol: str, 
        interval: str, 
        start: Optional[datetime] = None, 
        end: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch incremental candles from Alpha Vantage with retry and rate limit support.
        """
        import time
        import random

        # Simple client-side throttling
        now = time.time()
        elapsed = now - self._last_call_ts
        if elapsed < self._min_interval:
            await asyncio.sleep(self._min_interval - elapsed)

        max_retries = 3
        current_retry = 0
        
        while current_retry <= max_retries:
            try:
                self._last_call_ts = time.time()
                candles = await self._do_fetch(symbol, interval, start, end)
                return candles
            except Exception as e:
                if "RATE_LIMIT_EXCEEDED" in str(e):
                    current_retry += 1
                    if current_retry > max_retries:
                        raise e
                    
                    # Exponential backoff with jitter
                    wait_time = (2 ** current_retry) + random.uniform(0, 1)
                    logger.warning(f"Alpha Vantage rate limit hit for {symbol}. Retrying in {wait_time:.2f}s...")
                    await asyncio.sleep(wait_time)
                else:
                    raise e
        
        return []

    async def _do_fetch(self, symbol: str, interval: str, start: Optional[datetime] = None, end: Optional[datetime] = None) -> List[Dict[str, Any]]:
        if interval in ["1m", "5m", "15m", "30m", "60m", "1h"]:
            func = "TIME_SERIES_INTRADAY"
            mapping = {
                "1m": "1min",
                "5m": "5min",
                "15m": "15min",
                "30m": "30min",
                "60m": "60min",
                "1h": "60min"
            }
            av_interval = mapping.get(interval)
        elif interval == "1d":
            func = "TIME_SERIES_DAILY"
            av_interval = None
        elif interval in ["1wk", "1w"]:
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
            "outputsize": "full"
        }
        if av_interval:
            params["interval"] = av_interval

        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(self.BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

            if "Note" in data and "rate limit" in data["Note"]:
                logger.error(f"Alpha Vantage rate limit exceeded for {symbol}")
                raise Exception("RATE_LIMIT_EXCEEDED")
            
            if "Error Message" in data:
                logger.error(f"Alpha Vantage error for {symbol}: {data['Error Message']}")
                return []

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
                    dt = pd.to_datetime(ts_str).to_pydatetime()
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    else:
                        dt = dt.astimezone(timezone.utc)
                    
                    if interval == "1d":
                        dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
                    
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