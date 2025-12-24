"""Integration test for full alert flow."""
# T076 [Polish] Integration test: Create alert, price update, trigger, verify history

import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.symbol import Symbol
from app.models.alert import Alert
from app.models.alert_trigger import AlertTrigger
from app.models.candle import Candle
from app.core.enums import AlertCondition
from app.services.alert_engine import AlertEngine


@pytest.mark.asyncio
async def test_full_alert_flow(db_session: AsyncSession, db_session_factory):
    """
    Test: Complete alert flow from creation to trigger to history verification.

    Steps:
    1. Create a symbol
    2. Create an alert (crosses_up threshold=200)
    3. Simulate price update that triggers alert (150 -> 205)
    4. Verify AlertTrigger record was created
    5. Verify trigger history shows the alert fired
    """
    # Step 1: Create symbol
    symbol = Symbol(ticker="FLOW", name="Flow Test")
    db_session.add(symbol)
    await db_session.commit()
    await db_session.refresh(symbol)

    # Step 2: Create alert
    alert = Alert(
        symbol_id=symbol.id,
        condition=AlertCondition.CROSSES_UP.value,
        threshold=200.0,
        is_active=True,
        cooldown=None
    )
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)

    # Step 3: Simulate price update that triggers alert
    # Previous price was 150, current price is 205 (crosses above 200)
    engine = AlertEngine(db_session_factory)
    triggered_alerts = await engine.evaluate_symbol_alerts(
        symbol_id=symbol.id,
        current_price=205.0,
        previous_price=150.0
    )

    # Verify alert triggered
    assert len(triggered_alerts) == 1
    assert triggered_alerts[0].id == alert.id

    # Step 4: Verify AlertTrigger record was created
    stmt = select(AlertTrigger).where(AlertTrigger.alert_id == alert.id)
    result = await db_session.execute(stmt)
    triggers = result.scalars().all()

    assert len(triggers) == 1
    trigger = triggers[0]
    assert trigger.alert_id == alert.id
    assert trigger.observed_price == 205.0
    assert trigger.triggered_at is not None

    # Step 5: Verify trigger history via get_alert_triggers
    # This would normally be called via the API endpoint
    stmt = select(AlertTrigger).where(
        AlertTrigger.alert_id == alert.id
    ).order_by(
        AlertTrigger.triggered_at.desc()
    )
    result = await db_session.execute(stmt)
    history = result.scalars().all()

    assert len(history) == 1
    assert history[0].observed_price == 205.0


@pytest.mark.asyncio
async def test_alert_does_not_trigger_without_crossing(db_session: AsyncSession, db_session_factory):
    """Test: Alert does not trigger when price doesn't cross threshold."""
    # Create symbol
    symbol = Symbol(ticker="NOFLOW", name="No Flow Test")
    db_session.add(symbol)
    await db_session.commit()
    await db_session.refresh(symbol)

    # Create alert: crosses_up at 200
    alert = Alert(
        symbol_id=symbol.id,
        condition=AlertCondition.CROSSES_UP.value,
        threshold=200.0,
        is_active=True,
        cooldown=None
    )
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)

    # Evaluate with price that doesn't cross (both below threshold)
    engine = AlertEngine(db_session_factory)
    triggered = await engine.evaluate_symbol_alerts(
        symbol_id=symbol.id,
        current_price=180.0,
        previous_price=175.0
    )

    # Should not trigger
    assert len(triggered) == 0

    # Verify no trigger records
    stmt = select(AlertTrigger).where(AlertTrigger.alert_id == alert.id)
    result = await db_session.execute(stmt)
    triggers = result.scalars().all()

    assert len(triggers) == 0


@pytest.mark.asyncio
async def test_alert_cooldown_prevents_duplicate_trigger(db_session: AsyncSession, db_session_factory):
    """Test: Alert cooldown prevents duplicate triggers within cooldown period."""
    # Create symbol
    symbol = Symbol(ticker="COOLDOWN", name="Cooldown Test")
    db_session.add(symbol)
    await db_session.commit()
    await db_session.refresh(symbol)

    # Create alert with 300 second cooldown
    alert = Alert(
        symbol_id=symbol.id,
        condition=AlertCondition.ABOVE.value,
        threshold=200.0,
        is_active=True,
        cooldown=300  # 5 minutes
    )
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)

    engine = AlertEngine(db_session_factory)

    # First trigger (150 -> 205)
    triggered1 = await engine.evaluate_symbol_alerts(
        symbol_id=symbol.id,
        current_price=205.0,
        previous_price=150.0
    )
    assert len(triggered1) == 1

    # Immediate second trigger should be suppressed by cooldown
    triggered2 = await engine.evaluate_symbol_alerts(
        symbol_id=symbol.id,
        current_price=210.0,
        previous_price=205.0
    )
    assert len(triggered2) == 0  # Cooldown active

    # Verify only one trigger record exists
    stmt = select(AlertTrigger).where(AlertTrigger.alert_id == alert.id)
    result = await db_session.execute(stmt)
    triggers = result.scalars().all()

    assert len(triggers) == 1
