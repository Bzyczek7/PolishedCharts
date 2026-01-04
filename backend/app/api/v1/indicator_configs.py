"""
Indicator Configurations API endpoints.

This module provides REST API endpoints for managing user-specific indicator
configurations stored in the database (multi-device sync, persistence).

Endpoints:
- GET /indicator-configs - Retrieve all indicators for authenticated user
- POST /indicator-configs - Create new indicator configuration
- PUT /indicator-configs/{uuid} - Update existing indicator
- DELETE /indicator-configs/{uuid} - Delete indicator

Feature: 001-indicator-storage
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.auth_middleware import get_current_user
from app.models.indicator_config import IndicatorConfig
from app.models.user import User
from app.services.indicator_registry import get_registry

router = APIRouter()

# =============================================================================
# Pydantic Schemas
# =============================================================================

class IndicatorStyle(BaseModel):
    """Visual styling configuration for an indicator."""
    color: str = Field(..., description="Hex color string (e.g., '#FF5733')")
    lineWidth: int = Field(..., ge=1, le=10, description="Line width in pixels")
    showLastValue: bool = Field(default=True, description="Show last value label")
    seriesColors: Optional[Dict[str, str]] = Field(default=None, description="Multi-series colors (for oscillators)")

    @validator('color')
    def validate_hex_color(cls, v):
        """Validate hex color format."""
        if not v.startswith('#') or len(v) not in (7, 4):
            raise ValueError('color must be a valid hex string (e.g., "#FF5733")')
        return v


class IndicatorConfigCreate(BaseModel):
    """Schema for creating a new indicator configuration."""
    indicator_name: str = Field(..., description="Indicator type name (e.g., 'sma', 'ema', 'tdfi')")
    indicator_category: str = Field(..., description="Category: 'overlay' or 'oscillator'")
    indicator_params: Dict[str, Any] = Field(..., description="Parameter values (e.g., {'length': 20})")
    display_name: str = Field(..., min_length=1, max_length=255, description="Human-readable display name")
    style: IndicatorStyle = Field(..., description="Visual styling configuration")
    is_visible: bool = Field(default=True, description="Initial visibility state")

    @validator('indicator_name')
    def validate_indicator_name(cls, v):
        """Validate indicator name against registry."""
        registry = get_registry()
        valid_names = set(registry._indicators.keys())
        # Try case-insensitive match
        v_lower = v.lower()
        if v_lower not in [name.lower() for name in valid_names]:
            raise ValueError(f"Invalid indicator_name '{v}'. Valid names: {sorted(valid_names)}")
        return v_lower

    @validator('indicator_category')
    def validate_indicator_category(cls, v):
        """Validate indicator category."""
        if v not in ('overlay', 'oscillator'):
            raise ValueError("indicator_category must be 'overlay' or 'oscillator'")
        return v


class IndicatorConfigUpdate(BaseModel):
    """Schema for updating an existing indicator configuration."""
    indicator_params: Optional[Dict[str, Any]] = Field(None, description="Updated parameter values")
    display_name: Optional[str] = Field(None, min_length=1, max_length=255, description="Updated display name")
    style: Optional[IndicatorStyle] = Field(None, description="Updated visual styling")
    is_visible: Optional[bool] = Field(None, description="Updated visibility state")


class IndicatorConfigResponse(BaseModel):
    """Schema for indicator configuration response."""
    id: int
    uuid: str
    indicator_name: str
    indicator_category: str
    indicator_params: Dict[str, Any]
    display_name: str
    style: Dict[str, Any]
    is_visible: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# =============================================================================
# Validation Helper (T021a: Indicator parameter validation)
# =============================================================================

def validate_indicator_params(indicator_name: str, params: Dict[str, Any]) -> None:
    """
    Validate indicator parameters against the indicator registry.

    Rejects invalid configs with 400 error (FR-009).

    Args:
        indicator_name: Indicator type name
        params: Parameter values to validate

    Raises:
        HTTPException: 400 if parameters are invalid
    """
    registry = get_registry()
    indicator = registry.get(indicator_name)
    if not indicator:
        indicator = registry.get_by_base_name(indicator_name)

    if not indicator:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Indicator '{indicator_name}' not found in registry"
        )

    param_defs = indicator.parameter_definitions

    # Check for unknown parameters
    unknown_params = set(params.keys()) - set(param_defs.keys())
    if unknown_params:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown parameters for {indicator_name}: {sorted(unknown_params)}. "
                   f"Valid parameters: {sorted(param_defs.keys())}"
        )

    # Validate each parameter
    for param_name, param_value in params.items():
        if param_name not in param_defs:
            continue

        param_def = param_defs[param_name]

        # Type validation
        expected_type = param_def.type
        if expected_type == "integer":
            if not isinstance(param_value, int):
                try:
                    params[param_name] = int(param_value)
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Parameter '{param_name}' must be an integer, got {type(param_value).__name__}"
                    )
        elif expected_type == "float":
            if not isinstance(param_value, (int, float)):
                try:
                    params[param_name] = float(param_value)
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Parameter '{param_name}' must be a number, got {type(param_value).__name__}"
                    )

        # Range validation
        if hasattr(param_def, 'min') and param_def.min is not None:
            if params[param_name] < param_def.min:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Parameter '{param_name}' must be >= {param_def.min}, got {params[param_name]}"
                )
        if hasattr(param_def, 'max') and param_def.max is not None:
            if params[param_name] > param_def.max:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Parameter '{param_name}' must be <= {param_def.max}, got {params[param_name]}"
                )


# =============================================================================
# CRUD Endpoints
# =============================================================================

@router.get("", response_model=List[IndicatorConfigResponse])
async def get_indicator_configs(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> List[IndicatorConfigResponse]:
    """
    Retrieve all indicator configurations for the authenticated user.

    Returns all indicators stored in the database for the current user,
    including their parameters, styling, and visibility state.

    Performance Target: <2 seconds (SC-001)
    """
    # Get user ID from Firebase token
    result = await db.execute(
        select(User).where(User.firebase_uid == user['uid'])
    )
    db_user = result.scalar_one_or_none()

    if db_user is None:
        # New user - no indicators stored yet
        return []

    user_id = db_user.id

    # Query all indicators for this user
    result = await db.execute(
        select(IndicatorConfig)
        .where(IndicatorConfig.user_id == user_id)
        .order_by(IndicatorConfig.created_at)
    )
    indicators = result.scalars().all()

    return [
        IndicatorConfigResponse(
            id=ind.id,
            uuid=str(ind.uuid),
            indicator_name=ind.indicator_name,
            indicator_category=ind.indicator_category,
            indicator_params=ind.indicator_params,
            display_name=ind.display_name,
            style=ind.style,
            is_visible=ind.is_visible,
            created_at=ind.created_at.isoformat(),
            updated_at=ind.updated_at.isoformat(),
        )
        for ind in indicators
    ]


@router.post("", response_model=IndicatorConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_indicator_config(
    config: IndicatorConfigCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> IndicatorConfigResponse:
    """
    Create a new indicator configuration.

    Creates a new indicator configuration for the authenticated user.
    A UUID is automatically generated for merge operations.

    Performance Target: <500ms (typical config)
    """
    # Get user ID from Firebase token
    result = await db.execute(
        select(User).where(User.firebase_uid == user['uid'])
    )
    db_user = result.scalar_one_or_none()

    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please sign in again."
        )

    user_id = db_user.id

    # T021a: Validate indicator parameters
    validate_indicator_params(config.indicator_name, config.indicator_params)

    # Create new indicator configuration
    new_config = IndicatorConfig(
        user_id=user_id,
        uuid=uuid.uuid4(),
        indicator_name=config.indicator_name,
        indicator_category=config.indicator_category,
        indicator_params=config.indicator_params,
        display_name=config.display_name,
        style=config.style.model_dump(),
        is_visible=config.is_visible,
    )

    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)

    return IndicatorConfigResponse(
        id=new_config.id,
        uuid=str(new_config.uuid),
        indicator_name=new_config.indicator_name,
        indicator_category=new_config.indicator_category,
        indicator_params=new_config.indicator_params,
        display_name=new_config.display_name,
        style=new_config.style,
        is_visible=new_config.is_visible,
        created_at=new_config.created_at.isoformat(),
        updated_at=new_config.updated_at.isoformat(),
    )


@router.put("/{config_uuid}", response_model=IndicatorConfigResponse)
async def update_indicator_config(
    config_uuid: str,
    config: IndicatorConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> IndicatorConfigResponse:
    """
    Update an existing indicator configuration.

    Updates the specified fields of an indicator configuration.
    Only provided fields are updated (partial update).

    Performance Target: <500ms
    """
    # Get user ID from Firebase token
    result = await db.execute(
        select(User).where(User.firebase_uid == user['uid'])
    )
    db_user = result.scalar_one_or_none()

    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please sign in again."
        )

    user_id = db_user.id

    # Parse UUID
    try:
        config_uuid_parsed = uuid.UUID(config_uuid)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )

    # Find the indicator configuration
    result = await db.execute(
        select(IndicatorConfig)
        .where(
            IndicatorConfig.user_id == user_id,
            IndicatorConfig.uuid == config_uuid_parsed
        )
    )
    existing_config = result.scalar_one_or_none()

    if existing_config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Indicator configuration not found"
        )

    # T021a: Validate indicator parameters if provided
    if config.indicator_params is not None:
        validate_indicator_params(existing_config.indicator_name, config.indicator_params)

    # Update provided fields
    if config.indicator_params is not None:
        existing_config.indicator_params = config.indicator_params
    if config.display_name is not None:
        existing_config.display_name = config.display_name
    if config.style is not None:
        existing_config.style = config.style.model_dump()
    if config.is_visible is not None:
        existing_config.is_visible = config.is_visible

    # updated_at is automatically updated by SQLAlchemy onupdate

    await db.commit()
    await db.refresh(existing_config)

    return IndicatorConfigResponse(
        id=existing_config.id,
        uuid=str(existing_config.uuid),
        indicator_name=existing_config.indicator_name,
        indicator_category=existing_config.indicator_category,
        indicator_params=existing_config.indicator_params,
        display_name=existing_config.display_name,
        style=existing_config.style,
        is_visible=existing_config.is_visible,
        created_at=existing_config.created_at.isoformat(),
        updated_at=existing_config.updated_at.isoformat(),
    )


@router.delete("/{config_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_indicator_config(
    config_uuid: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> None:
    """
    Delete an indicator configuration.

    Permanently deletes the specified indicator configuration.
    This operation cannot be undone.

    Performance Target: <500ms
    """
    # Get user ID from Firebase token
    result = await db.execute(
        select(User).where(User.firebase_uid == user['uid'])
    )
    db_user = result.scalar_one_or_none()

    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please sign in again."
        )

    user_id = db_user.id

    # Parse UUID
    try:
        config_uuid_parsed = uuid.UUID(config_uuid)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )

    # Find the indicator configuration
    result = await db.execute(
        select(IndicatorConfig)
        .where(
            IndicatorConfig.user_id == user_id,
            IndicatorConfig.uuid == config_uuid_parsed
        )
    )
    existing_config = result.scalar_one_or_none()

    if existing_config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Indicator configuration not found"
        )

    # Delete the configuration
    await db.delete(existing_config)
    await db.commit()

    return None
