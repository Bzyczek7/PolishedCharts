"""
NotificationPreference SQLAlchemy Model

Global user notification preferences (one-to-one with User).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Preference identifier |
| user_id | UUID | Yes | Foreign key to User (UNIQUE) |
| toast_enabled | boolean | Yes | Show toast notifications |
| sound_enabled | boolean | Yes | Play sound notifications |
| sound_type | string | No | Sound identifier (bell, alert, chime) |
| telegram_enabled | boolean | Yes | Send Telegram messages |
| telegram_token_encrypted | string | No | Encrypted Telegram bot token |
| telegram_chat_id_encrypted | string | No | Encrypted Telegram chat ID |
| created_at | timestamp | Yes | Creation timestamp |
| updated_at | timestamp | Yes | Last update timestamp |

Constraints:
- One-to-one with User (user_id UNIQUE)
- telegram_token_encrypted and telegram_chat_id_encrypted required if telegram_enabled
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, String, Text, DateTime, Column, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class NotificationPreference(Base):
    """Global user notification preferences."""

    __tablename__ = "notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    toast_enabled = Column(Boolean, default=True, nullable=False)
    sound_enabled = Column(Boolean, default=False, nullable=False)
    sound_type = Column(String(20), nullable=True)  # bell, alert, chime
    telegram_enabled = Column(Boolean, default=False, nullable=False)
    telegram_token_encrypted = Column(Text, nullable=True)
    telegram_chat_id_encrypted = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="notification_preference")

    def __repr__(self) -> str:
        return f"<NotificationPreference(user_id={self.user_id}, toast={self.toast_enabled}, sound={self.sound_enabled}, telegram={self.telegram_enabled})>"
