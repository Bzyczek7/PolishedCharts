"""Layout model for saving user chart configurations.

This model stores saved chart layouts (indicators, settings, etc.) for
Firebase-authenticated users.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects import postgresql
from app.db.base_class import Base


class Layout(Base):
    """Saved chart layout for Firebase-authenticated users.

    Stores user's chart configurations including indicator setups,
    chart settings, and other visual preferences.

    Attributes:
        id: Internal database primary key
        user_id: Foreign key to users table (NULL for guest/unassigned layouts)
        uuid: Stable identifier for merge operations (never changes)
        name: Layout name (e.g., "My Trading Setup", "Day Trading Layout")
        config: Serialized layout configuration (indicators, settings, etc.) as JSONB
        created_at: Layout creation timestamp
        updated_at: Last update timestamp (used for merge conflict resolution)

    Merge Rule (FR-013):
        - Upsert by uuid within user_id scope
        - If uuid exists: update only if new updated_at > existing updated_at + 2 minutes
        - If uuid doesn't exist: insert as new
        - If timestamps within ±2 minutes: keep existing (prefer cloud, deterministic)
    """
    __tablename__ = "layouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    uuid = Column(postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    config = Column(postgresql.JSONB(), nullable=False)

    # Timestamps for merge operations
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationship to User
    user = relationship("User", back_populates="layouts")

    def __repr__(self) -> str:
        return f"<Layout(id={self.id}, user_id={self.user_id}, name={self.name})>"
