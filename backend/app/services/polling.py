"""
PollingRefreshService - Manages polling cache and refresh intervals.

Feature: 004-candle-data-refresh
Purpose: Provide interval-based polling with session-based caching
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
import logging

from app.services.market_schedule import MarketSchedule

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cache metadata entry for a symbol/interval combination."""
    last_fetch: datetime
    last_update: datetime
    fetch_count: int = 0
    is_stale: bool = False


class PollingRefreshService:
    """
    Manages polling logic and cache invalidation for backend polling.

    Refresh intervals per spec clarification:
    - 1m, 5m: 5 seconds
    - 15m, 1h: 15 seconds
    - 1d: 60 seconds (1 minute)
    - 1w: 300 seconds (5 minutes)

    Cache invalidation thresholds (session-based):
    - 1m, 5m: 10 candles (10-50 minutes)
    - 15m, 1h: 4 candles (1-4 hours)
    - 1d+: 1 day
    """

    # Refresh intervals in seconds per spec clarification
    REFRESH_INTERVALS = {
        '1m': 5,     # 5 seconds
        '5m': 5,
        '15m': 15,   # 15 seconds
        '1h': 15,
        '1d': 60,    # 1 minute
        '1wk': 300,  # 5 minutes
        '1w': 300,   # Alias for 1wk
    }

    # Session-based cache invalidation thresholds
    CACHE_THRESHOLDS = {
        '1m': timedelta(minutes=10),   # 10 candles
        '5m': timedelta(minutes=50),   # 10 candles
        '15m': timedelta(hours=1),      # 4 candles
        '1h': timedelta(hours=4),
        '1d': timedelta(days=1),
        '1wk': timedelta(days=7),
        '1w': timedelta(days=7),
    }

    def __init__(self, market_schedule: Optional[MarketSchedule] = None):
        """
        Initialize PollingRefreshService.

        Args:
            market_schedule: Optional MarketSchedule instance for market hours awareness
        """
        self.cache_metadata: Dict[str, CacheEntry] = {}
        self.market_schedule = market_schedule or MarketSchedule()

    def get_refresh_interval(self, interval: str) -> int:
        """
        Get poll frequency in seconds for the given interval.

        Args:
            interval: Time interval string (e.g., '1m', '5m', '1h', '1d')

        Returns:
            int: Poll interval in seconds

        Raises:
            ValueError: If interval is not supported
        """
        interval_lower = interval.lower().replace('wk', 'w')
        if interval_lower not in self.REFRESH_INTERVALS:
            raise ValueError(f"Unsupported interval: {interval}. "
                           f"Supported intervals: {list(self.REFRESH_INTERVALS.keys())}")
        return self.REFRESH_INTERVALS[interval_lower]

    def should_fetch(self, symbol_id: int, interval: str) -> bool:
        """
        Check if a new fetch is needed based on cache validity.

        Args:
            symbol_id: Database ID of the symbol
            interval: Time interval string

        Returns:
            bool: True if fetch is needed, False if cache is still valid
        """
        interval_lower = interval.lower().replace('wk', 'w')
        key = f"{symbol_id}_{interval_lower}"

        # No cache entry exists - need to fetch
        if key not in self.cache_metadata:
            return True

        entry = self.cache_metadata[key]

        # Check if stale based on threshold
        threshold = self.CACHE_THRESHOLDS.get(interval_lower, timedelta(minutes=30))
        time_since_fetch = datetime.now(timezone.utc) - entry.last_fetch

        if time_since_fetch > threshold:
            return True

        # Cache is still valid
        return False

    def mark_fetched(self, symbol_id: int, interval: str):
        """
        Update cache metadata after a successful fetch.

        Args:
            symbol_id: Database ID of the symbol
            interval: Time interval string
        """
        interval_lower = interval.lower().replace('wk', 'w')
        key = f"{symbol_id}_{interval_lower}"
        now = datetime.now(timezone.utc)

        if key in self.cache_metadata:
            # Update existing entry
            self.cache_metadata[key].last_fetch = now
            self.cache_metadata[key].last_update = now
            self.cache_metadata[key].fetch_count += 1
            self.cache_metadata[key].is_stale = False
        else:
            # Create new entry
            self.cache_metadata[key] = CacheEntry(
                last_fetch=now,
                last_update=now,
                fetch_count=1,
                is_stale=False
            )

        logger.debug(f"Marked {key} as fetched (count: {self.cache_metadata[key].fetch_count})")

    def invalidate_cache(self, symbol_id: int, interval: str):
        """
        Manually invalidate cache for a symbol/interval combination.

        Args:
            symbol_id: Database ID of the symbol
            interval: Time interval string
        """
        interval_lower = interval.lower().replace('wk', 'w')
        key = f"{symbol_id}_{interval_lower}"

        if key in self.cache_metadata:
            del self.cache_metadata[key]
            logger.debug(f"Invalidated cache for {key}")

    def is_market_open(self) -> bool:
        """
        Check if US market is currently open.

        Delegates to the MarketSchedule service.

        Returns:
            bool: True if market is open, False otherwise
        """
        return self.market_schedule.is_market_open()

    def get_cache_entry(self, symbol_id: int, interval: str) -> Optional[CacheEntry]:
        """
        Get the cache entry for a symbol/interval combination.

        Args:
            symbol_id: Database ID of the symbol
            interval: Time interval string

        Returns:
            CacheEntry if exists, None otherwise
        """
        interval_lower = interval.lower().replace('wk', 'w')
        key = f"{symbol_id}_{interval_lower}"
        return self.cache_metadata.get(key)

    def clear_all_cache(self):
        """Clear all cache metadata. Useful for testing or session reset."""
        self.cache_metadata.clear()
        logger.debug("Cleared all cache metadata")
