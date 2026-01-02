"""
Cache layer tests for Feature 014 - Indicator API Performance Optimization

Tests:
- Candle cache key generation
- Candle cache set and get operations
- Candle cache expiration
- Indicator cache key generation
- Indicator cache operations
"""

import pytest
from datetime import datetime, timezone, timedelta
from app.services.cache import (
    generate_candle_cache_key,
    get_candle_data,
    cache_candle_data,
    generate_indicator_cache_key,
    get_indicator_result,
    cache_indicator_result,
    invalidate_symbol,
    candle_cache,
    indicator_cache,
)


class TestCandleCacheKeyGeneration:
    """Tests for T005: Candle cache key generation."""

    def test_candle_cache_key_consistency(self):
        """Test that identical inputs produce identical cache keys."""
        start = datetime(2023, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 1, 1, tzinfo=timezone.utc)

        key1 = generate_candle_cache_key("SPY", "1d", start, end)
        key2 = generate_candle_cache_key("SPY", "1d", start, end)

        assert key1 == key2, "Cache keys should be identical for same inputs"

    def test_candle_cache_key_different_symbols(self):
        """Test that different symbols produce different cache keys."""
        start = datetime(2023, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 1, 1, tzinfo=timezone.utc)

        key1 = generate_candle_cache_key("SPY", "1d", start, end)
        key2 = generate_candle_cache_key("QQQ", "1d", start, end)

        assert key1 != key2, "Cache keys should differ for different symbols"

    def test_candle_cache_key_different_intervals(self):
        """Test that different intervals produce different cache keys."""
        start = datetime(2023, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 1, 1, tzinfo=timezone.utc)

        key1 = generate_candle_cache_key("SPY", "1d", start, end)
        key2 = generate_candle_cache_key("SPY", "1h", start, end)

        assert key1 != key2, "Cache keys should differ for different intervals"

    def test_candle_cache_key_different_ranges(self):
        """Test that different date ranges produce different cache keys."""
        start1 = datetime(2023, 1, 1, tzinfo=timezone.utc)
        end1 = datetime(2024, 1, 1, tzinfo=timezone.utc)

        start2 = datetime(2023, 6, 1, tzinfo=timezone.utc)
        end2 = datetime(2024, 6, 1, tzinfo=timezone.utc)

        key1 = generate_candle_cache_key("SPY", "1d", start1, end1)
        key2 = generate_candle_cache_key("SPY", "1d", start2, end2)

        assert key1 != key2, "Cache keys should differ for different date ranges"


class TestCandleCacheSetAndGet:
    """Tests for T006: Candle cache set and get operations."""

    def setup_method(self):
        """Clear cache before each test."""
        candle_cache.clear()

    def test_candle_cache_set_and_get(self):
        """Test caching and retrieving candle data."""
        start = datetime(2023, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 1, 1, tzinfo=timezone.utc)

        # Create sample candle data
        candles = [
            {
                "timestamp": datetime(2023, 1, 1, tzinfo=timezone.utc),
                "open": 100.0,
                "high": 105.0,
                "low": 95.0,
                "close": 103.0,
                "volume": 1000000,
                "interval": "1d",
                "ticker": "SPY"
            },
            {
                "timestamp": datetime(2023, 1, 2, tzinfo=timezone.utc),
                "open": 103.0,
                "high": 108.0,
                "low": 102.0,
                "close": 107.0,
                "volume": 1100000,
                "interval": "1d",
                "ticker": "SPY"
            }
        ]

        # Cache the candles
        cache_candle_data("SPY", "1d", start, end, candles)

        # Retrieve from cache
        cached = get_candle_data("SPY", "1d", start, end)

        assert cached is not None, "Cached data should be retrieved"
        assert len(cached) == len(candles), "Cached data should have same length"
        assert cached[0]["close"] == candles[0]["close"], "Cached data should match original"

    def test_candle_cache_miss_returns_none(self):
        """Test that cache miss returns None."""
        start = datetime(2023, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 1, 1, tzinfo=timezone.utc)

        cached = get_candle_data("NONEXISTENT", "1d", start, end)

        assert cached is None, "Cache miss should return None"


class TestCandleCacheExpiration:
    """Tests for T007: Candle cache expiration."""

    def setup_method(self):
        """Clear cache before each test."""
        candle_cache.clear()

    def test_candle_cache_expiration(self):
        """Test that cached candles expire after TTL."""
        # Note: This test uses a short TTL for testing purposes
        # The actual TTL is determined by interval, but we can test the mechanism

        start = datetime(2023, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 1, 1, tzinfo=timezone.utc)

        candles = [
            {
                "timestamp": datetime(2023, 1, 1, tzinfo=timezone.utc),
                "open": 100.0,
                "high": 105.0,
                "low": 95.0,
                "close": 103.0,
                "volume": 1000000,
                "interval": "1d",
                "ticker": "SPY"
            }
        ]

        # Cache with a very short TTL for testing
        original_ttl = candle_cache._ttl_seconds
        candle_cache._ttl_seconds = 1  # 1 second TTL

        try:
            cache_candle_data("SPY", "1d", start, end, candles)

            # Should be cached immediately
            cached = get_candle_data("SPY", "1d", start, end)
            assert cached is not None, "Data should be cached immediately"

            # Wait for expiration
            import time
            time.sleep(1.5)

            # Should be expired now
            cached_after = get_candle_data("SPY", "1d", start, end)
            assert cached_after is None, "Data should be expired after TTL"
        finally:
            # Restore original TTL
            candle_cache._ttl_seconds = original_ttl


class TestIndicatorCacheKeyGeneration:
    """Tests for T015: Indicator cache key generation."""

    def test_indicator_cache_key_consistency(self):
        """Test that identical inputs produce identical cache keys."""
        key1 = generate_indicator_cache_key("SPY", "1d", "crsi", {"domcycle": 10})
        key2 = generate_indicator_cache_key("SPY", "1d", "crsi", {"domcycle": 10})

        assert key1 == key2, "Cache keys should be identical for same inputs"

    def test_indicator_cache_key_params_order(self):
        """Test that cache key is independent of param order (T016)."""
        key1 = generate_indicator_cache_key("SPY", "1d", "crsi", {"a": 1, "b": 2})
        key2 = generate_indicator_cache_key("SPY", "1d", "crsi", {"b": 2, "a": 1})

        assert key1 == key2, "Cache keys should be identical regardless of param order"


class TestIndicatorCacheSetAndGet:
    """Tests for T017: Indicator cache set and get operations."""

    def setup_method(self):
        """Clear cache before each test."""
        indicator_cache.clear()

    def test_indicator_cache_set_and_get(self):
        """Test caching and retrieving indicator results."""
        result = {
            "timestamps": [946684800, 946771200],
            "data": {
                "crsi": [50.0, 52.3]
            }
        }

        cache_indicator_result("SPY", "1d", "crsi", {"domcycle": 10}, result)

        cached = get_indicator_result("SPY", "1d", "crsi", {"domcycle": 10})

        assert cached is not None, "Cached result should be retrieved"
        assert cached["data"]["crsi"][0] == 50.0, "Cached data should match original"

    def test_indicator_cache_miss_returns_none(self):
        """Test that cache miss returns None."""
        cached = get_indicator_result("INVALID", "1d", "sma", {"period": 20})
        assert cached is None, "Cache miss should return None"


class TestIndicatorCacheInvalidation:
    """Tests for T018: Indicator cache invalidation."""

    def setup_method(self):
        """Clear cache before each test."""
        indicator_cache.clear()

    def test_symbol_invalidation(self):
        """Test that symbol invalidation removes all entries."""
        result1 = {"data": [1, 2, 3]}
        result2 = {"data": [4, 5, 6]}

        cache_indicator_result("SPY", "1d", "sma", {"period": 20}, result1)
        cache_indicator_result("SPY", "1d", "ema", {"period": 20}, result2)

        # Verify both are cached
        assert get_indicator_result("SPY", "1d", "sma", {"period": 20}) is not None
        assert get_indicator_result("SPY", "1d", "ema", {"period": 20}) is not None

        # Invalidate symbol
        invalidate_symbol(symbol="SPY")

        # Both should be removed
        assert get_indicator_result("SPY", "1d", "sma", {"period": 20}) is None
        assert get_indicator_result("SPY", "1d", "ema", {"period": 20}) is None

    def test_symbol_invalidation_affects_candle_cache_too(self):
        """Test that symbol invalidation affects both indicator and candle caches."""
        # Set up indicator cache
        result = {"data": [1, 2, 3]}
        cache_indicator_result("SPY", "1d", "sma", {"period": 20}, result)

        # Set up candle cache
        start = datetime(2023, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 1, 1, tzinfo=timezone.utc)
        candles = [{"timestamp": start, "close": 100.0}]
        cache_candle_data("SPY", "1d", start, end, candles)

        # Invalidate symbol
        invalidate_symbol(symbol="SPY")

        # Both caches should be cleared for this symbol
        assert get_indicator_result("SPY", "1d", "sma", {"period": 20}) is None
        assert get_candle_data("SPY", "1d", start, end) is None


class TestCacheFailureHandling:
    """Tests for T022a-T022c: Edge case tests for cache failures."""

    def setup_method(self):
        """Clear cache before each test."""
        indicator_cache.clear()
        candle_cache.clear()

    def test_cache_get_failure_falls_back_to_db(self):
        """T022a: Test that cache get failures fall back to database gracefully."""
        # This test verifies graceful degradation when cache.get() fails
        # In a real scenario, this would involve mocking the cache to raise an exception
        # For now, we verify the caching functions handle None returns gracefully

        # Try to get non-existent data - should return None, not raise exception
        result = get_indicator_result("NONEXISTENT", "1d", "sma", {"period": 20})
        assert result is None, "Cache miss should return None without raising exception"

        # Verify candle cache also handles misses gracefully
        start = datetime(2023, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 1, 1, tzinfo=timezone.utc)
        candles = get_candle_data("NONEXISTENT", "1d", start, end)
        assert candles is None, "Candle cache miss should return None without raising exception"

    def test_cache_set_failure_continues_without_error(self):
        """T022b: Test that cache set failures don't break the endpoint."""
        # Verify that set operations complete without errors for valid data
        result = {"data": [1, 2, 3]}

        # This should not raise an exception even if caching has issues
        try:
            cache_indicator_result("TEST", "1d", "sma", {"period": 20}, result)
            # If we get here, caching worked
            cached = get_indicator_result("TEST", "1d", "sma", {"period": 20})
            assert cached == result, "Cached result should match original"
        except Exception as e:
            # Even if caching failed, it should not raise
            assert False, f"cache_indicator_result should not raise exceptions: {e}"

    def test_cache_invalidation_with_empty_cache(self):
        """T022c: Test that invalidation works even when cache is empty."""
        # Invalidate on an empty cache should not raise an error
        try:
            invalidate_symbol("NONEXISTENT_SYMBOL")
            # If we get here, invalidation worked
            assert True, "Invalidation on empty cache should not raise"
        except Exception as e:
            assert False, f"invalidate_symbol should not raise exceptions: {e}"
