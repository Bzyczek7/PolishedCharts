"""
Performance test for alert trigger latency.

T107b [P]: Add alert trigger latency test (<2s requirement, SC-004)

This test verifies that alerts trigger within 2 seconds of the condition being met.
"""

import pytest
import time
from unittest.mock import AsyncMock, MagicMock
from app.services.alert_engine import AlertEngine
from app.models.alert import Alert
from app.core.enums import AlertCondition


@pytest.mark.asyncio
async def test_alert_trigger_latency_under_2s():
    """
    T107b: Verify alert triggers within 2 seconds of condition being met.

    Success Criteria (SC-004): Alerts must trigger within 2 seconds of the condition being met.
    """
    # Setup mock session
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create an alert that will trigger
    alert = Alert(
        id=1,
        symbol_id=1,
        condition=AlertCondition.CROSSES_UP.value,
        threshold=100.0,
        is_active=True,
        cooldown=0
    )

    mock_result = MagicMock()
    mock_result.scalars().all().return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Simulate alert condition being met
    # Start measuring from when condition is met (when we call evaluate)
    start_time = time.perf_counter()

    triggered = await engine.evaluate_symbol_alerts(
        symbol_id=1,
        current_price=105.0,  # Above threshold
        previous_price=95.0   # Below threshold (crosses up)
    )

    latency_ms = (time.perf_counter() - start_time) * 1000

    # Verify alert triggered
    assert len(triggered) == 1, "Alert should have triggered"

    # Verify latency is under 2 seconds (2000ms)
    # In practice, this should be much faster (milliseconds), but SC-004 sets the floor at 2s
    assert latency_ms < 2000, f"Alert trigger latency {latency_ms:.2f}ms exceeds 2s requirement"


@pytest.mark.asyncio
async def test_indicator_alert_latency_under_2s():
    """
    T107b: Verify indicator-based alerts trigger within 2 seconds.
    """
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create an indicator-based alert
    alert = Alert(
        id=1,
        symbol_id=1,
        condition=AlertCondition.INDICATOR_CROSSES_UPPER.value,
        threshold=70.0,
        is_active=True,
        cooldown=0,
        indicator_name="crsi",
        indicator_field="crsi"
    )

    mock_result = MagicMock()
    mock_result.scalars().all().return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    start_time = time.perf_counter()

    triggered = await engine.evaluate_symbol_alerts(
        symbol_id=1,
        current_price=100.0,
        previous_price=95.0,
        indicator_data={
            "value": 75.0,   # Above threshold
            "prev_value": 65.0  # Below threshold (crosses up)
        }
    )

    latency_ms = (time.perf_counter() - start_time) * 1000

    assert len(triggered) == 1, "Indicator alert should have triggered"
    assert latency_ms < 2000, f"Indicator alert latency {latency_ms:.2f}ms exceeds 2s requirement"


@pytest.mark.asyncio
async def test_multiple_alerts_latency_under_2s():
    """
    T107b: Verify multiple alerts all trigger within 2 seconds even when processing many.
    """
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create 100 alerts
    alerts = []
    for i in range(100):
        alert = Alert(
            id=i + 1,
            symbol_id=1,
            condition=AlertCondition.CROSSES_UP.value,
            threshold=100.0 + i * 0.5,
            is_active=True,
            cooldown=0
        )
        alerts.append(alert)

    mock_result = MagicMock()
    mock_result.scalars().all().return_value = alerts
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    start_time = time.perf_counter()

    triggered = await engine.evaluate_symbol_alerts(
        symbol_id=1,
        current_price=200.0,  # Well above all thresholds
        previous_price=50.0   # Well below all thresholds
    )

    latency_ms = (time.perf_counter() - start_time) * 1000

    # All 100 alerts should trigger
    assert len(triggered) == 100, f"Expected 100 triggered alerts, got {len(triggered)}"

    # Even with 100 alerts, should still be under 2 seconds
    assert latency_ms < 2000, f"Multiple alerts latency {latency_ms:.2f}ms exceeds 2s requirement"
