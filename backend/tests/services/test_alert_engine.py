import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.alert_engine import AlertEngine
from app.models.alert import Alert
from app.models.candle import Candle
from app.core.enums import AlertCondition
from datetime import datetime, timezone


# T035 [US2] Test alert above condition
@pytest.mark.asyncio
async def test_alert_above_triggers():
    """Test: above triggers when current > threshold AND previous <= threshold"""
    mock_session = AsyncMock()

    # Mock async context manager
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Alert: price above 150
    alert = Alert(
        id=1,
        symbol_id=1,
        condition=AlertCondition.ABOVE.value,
        threshold=150.0,
        is_active=True
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Should trigger: current=155 > 150, previous=145 <= 150
    triggered = await engine.evaluate_symbol_alerts(1, 155.0, previous_price=145.0)

    assert len(triggered) == 1
    assert triggered[0].id == 1


# T036 [US2] Test alert below condition
@pytest.mark.asyncio
async def test_alert_below_triggers():
    """Test: below triggers when current < threshold AND previous >= threshold"""
    mock_session = AsyncMock()

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Alert: price below 150
    alert = Alert(
        id=1,
        symbol_id=1,
        condition=AlertCondition.BELOW.value,
        threshold=150.0,
        is_active=True
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Should trigger: current=145 < 150, previous=155 >= 150
    triggered = await engine.evaluate_symbol_alerts(1, 145.0, previous_price=155.0)

    assert len(triggered) == 1
    assert triggered[0].id == 1


# T037 [US2] Test crosses_up condition
@pytest.mark.asyncio
async def test_alert_crosses_up_triggers():
    """Test: crosses_up triggers when previous < threshold AND current >= threshold"""
    mock_session = AsyncMock()

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Alert: crosses up 150
    alert = Alert(
        id=1,
        symbol_id=1,
        condition=AlertCondition.CROSSES_UP.value,
        threshold=150.0,
        is_active=True
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Should trigger: previous=145 < 150, current=155 >= 150
    triggered = await engine.evaluate_symbol_alerts(1, 155.0, previous_price=145.0)

    assert len(triggered) == 1
    assert triggered[0].id == 1


# T038 [US2] Test crosses_down condition
@pytest.mark.asyncio
async def test_alert_crosses_down_triggers():
    """Test: crosses_down triggers when previous > threshold AND current <= threshold"""
    mock_session = AsyncMock()

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Alert: crosses down 150
    alert = Alert(
        id=1,
        symbol_id=1,
        condition=AlertCondition.CROSSES_DOWN.value,
        threshold=150.0,
        is_active=True
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Should trigger: previous=155 > 150, current=145 <= 150
    triggered = await engine.evaluate_symbol_alerts(1, 145.0, previous_price=155.0)

    assert len(triggered) == 1
    assert triggered[0].id == 1


# T039 [US2] Test exact price edge case
@pytest.mark.asyncio
async def test_alert_crosses_exact_price():
    """Test: crosses conditions trigger when price exactly equals threshold"""
    mock_session = AsyncMock()

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Alert: crosses up 150
    alert = Alert(
        id=1,
        symbol_id=1,
        condition=AlertCondition.CROSSES_UP.value,
        threshold=150.0,
        is_active=True
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Should trigger: previous=145 < 150, current=150 == 150 (inclusive)
    triggered = await engine.evaluate_symbol_alerts(1, 150.0, previous_price=145.0)

    assert len(triggered) == 1
    assert triggered[0].id == 1


# T040 [US2] Test price oscillations with direction changes
@pytest.mark.asyncio
async def test_alert_oscillations():
    """Test: alerts handle price oscillations with direction changes correctly"""
    mock_session = AsyncMock()

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Alert: crosses up 150
    alert = Alert(
        id=1,
        symbol_id=1,
        condition=AlertCondition.CROSSES_UP.value,
        threshold=150.0,
        is_active=True,
        cooldown=1  # 1 minute cooldown - minimum
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # Price oscillates around threshold: 148 -> 152 -> 148
    # First crossing: 148 -> 152 (should trigger)
    triggered1 = await engine.evaluate_symbol_alerts(1, 152.0, previous_price=148.0)
    assert len(triggered1) == 1

    # Reverse crossing: 152 -> 148 (should NOT trigger - crosses_down)
    triggered2 = await engine.evaluate_symbol_alerts(1, 148.0, previous_price=152.0)
    assert len(triggered2) == 0

    # Back to up crossing: 148 -> 152 (should NOT trigger - cooldown blocks this)
    triggered3 = await engine.evaluate_symbol_alerts(1, 152.0, previous_price=148.0)
    assert len(triggered3) == 0  # Cooldown blocks (minimum 1 minute)


# TXXX Test minimum cooldown enforcement (cooldown now in minutes)
@pytest.mark.asyncio
async def test_alert_minimum_cooldown():
    """Test: alerts enforce minimum 1-minute cooldown"""
    mock_session = AsyncMock()

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Alert with no explicit cooldown (should default to 1 minute minimum)
    alert = Alert(
        id=1,
        symbol_id=1,
        condition=AlertCondition.CROSSES_UP.value,
        threshold=150.0,
        is_active=True
        # No cooldown set - will use minimum 1 minute (60 seconds)
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    # First crossing: should trigger
    triggered1 = await engine.evaluate_symbol_alerts(1, 152.0, previous_price=148.0)
    assert len(triggered1) == 1

    # Immediate second crossing: should NOT trigger due to minimum 1-minute cooldown
    triggered2 = await engine.evaluate_symbol_alerts(1, 152.0, previous_price=148.0)
    assert len(triggered2) == 0  # Cooldown blocks this


# Original tests - keep for backward compatibility
@pytest.mark.asyncio
async def test_evaluate_alerts_triggers():
    mock_session = AsyncMock()

    # Mock async context manager
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Active alert: IBM price above 150
    alert = Alert(id=1, symbol_id=1, condition="above", threshold=150.0, is_active=True)

    # Mock query for active alerts
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    triggered = await engine.evaluate_symbol_alerts(1, 155.0)

    assert len(triggered) == 1
    assert triggered[0].id == 1

@pytest.mark.asyncio
async def test_evaluate_alerts_not_triggered():
    mock_session = AsyncMock()

    # Mock async context manager
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # IBM price above 150, but current price is 145
    alert = Alert(id=1, symbol_id=1, condition="above", threshold=150.0, is_active=True)

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result

    engine = AlertEngine(mock_factory)

    triggered = await engine.evaluate_symbol_alerts(1, 145.0)

    assert len(triggered) == 0
