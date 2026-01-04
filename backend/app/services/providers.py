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
        "1d": 365 * 2, # 2 years (reduced from 5 to prevent timeouts)
        "1wk": 365 * 5, # 5 years (reduced from 10)
        "1mo": 365 * 10,
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
        if start and end:
            # Fetch for specific date range
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
        else:
            # Fallback to single non-chunked call for default period
            return await self._fetch_chunk(symbol, interval)

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
                    # Check if this is a delisted symbol error
                    error_msg = str(fetch_error).lower()
                    if "delisted" in error_msg or "no price data found" in error_msg:
                        logger.warning(f"Symbol {symbol} appears to be delisted: {fetch_error}")
                        return []  # Return empty list for delisted symbols

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

            # Process candles and handle potential duplicates for all intervals
            candles = []
            daily_candles = {}  # For daily intervals, keep track of candles by date to avoid duplicates
            daily_original_timestamps = {}  # Store original timestamps for comparison

            for timestamp, row in df.iterrows():
                try:
                    # Ensure timestamp is aware UTC
                    original_ts = timestamp.to_pydatetime()
                    if original_ts.tzinfo is None:
                        original_ts = original_ts.replace(tzinfo=timezone.utc)
                    else:
                        original_ts = original_ts.astimezone(timezone.utc)

                    # Normalize to midnight for 1d+ intervals
                    normalized_dt = original_ts
                    if interval in ["1d", "1wk", "1w", "1mo", "3mo"]:
                        normalized_dt = original_ts.replace(hour=0, minute=0, second=0, microsecond=0)

                    if interval in ["1wk", "1w"]:
                        # Normalize to Monday 00:00
                        normalized_dt = normalized_dt - timedelta(days=normalized_dt.weekday())
                    elif interval == "1mo":
                        # Normalize to 1st of the month 00:00
                        normalized_dt = normalized_dt.replace(day=1)

                    vol = row.get('Volume')
                    vol = int(vol) if vol is not None and not pd.isna(vol) else None

                    # Ensure all required values are not NaN before adding
                    open_val = row.get('Open')
                    high_val = row.get('High')
                    low_val = row.get('Low')
                    close_val = row.get('Close')

                    if all(pd.notna(v) for v in [open_val, high_val, low_val, close_val]):
                        candle_data = {
                            "timestamp": normalized_dt,
                            "open": float(open_val),
                            "high": float(high_val),
                            "low": float(low_val),
                            "close": float(close_val),
                            "volume": vol
                        }

                        # For daily intervals, if we have multiple entries for the same date,
                        # keep the one with the latest time of day (typically the closing values)
                        if interval in ["1d", "1wk", "1mo", "1w", "3mo"]:  # Apply to all daily+ intervals
                            date_key = normalized_dt.date()
                            if date_key not in daily_candles:
                                daily_candles[date_key] = candle_data
                                daily_original_timestamps[date_key] = original_ts
                            else:
                                # If current entry has a later time of day, use it
                                if original_ts.time() > daily_original_timestamps[date_key].time():
                                    daily_candles[date_key] = candle_data
                                    daily_original_timestamps[date_key] = original_ts
                        else:
                            # For other intervals, just add to candles list (no deduplication needed for intraday)
                            # But we'll still add a general deduplication by timestamp to be safe
                            candles.append(candle_data)
                except Exception as e:
                    logger.warning(f"Error processing row for {symbol}: {e}")
                    continue

            # Add daily candles to the result list
            candles.extend(daily_candles.values())

            # Apply general deduplication for all intervals to prevent any duplicates
            # This handles cases where Yahoo Finance returns multiple entries for same timestamp
            unique_candles = {}
            for candle in candles:
                timestamp_key = candle["timestamp"]
                if timestamp_key not in unique_candles:
                    unique_candles[timestamp_key] = candle
                else:
                    # For duplicate timestamps, prefer the entry with the most complete data
                    # Check if current candle has more complete data than stored one
                    current_candle = unique_candles[timestamp_key]
                    current_complete_fields = sum(1 for v in [candle.get('open'), candle.get('high'), candle.get('low'), candle.get('close')] if v is not None and pd.notna(v))
                    stored_complete_fields = sum(1 for v in [current_candle.get('open'), current_candle.get('high'), current_candle.get('low'), current_candle.get('close')] if v is not None and pd.notna(v))

                    # Replace if current candle has more complete data
                    if current_complete_fields > stored_complete_fields:
                        unique_candles[timestamp_key] = candle

            # Convert back to list
            candles = list(unique_candles.values())

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

