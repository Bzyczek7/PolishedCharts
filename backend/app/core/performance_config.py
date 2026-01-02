"""
Backend Performance Configuration

Feature: 012-performance-optimization
Configurable thresholds and settings for performance monitoring
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Dict


class PerformanceSettings(BaseSettings):
    """Performance monitoring settings and thresholds."""

    # Maximum acceptable duration per operation type (milliseconds)
    operation_thresholds: Dict[str, int] = {
        'fetch_candles': 3000,           # 3 seconds - SC-003
        'calculate_indicator': 1000,     # 1 second - SC-004
        'batch_indicators': 3000,        # 3 seconds for 5 indicators - SC-006
        'database_query': 500,           # 500ms max for DB queries
        'api_request': 100,              # 100ms max for internal API calls
    }

    # Maximum percentage of total load time any single operation should contribute
    max_operation_contribution_percent: float = 20.0  # SC-008

    # Minimum count for an operation to be considered in bottleneck analysis
    min_sample_count: int = 3

    # Memory budget for caching (bytes) - Constitution VI
    cache_memory_budget: int = 500 * 1024 * 1024  # 500MB

    # Default TTL for cached items (seconds)
    default_cache_ttl: int = 60  # 1 minute

    # Interval-specific cache TTL (seconds) - Feature 014
    cache_ttl_by_interval: Dict[str, int] = {
        "1m": 300,      # 5 minutes - intraday data updates frequently
        "5m": 300,      # 5 minutes
        "15m": 300,     # 5 minutes
        "30m": 300,     # 5 minutes
        "1h": 900,      # 15 minutes - hourly data updates less frequently
        "4h": 900,      # 15 minutes
        "1d": 3600,     # 1 hour - daily data updates once per market close
        "1wk": 3600     # 1 hour
    }

    # Maximum cache entries before eviction
    max_cache_entries: int = 100

    # Enable/disable performance logging
    performance_logging_enabled: bool = True

    # Sampling rate for high-frequency operations (0.0 to 1.0)
    # 1.0 = log all, 0.1 = log 10%
    sampling_rate: float = 1.0

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore",
        env_prefix="PERFORMANCE_"
    )


def get_cache_ttl_for_interval(interval: str) -> int:
    """
    Get cache TTL for a specific interval.

    Args:
        interval: Time interval (e.g., "1d", "1h", "5m")

    Returns:
        TTL in seconds for the interval
    """
    return performance_settings.cache_ttl_by_interval.get(
        interval,
        performance_settings.default_cache_ttl
    )


# Global settings instance
performance_settings = PerformanceSettings()


def get_threshold(operation: str) -> int | None:
    """Get the threshold for an operation, or None if not defined."""
    return performance_settings.operation_thresholds.get(operation)


def is_threshold_exceeded(operation: str, duration_ms: float) -> bool:
    """Check if an operation duration exceeds its threshold."""
    threshold = get_threshold(operation)
    if threshold is None:
        return False
    return duration_ms > threshold


def exceeds_contribution_limit(duration_ms: float, total_duration_ms: float) -> bool:
    """Check if an operation's contribution exceeds the allowed percentage."""
    if total_duration_ms == 0:
        return False
    contribution = (duration_ms / total_duration_ms) * 100
    return contribution > performance_settings.max_operation_contribution_percent
