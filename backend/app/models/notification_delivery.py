"""
NotificationDelivery SQLAlchemy Model

Record of a notification that was sent (history). Multiple deliveries per AlertTrigger
(one per notification type: toast, sound, Telegram).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Delivery identifier |
| alert_trigger_id | UUID | Yes | Foreign key to AlertTrigger (1:N relationship) |
| alert_id | UUID | Yes | Foreign key to Alert (denormalized) |
| user_id | UUID | Yes | User who owns the alert |
| notification_type | enum | Yes | TOAST, SOUND, TELEGRAM |
| status | enum | Yes | SENT, FAILED, PENDING |
| triggered_at | timestamp | Yes | When alert triggered |
| message | string | No | Content sent (for history display) |
| error_message | string | No | Error details if status is FAILED |

Enums:
- NotificationType: TOAST, SOUND, TELEGRAM
- DeliveryStatus: SENT, FAILED, PENDING
"""

from datetime import datetime
from enum import Enum
from uuid import uuid4

from sqlalchemy import DateTime, Enum as SQLEnum, String, Text, Column, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


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


class NotificationDelivery(Base):
    """Record of a notification that was sent (history)."""

    __tablename__ = "notification_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    alert_trigger_id = Column(Integer, ForeignKey("alert_trigger.id"), nullable=False, index=True)
    alert_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    notification_type = Column(SQLEnum(NotificationType), nullable=False)
    status = Column(SQLEnum(DeliveryStatus), nullable=False)
    triggered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    message = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    alert_trigger = relationship("AlertTrigger")

    def __repr__(self) -> str:
        return f"<NotificationDelivery(id={self.id}, type={self.notification_type}, status={self.status})>"
