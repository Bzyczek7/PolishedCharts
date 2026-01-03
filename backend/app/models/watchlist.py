from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class DefaultWatchlist(Base):
    """Model for the default/global watchlist table for unauthenticated access.

    Stores tickers that should be polled for data when no user is logged in.
    This is a fallback watchlist used when user_watchlists is not available.
    """
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    symbol_id = Column(Integer, ForeignKey("symbol.id", ondelete="CASCADE"), nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sort_order = Column(Integer, nullable=False)

    # Relationship to Symbol
    symbol = relationship("Symbol", foreign_keys=[symbol_id])

    __table_args__ = (
        UniqueConstraint('symbol_id', name='uix_watchlist_symbol_id'),
        Index('ix_watchlist_symbol_id', 'symbol_id', unique=True),
        Index('ix_watchlist_sort_order', 'sort_order'),
    )

# Keep alias for backward compatibility
WatchlistEntry = DefaultWatchlist
