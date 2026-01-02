"""
Notification Service - Business Logic Layer

Provides database operations for notification preferences, settings, and history.
Handles encryption of Telegram credentials before storage.

Usage:
    from app.services.notification_service import (
        get_user_preference,
        update_user_preference,
        get_telegram_config,
    )

    preference = await get_user_preference(db, user_id)
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import encrypt, decrypt, EncryptionError
from app.models.notification_preference import NotificationPreference
from app.models.alert_notification_settings import AlertNotificationSettings
from app.models.notification_delivery import NotificationDelivery
from app.schemas.notification import (
    NotificationPreferenceUpdate,
    NotificationType,
    DeliveryStatus,
)
from app.services.audit import notification_audit_log

logger = logging.getLogger(__name__)


async def get_user_preference(
    db: AsyncSession,
    user_id: int,
) -> Optional[NotificationPreference]:
    """Get user's notification preferences."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def create_or_update_preference(
    db: AsyncSession,
    user_id: int,
    update_data: NotificationPreferenceUpdate,
) -> NotificationPreference:
    """
    Create or update user's notification preferences.

    Handles encryption of Telegram credentials before storage.
    """
    # Get existing preference
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
    )
    preference = result.scalar_one_or_none()

    # Determine action for audit
    action = "create" if not preference else "update"

    # Prepare update data
    update_dict = update_data.model_dump(exclude_unset=True)

    # Encrypt Telegram credentials if provided
    telegram_token_encrypted = None
    telegram_chat_id_encrypted = None

    if "telegram_token" in update_dict and update_dict["telegram_token"]:
        telegram_token_encrypted = encrypt(update_dict["telegram_token"]).ciphertext_b64
        del update_dict["telegram_token"]

    if "telegram_chat_id" in update_dict and update_dict["telegram_chat_id"]:
        telegram_chat_id_encrypted = encrypt(update_dict["telegram_chat_id"]).ciphertext_b64
        del update_dict["telegram_chat_id"]

    if not preference:
        # Create new preference
        preference = NotificationPreference(
            id=uuid4(),
            user_id=user_id,
            toast_enabled=update_dict.get("toast_enabled", True),
            sound_enabled=update_dict.get("sound_enabled", False),
            sound_type=update_dict.get("sound_type"),
            telegram_enabled=update_dict.get("telegram_enabled", False),
            telegram_token_encrypted=telegram_token_encrypted,
            telegram_chat_id_encrypted=telegram_chat_id_encrypted,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(preference)
    else:
        # Update existing preference
        for field, value in update_dict.items():
            if hasattr(preference, field):
                setattr(preference, field, value)

        if telegram_token_encrypted:
            preference.telegram_token_encrypted = telegram_token_encrypted
        if telegram_chat_id_encrypted:
            preference.telegram_chat_id_encrypted = telegram_chat_id_encrypted

        preference.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(preference)

    # Audit log
    notification_audit_log.log_credential_change(user_id, action)

    return preference


async def get_telegram_config(
    db: AsyncSession,
    user_id: int,
) -> Optional[dict]:
    """
    Get user's Telegram configuration with decrypted credentials.

    Returns:
        Dict with decrypted token and chat_id, or None if not configured

    Note:
        Decryption failures are handled gracefully per FR-ENC-001/002/003
    """
    preference = await get_user_preference(db, user_id)

    if not preference:
        return None

    if not preference.telegram_enabled:
        return None

    if not preference.telegram_token_encrypted or not preference.telegram_chat_id_encrypted:
        return None

    # Decrypt credentials (handle failures gracefully)
    try:
        token = decrypt(preference.telegram_token_encrypted)
        chat_id = decrypt(preference.telegram_chat_id_encrypted)
    except EncryptionError as e:
        logger.warning(f"Failed to decrypt Telegram credentials for user {user_id}: {e}")
        # Per FR-ENC-001: treat as "no Telegram configured"
        return None

    return {
        "token": token,
        "chat_id": chat_id,
    }


async def get_alert_notification_settings(
    db: AsyncSession,
    alert_id: UUID,
) -> Optional[AlertNotificationSettings]:
    """Get per-alert notification settings."""
    result = await db.execute(
        select(AlertNotificationSettings).where(
            AlertNotificationSettings.alert_id == alert_id
        )
    )
    return result.scalar_one_or_none()


async def create_or_update_alert_settings(
    db: AsyncSession,
    alert_id: UUID,
    settings_data: dict,
) -> AlertNotificationSettings:
    """Create or update per-alert notification settings."""
    result = await db.execute(
        select(AlertNotificationSettings).where(
            AlertNotificationSettings.alert_id == alert_id
        )
    )
    settings = result.scalar_one_or_none()

    action = "create" if not settings else "update"

    if not settings:
        settings = AlertNotificationSettings(
            id=uuid4(),
            alert_id=alert_id,
            toast_enabled=settings_data.get("toast_enabled"),
            sound_enabled=settings_data.get("sound_enabled"),
            sound_type=settings_data.get("sound_type"),
            telegram_enabled=settings_data.get("telegram_enabled"),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(settings)
    else:
        for field, value in settings_data.items():
            if value is not None and hasattr(settings, field):
                setattr(settings, field, value)
        settings.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(settings)

    return settings


async def get_notification_history(
    db: AsyncSession,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[NotificationDelivery], int]:
    """Get user's notification history with pagination."""
    # Get total count
    count_result = await db.execute(
        select(NotificationDelivery).where(
            NotificationDelivery.user_id == user_id
        )
    )
    total = len(count_result.all())

    # Get paginated results
    result = await db.execute(
        select(NotificationDelivery)
        .where(NotificationDelivery.user_id == user_id)
        .order_by(NotificationDelivery.triggered_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = result.scalars().all()

    return list(items), total


async def log_notification_delivery(
    db: AsyncSession,
    alert_id: UUID,
    trigger_id: int,
    user_id: int,
    notification_type: NotificationType,
    status: DeliveryStatus,
    message: Optional[str] = None,
    error_message: Optional[str] = None,
) -> NotificationDelivery:
    """Create a NotificationDelivery record."""
    delivery = NotificationDelivery(
        id=uuid4(),
        alert_trigger_id=trigger_id,
        alert_id=alert_id,
        user_id=user_id,
        notification_type=notification_type.value,
        status=status.value,
        triggered_at=datetime.utcnow(),
        message=message,
        error_message=error_message,
    )

    db.add(delivery)
    await db.commit()
    await db.refresh(delivery)

    # Audit log
    notification_audit_log.log_notification_delivery(
        alert_id=alert_id,
        trigger_id=trigger_id,
        notification_type=notification_type.value,
        status=status.value,
        delivery_id=delivery.id,
    )

    return delivery


async def delete_notification_preference(
    db: AsyncSession,
    user_id: int,
) -> bool:
    """Delete user's notification preferences."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
    )
    preference = result.scalar_one_or_none()

    if not preference:
        return False

    await db.delete(preference)
    await db.commit()

    notification_audit_log.log_credential_change(user_id, "delete")

    return True
