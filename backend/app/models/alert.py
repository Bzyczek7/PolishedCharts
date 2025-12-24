from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.sql import func
from app.db.base_class import Base
from app.core.enums import AlertCondition


class Alert(Base):
    """Alert model for price-based and indicator-based alerts.

    Supports both traditional price alerts and indicator-based alerts
    where users can trigger on indicator conditions like crosses_upper,
    turns_positive, slope_bullish, etc.
    """
    __tablename__ = "alert"

    id = Column(Integer, primary_key=True, index=True)
    symbol_id = Column(Integer, ForeignKey("symbol.id"), nullable=False)

    # Alert condition and threshold
    condition = Column(String, nullable=False)  # Stores AlertCondition value
    threshold = Column(Float, nullable=False)

    # Indicator-specific fields (for indicator-based alerts)
    indicator_name = Column(String(50), nullable=True)  # e.g., 'crsi', 'tdfi', 'adxvma'
    indicator_field = Column(String(50), nullable=True)  # e.g., 'crsi', 'tdfi_signal'
    indicator_params = Column(JSON, nullable=True)  # e.g., {'period': 14, 'smooth': 3}

    # Alert state
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    cooldown = Column(Integer, nullable=True)  # Cooldown period in seconds
