"""
AlertNotificationSettings SQLAlchemy Model

Per-alert notification overrides. When set, these override global NotificationPreference
settings for a specific alert.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Settings identifier |
| alert_id | UUID | Yes | Foreign key to Alert (UNIQUE) |
| toast_enabled | boolean | No | Override global toast setting (null = use global) |
| sound_enabled | boolean | No | Override global sound setting (null = use global) |
| sound_type | string | No | Alert-specific sound (null = use global) |
| telegram_enabled | boolean | No | Override global Telegram setting (null = use global) |
| created_at | timestamp | Yes | Creation timestamp |
| updated_at | timestamp | Yes | Last update timestamp |

Note: When any field is null, the global NotificationPreference value is used.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, String, DateTime, ForeignKey, Column, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class AlertNotificationSettings(Base):
    """Per-alert notification overrides."""

    __tablename__ = "alert_notification_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    alert_id = Column(Integer, ForeignKey("alert.id"), unique=True, nullable=False, index=True)
    toast_enabled = Column(Boolean, nullable=True, default=None)  # null = use global default
    sound_enabled = Column(Boolean, nullable=True, default=None)  # null = use global default
    sound_type = Column(String(20), nullable=True)  # bell, alert, chime (null = use global)
    telegram_enabled = Column(Boolean, nullable=True, default=None)  # null = use global default
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    alert = relationship("Alert", back_populates="notification_settings")

    def __repr__(self) -> str:
        return f"<AlertNotificationSettings(alert_id={self.alert_id})>"
