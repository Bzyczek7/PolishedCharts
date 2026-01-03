"""
Notifications API Router

Provides endpoints for:
- Global notification preferences (toast, sound, Telegram)
- Per-alert notification settings overrides
- Notification history (delivery records)
- Telegram credential validation and testing
- Internal notification triggering

All endpoints follow FR-AUTHZ requirements:
- FR-AUTHZ-001: Users can only access their own notification data
- FR-AUTHZ-002: All endpoints verify ownership before operations
- FR-AUTHZ-003: 401 for guests, 403 for authenticated users accessing others' data

Base URL: /api/v1/notifications
"""

import logging
from typing import Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse,
    NotificationSettingsResponse,
    AlertNotificationSettingsCreate,
    AlertNotificationSettingsUpdate,
    AlertNotificationSettingsResponse,
    NotificationDeliveryListResponse,
    NotificationDeliveryResponse,
    TelegramCredentialsValidate,
    TelegramValidationResult,
    TelegramTestResult,
    SendNotificationRequest,
    SendNotificationResponse,
    NotificationType,
    DeliveryStatus,
)
from app.services.auth_middleware import get_current_user
from app.services.notification_service import (
    get_user_preference,
    create_or_update_preference,
    get_telegram_config,
    get_alert_notification_settings as get_alert_notification_settings_svc,
    create_or_update_alert_settings,
    get_notification_history,
    log_notification_delivery,
)
from app.services.telegram_service import (
    validate_telegram_credentials,
    send_telegram_message,
    TelegramError,
)
from app.api.dependencies import check_notification_ownership

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Settings Endpoints
# =============================================================================

@router.get("/settings", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationSettingsResponse:
    """
    Get user's complete notification settings.

    Returns:
        - User's global notification preferences
        - Whether Telegram is configured (has encrypted credentials)
    """
    preference = await get_user_preference(db, user.id)

    has_telegram = False
    if preference and preference.telegram_enabled:
        # Check if encrypted credentials exist (not just that telegram_enabled is True)
        has_telegram = bool(
            preference.telegram_token_encrypted and preference.telegram_chat_id_encrypted
        )

    return NotificationSettingsResponse(
        preference=NotificationPreferenceResponse.model_validate(preference) if preference else None,
        has_telegram_configured=has_telegram,
    )


@router.patch("/settings", response_model=NotificationPreferenceResponse)
async def update_notification_settings(
    settings_update: NotificationPreferenceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceResponse:
    """
    Update user's notification preferences.

    Supports partial updates - only provided fields will be updated.

    Telegram credentials are encrypted before storage using AES-256-GCM.
    """
    preference = await create_or_update_preference(db, user.id, settings_update)

    # Audit log for credential changes
    logger.info(
        f"User {user.id} updated notification preferences: "
        f"toast={preference.toast_enabled}, sound={preference.sound_enabled}, "
        f"telegram={preference.telegram_enabled}"
    )

    return NotificationPreferenceResponse.model_validate(preference)


# =============================================================================
# Per-Alert Settings Endpoints
# =============================================================================

@router.get("/alert-settings/{alert_id}", response_model=AlertNotificationSettingsResponse)
async def get_alert_notification_settings(
    alert_id: int,
    user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlertNotificationSettingsResponse:
    """
    Get per-alert notification settings overrides.

    Returns null values for any setting that uses the global default.
    If no custom settings exist for this alert, returns default response with all
    notification fields set to null (indicating "use global defaults").
    """
    # Verify ownership (alerts table has user_id column)
    from sqlalchemy import select
    from app.models.alert import Alert
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found"
        )

    await check_notification_ownership(alert.user_id, user)

    settings = await get_alert_notification_settings_svc(db, alert_id)

    # If no custom settings exist, return default response with all notification fields set to null
    # This indicates "use global defaults" for all notification types
    if not settings:
        from datetime import datetime
        from uuid import uuid4

        # Return default response structure with all notification fields as null
        # The required fields (id, alert_id, timestamps) are set to placeholder values
        return AlertNotificationSettingsResponse(
            id=uuid4(),
            alert_id=alert_id,
            toast_enabled=None,
            sound_enabled=None,
            sound_type=None,
            telegram_enabled=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

    return AlertNotificationSettingsResponse.model_validate(settings)


@router.post("/alert-settings", response_model=AlertNotificationSettingsResponse, status_code=201)
async def create_alert_notification_settings(
    settings_in: AlertNotificationSettingsCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlertNotificationSettingsResponse:
    """
    Create per-alert notification settings overrides.

    When set, these override global preferences for this specific alert.
    """
    # Verify alert ownership
    from sqlalchemy import select
    from app.models.alert import Alert
    result = await db.execute(select(Alert).where(Alert.id == settings_in.alert_id))
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {settings_in.alert_id} not found"
        )

    await check_notification_ownership(alert.user_id, user)

    settings = await create_or_update_alert_settings(
        db,
        settings_in.alert_id,
        settings_in.model_dump(exclude={"alert_id"}),
    )

    return AlertNotificationSettingsResponse.model_validate(settings)


@router.patch("/alert-settings/{alert_id}", response_model=AlertNotificationSettingsResponse)
async def update_alert_notification_settings(
    alert_id: int,
    settings_update: AlertNotificationSettingsUpdate,
    user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlertNotificationSettingsResponse:
    """
    Update per-alert notification settings overrides.

    Supports partial updates - only provided fields will be updated.
    """
    # Verify alert ownership first
    from sqlalchemy import select
    from app.models.alert import Alert
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found"
        )

    await check_notification_ownership(alert.user_id, user)

    settings = await create_or_update_alert_settings(
        db,
        alert_id,
        settings_update.model_dump(exclude_unset=True),
    )

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No notification settings found for alert {alert_id}"
        )

    return AlertNotificationSettingsResponse.model_validate(settings)


# =============================================================================
# Telegram Endpoints
# =============================================================================

@router.post("/telegram/validate", response_model=TelegramValidationResult)
async def validate_telegram(
    credentials: TelegramCredentialsValidate,
    user: User = Depends(get_current_user),
) -> TelegramValidationResult:
    """
    Validate Telegram credentials without saving.

    Tests connectivity to Telegram Bot API and verifies the bot token.
    """
    try:
        is_valid, bot_username, error = await validate_telegram_credentials(
            credentials.telegram_token,
            credentials.telegram_chat_id,
        )

        return TelegramValidationResult(
            valid=is_valid,
            bot_username=bot_username,
            error_message=error,
        )
    except Exception as e:
        logger.error(f"Telegram validation error for user {user.id}: {e}")
        return TelegramValidationResult(
            valid=False,
            error_message=str(e),
        )


@router.post("/telegram/test", response_model=TelegramTestResult)
async def test_telegram(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TelegramTestResult:
    """
    Test Telegram configuration (send test message).

    Uses the encrypted credentials from the user's notification preferences.
    """
    config = await get_telegram_config(db, user.id)

    if not config:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Telegram not configured. Please configure your Telegram credentials first."
        )

    try:
        message_id = await send_telegram_message(
            config["token"],
            config["chat_id"],
            "🔔 Test notification from PolishedCharts - Your Telegram integration is working!",
        )

        # Log successful delivery
        await log_notification_delivery(
            db,
            alert_id=user.id,  # Using user.id as pseudo alert_id for test messages
            trigger_id=0,  # 0 indicates test message
            user_id=user.id,
            notification_type=NotificationType.TELEGRAM,
            status=DeliveryStatus.SENT,
            message="Test notification from PolishedCharts",
        )

        return TelegramTestResult(
            success=True,
            message_id=str(message_id),
        )
    except TelegramError as e:
        # Log failed delivery
        await log_notification_delivery(
            db,
            alert_id=user.id,
            trigger_id=0,
            user_id=user.id,
            notification_type=NotificationType.TELEGRAM,
            status=DeliveryStatus.FAILED,
            error_message=str(e),
        )

        return TelegramTestResult(
            success=False,
            error_message=str(e),
        )


# =============================================================================
# History Endpoints
# =============================================================================

@router.get("/history", response_model=NotificationDeliveryListResponse)
async def get_notification_history(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationDeliveryListResponse:
    """
    Get user's notification delivery history.

    Paginated list of all notification deliveries for the user.
    """
    items, total = await get_notification_history(db, user.id, limit=limit, offset=offset)

    # Convert to response format
    item_responses = []
    for item in items:
        item_responses.append(NotificationDeliveryResponse(
            id=item.id,
            alert_trigger_id=item.alert_trigger_id,
            alert_id=item.alert_id,
            user_id=item.user_id,
            notification_type=NotificationType(item.notification_type),
            status=DeliveryStatus(item.status),
            triggered_at=item.triggered_at,
            message=item.message,
            error_message=item.error_message,
            # These would need a join to populate - simplified for now
            alert_name=None,
            symbol=None,
        ))

    return NotificationDeliveryListResponse(
        items=item_responses,
        total=total,
        limit=limit,
        offset=offset,
    )


# =============================================================================
# Internal/Trigger Endpoints
# =============================================================================

@router.post("/send", response_model=SendNotificationResponse)
async def send_notification(
    request: SendNotificationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SendNotificationResponse:
    """
    Send a notification (called by backend alert engine internally).

    This endpoint is typically called by the backend alert engine, not the frontend.
    It logs the delivery and handles the actual notification sending.
    """
    from app.services.notification_sender import send_notification_internal

    try:
        delivery = await send_notification_internal(
            db=db,
            alert_trigger_id=request.alert_trigger_id,
            notification_type=request.notification_type,
            message=request.message,
            user_id=user.id,
        )

        return SendNotificationResponse(
            success=True,
            notification_delivery_id=delivery.id if delivery else None,
        )
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")

        # Log the failed delivery
        await log_notification_delivery(
            db,
            alert_id=user.id,  # Would need to fetch from alert_trigger
            trigger_id=request.alert_trigger_id,
            user_id=user.id,
            notification_type=request.notification_type,
            status=DeliveryStatus.FAILED,
            message=request.message,
            error_message=str(e),
        )

        return SendNotificationResponse(
            success=False,
            error_message=str(e),
        )
