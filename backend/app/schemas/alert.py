from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from app.core.enums import AlertCondition


class AlertTrigger(BaseModel):
    """Schema for alert trigger history."""
    id: int
    alert_id: int
    triggered_at: datetime
    observed_price: Optional[float] = None  # Price value (for price alerts)
    indicator_value: Optional[float] = None  # Indicator value (for indicator alerts)
    delivery_status: Optional[str] = "pending"
    retry_count: Optional[int] = 0
    last_retry_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertBase(BaseModel):
    """Base schema for alerts."""
    symbol_id: int
    condition: AlertCondition
    threshold: Optional[float] = None  # Optional for indicator-based alerts
    is_active: Optional[bool] = True
    cooldown: Optional[int] = None  # Cooldown period in seconds

    # Indicator-specific fields
    indicator_name: Optional[str] = Field(None, max_length=50, description="e.g., 'crsi', 'tdfi', 'adxvma'")
    indicator_field: Optional[str] = Field(None, max_length=50, description="e.g., 'crsi', 'tdfi_signal'")
    indicator_params: Optional[Dict[str, Any]] = Field(None, description="e.g., {'period': 14}")


class AlertCreate(AlertBase):
    @field_validator('threshold')
    @classmethod
    def threshold_must_be_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError('threshold must be positive')
        return v

    @field_validator('cooldown')
    @classmethod
    def cooldown_must_be_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError('cooldown must be non-negative')
        return v

    @field_validator('indicator_name', 'indicator_field')
    @classmethod
    def indicator_fields_must_be_both_present_or_absent(cls, v: Optional[str], info) -> Optional[str]:
        """Validate that indicator_name and indicator_field are either both present or both absent."""
        if v is not None:
            # If one indicator field is set, the other must also be set
            other_field = 'indicator_field' if info.field_name == 'indicator_name' else 'indicator_name'
            if other_field not in info.data or info.data[other_field] is None:
                raise ValueError(f'Both indicator_name and indicator_field must be provided together')
        return v


class AlertUpdate(BaseModel):
    condition: Optional[AlertCondition] = None
    threshold: Optional[float] = None
    is_active: Optional[bool] = None
    cooldown: Optional[int] = None
    indicator_name: Optional[str] = Field(None, max_length=50)
    indicator_field: Optional[str] = Field(None, max_length=50)
    indicator_params: Optional[Dict[str, Any]] = None

    @field_validator('threshold')
    @classmethod
    def threshold_must_be_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError('threshold must be positive')
        return v

    @field_validator('cooldown')
    @classmethod
    def cooldown_must_be_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError('cooldown must be non-negative')
        return v


class AlertResponse(AlertBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
