"""
Backend Performance Logging Service

Feature: 012-performance-optimization
Provides performance logging utilities for backend operations
"""

import time
import logging
from datetime import datetime
from typing import Any, Dict, Optional, List
from contextlib import contextmanager
from dataclasses import dataclass, asdict
import json

from ..core.performance_config import (
    performance_settings,
    is_threshold_exceeded,
    exceeds_contribution_limit,
)


logger = logging.getLogger(__name__)


@dataclass
class PerformanceLogEntry:
    """A single performance measurement."""

    timestamp: datetime
    category: str
    operation: str
    duration_ms: float
    context: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'timestamp': self.timestamp.isoformat(),
            'category': self.category,
            'operation': self.operation,
            'duration_ms': round(self.duration_ms, 2),
            'context': self.context,
        }


class PerformanceLogger:
    """
    Centralized performance logging for backend operations.

    Logs are structured JSON for easy parsing and analysis.
    """

    def __init__(self):
        self._logs: List[PerformanceLogEntry] = []
        self._max_logs = 10000  # Prevent unbounded growth

    def record(
        self,
        operation: str,
        duration_ms: float,
        category: str = "api",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Record a performance measurement.

        Args:
            operation: Name of the operation (e.g., 'fetch_candles', 'calculate_rsi')
            duration_ms: Duration in milliseconds
            category: Category for grouping (data_fetch, calculation, database, api)
            context: Additional context (symbol, interval, data_size, etc.)
        """
        if not performance_settings.performance_logging_enabled:
            return

        # Sampling for high-frequency operations
        if performance_settings.sampling_rate < 1.0:
            import random
            if random.random() > performance_settings.sampling_rate:
                return

        entry = PerformanceLogEntry(
            timestamp=datetime.now(),
            category=category,
            operation=operation,
            duration_ms=duration_ms,
            context=context or {},
        )

        self._logs.append(entry)

        # Prevent unbounded growth
        if len(self._logs) > self._max_logs:
            self._logs = self._logs[len(self._logs) // 2:]

        # Log warnings for threshold violations
        if is_threshold_exceeded(operation, duration_ms):
            logger.warning(
                f"Performance threshold exceeded: {operation} took {duration_ms:.0f}ms "
                f"(threshold: {performance_settings.operation_thresholds.get(operation, 'N/A')}ms)"
            )

        # Log at info level for normal operations
        logger.debug(
            f"Performance: {operation} completed in {duration_ms:.0f}ms "
            f"(category: {category}, context: {context})"
        )

    def get_logs(
        self,
        category: Optional[str] = None,
        operation: Optional[str] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve performance logs with optional filtering.

        Args:
            category: Filter by category
            operation: Filter by operation name
            start: Start of time range
            end: End of time range
            limit: Maximum number of logs to return

        Returns:
            List of performance log entries as dictionaries
        """
        filtered = self._logs

        if category:
            filtered = [log for log in filtered if log.category == category]

        if operation:
            filtered = [log for log in filtered if log.operation == operation]

        if start:
            filtered = [log for log in filtered if log.timestamp >= start]

        if end:
            filtered = [log for log in filtered if log.timestamp <= end]

        # Sort by timestamp descending (most recent first)
        filtered = sorted(filtered, key=lambda x: x.timestamp, reverse=True)

        return [log.to_dict() for log in filtered[:limit]]

    def clear(self) -> None:
        """Clear all performance logs."""
        self._logs.clear()

    def get_stats(self) -> Dict[str, Any]:
        """
        Get aggregate statistics for all logged operations.

        Returns:
            Dictionary with operation names as keys and stats as values
        """
        from collections import defaultdict

        operation_stats: Dict[str, List[float]] = defaultdict(list)

        for log in self._logs:
            operation_stats[log.operation].append(log.duration_ms)

        stats = {}
        for operation, durations in operation_stats.items():
            sorted_durations = sorted(durations)
            stats[operation] = {
                'count': len(durations),
                'total_ms': round(sum(durations), 2),
                'avg_ms': round(sum(durations) / len(durations), 2),
                'min_ms': round(min(durations), 2),
                'max_ms': round(max(durations), 2),
                'p50_ms': round(sorted_durations[len(sorted_durations) // 2], 2),
                'p95_ms': round(sorted_durations[int(len(sorted_durations) * 0.95)] if len(sorted_durations) >= 20 else sorted_durations[-1], 2),
                'p99_ms': round(sorted_durations[int(len(sorted_durations) * 0.99)] if len(sorted_durations) >= 100 else sorted_durations[-1], 2),
            }

        return stats

    def get_bottlenecks(
        self,
        total_duration_ms: float,
    ) -> List[Dict[str, Any]]:
        """
        Identify performance bottlenecks.

        Args:
            total_duration_ms: Total duration of the operation being analyzed

        Returns:
            List of bottlenecks sorted by impact
        """
        bottlenecks = []
        stats = self.get_stats()

        for operation, stat in stats.items():
            # Skip if insufficient samples
            if stat['count'] < performance_settings.min_sample_count:
                continue

            # Check threshold violations
            if is_threshold_exceeded(operation, stat['p95_ms']):
                bottlenecks.append({
                    'operation': operation,
                    'reason': 'threshold_exceeded',
                    'p95_ms': stat['p95_ms'],
                    'threshold_ms': performance_settings.operation_thresholds.get(operation),
                    'count': stat['count'],
                    'impact': 'critical' if stat['p95_ms'] > performance_settings.operation_thresholds.get(operation, 0) * 2 else 'high',
                })

            # Check high contribution
            contribution = (stat['total_ms'] / total_duration_ms * 100) if total_duration_ms > 0 else 0
            if contribution > performance_settings.max_operation_contribution_percent:
                bottlenecks.append({
                    'operation': operation,
                    'reason': 'high_contribution',
                    'p95_ms': stat['p95_ms'],
                    'contribution_percent': round(contribution, 2),
                    'count': stat['count'],
                    'impact': 'critical' if contribution > performance_settings.max_operation_contribution_percent * 2 else 'high',
                })

        # Sort by impact (critical first) then by p95 duration
        bottlenecks.sort(
            key=lambda x: (
                0 if x['impact'] == 'critical' else 1,
                -x.get('p95_ms', 0)
            )
        )

        return bottlenecks[:5]  # Return top 5


# Global performance logger instance
performance_logger = PerformanceLogger()


@contextmanager
def measure_performance(operation: str, category: str = "api", **context):
    """
    Context manager for measuring operation performance.

    Usage:
        with measure_performance("fetch_candles", "data_fetch", symbol="AAPL"):
            candles = await fetch_candles(symbol)

    Args:
        operation: Name of the operation
        category: Category for grouping
        **context: Additional context key-value pairs
    """
    start = time.time()
    try:
        yield
    finally:
        duration_ms = (time.time() - start) * 1000
        performance_logger.record(
            operation=operation,
            duration_ms=duration_ms,
            category=category,
            context=context,
        )


def record_performance(
    operation: str,
    duration_ms: float,
    category: str = "api",
    **context,
) -> None:
    """
    Manually record a performance measurement.

    Args:
        operation: Name of the operation
        duration_ms: Duration in milliseconds
        category: Category for grouping
        **context: Additional context key-value pairs
    """
    performance_logger.record(
        operation=operation,
        duration_ms=duration_ms,
        category=category,
        context=context,
    )
