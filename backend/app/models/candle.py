from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.sql import func
from app.db.base_class import Base

class Candle(Base):
    symbol_id = Column(Integer, ForeignKey("symbol.id"), primary_key=True)
    timestamp = Column(DateTime(timezone=True), primary_key=True, index=True)
    interval = Column(String, primary_key=True, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Integer)

    __table_args__ = (
        UniqueConstraint('symbol_id', 'timestamp', 'interval', name='uix_candle_symbol_timestamp_interval'),
    )
