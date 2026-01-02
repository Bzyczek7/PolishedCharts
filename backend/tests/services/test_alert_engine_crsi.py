"""Unit tests for cRSI band cross detection logic in AlertEngine."""
# T073 [Polish] Unit tests: cRSI band cross detection logic
# T074 [Polish] Unit tests: alert cooldown logic
# T075 [Polish] Integration test: multi-trigger edge case (both bands crossed)
# T076 [Polish] Integration test: mute preventing triggers

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.alert_engine import AlertEngine
from app.models.alert import Alert
from app.models.alert_trigger import AlertTrigger
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_crsi_upper_band_cross_detection():
    """T073: Test cRSI upper band cross detection logic."""
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create alert with cRSI configuration
    alert = Alert(
        id=1,
        symbol_id=1,
        condition="indicator_crosses_upper",
        threshold=70.0,
        is_active=True,
        enabled_conditions={"upper": True, "lower": False},
        message_upper="Time to sell!",
        message_lower="Time to buy!"
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Mock indicator data: crossing above upper band
    # prev_value=65 <= 70, current_value=75 > 70 -> should trigger upper
    indicator_data = {
        "value": 75.0,
        "prev_value": 65.0,
        "upper_band": 70.0,
        "lower_band": 30.0,
        "price": 150.0
    }

    triggered = await engine.evaluate_symbol_alerts(1, 150.0, indicator_data=indicator_data)

    assert len(triggered) == 1
    assert triggered[0].id == 1


@pytest.mark.asyncio
async def test_crsi_lower_band_cross_detection():
    """T073: Test cRSI lower band cross detection logic."""
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create alert with cRSI configuration
    alert = Alert(
        id=2,
        symbol_id=1,
        condition="indicator_crosses_lower",
        threshold=30.0,
        is_active=True,
        enabled_conditions={"upper": False, "lower": True},
        message_upper="Time to sell!",
        message_lower="Time to buy!"
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Mock indicator data: crossing below lower band
    # prev_value=35 >= 30, current_value=25 < 30 -> should trigger lower
    indicator_data = {
        "value": 25.0,
        "prev_value": 35.0,
        "upper_band": 70.0,
        "lower_band": 30.0,
        "price": 150.0
    }

    triggered = await engine.evaluate_symbol_alerts(1, 150.0, indicator_data=indicator_data)

    assert len(triggered) == 1
    assert triggered[0].id == 2


@pytest.mark.asyncio
async def test_crsi_both_bands_crossed_multi_trigger():
    """T075: Test multi-trigger edge case - both bands crossed in single evaluation."""
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create alert with both conditions enabled
    alert = Alert(
        id=3,
        symbol_id=1,
        condition="crsi_band_cross",
        threshold=0.0,  # Not used for band cross
        is_active=True,
        enabled_conditions={"upper": True, "lower": True},
        message_upper="Time to sell!",
        message_lower="Time to buy!"
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Mock indicator data: extreme case where both bands are crossed
    # This simulates a gap where prev_value=80 (above upper=70), current_value=20 (below lower=30)
    indicator_data = {
        "value": 20.0,      # Below lower band
        "prev_value": 80.0, # Above upper band
        "upper_band": 70.0,
        "lower_band": 30.0,
        "price": 150.0
    }

    triggered = await engine.evaluate_symbol_alerts(1, 150.0, indicator_data=indicator_data)

    # Should trigger once for the alert (but potentially create multiple triggers in DB)
    assert len(triggered) == 1
    assert triggered[0].id == 3


@pytest.mark.asyncio
async def test_crsi_no_cross_when_within_bands():
    """T073: Test cRSI does not trigger when values stay within bands."""
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create alert with cRSI configuration
    alert = Alert(
        id=4,
        symbol_id=1,
        condition="indicator_crosses_upper",
        threshold=70.0,
        is_active=True,
        enabled_conditions={"upper": True, "lower": True},
        message_upper="Time to sell!",
        message_lower="Time to buy!"
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Mock indicator data: no cross, just moving within bounds
    # prev_value=60, current_value=65 -> both within bands, no cross
    indicator_data = {
        "value": 65.0,
        "prev_value": 60.0,
        "upper_band": 70.0,
        "lower_band": 30.0,
        "price": 150.0
    }

    triggered = await engine.evaluate_symbol_alerts(1, 150.0, indicator_data=indicator_data)

    assert len(triggered) == 0


@pytest.mark.asyncio
async def test_crsi_upper_cross_disabled():
    """T073: Test cRSI does not trigger upper when upper condition is disabled."""
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create alert with only lower enabled
    alert = Alert(
        id=5,
        symbol_id=1,
        condition="indicator_crosses_upper",
        threshold=70.0,
        is_active=True,
        enabled_conditions={"upper": False, "lower": True},
        message_upper="Time to sell!",
        message_lower="Time to buy!"
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Mock indicator data: would cross upper band, but upper is disabled
    indicator_data = {
        "value": 75.0,
        "prev_value": 65.0,
        "upper_band": 70.0,
        "lower_band": 30.0,
        "price": 150.0
    }

    triggered = await engine.evaluate_symbol_alerts(1, 150.0, indicator_data=indicator_data)

    assert len(triggered) == 0


@pytest.mark.asyncio
async def test_alert_cooldown_prevents_triggers():
    """T074: Test alert cooldown prevents triggers within cooldown period."""
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create alert with 300 second cooldown
    alert = Alert(
        id=6,
        symbol_id=1,
        condition="above",
        threshold=200.0,
        is_active=True,
        cooldown=300  # 5 minutes
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # First trigger should work
    triggered1 = await engine.evaluate_symbol_alerts(1, 205.0, previous_price=150.0)
    assert len(triggered1) == 1

    # Second trigger immediately should be blocked by cooldown
    triggered2 = await engine.evaluate_symbol_alerts(1, 210.0, previous_price=205.0)
    assert len(triggered2) == 0


@pytest.mark.asyncio
async def test_alert_mute_prevents_triggers():
    """T076: Test muted alert does not create triggers."""
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create alert that is NOT active (muted)
    alert = Alert(
        id=7,
        symbol_id=1,
        condition="above",
        threshold=200.0,
        is_active=False,  # Muted
        cooldown=None
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Should not trigger because alert is muted
    triggered = await engine.evaluate_symbol_alerts(1, 205.0, previous_price=150.0)

    assert len(triggered) == 0


@pytest.mark.asyncio
async def test_crsi_exact_band_cross():
    """T073: Test cRSI exact cross detection (touching band)."""
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Create alert with cRSI configuration
    alert = Alert(
        id=8,
        symbol_id=1,
        condition="indicator_crosses_upper",
        threshold=70.0,
        is_active=True,
        enabled_conditions={"upper": True, "lower": False},
        message_upper="Time to sell!",
        message_lower="Time to buy!"
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Mock indicator data: exact cross (prev_value=65 <= 70, current_value=70 == 70)
    indicator_data = {
        "value": 70.0,
        "prev_value": 65.0,
        "upper_band": 70.0,
        "lower_band": 30.0,
        "price": 150.0
    }

    triggered = await engine.evaluate_symbol_alerts(1, 150.0, indicator_data=indicator_data)

    assert len(triggered) == 1
    assert triggered[0].id == 8