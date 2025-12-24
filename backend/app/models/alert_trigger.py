from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.db.base_class import Base


class AlertTrigger(Base):
    """Records when an alert condition is met.

    Tracks both price-based and indicator-based alert triggers,
    including delivery status for notification retry logic.
    """
    __tablename__ = "alert_trigger"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alert.id"), nullable=False, index=True)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Observed values at trigger time
    observed_price = Column(Float, nullable=True)  # Price value (for price alerts)
    indicator_value = Column(Float, nullable=True)  # Indicator value (for indicator alerts)

    # Delivery tracking
    delivery_status = Column(String(20), nullable=True, default="pending")  # pending, delivered, failed, retrying
    retry_count = Column(Integer, nullable=True, default=0)  # Number of retry attempts
    last_retry_at = Column(DateTime(timezone=True), nullable=True)  # Last retry timestamp
