import uuid
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects import postgresql
from app.db.base_class import Base
from app.core.enums import AlertCondition, AlertTriggerMode


class Alert(Base):
    """Alert model for price-based and indicator-based alerts.

    Supports both traditional price alerts and indicator-based alerts
    where users can trigger on indicator conditions like crosses_upper,
    turns_positive, slope_bullish, etc.

    For indicator-based alerts (cRSI only in initial implementation):
    - Supports direction-specific trigger messages (upper/lower band)
    - Configurable enabled_conditions for which triggers to fire
    - Stores last_triggered_at timestamp instead of transient "triggered" status

    Authentication:
    - user_id: Foreign key to users table (NULL for guest/unassigned alerts)
    - uuid: Stable identifier for merge operations (never changes)
    - created_at/updated_at: Timestamps for merge conflict resolution
    """
    __tablename__ = "alert"

    id = Column(Integer, primary_key=True, index=True)
    symbol_id = Column(Integer, ForeignKey("symbol.id"), nullable=False)

    # Firebase authentication fields
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    uuid = Column(postgresql.UUID(as_uuid=True), nullable=False, unique=True, default=uuid.uuid4)

    # Alert condition and threshold
    condition = Column(String, nullable=False)  # Stores AlertCondition value
    threshold = Column(Float, nullable=False)

    # Indicator-specific fields (for indicator-based alerts)
    indicator_name = Column(String(50), nullable=True)  # e.g., 'crsi', 'tdfi', 'adxvma'
    indicator_field = Column(String(50), nullable=True)  # e.g., 'crsi', 'tdfi_signal'
    indicator_params = Column(JSON, nullable=True)  # e.g., {'period': 14, 'smooth': 3}

    # Direction-specific trigger messages (for indicator-based alerts)
    message_upper = Column(String(200), nullable=True, server_default="It's time to sell!")
    message_lower = Column(String(200), nullable=True, server_default="It's time to buy!")

    # Enabled conditions for configurable triggers (e.g., {"upper": true, "lower": true})
    enabled_conditions = Column(postgresql.JSONB(), nullable=True)

    # Flexible messages map for any indicator (new format - takes priority over message_upper/message_lower)
    # Maps condition_type to message: e.g., {"indicator_crosses_upper": "Sell!", "indicator_turns_positive": "Bullish!"}
    messages = Column(postgresql.JSONB(), nullable=True)

    # Alert state
    is_active = Column(Boolean, default=True)
    interval = Column(String(10), nullable=False, default='1d')  # Timeframe: '1d', '1h', '15m', etc.
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
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)  # Tracks when alert most recently fired
    last_triggered_bar_timestamp = Column(DateTime(timezone=True), nullable=True)  # Tracks bar timestamp for bar-based trigger modes
    trigger_mode = Column(String(20), nullable=False, default=AlertTriggerMode.ONCE_PER_BAR_CLOSE.value)  # Trigger mode: once, once_per_bar, once_per_bar_close
    cooldown = Column(Integer, nullable=True)  # Cooldown period in minutes (default: 1)

    # Table constraints - explicitly define unique constraint on uuid
    __table_args__ = (
        sa.UniqueConstraint('uuid', name='uq_alert_uuid'),
    )

    # Relationship to User
    user = relationship("User", back_populates="alerts")

    # Relationship to Symbol (for accessing ticker)
    # Named symbol_obj to avoid conflict with AlertBase.symbol (string) schema field
    symbol_obj = relationship("Symbol", back_populates="alerts")

    # Relationship to notification settings (per-alert overrides)
    # Temporarily commented out due to fk constraint issues in tests
    # notification_settings = relationship("AlertNotificationSettings", back_populates="alert", cascade="all, delete-orphan")

    @property
    def alert_label(self) -> str:
        """Generate a human-readable label for the alert.

        Computed at access time from indicator parameters and enabled conditions.
        Example: "cRSI(20) band cross", "cRSI(14) upper only"
        """
        if not self.indicator_name:
            # Price alerts use condition-based label
            return f"{self.condition} alert"

        # Extract primary parameter for label (e.g., domcycle for cRSI)
        if self.indicator_params:
            # Try to get the most descriptive parameter
            if self.indicator_name == 'crsi':
                primary_param = self.indicator_params.get('domcycle', self.indicator_params.get('period', 20))
            else:
                # For other indicators, use first numeric param
                for k, v in self.indicator_params.items():
                    if isinstance(v, (int, float)):
                        primary_param = v
                        break
                else:
                    primary_param = '?'
        else:
            primary_param = '?'

        # Generate label based on enabled conditions
        # Frontend sends keys like 'indicator_above_upper', 'indicator_below_lower'
        # Map these to upper/lower for label computation
        if self.enabled_conditions:
            has_upper = (
                'upper' in self.enabled_conditions or
                'indicator_above_upper' in self.enabled_conditions or
                'indicator_crosses_upper' in self.enabled_conditions
            )
            has_lower = (
                'lower' in self.enabled_conditions or
                'indicator_below_lower' in self.enabled_conditions or
                'indicator_crosses_lower' in self.enabled_conditions
            )

            if has_upper and has_lower:
                condition_label = "band cross"
            elif has_upper:
                condition_label = "upper only"
            elif has_lower:
                condition_label = "lower only"
            else:
                condition_label = "alert"
        else:
            condition_label = "alert"

        return f"{self.indicator_name.upper()}({primary_param}) {condition_label}"
