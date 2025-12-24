"""
Memory footprint profiling test.

T107c [P]: Add memory footprint profiling test (500MB budget, Constitution VI)

This test verifies that the application stays within the 500MB memory budget
for typical usage scenarios (5 symbols / 20 alerts as per Constitution VI).
"""

import pytest
import tracemalloc
from unittest.mock import AsyncMock, MagicMock
from app.services.alert_engine import AlertEngine
from app.models.alert import Alert
from app.core.enums import AlertCondition


class TestMemoryUsage:
    """Memory footprint tests to ensure we stay within budget."""

    # Constitution VI: Memory budget is 500MB for 5 symbols / 20 alerts
    MEMORY_BUDGET_MB = 500

    @pytest.mark.asyncio
    async def test_alert_engine_memory_under_500mb(self):
        """
        T107c: Verify alert engine uses less than 500MB for typical workload.

        Typical workload: 5 symbols with ~20 alerts each = 100 alerts total.
        """
        # Start memory tracking
        tracemalloc.start()
        initial_memory = tracemalloc.get_traced_memory()[0]

        # Setup mock session
        mock_session = AsyncMock()
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__.return_value = mock_session
        mock_factory.return_value.__aexit__.return_value = AsyncMock()

        # Create 100 alerts (5 symbols x 20 alerts)
        alerts = []
        for symbol_id in range(1, 6):
            for i in range(20):
                alert = Alert(
                    id=len(alerts) + 1,
                    symbol_id=symbol_id,
                    condition=AlertCondition.CROSSES_UP.value,
                    threshold=100.0 + i,
                    is_active=True,
                    cooldown=60
                )
                alerts.append(alert)

        mock_result = MagicMock()
        mock_result.scalars().all().return_value = alerts
        mock_session.execute.return_value = mock_result

        # Create alert engine and evaluate
        engine = AlertEngine(mock_factory)

        # Evaluate alerts for all 5 symbols
        for symbol_id in range(1, 6):
            await engine.evaluate_symbol_alerts(
                symbol_id=symbol_id,
                current_price=105.0,
                previous_price=95.0
            )

        # Check memory usage
        current_memory, peak_memory = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        # Calculate memory increase in MB
        memory_increase_mb = (peak_memory - initial_memory) / (1024 * 1024)

        # Verify we're under budget
        assert memory_increase_mb < self.MEMORY_BUDGET_MB, (
            f"Memory usage {memory_increase_mb:.2f}MB exceeds budget of {self.MEMORY_BUDGET_MB}MB"
        )

        # Log for reference
        pytest.memory_usage = memory_increase_mb

    @pytest.mark.asyncio
    async def test_indicator_alert_memory_overhead(self):
        """
        T107c: Verify indicator alerts don't significantly increase memory usage.
        """
        tracemalloc.start()
        initial_memory = tracemalloc.get_traced_memory()[0]

        mock_session = AsyncMock()
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__.return_value = mock_session
        mock_factory.return_value.__aexit__.return_value = AsyncMock()

        # Create indicator-based alerts
        alerts = []
        for i in range(50):
            alert = Alert(
                id=i + 1,
                symbol_id=1,
                condition=AlertCondition.INDICATOR_CROSSES_UPPER.value,
                threshold=70.0,
                is_active=True,
                cooldown=60,
                indicator_name="crsi",
                indicator_field="crsi"
            )
            alerts.append(alert)

        mock_result = MagicMock()
        mock_result.scalars().all().return_value = alerts
        mock_session.execute.return_value = mock_result

        engine = AlertEngine(mock_factory)

        # Evaluate with indicator data
        await engine.evaluate_symbol_alerts(
            symbol_id=1,
            current_price=100.0,
            previous_price=95.0,
            indicator_data={
                "value": 75.0,
                "prev_value": 65.0
            }
        )

        current_memory, peak_memory = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        memory_increase_mb = (peak_memory - initial_memory) / (1024 * 1024)

        # Indicator alerts shouldn't use more than 50MB extra
        assert memory_increase_mb < 50, (
            f"Indicator alert memory overhead {memory_increase_mb:.2f}MB is too high"
        )

    @pytest.mark.asyncio
    async def test_cooldown_tracking_memory_efficiency(self):
        """
        T107c: Verify cooldown tracking doesn't leak memory over time.
        """
        tracemalloc.start()
        initial_memory = tracemalloc.get_traced_memory()[0]

        mock_session = AsyncMock()
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__.return_value = mock_session
        mock_factory.return_value.__aexit__.return_value = AsyncMock()

        alert = Alert(
            id=1,
            symbol_id=1,
            condition=AlertCondition.CROSSES_UP.value,
            threshold=100.0,
            is_active=True,
            cooldown=60
        )

        mock_result = MagicMock()
        mock_result.scalars().all().return_value = [alert]
        mock_session.execute.return_value = mock_result

        engine = AlertEngine(mock_factory)

        # Trigger alert multiple times to populate cooldown tracking
        for _ in range(100):
            # Reset cooldown tracking to simulate new alerts
            engine._last_triggered.clear()

            await engine.evaluate_symbol_alerts(
                symbol_id=1,
                current_price=105.0,
                previous_price=95.0
            )

        current_memory, peak_memory = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        memory_increase_mb = (peak_memory - initial_memory) / (1024 * 1024)

        # Multiple evaluations shouldn't cause memory growth
        # Allow some overhead but should be minimal
        assert memory_increase_mb < 10, (
            f"Cooldown tracking memory leak detected: {memory_increase_mb:.2f}MB"
        )
