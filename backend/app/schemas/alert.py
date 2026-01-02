from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Dict, Any
from datetime import datetime
from app.core.enums import AlertCondition, AlertTriggerMode


class AlertTrigger(BaseModel):
    """Schema for alert trigger history.

    For indicator-based alerts, includes trigger_type and trigger_message
    to distinguish which condition fired and what message was shown.
    """
    id: int
    alert_id: int
    triggered_at: datetime
    observed_price: Optional[float] = None  # Price value (for price alerts)
    indicator_value: Optional[float] = None  # Indicator value (for indicator alerts)
    trigger_type: Optional[str] = "upper"  # "upper" or "lower" - which condition fired
    trigger_message: Optional[str] = "Alert triggered"  # Direction-specific message used
    alert_label: Optional[str] = None  # Computed label for display (computed from alert)
    delivery_status: Optional[str] = "pending"
    retry_count: Optional[int] = 0
    last_retry_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertBase(BaseModel):
    """Base schema for alerts."""
    symbol_id: Optional[int] = None  # Numeric ID (preferred, resolved from symbol if not provided)
    symbol: Optional[str] = None  # Symbol ticker (e.g., "AAPL") - will be resolved to symbol_id
    condition: AlertCondition
    threshold: Optional[float] = None  # Optional for indicator-based alerts
    is_active: Optional[bool] = True
    interval: Optional[str] = Field('1d', description="Timeframe: '1d', '1h', '15m', '5m', '1m', etc.")
    cooldown: Optional[int] = 1  # Cooldown period in minutes (default: 1)
    trigger_mode: Optional[AlertTriggerMode] = AlertTriggerMode.ONCE_PER_BAR_CLOSE  # Trigger mode: once, once_per_bar, once_per_bar_close

    # Indicator-specific fields
    indicator_name: Optional[str] = Field(None, max_length=50, description="e.g., 'crsi', 'tdfi', 'adxvma'")
    indicator_field: Optional[str] = Field(None, max_length=50, description="e.g., 'crsi', 'tdfi_signal'")
    indicator_params: Optional[Dict[str, Any]] = Field(None, description="e.g., {'period': 14}")

    # Direction-specific trigger messages (legacy cRSI format - for backward compatibility)
    message_upper: Optional[str] = Field("It's time to sell!", max_length=200, description="Message when upper band crosses")
    message_lower: Optional[str] = Field("It's time to buy!", max_length=200, description="Message when lower band crosses")

    # Flexible messages map for any indicator (new format - takes priority)
    # e.g., {"indicator_crosses_upper": "Sell!", "indicator_turns_positive": "Bullish!"}
    messages: Optional[Dict[str, str]] = Field(None, description="Maps condition_type to trigger message")

    # Enabled conditions for configurable triggers
    enabled_conditions: Optional[Dict[str, bool]] = Field(
        {"upper": True, "lower": True},
        description="Which trigger conditions are enabled (e.g., {'upper': true, 'lower': true})"
    )


class AlertCreate(AlertBase):
    @field_validator('threshold')
    @classmethod
    def threshold_must_be_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('threshold must be positive or zero (zero is allowed for indicator alerts)')
        return v

    @field_validator('cooldown')
    @classmethod
    def cooldown_minimum_enforced(cls, v: Optional[int]) -> Optional[int]:
        """Backend enforces minimum 1-minute cooldown."""
        if v is not None and v < 1:
            raise ValueError('cooldown must be at least 1 minute')
        return v

    @model_validator(mode='after')
    def indicator_fields_must_be_both_present_or_absent(self) -> 'AlertCreate':
        """Validate that indicator_name and indicator_field are either both present or both absent."""
        indicator_name = self.indicator_name
        indicator_field = self.indicator_field

        # If one is set, both must be set
        if indicator_name is not None and indicator_field is None:
            raise ValueError('Both indicator_name and indicator_field must be provided together')
        if indicator_field is not None and indicator_name is None:
            raise ValueError('Both indicator_name and indicator_field must be provided together')

        return self

    @field_validator('enabled_conditions')
    @classmethod
    def at_least_one_condition_must_be_enabled(cls, v: Optional[Dict[str, bool]]) -> Optional[Dict[str, bool]]:
        """Validate that at least one trigger condition is enabled."""
        if v is not None:
            if not any(v.values()):
                raise ValueError('At least one trigger condition must be enabled')
        return v

    @field_validator('message_upper', 'message_lower')
    @classmethod
    def message_non_empty_for_enabled_condition(cls, v: Optional[str], info) -> Optional[str]:
        """Validate that messages are non-empty for corresponding enabled conditions."""
        if v is not None and v == '':
            raise ValueError('Trigger messages cannot be empty')
        return v


class AlertUpdate(BaseModel):
    condition: Optional[AlertCondition] = None
    threshold: Optional[float] = None
    is_active: Optional[bool] = None
    cooldown: Optional[int] = None
    trigger_mode: Optional[AlertTriggerMode] = None
    indicator_name: Optional[str] = Field(None, max_length=50)
    indicator_field: Optional[str] = Field(None, max_length=50)
    indicator_params: Optional[Dict[str, Any]] = None
    message_upper: Optional[str] = Field(None, max_length=200)
    message_lower: Optional[str] = Field(None, max_length=200)
    messages: Optional[Dict[str, str]] = None
    enabled_conditions: Optional[Dict[str, bool]] = None

    @field_validator('threshold')
    @classmethod
    def threshold_must_be_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('threshold must be positive or zero (zero is allowed for indicator alerts)')
        return v

    @field_validator('cooldown')
    @classmethod
    def cooldown_minimum_enforced(cls, v: Optional[int]) -> Optional[int]:
        """Backend enforces minimum 1-minute cooldown."""
        if v is not None and v < 1:
            raise ValueError('cooldown must be at least 1 minute')
        return v

    @field_validator('enabled_conditions')
    @classmethod
    def at_least_one_condition_must_be_enabled(cls, v: Optional[Dict[str, bool]]) -> Optional[Dict[str, bool]]:
        """Validate that at least one trigger condition is enabled."""
        if v is not None:
            if not any(v.values()):
                raise ValueError('At least one trigger condition must be enabled')
        return v


class AlertResponse(AlertBase):
    id: int
    created_at: datetime
    last_triggered_at: Optional[datetime] = None  # When the alert most recently fired
    alert_label: Optional[str] = None  # Computed label for display (e.g., "cRSI(20) band cross")
    # Symbol ticker from joined Symbol relationship (populated by API)
    symbol: Optional[str] = None

    class Config:
        from_attributes = True
