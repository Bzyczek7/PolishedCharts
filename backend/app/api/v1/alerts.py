from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from app.db.session import get_db
from app.models.alert import Alert
from app.models.alert_trigger import AlertTrigger
from app.schemas.alert import AlertCreate, AlertUpdate, AlertResponse, AlertTrigger as AlertTriggerSchema
from app.core.enums import AlertCondition
from app.services.indicator_registry.registry import get_registry

router = APIRouter()


@router.post("/", response_model=AlertResponse, status_code=201)
async def create_alert(alert_in: AlertCreate, db: AsyncSession = Depends(get_db)):
    """
    Create a new price alert or indicator-based alert.

    Price Conditions:
    - above: Triggers when current > threshold AND previous <= threshold
    - below: Triggers when current < threshold AND previous >= threshold
    - crosses_up: Triggers when previous < threshold AND current >= threshold
    - crosses_down: Triggers when previous > threshold AND current <= threshold

    Indicator Conditions:
    - indicator_crosses_upper: Triggers when indicator crosses above threshold
    - indicator_crosses_lower: Triggers when indicator crosses below threshold
    - indicator_turns_positive: Triggers when indicator turns positive (enters bullish zone)
    - indicator_turns_negative: Triggers when indicator turns negative (enters bearish zone)
    - indicator_slope_bullish: Triggers when indicator slope turns positive
    - indicator_slope_bearish: Triggers when indicator slope turns negative
    - indicator_signal_change: Triggers when discrete signal value changes
    """
    # Validate condition is a valid AlertCondition
    try:
        AlertCondition(alert_in.condition)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid condition '{alert_in.condition}'. Must be one of: {[c.value for c in AlertCondition]}"
        )

    alert = Alert(
        symbol_id=alert_in.symbol_id,
        condition=alert_in.condition.value if isinstance(alert_in.condition, AlertCondition) else alert_in.condition,
        threshold=alert_in.threshold,
        is_active=alert_in.is_active,
        cooldown=alert_in.cooldown,
        # Indicator fields
        indicator_name=alert_in.indicator_name,
        indicator_field=alert_in.indicator_field,
        indicator_params=alert_in.indicator_params
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


@router.get("/", response_model=List[AlertResponse])
async def list_alerts(
    symbol_id: Optional[int] = Query(None, description="Filter by symbol ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db)
):
    """List all alerts, optionally filtered by symbol and active status."""
    query = select(Alert)

    if symbol_id is not None:
        query = query.where(Alert.symbol_id == symbol_id)
    if is_active is not None:
        query = query.where(Alert.is_active == is_active)

    query = query.order_by(Alert.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific alert by ID."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalars().first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return alert


@router.put("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: int,
    alert_in: AlertUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an existing alert."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalars().first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Validate condition if provided
    if alert_in.condition is not None:
        try:
            AlertCondition(alert_in.condition)
            alert.condition = alert_in.condition.value if isinstance(alert_in.condition, AlertCondition) else alert_in.condition
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid condition '{alert_in.condition}'. Must be one of: {[c.value for c in AlertCondition]}"
            )

    # Update fields
    if alert_in.threshold is not None:
        alert.threshold = alert_in.threshold
    if alert_in.is_active is not None:
        alert.is_active = alert_in.is_active
    if alert_in.cooldown is not None:
        alert.cooldown = alert_in.cooldown

    await db.commit()
    await db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an alert."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalars().first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    await db.delete(alert)
    await db.commit()
    return None


@router.get("/{alert_id}/triggers", response_model=List[AlertTriggerSchema])
async def get_alert_triggers(
    alert_id: int,
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of triggers to return"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get trigger history for a specific alert.

    Returns a list of when this alert has fired, including the observed price at trigger time.
    """
    # Verify alert exists
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Get triggers
    query = select(AlertTrigger).where(
        AlertTrigger.alert_id == alert_id
    ).order_by(
        AlertTrigger.triggered_at.desc()
    ).limit(limit)

    result = await db.execute(query)
    triggers = result.scalars().all()
    return triggers


@router.get("/triggers/recent", response_model=List[AlertTriggerSchema])
async def get_recent_triggers(
    symbol_id: Optional[int] = Query(None, description="Filter by symbol ID"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of triggers to return"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get recent alert triggers across all alerts.

    Optionally filter by symbol to see recent triggers for specific symbols.
    """
    query = select(AlertTrigger)

    if symbol_id is not None:
        # Join with alerts table to filter by symbol_id
        query = query.join(Alert, AlertTrigger.alert_id == Alert.id).where(Alert.symbol_id == symbol_id)

    query = query.order_by(AlertTrigger.triggered_at.desc()).limit(limit)

    result = await db.execute(query)
    triggers = result.scalars().all()
    return triggers


@router.get("/indicator-conditions")
async def get_indicator_conditions(
    indicator_name: str = Query(..., description="Name of the indicator")
) -> Dict[str, Any]:
    """
    Get available alert conditions for a specific indicator.

    Returns the alert templates that define which conditions can be used
    with this indicator (e.g., crosses_upper, turns_positive, slope_bullish).

    Each condition includes:
    - condition_type: The alert condition enum value
    - label: Human-readable name for the condition
    - description: What the condition does
    - applicable_fields: Which indicator fields this condition applies to
    - requires_threshold: Whether this condition needs a threshold value
    """
    registry = get_registry()
    indicator = registry.get(indicator_name)

    if indicator is None:
        raise HTTPException(
            status_code=404,
            detail=f"Indicator '{indicator_name}' not found. Available indicators: {[ind.name for ind in registry._indicators.values()]}"
        )

    # Convert alert templates to response format
    conditions = [
        {
            "condition_type": template.condition_type,
            "label": template.label,
            "description": template.description,
            "requires_threshold": template.requires_threshold,
            "applicable_fields": template.applicable_fields
        }
        for template in indicator.alert_templates
    ]

    return {
        "indicator_name": indicator_name,
        "conditions": conditions
    }
