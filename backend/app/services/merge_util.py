"""
Shared idempotent upsert utility for user entities (FR-013, FR-013a).

Uses upsert-by-UUID with updated_at comparison. If timestamps are equal
within tolerance, prefers the cloud version (deterministic tiebreaker).

This is a single shared implementation used by all merge operations
(alerts, watchlists, layouts) to prevent inconsistent behavior.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Type, TypeVar, Generic, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

# ±2 minutes tolerance for merge timestamp comparison (FR-010)
MERGE_TIMESTAMP_TOLERANCE_MS = 120000


T = TypeVar('T')  # Generic model type


def should_update(guest_updated: datetime, cloud_updated: datetime) -> bool:
    """
    Determine if guest data should overwrite cloud data.

    Merge rule (FR-013, FR-010):
        - If guest.updated_at > cloud.updated_at + 2 minutes: update (guest wins)
        - If |guest.updated_at - cloud.updated_at| <= 2 minutes: keep existing (prefer cloud, deterministic)
        - Else: keep existing (cloud wins)

    Args:
        guest_updated: Timestamp from guest data (localStorage)
        cloud_updated: Timestamp from cloud data (PostgreSQL)

    Returns:
        True if guest is significantly newer (> 2 min), False otherwise
    """
    # Calculate time difference
    time_diff = guest_updated - cloud_updated
    time_diff_ms = abs(time_diff.total_seconds() * 1000)

    # Guest is significantly newer (more than tolerance)
    if time_diff.total_seconds() > 0 and time_diff_ms > MERGE_TIMESTAMP_TOLERANCE_MS:
        return True

    # Within tolerance or cloud is newer → prefer cloud
    return False


async def upsert_alert(
    db: AsyncSession,
    user_id: int,
    guest_alerts: List[Dict[str, Any]],
) -> Dict[str, int]:
    """
    Upsert guest alerts to cloud using upsert-by-UUID strategy.

    Args:
        db: Database session
        user_id: User ID to associate alerts with
        guest_alerts: List of guest alert dicts from localStorage

    Returns:
        Dict with counts: {added: int, updated: int, skipped: int}
    """
    from app.models.alert import Alert

    stats = {'added': 0, 'updated': 0, 'skipped': 0}

    if not guest_alerts:
        return stats

    for guest_alert in guest_alerts:
        guest_uuid = guest_alert['uuid']
        guest_updated_at = datetime.fromisoformat(guest_alert['updated_at'].replace('Z', '+00:00'))

        # Check if alert exists in cloud
        result = await db.execute(
            select(Alert).where(
                Alert.user_id == user_id,
                Alert.uuid == guest_uuid
            )
        )
        existing_alert = result.scalar_one_or_none()

        if existing_alert is None:
            # Create new alert
            new_alert = Alert(
                user_id=user_id,
                uuid=guest_uuid,
                symbol_id=guest_alert.get('symbol_id'),  # Need to map symbol to ID
                condition=guest_alert.get('condition'),
                threshold=guest_alert.get('target'),  # Map target → threshold
                indicator_name=guest_alert.get('indicator_name'),
                indicator_field=guest_alert.get('indicator_field'),
                indicator_params=guest_alert.get('indicator_params'),
                is_active=guest_alert.get('enabled', True),  # Map enabled → is_active
                created_at=datetime.fromisoformat(guest_alert['created_at'].replace('Z', '+00:00')),
                updated_at=guest_updated_at,
            )
            db.add(new_alert)
            stats['added'] += 1
        else:
            # Check if we should update based on timestamps
            if should_update(guest_updated_at, existing_alert.updated_at):
                # Update existing alert
                existing_alert.condition = guest_alert.get('condition')
                existing_alert.threshold = guest_alert.get('target')
                existing_alert.is_active = guest_alert.get('enabled', True)
                existing_alert.updated_at = guest_updated_at
                stats['updated'] += 1
            else:
                # Skip - cloud is more recent or within tolerance
                stats['skipped'] += 1

    await db.commit()
    return stats


async def upsert_watchlist(
    db: AsyncSession,
    user_id: int,
    guest_watchlist: Dict[str, Any],
) -> Dict[str, int]:
    """
    Upsert guest watchlist to cloud.

    Watchlists merge symbols arrays instead of replacing entire entity,
    but timestamp comparison uses same tolerance logic as should_update().

    Merge rule (FR-013):
        - If guest.updated_at > cloud.updated_at + 2 minutes: use guest's sort_order as base
        - If |guest.updated_at - cloud.updated_at| <= 2 minutes: use cloud's sort_order (prefer cloud)
        - Else: use cloud's sort_order (cloud is more recent)
        - Append any new symbols from non-base list (deduplicated)

    Args:
        db: Database session
        user_id: User ID to associate watchlist with
        guest_watchlist: Guest watchlist dict from localStorage

    Returns:
        Dict with counts: {added: int, updated: int, skipped: int}
    """
    from app.models.user_watchlist import UserWatchlist

    stats = {'added': 0, 'updated': 0, 'skipped': 0}

    if not guest_watchlist:
        return stats

    guest_uuid = guest_watchlist['uuid']
    guest_updated_at = datetime.fromisoformat(guest_watchlist['updated_at'].replace('Z', '+00:00'))
    guest_symbols = guest_watchlist.get('symbols', [])
    guest_sort_order = guest_watchlist.get('sort_order', [])

    # Skip empty watchlists - don't create entries with no symbols
    if not guest_symbols:
        return stats

    # Check if watchlist exists in cloud
    result = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.user_id == user_id,
            UserWatchlist.uuid == guest_uuid
        )
    )
    existing_watchlist = result.scalar_one_or_none()

    if existing_watchlist is None:
        # Create new watchlist
        new_watchlist = UserWatchlist(
            user_id=user_id,
            uuid=guest_uuid,
            symbols=guest_symbols,
            sort_order=guest_sort_order,
            created_at=datetime.fromisoformat(guest_watchlist['created_at'].replace('Z', '+00:00')),
            updated_at=guest_updated_at,
        )
        db.add(new_watchlist)
        stats['added'] += 1
    else:
        # Check if we should update based on timestamps
        if should_update(guest_updated_at, existing_watchlist.updated_at):
            # Merge symbols arrays (deduplicate)
            cloud_symbols = existing_watchlist.symbols or []
            merged_symbols = list(dict.fromkeys(guest_symbols + cloud_symbols))

            existing_watchlist.symbols = merged_symbols
            existing_watchlist.sort_order = merged_symbols  # Use merged list as sort order
            existing_watchlist.updated_at = guest_updated_at
            stats['updated'] += 1
        else:
            # Cloud is newer or within tolerance - but still add any new symbols
            cloud_symbols = existing_watchlist.symbols or []
            new_symbols = [s for s in guest_symbols if s not in cloud_symbols]
            if new_symbols:
                merged_symbols = cloud_symbols + new_symbols
                existing_watchlist.symbols = merged_symbols
                existing_watchlist.sort_order = merged_symbols
                # Don't update updated_at since we're just adding symbols
                stats['updated'] += 1
            else:
                stats['skipped'] += 1

    await db.commit()
    return stats


async def upsert_layouts(
    db: AsyncSession,
    user_id: int,
    guest_layouts: List[Dict[str, Any]],
) -> Dict[str, int]:
    """
    Upsert guest layouts to cloud using upsert-by-UUID strategy.

    Args:
        db: Database session
        user_id: User ID to associate layouts with
        guest_layouts: List of guest layout dicts from localStorage

    Returns:
        Dict with counts: {added: int, updated: int, skipped: int}
    """
    from app.models.layout import Layout

    stats = {'added': 0, 'updated': 0, 'skipped': 0}

    if not guest_layouts:
        return stats

    for guest_layout in guest_layouts:
        guest_uuid = guest_layout['uuid']
        guest_updated_at = datetime.fromisoformat(guest_layout['updated_at'].replace('Z', '+00:00'))

        # Check if layout exists in cloud
        result = await db.execute(
            select(Layout).where(
                Layout.user_id == user_id,
                Layout.uuid == guest_uuid
            )
        )
        existing_layout = result.scalar_one_or_none()

        if existing_layout is None:
            # Create new layout
            new_layout = Layout(
                user_id=user_id,
                uuid=guest_uuid,
                name=guest_layout['name'],
                config=guest_layout['config'],
                created_at=datetime.fromisoformat(guest_layout['created_at'].replace('Z', '+00:00')),
                updated_at=guest_updated_at,
            )
            db.add(new_layout)
            stats['added'] += 1
        else:
            # Check if we should update based on timestamps
            if should_update(guest_updated_at, existing_layout.updated_at):
                # Update existing layout
                existing_layout.name = guest_layout['name']
                existing_layout.config = guest_layout['config']
                existing_layout.updated_at = guest_updated_at
                stats['updated'] += 1
            else:
                # Skip - cloud is more recent or within tolerance
                stats['skipped'] += 1

    await db.commit()
    return stats


# Generic wrapper function for backward compatibility
async def upsert_by_uuid(
    db: AsyncSession,
    model: Type[T],
    items: List[Dict[str, Any]],
    user_id: int,
) -> None:
    """
    Generic upsert wrapper for backward compatibility.

    This function delegates to the specific upsert functions based on model type.

    Args:
        db: Database session
        model: SQLAlchemy model class (Alert, UserWatchlist, or Layout)
        items: List of items to upsert
        user_id: User ID to associate entities with
    """
    from app.models.alert import Alert
    from app.models.user_watchlist import UserWatchlist
    from app.models.layout import Layout

    # Early return for empty lists - nothing to do
    if not items:
        return

    # Get model name safely for comparison
    model_name = getattr(model, '__name__', str(model))

    if model == Alert or model_name == 'Alert':
        await upsert_alert(db, user_id, items)
    elif model == UserWatchlist or model_name == 'UserWatchlist':
        # Watchlist is a single item, not a list
        await upsert_watchlist(db, user_id, items[0] if isinstance(items, list) else items)
    elif model == Layout or model_name == 'Layout':
        await upsert_layouts(db, user_id, items)
    else:
        raise ValueError(f"Unsupported model type: {model_name}")
