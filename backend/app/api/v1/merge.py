"""
Merge API endpoints for guest-to-user data synchronization.

These endpoints handle:
- Merging localStorage guest data with cloud data on sign-in
- Getting merge status (counts of stored entities)
- Idempotent upsert-by-UUID merge operations

All endpoints are protected (require valid Firebase ID token with email_verified).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.services.auth_middleware import get_current_user
from app.services.merge_util import upsert_alert, upsert_watchlist, upsert_layouts
from app.db.session import AsyncSessionLocal
from sqlalchemy import select, func
from app.models.alert import Alert
from app.models.user_watchlist import UserWatchlist
from app.models.layout import Layout
from app.models.user import User

router = APIRouter()


# =============================================================================
# Request/Response Schemas
# =============================================================================

class GuestAlert(BaseModel):
    """Guest alert from localStorage."""
    uuid: str
    symbol: str
    condition: str
    target: float
    enabled: bool = True
    created_at: str
    updated_at: str


class GuestWatchlist(BaseModel):
    """Guest watchlist from localStorage."""
    uuid: str
    symbols: List[str]
    sort_order: List[str]
    created_at: str
    updated_at: str


class GuestLayout(BaseModel):
    """Guest layout from localStorage."""
    uuid: str
    name: str
    config: Dict[str, Any]
    created_at: str
    updated_at: str


class MergeRequest(BaseModel):
    """Guest data merge request."""
    schemaVersion: int
    alerts: List[GuestAlert]
    watchlist: GuestWatchlist
    layouts: List[GuestLayout]


class MergeEntityStats(BaseModel):
    """Statistics for a single entity type after merge."""
    added: int
    updated: int
    skipped: int


class MergeResponse(BaseModel):
    """Merge response with statistics."""
    message: str
    stats: Dict[str, MergeEntityStats]


class MergeStatus(BaseModel):
    """Merge status (counts of stored entities)."""
    alerts: int
    watchlists: int
    layouts: int


# =============================================================================
# Protected Endpoints (require valid Firebase ID token)
# =============================================================================

@router.post("/sync", response_model=MergeResponse)
async def merge_guest_data(
    request: MergeRequest,
    user: dict = Depends(get_current_user),
):
    """
    Merge guest localStorage data with cloud data.

    Uses upsert-by-UUID strategy with timestamp comparison (±2 minute tolerance).
    - If UUID doesn't exist: insert as new
    - If guest.updated_at > cloud.updated_at + 2 min: update
    - If timestamps within ±2 min: keep cloud (prefer cloud)
    - Else: keep cloud

    Watchlists merge symbols arrays (deduplicated) but use same timestamp logic.
    """
    # Get user ID from Firebase token
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.firebase_uid == user['uid'])
        )
        db_user = result.scalar_one_or_none()

        if db_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found. Please sign in again.",
            )

        user_id = db_user.id

        # Merge alerts
        alerts_data = [alert.model_dump() for alert in request.alerts]
        # Need to map symbol names to symbol_ids for alerts
        # For now, we'll store the symbol name and handle mapping later
        alerts_stats = await upsert_alert(db, user_id, alerts_data)

        # Merge watchlist
        watchlist_data = request.watchlist.model_dump()
        watchlist_stats = await upsert_watchlist(db, user_id, watchlist_data)

        # Merge layouts
        layouts_data = [layout.model_dump() for layout in request.layouts]
        layouts_stats = await upsert_layouts(db, user_id, layouts_data)

    return MergeResponse(
        message="Merge completed successfully",
        stats={
            "alerts": MergeEntityStats(**alerts_stats),
            "watchlist": MergeEntityStats(**watchlist_stats),
            "layouts": MergeEntityStats(**layouts_stats),
        }
    )


@router.get("/status", response_model=MergeStatus)
async def get_merge_status(user: dict = Depends(get_current_user)):
    """
    Get merge status (counts of stored entities for user).

    Returns the number of alerts, watchlists, and layouts stored in the cloud.
    """
    async with AsyncSessionLocal() as db:
        # Get user ID from Firebase token
        result = await db.execute(
            select(User).where(User.firebase_uid == user['uid'])
        )
        db_user = result.scalar_one_or_none()

        if db_user is None:
            # New user - no data stored yet
            return MergeStatus(alerts=0, watchlists=0, layouts=0)

        user_id = db_user.id

        # Count alerts
        alerts_result = await db.execute(
            select(func.count(Alert.id)).where(Alert.user_id == user_id)
        )
        alerts_count = alerts_result.scalar() or 0

        # Count watchlists
        watchlists_result = await db.execute(
            select(func.count(UserWatchlist.id)).where(UserWatchlist.user_id == user_id)
        )
        watchlists_count = watchlists_result.scalar() or 0

        # Count layouts
        layouts_result = await db.execute(
            select(func.count(Layout.id)).where(Layout.user_id == user_id)
        )
        layouts_count = layouts_result.scalar() or 0

    return MergeStatus(
        alerts=alerts_count,
        watchlists=watchlists_count,
        layouts=layouts_count,
    )
