"""
Backend Cache Service

Feature: 012-performance-optimization
In-memory LRU cache for expensive operations (indicator calculations, etc.)
"""

import time
import hashlib
import logging
from typing import Any, Dict, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from ..core.performance_config import (
    performance_settings,
)


logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """A single cache entry."""

    key: str
    value: Any
    created_at: datetime
    last_accessed: datetime
    access_count: int = 0
    size_bytes: int = 0

    def is_expired(self, ttl_seconds: int) -> bool:
        """Check if this entry has expired."""
        expiry_time = self.created_at + timedelta(seconds=ttl_seconds)
        return datetime.now() > expiry_time


class LRUCache:
    """
    Thread-safe LRU cache with TTL-based expiration.

    Features:
    - LRU eviction when size limit is reached
    - TTL-based expiration
    - Memory budget enforcement
    - Cache statistics
    - Symbol-based invalidation support
    """

    def __init__(
        self,
        max_size: int = 100,
        ttl_seconds: int = 60,
        memory_budget_bytes: int = 100 * 1024 * 1024,  # 100MB default
    ):
        self._cache: Dict[str, CacheEntry] = {}
        self._max_size = max_size
        self._ttl_seconds = ttl_seconds
        self._memory_budget = memory_budget_bytes
        self._current_memory = 0
        self._hits = 0
        self._misses = 0
        # FEATURE 014: Track symbols for invalidation
        # Maps symbol to list of cache keys
        self._symbol_to_keys: Dict[str, set] = {}

    def _add_symbol_mapping(self, key: str, symbol: str) -> None:
        """Add a key to the symbol tracking."""
        if symbol not in self._symbol_to_keys:
            self._symbol_to_keys[symbol] = set()
        self._symbol_to_keys[symbol].add(key)

    def _remove_symbol_mapping(self, key: str, symbol: str) -> None:
        """Remove a key from symbol tracking."""
        if symbol in self._symbol_to_keys and key in self._symbol_to_keys[symbol]:
            self._symbol_to_keys[symbol].discard(key)
            if not self._symbol_to_keys[symbol]:
                del self._symbol_to_keys[symbol]

    def invalidate_by_symbol(self, symbol: str) -> int:
        """
        Invalidate all cache entries for a specific symbol.

        Args:
            symbol: The symbol to invalidate

        Returns:
            Number of entries invalidated
        """
        if symbol not in self._symbol_to_keys:
            return 0

        keys_to_remove = list(self._symbol_to_keys[symbol])
        count = 0
        for key in keys_to_remove:
            self._remove_entry(key)
            count += 1

        # Clean up symbol mapping
        del self._symbol_to_keys[symbol]
        logger.debug(f"Invalidated {count} cache entries for symbol {symbol}")
        return count

    def _estimate_size(self, value: Any) -> int:
        """Estimate the memory size of a value in bytes."""
        try:
            import sys
            return sys.getsizeof(value)
        except Exception:
            # Fallback: assume 1KB per entry
            return 1024

    def _evict_lru(self) -> None:
        """Evict the least recently used entries."""
        # Sort by last accessed time
        sorted_entries = sorted(
            self._cache.items(),
            key=lambda x: x[1].last_accessed
        )

        # Evict oldest 10% of entries
        num_to_evict = max(1, len(self._cache) // 10)
        for key, _ in sorted_entries[:num_to_evict]:
            self._remove_entry(key)

        logger.debug(f"Evicted {num_to_evict} LRU entries")

    def _remove_entry(self, key: str) -> None:
        """Remove an entry and update memory tracking."""
        if key in self._cache:
            entry = self._cache[key]
            self._current_memory -= entry.size_bytes
            del self._cache[key]

        # FEATURE 014: Also remove from symbol tracking
        # Extract symbol from key (format: symbol:interval:start:end or symbol:indicator:...)
        # This ensures _symbol_to_keys stays in sync with _cache
        if ':' in key:
            parts = key.split(':')
            if len(parts) >= 1:
                symbol = parts[0]
                self._remove_symbol_mapping(key, symbol)

    def _cleanup_expired(self) -> None:
        """Remove expired entries."""
        now = datetime.now()
        expired_keys = [
            key for key, entry in self._cache.items()
            if entry.is_expired(self._ttl_seconds)
        ]

        for key in expired_keys:
            self._remove_entry(key)

        if expired_keys:
            logger.debug(f"Cleaned up {len(expired_keys)} expired entries")

    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from the cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """
        self._cleanup_expired()

        entry = self._cache.get(key)
        if entry is None:
            self._misses += 1
            return None

        if entry.is_expired(self._ttl_seconds):
            self._remove_entry(key)
            self._misses += 1
            return None

        # Update access metadata
        entry.last_accessed = datetime.now()
        entry.access_count += 1
        self._hits += 1

        return entry.value

    def set(self, key: str, value: Any, symbol: Optional[str] = None) -> None:
        """
        Set a value in the cache.

        Args:
            key: Cache key
            value: Value to cache
            symbol: Optional symbol for invalidation tracking
        """
        # Check if we need to evict
        if key not in self._cache and len(self._cache) >= self._max_size:
            self._evict_lru()

        # Estimate size
        size = self._estimate_size(value)

        # Remove existing entry if present
        self._remove_entry(key)

        # Check memory budget
        if self._current_memory + size > self._memory_budget:
            self._evict_lru()

            # Still over budget? Clear and start fresh
            if self._current_memory + size > self._memory_budget:
                logger.warning("Cache over memory budget, clearing all entries")
                self._cache.clear()
                self._symbol_to_keys.clear()
                self._current_memory = 0

        # Add new entry
        now = datetime.now()
        self._cache[key] = CacheEntry(
            key=key,
            value=value,
            created_at=now,
            last_accessed=now,
            size_bytes=size,
        )
        self._current_memory += size

        # FEATURE 014: Track symbol for invalidation
        if symbol:
            self._add_symbol_mapping(key, symbol)

    def clear(self) -> None:
        """Clear all cache entries."""
        self._cache.clear()
        self._symbol_to_keys.clear()
        self._current_memory = 0
        self._hits = 0
        self._misses = 0

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_requests = self._hits + self._misses
        hit_rate = self._hits / total_requests if total_requests > 0 else 0

        return {
            'entries': len(self._cache),
            'max_size': self._max_size,
            'memory_used_bytes': self._current_memory,
            'memory_budget_bytes': self._memory_budget,
            'hits': self._hits,
            'misses': self._misses,
            'hit_rate': round(hit_rate * 100, 2),
            'ttl_seconds': self._ttl_seconds,
        }

    def invalidate(self, pattern: Optional[str] = None) -> int:
        """
        Invalidate cache entries matching a pattern.

        Args:
            pattern: If provided, only invalidate keys containing this string.
                     If None, invalidate all entries.

        Returns:
            Number of entries invalidated
        """
        if pattern is None:
            count = len(self._cache)
            self.clear()
            return count

        keys_to_remove = [key for key in self._cache if pattern in key]
        for key in keys_to_remove:
            self._remove_entry(key)

        return len(keys_to_remove)


def generate_cache_key(*parts: Any) -> str:
    """
    Generate a consistent cache key from components.

    Args:
        *parts: Components to include in the key

    Returns:
        A hash-based cache key
    """
    # Convert all parts to strings
    str_parts = [str(p) for p in parts]

    # Create a deterministic string
    key_string = ":".join(str_parts)

    # Hash for shorter keys
    return hashlib.md5(key_string.encode()).hexdigest()


def generate_indicator_cache_key(
    symbol: str,
    interval: str,
    indicator_name: str,
    params: Dict[str, Any],
    from_ts: Optional[datetime] = None,
    to_ts: Optional[datetime] = None,
) -> str:
    """
    Generate a cache key for indicator calculations.

    CRITICAL: from_ts and to_ts ARE NOW included in the cache key to support backfill.
    When users scroll left to load historical data, indicators need to be recalculated
    for the extended date range. Different date ranges create separate cache entries.

    Args:
        symbol: Stock symbol
        interval: Time interval
        indicator_name: Name of the indicator
        params: Indicator parameters
        from_ts: Start date (for zooming/scrolling) - INCLUDED in key for backfill support
        to_ts: End date (for zooming/scrolling) - INCLUDED in key for backfill support

    Returns:
        A cache key
    """
    # Sort params for consistency
    sorted_params = sorted(params.items())

    # Create param string - include date range for backfill support
    param_str = ",".join(f"{k}={v}" for k, v in sorted_params)

    # Add date range to cache key if provided
    date_range_str = ""
    if from_ts and to_ts:
        # Format dates as ISO strings for consistent cache keys
        date_range_str = f":{from_ts.isoformat()}:{to_ts.isoformat()}"
    elif from_ts:
        date_range_str = f":{from_ts.isoformat()}:"
    elif to_ts:
        date_range_str = f"::{to_ts.isoformat()}"

    return generate_cache_key(symbol, interval, indicator_name, param_str + date_range_str)


# Global cache instances
indicator_cache = LRUCache(
    max_size=performance_settings.max_cache_entries,
    ttl_seconds=performance_settings.default_cache_ttl,
    memory_budget_bytes=performance_settings.cache_memory_budget // 2,  # Half for indicators
)

candle_cache = LRUCache(
    max_size=performance_settings.max_cache_entries,
    ttl_seconds=performance_settings.default_cache_ttl,
    memory_budget_bytes=performance_settings.cache_memory_budget // 2,  # Half for candles
)


def get_indicator_result(
    symbol: str,
    interval: str,
    indicator_name: str,
    params: Dict[str, Any],
    from_ts: Optional[datetime] = None,
    to_ts: Optional[datetime] = None,
) -> Optional[Any]:
    """Get a cached indicator calculation result."""
    key = generate_indicator_cache_key(symbol, interval, indicator_name, params, from_ts, to_ts)
    return indicator_cache.get(key)


def cache_indicator_result(
    symbol: str,
    interval: str,
    indicator_name: str,
    params: Dict[str, Any],
    result: Any,
    from_ts: Optional[datetime] = None,
    to_ts: Optional[datetime] = None,
) -> None:
    """Cache an indicator calculation result."""
    key = generate_indicator_cache_key(symbol, interval, indicator_name, params, from_ts, to_ts)
    indicator_cache.set(key, result, symbol=symbol)


def invalidate_symbol(symbol: str) -> None:
    """Invalidate all cache entries for a symbol."""
    # Use the new symbol-based invalidation
    indicator_cache.invalidate_by_symbol(symbol)
    candle_cache.invalidate_by_symbol(symbol)


def get_all_cache_stats() -> Dict[str, Any]:
    """Get statistics for all caches."""
    return {
        'indicator_cache': indicator_cache.get_stats(),
        'candle_cache': candle_cache.get_stats(),
    }


def generate_candle_cache_key(
    symbol: str,
    interval: str,
    start: datetime,
    end: datetime,
) -> str:
    """
    Generate a cache key for candle data.

    OPTIMIZATION: Normalize to day boundaries for better cache hits.
    Requests within the same day (even with different times) use the same cache key.
    This allows the initial chart fetch to serve subsequent indicator requests.

    Args:
        symbol: Stock symbol
        interval: Time interval
        start: Start timestamp
        end: End timestamp

    Returns:
        A cache key
    """
    # Normalize to day boundaries for cache hits
    # This allows "latest data" requests to share cache entries
    start_normalized = start.replace(hour=0, minute=0, second=0, microsecond=0)
    end_normalized = end.replace(hour=0, minute=0, second=0, microsecond=0)

    start_str = start_normalized.isoformat() if start_normalized.tzinfo else start_normalized.isoformat() + "Z"
    end_str = end_normalized.isoformat() if end_normalized.tzinfo else end_normalized.isoformat() + "Z"

    return generate_cache_key(symbol, interval, start_str, end_str)


def get_candle_data(
    symbol: str,
    interval: str,
    start: datetime,
    end: datetime,
) -> Optional[Any]:
    """
    Get cached candle data.

    Args:
        symbol: Stock symbol
        interval: Time interval
        start: Start timestamp
        end: End timestamp

    Returns:
        Cached candle data or None if not found/expired
    """
    key = generate_candle_cache_key(symbol, interval, start, end)
    return candle_cache.get(key)


def cache_candle_data(
    symbol: str,
    interval: str,
    start: datetime,
    end: datetime,
    candles: Any,
) -> None:
    """
    Cache candle data with interval-specific TTL.

    Args:
        symbol: Stock symbol
        interval: Time interval
        start: Start timestamp
        end: End timestamp
        candles: Candle data to cache
    """
    from ..core.performance_config import get_cache_ttl_for_interval

    key = generate_candle_cache_key(symbol, interval, start, end)

    # Get interval-specific TTL
    ttl = get_cache_ttl_for_interval(interval)

    # Temporarily set TTL for this cache instance
    original_ttl = candle_cache._ttl_seconds
    candle_cache._ttl_seconds = ttl

    try:
        candle_cache.set(key, candles, symbol=symbol)
    finally:
        # Restore original TTL
        candle_cache._ttl_seconds = original_ttl
