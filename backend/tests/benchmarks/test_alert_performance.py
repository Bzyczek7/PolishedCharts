"""
Performance benchmarks for alert evaluation.

T106: Add performance benchmarks for alert evaluation at scale (100, 1000, 10000 alerts)
T106a: Implement alert evaluation timing measurement (enforce 500ms budget)
T106b: Implement batch evaluation for high alert volumes (>1000)

This module tests the alert engine's performance with varying numbers of alerts
to ensure the system can handle unlimited alerts as per the Constitution's
"Unlimited Alerts Philosophy".
"""

import pytest
import time
from unittest.mock import AsyncMock, MagicMock
from app.services.alert_engine import AlertEngine
from app.models.alert import Alert
from app.core.enums import AlertCondition


class TestAlertPerformance:
    """Performance benchmarks for alert evaluation at various scales."""

    @pytest.fixture
    def mock_session_factory(self):
        """Create a mock database session factory."""
        def _factory(alerts):
            mock_session = AsyncMock()
            mock_factory = MagicMock()
            mock_factory.return_value.__aenter__.return_value = mock_session
            mock_factory.return_value.__aexit__.return_value = AsyncMock()

            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = alerts
            mock_session.execute.return_value = mock_result
            mock_session.commit = AsyncMock()

            return mock_factory
        return _factory

    @pytest.fixture
    def create_alerts(self):
        """Create mock alerts with different conditions."""
        def _create(count):
            alerts = []
            conditions = [
                AlertCondition.ABOVE.value,
                AlertCondition.BELOW.value,
                AlertCondition.CROSSES_UP.value,
                AlertCondition.CROSSES_DOWN.value,
                AlertCondition.INDICATOR_CROSSES_UPPER.value,
                AlertCondition.INDICATOR_TURNS_POSITIVE.value,
                AlertCondition.INDICATOR_SLOPE_BULLISH.value,
            ]
            for i in range(count):
                alert = Alert(
                    id=i + 1,
                    symbol_id=1,
                    condition=conditions[i % len(conditions)],
                    threshold=100.0 + (i % 10),
                    is_active=True,
                    cooldown=60,
                    indicator_name="crsi" if "indicator" in conditions[i % len(conditions)] else None,
                    indicator_field="crsi" if "indicator" in conditions[i % len(conditions)] else None
                )
                alerts.append(alert)
            return alerts
        return _create

    @pytest.mark.asyncio
    async def test_100_alerts_performance(
        self, mock_session_factory, create_alerts
    ):
        """
        T106: Benchmark alert evaluation with 100 alerts.
        Target: Should complete well under 500ms budget.
        """
        alerts = create_alerts(100)
        mock_factory = mock_session_factory(alerts)
        engine = AlertEngine(mock_factory)

        start_time = time.perf_counter()
        triggered = await engine.evaluate_symbol_alerts(
            symbol_id=1,
            current_price=105.0,
            previous_price=100.0,
            indicator_data={"value": 75.0, "prev_value": 65.0}
        )
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # Should complete quickly (< 100ms for 100 alerts)
        assert elapsed_ms < 100, f"100 alerts took {elapsed_ms:.2f}ms, expected < 100ms"
        assert isinstance(triggered, list)

    @pytest.mark.asyncio
    async def test_1000_alerts_under_500ms(
        self, mock_session_factory, create_alerts
    ):
        """
        T106: Benchmark alert evaluation with 1000 alerts.
        T106a: Alert evaluation timing measurement (enforce 500ms budget).
        """
        alerts = create_alerts(1000)
        mock_factory = mock_session_factory(alerts)
        engine = AlertEngine(mock_factory)

        start_time = time.perf_counter()
        triggered = await engine.evaluate_symbol_alerts(
            symbol_id=1,
            current_price=105.0,
            previous_price=100.0,
            indicator_data={"value": 75.0, "prev_value": 65.0}
        )
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # Performance budget: 500ms for 1000 alerts
        assert elapsed_ms < 500, f"1000 alerts took {elapsed_ms:.2f}ms, budget is 500ms"
        assert isinstance(triggered, list)

    @pytest.mark.asyncio
    async def test_10000_alerts_performance(
        self, mock_session_factory, create_alerts
    ):
        """
        T106: Benchmark alert evaluation with 10000 alerts.
        This tests scalability - should still complete in reasonable time.
        """
        alerts = create_alerts(10000)
        mock_factory = mock_session_factory(alerts)
        engine = AlertEngine(mock_factory)

        start_time = time.perf_counter()
        triggered = await engine.evaluate_symbol_alerts(
            symbol_id=1,
            current_price=105.0,
            previous_price=100.0,
            indicator_data={"value": 75.0, "prev_value": 65.0}
        )
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # For 10000 alerts, we allow more time but should still be reasonable
        # This helps identify if there are O(n^2) issues
        assert elapsed_ms < 5000, f"10000 alerts took {elapsed_ms:.2f}ms, expected < 5000ms"
        assert isinstance(triggered, list)

    @pytest.mark.asyncio
    async def test_evaluation_scales_linearly(
        self, mock_session_factory, create_alerts
    ):
        """
        T106: Verify that evaluation time scales roughly linearly with alert count.
        This helps ensure we don't have O(n^2) algorithms.
        """
        sizes = [100, 500, 1000]
        times = []

        for size in sizes:
            alerts = create_alerts(size)
            mock_factory = mock_session_factory(alerts)
            engine = AlertEngine(mock_factory)

            start_time = time.perf_counter()
            await engine.evaluate_symbol_alerts(
                symbol_id=1,
                current_price=105.0,
                previous_price=100.0,
                indicator_data={"value": 75.0, "prev_value": 65.0}
            )
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            times.append(elapsed_ms)

        # Check that 1000 alerts don't take more than 12x the time of 100 alerts
        # (10x is linear, 12x allows for some overhead)
        ratio = times[2] / times[0]
        assert ratio < 12, f"Scaling appears non-linear: {times[0]:.2f}ms -> {times[2]:.2f}ms (ratio: {ratio:.1f}x)"

    @pytest.mark.asyncio
    async def test_cooldown_filtering_performance(
        self, mock_session_factory, create_alerts
    ):
        """
        Test that cooldown filtering is efficient even with many alerts.
        Most alerts should be filtered out by cooldown in typical usage.
        """
        alerts = create_alerts(1000)
        mock_factory = mock_session_factory(alerts)
        engine = AlertEngine(mock_factory)

        # Simulate that half the alerts are in cooldown
        for i in range(500):
            from datetime import datetime, timezone
            engine._last_triggered[i + 1] = datetime.now(timezone.utc)

        start_time = time.perf_counter()
        triggered = await engine.evaluate_symbol_alerts(
            symbol_id=1,
            current_price=105.0,
            previous_price=100.0,
        )
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # Cooldown filtering should make this faster
        assert elapsed_ms < 300, f"Cooldown filtering took {elapsed_ms:.2f}ms"


@pytest.mark.asyncio
async def test_1000_alerts_under_500ms():
    """Legacy test: Alert evaluation of 1000+ alerts completes within 500ms (NFR-003)"""
    mock_session = AsyncMock()

    # Mock async context manager
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create 1000 alerts with different thresholds
    alerts = []
    for i in range(1000):
        alert = Alert(
            id=i + 1,
            symbol_id=1,
            condition=AlertCondition.CROSSES_UP.value,
            threshold=100.0 + i * 0.1,  # Different thresholds
            is_active=True
        )
        alerts.append(alert)

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = alerts
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Measure time to evaluate 1000 alerts
    start_time = time.perf_counter()
    triggered = await engine.evaluate_symbol_alerts(1, 150.0, previous_price=100.0)
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    # Performance budget: 500ms for 1000+ alerts
    assert elapsed_ms < 500, f"Alert evaluation took {elapsed_ms:.2f}ms, budget is 500ms"

    # All alerts should trigger since price crosses all thresholds
    assert len(triggered) == 1000
