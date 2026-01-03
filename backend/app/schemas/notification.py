"""
Pydantic Schemas for Notification System

Provides request/response schemas for:
- NotificationPreference: Global user notification settings
- AlertNotificationSettings: Per-alert notification overrides
- NotificationDelivery: History records of sent notifications
- Telegram credential validation and testing

All schemas follow the data model specifications and include proper
validation for notification types, delivery status, and encrypted credentials.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NotificationType(str, Enum):
    """Types of notifications that can be sent."""
    TOAST = "toast"
    SOUND = "sound"
    TELEGRAM = "telegram"


class DeliveryStatus(str, Enum):
    """Status of a notification delivery attempt."""
    SENT = "sent"
    FAILED = "failed"
    PENDING = "pending"


# =============================================================================
# Notification Preference Schemas
# =============================================================================

class NotificationPreferenceBase(BaseModel):
    """Base schema for notification preferences (shared fields)."""
    toast_enabled: bool = Field(default=True, description="Enable toast notifications")
    sound_enabled: bool = Field(default=False, description="Enable sound notifications")
    sound_type: Optional[str] = Field(
        default=None,
        description="Sound type: bell, alert, chime",
        pattern="^(bell|alert|chime)$"
    )
    telegram_enabled: bool = Field(default=False, description="Enable Telegram notifications")


class NotificationPreferenceCreate(NotificationPreferenceBase):
    """Schema for creating notification preferences."""
    pass


class NotificationPreferenceUpdate(BaseModel):
    """Schema for updating notification preferences (all fields optional)."""
    toast_enabled: Optional[bool] = None
    sound_enabled: Optional[bool] = None
    sound_type: Optional[str] = Field(
        default=None,
        description="Sound type: bell, alert, chime",
        pattern="^(bell|alert|chime)$"
    )
    telegram_enabled: Optional[bool] = None
    telegram_token: Optional[str] = Field(
        default=None,
        description="Plaintext Telegram bot token (will be encrypted before storage)"
    )
    telegram_chat_id: Optional[str] = Field(
        default=None,
        description="Plaintext Telegram chat ID (will be encrypted before storage)"
    )

    @field_validator("telegram_token", "telegram_chat_id")
    @classmethod
    def validate_telegram_credentials(cls, v: Optional[str], info) -> Optional[str]:
        """Validate that Telegram credentials are provided together."""
        # This is a partial validation - full validation happens in the service layer
        # after encryption, since we need to check both fields together
        return v


class NotificationPreferenceResponse(NotificationPreferenceBase):
    """Schema for notification preference response (never exposes encrypted values)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    telegram_token_encrypted: Optional[str] = Field(
        default=None,
        description="Encrypted token (masked in API response: ****abcd)"
    )
    telegram_chat_id_encrypted: Optional[str] = Field(
        default=None,
        description="Encrypted chat ID (masked in API response: ****1234)"
    )
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm(cls, obj) -> "NotificationPreferenceResponse":
        """Convert from ORM model, masking encrypted values."""
        # Mask the encrypted values for API response
        data = obj.__dict__.copy()
        for field in ("telegram_token_encrypted", "telegram_chat_id_encrypted"):
            val = data.get(field)
            if val and len(val) > 4:
                data[field] = "****" + val[-4:]
            elif val:
                data[field] = "****"
        return cls(**data)


# =============================================================================
# Alert Notification Settings Schemas (Per-Alert Overrides)
# =============================================================================

class AlertNotificationSettingsBase(BaseModel):
    """Base schema for alert notification settings."""
    toast_enabled: Optional[bool] = Field(
        default=None,
        alias="toastEnabled",
        description="Enable toast notifications (null = use global default)"
    )
    sound_enabled: Optional[bool] = Field(
        default=None,
        alias="soundEnabled",
        description="Enable sound notifications (null = use global default)"
    )
    sound_type: Optional[str] = Field(
        default=None,
        alias="soundType",
        description="Alert-specific sound type (null = use global)",
        pattern="^(bell|alert|chime)$"
    )
    telegram_enabled: Optional[bool] = Field(
        default=None,
        alias="telegramEnabled",
        description="Enable Telegram notifications (null = use global default)"
    )

    class Config:
        populate_by_name = True  # Allow both alias and field name


class AlertNotificationSettingsCreate(AlertNotificationSettingsBase):
    """Schema for creating alert notification settings."""
    alert_id: int = Field(..., description="ID of the associated alert")


class AlertNotificationSettingsUpdate(BaseModel):
    """Schema for updating alert notification settings (all fields optional)."""
    toast_enabled: Optional[bool] = Field(None, alias="toastEnabled")
    sound_enabled: Optional[bool] = Field(None, alias="soundEnabled")
    sound_type: Optional[str] = Field(
        default=None,
        alias="soundType",
        pattern="^(bell|alert|chime)$"
    )
    telegram_enabled: Optional[bool] = Field(None, alias="telegramEnabled")

    class Config:
        populate_by_name = True  # Allow both alias and field name


class AlertNotificationSettingsResponse(AlertNotificationSettingsBase):
    """Schema for alert notification settings response."""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True  # Serialize using camelCase aliases
    )

    id: UUID
    alert_id: int
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Notification Delivery Schemas (History Records)
# =============================================================================

class NotificationDeliveryResponse(BaseModel):
    """Schema for notification delivery history record."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    alert_trigger_id: int = Field(..., description="FK to AlertTrigger (Integer)")
    alert_id: UUID = Field(..., description="Denormalized alert ID for query efficiency")
    user_id: UUID
    notification_type: NotificationType
    status: DeliveryStatus
    triggered_at: datetime
    message: Optional[str] = None
    error_message: Optional[str] = None

    # Denormalized fields for history display
    alert_name: Optional[str] = Field(default=None, description="Alert name for display")
    symbol: Optional[str] = Field(default=None, description="Symbol for display")


class NotificationDeliveryListResponse(BaseModel):
    """Paginated response for notification history."""
    items: list[NotificationDeliveryResponse]
    total: int = Field(..., description="Total number of records")
    limit: int = Field(..., description="Records per page")
    offset: int = Field(..., description="Offset for pagination")


# =============================================================================
# Telegram Credential Validation Schemas
# =============================================================================

class TelegramCredentialsValidate(BaseModel):
    """Request schema for validating Telegram credentials."""
    telegram_token: str = Field(..., min_length=1, description="Telegram bot token")
    telegram_chat_id: str = Field(..., min_length=1, description="Telegram chat ID")


class TelegramCredentialsTest(BaseModel):
    """Request schema for testing Telegram configuration (after encryption)."""
    # Note: Encrypted credentials are retrieved from storage by user_id
    # This endpoint just triggers a test message
    pass


class TelegramValidationResult(BaseModel):
    """Response schema for credential validation."""
    valid: bool
    error_message: Optional[str] = None
    bot_username: Optional[str] = None


class TelegramTestResult(BaseModel):
    """Response schema for test notification."""
    success: bool
    message_id: Optional[str] = None
    error_message: Optional[str] = None


# =============================================================================
# Send Notification Schemas
# =============================================================================

class SendNotificationRequest(BaseModel):
    """Request schema for sending a notification (internal API)."""
    alert_trigger_id: int = Field(..., description="ID of the triggered alert (Integer)")
    notification_type: NotificationType = Field(..., description="Type of notification to send")
    message: str = Field(..., description="Notification message content")


class SendNotificationResponse(BaseModel):
    """Response schema for notification sending."""
    success: bool
    notification_delivery_id: Optional[UUID] = None
    error_message: Optional[str] = None


# =============================================================================
# Settings Schemas
# =============================================================================

class NotificationSettingsResponse(BaseModel):
    """Combined response for notification settings."""
    preference: Optional[NotificationPreferenceResponse] = None
    has_telegram_configured: bool = Field(
        default=False,
        description="True if Telegram is configured and encrypted credentials exist"
    )
