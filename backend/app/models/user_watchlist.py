"""User-specific watchlist model for Firebase authentication.

This model stores per-user watchlists, separate from the global shared watchlist.
Each user can have their own list of symbols with custom sort order.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.dialects import postgresql
from app.db.base_class import Base


class UserWatchlist(Base):
    """User-specific watchlist for Firebase-authenticated users.

    This is separate from the global WatchlistEntry table which is shared
    by all users. UserWatchlist stores per-user symbol lists with custom
    sort orders and merge support for guest-to-user transitions.

    Attributes:
        id: Internal database primary key
        user_id: Foreign key to users table (NULL for guest/unassigned watchlists)
        uuid: Stable identifier for merge operations (never changes)
        symbols: Array of stock symbols in the watchlist
        sort_order: Array of symbols in display order
        created_at: Watchlist creation timestamp
        updated_at: Last update timestamp (used for merge conflict resolution)

    Merge Rule (FR-013):
        - Upsert by uuid within user_id scope
        - If uuid exists: merge symbols arrays (deduplicate by symbol)
        - Timestamp comparison determines base sort_order:
            - If guest.updated_at > cloud.updated_at + 2 minutes: use guest's sort_order
            - If |guest.updated_at - cloud.updated_at| <= 2 minutes: use cloud's sort_order (prefer cloud)
            - Else: use cloud's sort_order (cloud is more recent)
        - Append any new symbols from the non-base list (deduplicated)
        - If uuid doesn't exist: insert as new watchlist
    """
    __tablename__ = "user_watchlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    uuid = Column(postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4)

    # Watchlist data
    symbols = Column(ARRAY(String), nullable=False, default=list)
    sort_order = Column(ARRAY(String), nullable=False, default=list)

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
    user = relationship("User", back_populates="user_watchlists")

    def __repr__(self) -> str:
        return f"<UserWatchlist(id={self.id}, user_id={self.user_id}, symbols_count={len(self.symbols) if self.symbols else 0})>"
