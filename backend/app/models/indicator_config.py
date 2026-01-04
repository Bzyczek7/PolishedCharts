"""Indicator configuration model for user-specific indicator instances.

Stores overlay indicator instances with styling and visibility settings.
Follows the same pattern as Alert, UserWatchlist, and Layout models.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects import postgresql
from app.db.base_class import Base


class IndicatorConfig(Base):
    """User-specific indicator configuration for overlay indicators.

    Stores per-instance indicator settings including:
    - Indicator type (name, category, params)
    - Display name (e.g., "SMA (20)")
    - Visual styling (color, line width, etc.)
    - Visibility state

    Attributes:
        id: Internal database primary key
        user_id: Foreign key to users table (NULL for guest/unassigned configs)
        uuid: Stable identifier for merge operations (per-user unique)
        indicator_name: Indicator name (e.g., 'sma', 'ema', 'tdfi')
        indicator_category: Indicator category ('overlay' or 'oscillator')
        indicator_params: Parameter values as JSON (e.g., {'length': 20})
        display_name: Human-readable display name (e.g., "SMA (20)")
        style: Visual styling configuration as JSON
        is_visible: Visibility state (hide without removing)
        created_at: Config creation timestamp
        updated_at: Last update timestamp (used for merge conflict resolution)

    Merge Rule:
        - Upsert by uuid within user_id scope
        - If uuid exists: update only if new updated_at > existing updated_at + 2 minutes
        - If uuid doesn't exist: insert as new
        - If timestamps within ±2 minutes: keep existing (prefer cloud, deterministic)

    Note: UUID is NOT globally unique - it's unique per user (composite constraint).
    This matches the merge semantics of "upsert by uuid within user_id scope".
    """
    __tablename__ = "indicator_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    # Non-unique UUID (unique per user, not globally)
    uuid = Column(
        postgresql.UUID(as_uuid=True),
        nullable=False,
        default=uuid.uuid4
    )

    # Indicator type definition
    indicator_name = Column(String(50), nullable=False, index=True)  # 'sma', 'ema', 'tdfi', etc.
    indicator_category = Column(String(20), nullable=False)  # 'overlay' or 'oscillator'
    indicator_params = Column(JSON, nullable=False)  # {'length': 20} or {'period': 14}

    # Display and styling
    display_name = Column(String(255), nullable=False)
    style = Column(JSON, nullable=False)  # {color, lineWidth, showLastValue, seriesColors}
    is_visible = Column(Boolean, nullable=False, default=True)

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

    # Composite unique constraint for (user_id, uuid)
    # This ensures UUID is unique within each user's scope, not globally
    __table_args__ = (
        UniqueConstraint('user_id', 'uuid', name='uq_indicator_config_user_uuid'),
    )

    # No cascade on relationship (use nullable FK + SET NULL instead)
    # This matches Alert, UserWatchlist, Layout patterns
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<IndicatorConfig(id={self.id}, user_id={self.user_id}, name={self.indicator_name})>"
