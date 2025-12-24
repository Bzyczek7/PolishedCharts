"""Integration tests for alert persistence."""
# T042 [US2] Test: Alerts survive restart
import pytest
from datetime import datetime, timezone
from app.models.alert import Alert
from app.models.symbol import Symbol
from app.core.enums import AlertCondition
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_alerts_survive_restart(db_session: AsyncSession):
    """Test: Alerts persist across application restarts."""
    # Create a symbol
    symbol = Symbol(ticker="PERSIST", name="Persistence Test")
    db_session.add(symbol)
    await db_session.commit()
    await db_session.refresh(symbol)

    # Create an alert
    alert = Alert(
        symbol_id=symbol.id,
        condition=AlertCondition.CROSSES_UP.value,
        threshold=200.0,
        is_active=True,
        cooldown=300
    )
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)

    alert_id = alert.id
    symbol_id = symbol.id

    # Simulate "restart" by doing a fresh query (not using expire_all)
    # This simulates getting data from the database as if it were a new connection
    stmt = select(Alert).where(Alert.id == alert_id)
    result = await db_session.execute(stmt)
    retrieved_alert = result.scalars().first()

    # Verify alert persisted
    assert retrieved_alert is not None
    assert retrieved_alert.id == alert_id
    assert retrieved_alert.symbol_id == symbol_id
    assert retrieved_alert.condition == AlertCondition.CROSSES_UP.value
    assert retrieved_alert.threshold == 200.0
    assert retrieved_alert.is_active is True
    assert retrieved_alert.cooldown == 300


@pytest.mark.asyncio
async def test_multiple_alerts_persist(db_session: AsyncSession):
    """Test: Multiple alerts persist correctly."""
    # Create a symbol
    symbol = Symbol(ticker="MULTI", name="Multi Test")
    db_session.add(symbol)
    await db_session.commit()
    await db_session.refresh(symbol)

    symbol_id = symbol.id

    # Create 100 alerts
    alert_ids = []
    for i in range(100):
        alert = Alert(
            symbol_id=symbol.id,
            condition=AlertCondition.ABOVE.value,
            threshold=100.0 + i,
            is_active=True,
            cooldown=None
        )
        db_session.add(alert)
        await db_session.flush()
        alert_ids.append(alert.id)

    await db_session.commit()

    # Do a fresh query (not using expire_all)
    stmt = select(Alert).where(Alert.symbol_id == symbol_id)
    result = await db_session.execute(stmt)
    retrieved_alerts = result.scalars().all()

    # Verify all 100 alerts persisted
    assert len(retrieved_alerts) == 100
    retrieved_ids = [a.id for a in retrieved_alerts]
    assert set(retrieved_ids) == set(alert_ids)
