"""
Notification Sender Service

Orchestrates sending notifications through multiple channels:
- Toast: WebSocket/polling for frontend to display
- Sound: Triggers audio playback on frontend
- Telegram: Sends messages via Telegram Bot API

Handles delivery logging and error recovery.

Usage:
    from app.services.notification_sender import send_notification_internal

    delivery = await send_notification_internal(
        db=db,
        alert_trigger_id=123,
        notification_type=NotificationType.TELEGRAM,
        message="Alert triggered!",
        user_id=user_uuid,
    )
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification_delivery import (
    NotificationDelivery,
    NotificationType,
    DeliveryStatus,
)
from app.schemas.notification import NotificationType as SchemaNotificationType
from app.services.notification_service import (
    get_user_preference,
    get_alert_notification_settings,
    log_notification_delivery,
    get_telegram_config,
)
from app.services.telegram_service import (
    send_telegram_message,
    TelegramError,
)

logger = logging.getLogger(__name__)


async def send_notification_internal(
    db: AsyncSession,
    alert_trigger_id: int,
    notification_type: SchemaNotificationType,
    message: str,
    user_id: UUID,
    alert_id: Optional[UUID] = None,
) -> Optional[NotificationDelivery]:
    """
    Send a notification through the specified channel.

    Args:
        db: Database session
        alert_trigger_id: ID of the triggered alert (Integer)
        notification_type: Type of notification to send
        message: Notification message content
        user_id: User ID who owns the alert
        alert_id: Optional alert ID (will be fetched if not provided)

    Returns:
        NotificationDelivery record if logging was successful, None otherwise

    Raises:
        ValueError: If notification type is not supported
    """
    # Convert notification type enum
    nt = NotificationType(notification_type.value)

    # Fetch alert_id if not provided
    if not alert_id:
        from sqlalchemy import select
        from app.models.alert_trigger import AlertTrigger
        result = await db.execute(
            select(AlertTrigger.alert_id).where(AlertTrigger.id == alert_trigger_id)
        )
        alert_id = result.scalar_one_or_none()

    if not alert_id:
        logger.error(f"Could not find alert_id for trigger {alert_trigger_id}")
        alert_id = user_id  # Use user_id as fallback

    try:
        if notification_type == SchemaNotificationType.TELEGRAM:
            delivery = await _send_telegram_notification(
                db=db,
                alert_trigger_id=alert_trigger_id,
                alert_id=alert_id,
                user_id=user_id,
                message=message,
            )
        elif notification_type == SchemaNotificationType.TOAST:
            # Toast notifications are handled by the frontend via WebSocket/polling
            # We just log the delivery
            delivery = await log_notification_delivery(
                db=db,
                alert_id=alert_id,
                trigger_id=alert_trigger_id,
                user_id=user_id,
                notification_type=nt,
                status=DeliveryStatus.SENT,
                message=message,
            )
            logger.info(f"Toast notification logged for trigger {alert_trigger_id}")
        elif notification_type == SchemaNotificationType.SOUND:
            # Sound notifications are handled by the frontend
            # We just log the delivery
            delivery = await log_notification_delivery(
                db=db,
                alert_id=alert_id,
                trigger_id=alert_trigger_id,
                user_id=user_id,
                notification_type=nt,
                status=DeliveryStatus.SENT,
                message=message,
            )
            logger.info(f"Sound notification logged for trigger {alert_trigger_id}")
        else:
            raise ValueError(f"Unknown notification type: {notification_type}")

        return delivery

    except Exception as e:
        logger.error(f"Failed to send {notification_type.value} notification: {e}")

        # Log the failed delivery
        await log_notification_delivery(
            db=db,
            alert_id=alert_id,
            trigger_id=alert_trigger_id,
            user_id=user_id,
            notification_type=nt,
            status=DeliveryStatus.FAILED,
            message=message,
            error_message=str(e),
        )

        return None


async def _send_telegram_notification(
    db: AsyncSession,
    alert_trigger_id: int,
    alert_id: UUID,
    user_id: UUID,
    message: str,
) -> NotificationDelivery:
    """
    Send a Telegram notification.

    Fetches user's Telegram config and sends the message.
    """
    # Get Telegram configuration
    config = await get_telegram_config(db, user_id)

    if not config:
        raise ValueError("Telegram not configured for user")

    # Format message with Telegram-friendly formatting
    formatted_message = _format_telegram_message(message, alert_id)

    # Send the message
    try:
        message_id = await send_telegram_message(
            token=config["token"],
            chat_id=config["chat_id"],
            text=formatted_message,
        )

        # Log successful delivery
        delivery = await log_notification_delivery(
            db=db,
            alert_id=alert_id,
            trigger_id=alert_trigger_id,
            user_id=user_id,
            notification_type=NotificationType.TELEGRAM,
            status=DeliveryStatus.SENT,
            message=message,
        )

        logger.info(
            f"Telegram notification sent: trigger={alert_trigger_id}, "
            f"message_id={message_id}"
        )

        return delivery

    except TelegramError as e:
        raise ValueError(f"Telegram send failed: {e.message}")


def _format_telegram_message(
    message: str,
    alert_id: UUID,
) -> str:
    """
    Format a message for Telegram with HTML formatting.

    Args:
        message: Original message
        alert_id: Alert ID for context

    Returns:
        HTML-formatted message suitable for Telegram
    """
    # Add alarm bell emoji and formatting
    formatted = f"🔔 <b>Alert Triggered</b>\n\n{message}\n\n"
    formatted += f"<code>Alert ID: {str(alert_id)[:8]}...</code>"

    return formatted


async def send_multi_channel_notification(
    db: AsyncSession,
    alert_trigger_id: int,
    message: str,
    user_id: UUID,
    alert_id: Optional[UUID] = None,
    channels: Optional[list[SchemaNotificationType]] = None,
) -> dict:
    """
    Send a notification through multiple channels.

    Args:
        db: Database session
        alert_trigger_id: ID of the triggered alert
        message: Notification message
        user_id: User ID
        alert_id: Optional alert ID
        channels: List of channels to use (default: all configured)

    Returns:
        Dict with results for each channel
    """
    if channels is None:
        channels = [
            SchemaNotificationType.TOAST,
            SchemaNotificationType.SOUND,
            SchemaNotificationType.TELEGRAM,
        ]

    results = {}

    for channel in channels:
        try:
            delivery = await send_notification_internal(
                db=db,
                alert_trigger_id=alert_trigger_id,
                notification_type=channel,
                message=message,
                user_id=user_id,
                alert_id=alert_id,
            )
            results[channel.value] = {
                "success": delivery is not None,
                "delivery_id": str(delivery.id) if delivery else None,
            }
        except Exception as e:
            logger.error(f"Failed to send {channel.value} notification: {e}")
            results[channel.value] = {
                "success": False,
                "error": str(e),
            }

    return results
