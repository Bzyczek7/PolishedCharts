from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging
from app.db.session import get_db
from app.models.alert import Alert
from app.models.alert_trigger import AlertTrigger
from app.models.symbol import Symbol
from app.schemas.alert import AlertCreate, AlertUpdate, AlertResponse, AlertTrigger as AlertTriggerSchema
from app.core.enums import AlertCondition
from app.services.indicator_registry.registry import get_registry
from app.api.decorators import public_endpoint

logger = logging.getLogger(__name__)
router = APIRouter()


async def _add_alert_label(alert: Alert, response: dict) -> dict:
    """Add computed alert_label to response dictionary."""
    response['alert_label'] = alert.alert_label
    return response


async def _add_trigger_alert_labels(triggers: List[AlertTrigger], db: AsyncSession) -> List[dict]:
    """Add alert_label to trigger events by joining with alerts."""
    result = []
    for trigger in triggers:
        trigger_dict = {
            'id': trigger.id,
            'alert_id': trigger.alert_id,
            'triggered_at': trigger.triggered_at,
            'observed_price': trigger.observed_price,
            'indicator_value': trigger.indicator_value,
            'trigger_type': trigger.trigger_type,
            'trigger_message': trigger.trigger_message,
            'delivery_status': trigger.delivery_status,
            'retry_count': trigger.retry_count,
            'last_retry_at': trigger.last_retry_at,
            'alert_label': None  # Will be populated below
        }
        # Fetch alert to compute label
        alert_result = await db.execute(select(Alert).where(Alert.id == trigger.alert_id))
        alert = alert_result.scalars().first()
        if alert:
            trigger_dict['alert_label'] = alert.alert_label
        result.append(trigger_dict)
    return result


@router.post("/", response_model=AlertResponse, status_code=201)
@public_endpoint
async def create_alert(
    alert_in: AlertCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new price alert or indicator-based alert.

    Supports both symbol_id (int) and symbol (string) - if symbol is provided,
    it will be resolved to symbol_id automatically.

    Price Conditions:
    - above: Triggers when current > threshold AND previous <= threshold
    - below: Triggers when current < threshold AND previous >= threshold
    - crosses_up: Triggers when previous < threshold AND current >= threshold
    - crosses_down: Triggers when previous > threshold AND current <= threshold

    Indicator Conditions (cRSI only in initial implementation):
    - indicator_crosses_upper: Triggers when indicator crosses above threshold (upper band)
    - indicator_crosses_lower: Triggers when indicator crosses below threshold (lower band)

    For indicator-based alerts:
    - messages: Flexible map of condition_type to message (e.g., {"indicator_crosses_upper": "Sell!"})
    - message_upper/message_lower: Legacy cRSI format (for backward compatibility)
    - enabled_conditions: Which conditions are enabled (e.g., {"upper": true, "lower": true})
    - cooldown: Minimum 5 seconds, default 60 seconds
    """
    # Validate condition is a valid AlertCondition
    try:
        AlertCondition(alert_in.condition)
    except ValueError:
        logger.warning(f"Invalid condition: {alert_in.condition}")
        raise HTTPException(
            status_code=422,
            detail=f"Invalid condition '{alert_in.condition}'. Must be one of: {[c.value for c in AlertCondition]}"
        )

    # Log the incoming data for debugging
    logger.info(f"Creating alert: symbol={alert_in.symbol}, condition={alert_in.condition}, indicator_name={alert_in.indicator_name}")

    # Resolve symbol to symbol_id if symbol string is provided
    symbol_id = alert_in.symbol_id
    symbol_ticker = None
    if symbol_id is None:
        # Try to resolve symbol string to symbol_id
        if alert_in.symbol:
            symbol_result = await db.execute(select(Symbol).where(Symbol.ticker == alert_in.symbol.upper()))
            symbol_obj = symbol_result.scalars().first()
            if symbol_obj:
                symbol_id = symbol_obj.id
                symbol_ticker = symbol_obj.ticker
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Symbol '{alert_in.symbol}' not found"
                )
        else:
            raise HTTPException(
                status_code=422,
                detail="Either symbol_id or symbol must be provided"
            )

    alert = Alert(
        symbol_id=symbol_id,
        condition=alert_in.condition.value if isinstance(alert_in.condition, AlertCondition) else alert_in.condition,
        threshold=alert_in.threshold,
        is_active=alert_in.is_active,
        interval=alert_in.interval,
        cooldown=alert_in.cooldown,
        # Indicator fields
        indicator_name=alert_in.indicator_name,
        indicator_field=alert_in.indicator_field,
        indicator_params=alert_in.indicator_params,
        # Message fields - use messages if provided, otherwise fall back to legacy format
        messages=alert_in.messages,
        message_upper=alert_in.message_upper,
        message_lower=alert_in.message_lower,
        enabled_conditions=alert_in.enabled_conditions
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)

    # Return dict with symbol field populated (to avoid lazy loading issues)
    alert_dict = {**alert.__dict__, 'symbol': symbol_ticker}
    return alert_dict


@router.get("/", response_model=List[AlertResponse])
@public_endpoint
async def list_alerts(
    symbol_id: Optional[int] = Query(None, description="Filter by symbol ID"),
    symbol: Optional[str] = Query(None, description="Filter by symbol (preferred, simpler frontend)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db)
):
    """
    List all alerts, optionally filtered by symbol and active status.

    Note: symbol parameter (string) is preferred over symbol_id for simpler frontend integration.
    """
    query = select(Alert).options(selectinload(Alert.symbol_obj))

    # Support both symbol_id (int) and symbol (string) filtering
    if symbol_id is not None:
        query = query.where(Alert.symbol_id == symbol_id)
    elif symbol is not None:
        # Resolve symbol string to symbol_id
        symbol_result = await db.execute(select(Symbol).where(Symbol.ticker == symbol.upper()))
        symbol_obj = symbol_result.scalars().first()
        if symbol_obj:
            query = query.where(Alert.symbol_id == symbol_obj.id)
        else:
            # Symbol not found, return empty list
            return []

    if is_active is not None:
        query = query.where(Alert.is_active == is_active)

    query = query.order_by(Alert.created_at.desc())
    result = await db.execute(query)
    alerts = result.scalars().all()

    # Add symbol to each alert response (symbol_obj is now eagerly loaded)
    response_alerts = []
    for alert in alerts:
        alert_dict = {
            **alert.__dict__,
            'symbol': alert.symbol_obj.ticker if hasattr(alert, 'symbol_obj') and alert.symbol_obj else None
        }
        response_alerts.append(alert_dict)

    return response_alerts


@router.get("/indicator-conditions")
@public_endpoint
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
    indicator = registry.get_by_base_name(indicator_name)

    if indicator is None:
        raise HTTPException(
            status_code=404,
            detail=f"Indicator '{indicator_name}' not found. Available indicators: {[ind.base_name for ind in registry._indicators.values()]}"
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


@router.get("/triggers/recent", response_model=List[AlertTriggerSchema])
@public_endpoint
async def get_recent_triggers(
    symbol_id: Optional[int] = Query(None, description="Filter by symbol ID"),
    symbol: Optional[str] = Query(None, description="Filter by symbol (preferred, simpler frontend)"),
    limit: int = Query(500, ge=1, le=1000, description="Maximum number of triggers to return"),
    offset: int = Query(0, ge=0, description="Number of triggers to skip (for pagination)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get recent alert triggers across all alerts for the global Log tab.

    Returns triggers in reverse chronological order (newest first).
    Optionally filter by symbol to see triggers for specific symbols.

    Response includes:
    - trigger_type: Which condition fired ("upper" or "lower")
    - trigger_message: The direction-specific message used
    - alert_label: Computed label for display
    """
    query = select(AlertTrigger)

    # Support both symbol_id (int) and symbol (string) filtering
    if symbol_id is not None:
        query = query.join(Alert, AlertTrigger.alert_id == Alert.id).where(Alert.symbol_id == symbol_id)
    elif symbol is not None:
        # Resolve symbol string to symbol_id
        symbol_result = await db.execute(select(Symbol).where(Symbol.ticker == symbol.upper()))
        symbol_obj = symbol_result.scalars().first()
        if symbol_obj:
            query = query.join(Alert, AlertTrigger.alert_id == Alert.id).where(Alert.symbol_id == symbol_obj.id)
        else:
            # Symbol not found, return empty list
            return []

    query = query.order_by(AlertTrigger.triggered_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    triggers = result.scalars().all()

    # trigger_type and trigger_message are now stored in the database
    # alert_label will be computed by Pydantic from the Alert model relationship
    return triggers


@router.get("/{alert_id}", response_model=AlertResponse)
@public_endpoint
async def get_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific alert by ID."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalars().first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return alert


@router.put("/{alert_id}", response_model=AlertResponse)
@public_endpoint
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
    if alert_in.message_upper is not None:
        alert.message_upper = alert_in.message_upper
    if alert_in.message_lower is not None:
        alert.message_lower = alert_in.message_lower
    if alert_in.enabled_conditions is not None:
        alert.enabled_conditions = alert_in.enabled_conditions
    if alert_in.indicator_params is not None:
        alert.indicator_params = alert_in.indicator_params

    await db.commit()
    await db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=204)
@public_endpoint
async def delete_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete an alert and all its trigger history (cascade delete)."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalars().first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    await db.delete(alert)
    await db.commit()
    return None


@router.post("/{alert_id}/mute", response_model=AlertResponse)
@public_endpoint
async def mute_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Mute an alert (prevent it from creating trigger events)."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalars().first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_active = False
    await db.commit()
    await db.refresh(alert)
    return alert


@router.post("/{alert_id}/unmute", response_model=AlertResponse)
@public_endpoint
async def unmute_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Unmute an alert (allow it to create trigger events again)."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalars().first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_active = True
    await db.commit()
    await db.refresh(alert)
    return alert


@router.get("/{alert_id}/triggers", response_model=List[AlertTriggerSchema])
@public_endpoint
async def get_alert_triggers(
    alert_id: int,
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of triggers to return"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get trigger history for a specific alert.

    Returns a list of when this alert has fired, including:
    - trigger_type: Which condition fired ("upper" or "lower")
    - trigger_message: The direction-specific message used
    - alert_label: Computed label for display
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

    # trigger_type and trigger_message are now stored in the database
    # alert_label will be computed by Pydantic from the Alert model
    return triggers


@router.delete("/triggers/{trigger_id}", status_code=204)
@public_endpoint
async def delete_trigger(
    trigger_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a specific alert trigger (log entry).

    This allows users to remove individual trigger entries from the log,
    useful for cleaning up orphaned or unwanted trigger records.
    """
    result = await db.execute(select(AlertTrigger).where(AlertTrigger.id == trigger_id))
    trigger = result.scalars().first()

    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")

    await db.delete(trigger)
    await db.commit()
    return None


