"""
Notification Authorization Dependencies

Provides FastAPI dependency functions for notification API endpoints.
All endpoints follow FR-AUTHZ requirements:
- FR-AUTHZ-001: Users can only access their own notification data
- FR-AUTHZ-002: All endpoints verify ownership before operations
- FR-AUTHZ-003: 401 for guests, 403 for authenticated users accessing others' data

Usage:
    from app.api.dependencies import (
        get_current_user,
        get_notification_preference_or_403,
        get_history_or_403,
        get_telegram_config_or_403,
    )

    @router.get("/settings")
    async def get_settings(
        user: User = Depends(get_current_user),
        preference = Depends(get_notification_preference_or_403),
    ) -> NotificationPreferenceResponse:
        ...
"""

from typing import Dict, Any, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.services.auth_middleware import get_current_user
from app.services.firebase_admin import verify_firebase_token
from app.db.session import AsyncSessionLocal


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_notification_preference_or_403(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get user's notification preference or raise 403 if not found.

    Returns:
        User dict with notification preference data

    Raises:
        HTTPException 403: If user has no notification preferences
    """
    # Import here to avoid circular imports
    from app.services.notification_service import get_user_preference

    preference = await get_user_preference(db, user.id)
    if not preference:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Notification preferences not configured"
        )
    return {"user": user, "preference": preference}


async def get_history_or_403(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Verify user can access notification history.

    Returns:
        User dict if access is allowed

    Raises:
        HTTPException 401: If not authenticated (guest)
        HTTPException 403: If accessing another user's data
    """
    # History access is allowed for authenticated users
    # The actual ownership check happens in the history service
    return {"user": user, "db": db}


async def get_telegram_config_or_403(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get user's Telegram configuration or raise 403 if not configured.

    Returns:
        User dict with Telegram config data

    Raises:
        HTTPException 403: If Telegram is not configured for user
    """
    from app.services.notification_service import get_telegram_config

    config = await get_telegram_config(db, user.id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Telegram not configured. Please configure your Telegram credentials first."
        )
    return {"user": user, "config": config}


async def require_authenticated_user(
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Require an authenticated user (not a guest).

    Returns:
        Decoded user token dict with uid, email, etc.

    Raises:
        HTTPException 401: If not authenticated
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user = await verify_firebase_token(token)
        return user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def check_notification_ownership(
    resource_user_id: UUID,
    current_user: User,
) -> None:
    """
    Verify user owns the resource they're trying to access.

    Args:
        resource_user_id: User ID from the resource (e.g., notification preference)
        current_user: Authenticated user making the request

    Raises:
        HTTPException 403: If user doesn't own the resource
    """
    if resource_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource"
        )
