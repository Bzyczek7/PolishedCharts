from sqlalchemy import Column, DateTime, Index, Integer, String
from sqlalchemy.sql import func
from app.db.base_class import Base


class TickerUniverse(Base):
    """Model for the ticker_universe table.

    Stores all searchable US equity symbols with their display names.
    Used for symbol search autocomplete functionality.
    """
    __tablename__ = "ticker_universe"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), unique=True, nullable=False, index=True)
    display_name = Column(String(200), nullable=False, index=True)
    asset_class = Column(String(20), nullable=True)
    exchange = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index('ix_ticker_universe_ticker', 'ticker'),
        Index('ix_ticker_universe_display_name', 'display_name'),
    )
