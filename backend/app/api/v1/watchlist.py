"""
Watchlist API endpoints (Per-User Watchlist)

Provides REST API for managing the user's personal watchlist with automatic
historical data backfill.
"""
import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel, Field, field_validator

from app.db.session import get_db
from app.services.auth_middleware import get_current_user
from app.api.decorators import public_endpoint
from app.models.user import User
from app.models.user_watchlist import UserWatchlist
from app.services.watchlist import get_or_create_symbol

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Request/Response Schemas ---

class WatchlistAddRequest(BaseModel):
    """Request schema for adding a ticker to watchlist."""
    symbol: str = Field(..., description="Stock ticker symbol (Yahoo Finance-valid tickers except crypto formats containing -USD or / followed by USD)")

    @field_validator('symbol')
    @classmethod
    def uppercase_and_validate_symbol(cls, v: str) -> str:
        # Normalize: uppercase and trim whitespace
        symbol = v.strip().upper()

        # T029: Reject crypto ticker formats (*-USD, */USD)
        if '-' in symbol and symbol.endswith('-USD'):
            raise ValueError("Crypto tickers with -USD format not supported in watchlist add/backfill")
        if '/' in symbol and symbol.endswith('/USD'):
            raise ValueError("Crypto tickers with /USD format not supported in watchlist add/backfill")

        return symbol


class WatchlistEntry(BaseModel):
    """Watchlist entry schema for per-user watchlist."""
    id: int
    symbol: str
    added_at: str
    sort_order: int

    model_config = {"from_attributes": True}


class UserWatchlistResponse(BaseModel):
    """Per-user watchlist response schema."""
    uuid: str
    symbols: list[str]
    sort_order: list[str]
    created_at: str
    updated_at: str


class WatchlistAddResponse(BaseModel):
    """Response schema for watchlist add operation."""
    status: str = Field(..., description="'added' or 'already_present'")
    symbol: str


class WatchlistReorderRequest(BaseModel):
    """Request schema for reordering watchlist entries."""
    ordered_symbols: list[str] = Field(..., description="List of symbols in desired order")

    @field_validator('ordered_symbols')
    @classmethod
    def non_empty_and_uppercase(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("ordered_symbols cannot be empty")
        # Normalize to uppercase
        return [sym.strip().upper() for sym in v]


class ErrorResponse(BaseModel):
    """Error response schema."""
    detail: str


# --- API Endpoints ---

@router.get("", response_model=list[WatchlistEntry], tags=["watchlist"])
async def list_watchlist(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """List all watchlist entries for the authenticated user.

    Returns all symbols in the user's personal watchlist.
    """
    # Get user from database - use first() to avoid MultipleResultsFound error
    result = await db.execute(
        select(User).where(User.firebase_uid == user['uid']).limit(1)
    )
    db_user = result.first()
    db_user = db_user[0] if db_user else None

    if db_user is None:
        return []

    # Get user's watchlist - prioritize non-empty watchlists, then by updated_at
    result = await db.execute(
        select(UserWatchlist)
        .where(UserWatchlist.user_id == db_user.id)
        .order_by(
            func.coalesce(func.array_length(UserWatchlist.symbols, 1), 0).desc(),
            UserWatchlist.updated_at.desc()
        )
        .limit(1)
    )
    watchlist = result.first()
    watchlist = watchlist[0] if watchlist else None

    if watchlist is None or not (watchlist.sort_order or watchlist.symbols):
        return []

    # Convert sort_order array to WatchlistEntry format (respect user's custom order)
    # Fall back to symbols array if sort_order is empty
    display_order = watchlist.sort_order or watchlist.symbols or []
    sort_order_map = {sym.upper(): idx for idx, sym in enumerate(display_order)}
    entries = []
    for symbol in display_order:
        symbol_upper = symbol.upper()
        # Use sort_order index + 1 for the sort_order field (1-indexed)
        sort_idx = sort_order_map.get(symbol_upper, 0)
        entries.append(WatchlistEntry(
            id=sort_idx + 1,
            symbol=symbol_upper,
            added_at=watchlist.created_at.isoformat() if watchlist.created_at else datetime.now(timezone.utc).isoformat(),
            sort_order=sort_idx + 1
        ))

    print(f"[DEBUG] GET /watchlist returning {len(entries)} entries for user {user['uid']}")

    return entries


@router.post("", response_model=WatchlistAddResponse, tags=["watchlist"])
async def add_to_watchlist(
    request: WatchlistAddRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Add a symbol to the user's watchlist.

    Returns 201 with status "added" on success.
    Returns 200 with status "already_present" if ticker already in watchlist.
    """
    from fastapi import status
    from fastapi.responses import JSONResponse

    # Get or create user - use first() to avoid MultipleResultsFound error
    result = await db.execute(
        select(User).where(User.firebase_uid == user['uid']).limit(1)
    )
    db_user = result.first()
    db_user = db_user[0] if db_user else None

    if db_user is None:
        db_user = User(
            firebase_uid=user['uid'],
            email=user.get('email', ''),
            email_verified=user.get('email_verified', False),
            display_name=user.get('display_name'),
            photo_url=user.get('photo_url'),
        )
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)

    # Get user's watchlist - prioritize non-empty watchlists, then by updated_at
    # This ensures we get the watchlist with actual symbols, not empty ones
    result = await db.execute(
        select(UserWatchlist)
        .where(UserWatchlist.user_id == db_user.id)
        .order_by(
            # First priority: most symbols (empty arrays have NULL length, sort last)
            func.coalesce(func.array_length(UserWatchlist.symbols, 1), 0).desc(),
            # Second priority: most recently updated
            UserWatchlist.updated_at.desc()
        )
        .limit(1)
    )
    watchlist = result.first()
    watchlist = watchlist[0] if watchlist else None

    now = datetime.now(timezone.utc)

    # Validate symbol and create entry in Symbol table for price lookups
    # This ensures that all watchlist symbols can be found by _get_price_for_symbol
    symbol_obj = await get_or_create_symbol(db, request.symbol)
    if symbol_obj is None:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ticker symbol: {request.symbol}"
        )

    if watchlist is None:
        watchlist = UserWatchlist(
            user_id=db_user.id,
            uuid=uuid.uuid4(),  # Generate unique UUID for each watchlist
            symbols=[request.symbol],
            sort_order=[request.symbol],
            created_at=now,
            updated_at=now
        )
        db.add(watchlist)
        await db.commit()
        return JSONResponse(
            content={"status": "added", "symbol": request.symbol},
            status_code=status.HTTP_201_CREATED
        )

    # Check if symbol already exists
    symbols = watchlist.symbols or []
    if request.symbol in symbols:
        return JSONResponse(
            content={"status": "already_present", "symbol": request.symbol},
            status_code=status.HTTP_200_OK
        )

    # Add symbol
    symbols.append(request.symbol)
    watchlist.symbols = symbols
    
    # Preserve custom sort_order - only append new symbol to the end
    # This fixes the bug where reordering was lost when adding new symbols
    sort_order = watchlist.sort_order or []
    if request.symbol not in sort_order:
        sort_order.append(request.symbol)
    watchlist.sort_order = sort_order
    
    watchlist.updated_at = now
    # Flag mutable columns as modified so SQLAlchemy persists them
    flag_modified(watchlist, "symbols")
    flag_modified(watchlist, "sort_order")
    await db.commit()

    return JSONResponse(
        content={"status": "added", "symbol": request.symbol},
        status_code=status.HTTP_201_CREATED
    )


@router.put("/order", response_model=dict, tags=["watchlist"])
async def update_watchlist_order(
    request: WatchlistReorderRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Update the order of watchlist entries for the authenticated user."""
    # Get user from database - use first() to avoid MultipleResultsFound error
    result = await db.execute(
        select(User).where(User.firebase_uid == user['uid']).limit(1)
    )
    db_user = result.first()
    db_user = db_user[0] if db_user else None

    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's watchlist - prioritize non-empty watchlists, then by updated_at
    result = await db.execute(
        select(UserWatchlist)
        .where(UserWatchlist.user_id == db_user.id)
        .order_by(
            func.coalesce(func.array_length(UserWatchlist.symbols, 1), 0).desc(),
            UserWatchlist.updated_at.desc()
        )
        .limit(1)
    )
    watchlist = result.first()
    watchlist = watchlist[0] if watchlist else None

    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    # Normalize both sides to uppercase for case-insensitive comparison
    existing_symbols = {sym.upper() for sym in (watchlist.symbols or [])}
    requested_symbols = {sym.upper() for sym in request.ordered_symbols}

    if existing_symbols != requested_symbols:
        missing = existing_symbols - requested_symbols
        extra = requested_symbols - existing_symbols
        raise HTTPException(
            status_code=400,
            detail=f"All watchlist symbols must be included in the reorder request. Missing: {missing}, Extra: {extra}"
        )

    # Update order with uppercase symbols for consistency
    watchlist.sort_order = [sym.upper() for sym in request.ordered_symbols]
    watchlist.updated_at = datetime.now(timezone.utc)
    # Flag mutable column as modified so SQLAlchemy persists it
    flag_modified(watchlist, "sort_order")
    await db.commit()

    return {"status": "success"}


@router.delete("/{symbol}", status_code=204, tags=["watchlist"])
async def remove_from_watchlist(
    symbol: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Remove a symbol from the user's watchlist."""
    # Get user from database - use first() to avoid MultipleResultsFound error
    result = await db.execute(
        select(User).where(User.firebase_uid == user['uid']).limit(1)
    )
    db_user = result.first()
    db_user = db_user[0] if db_user else None

    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's watchlist - prioritize non-empty watchlists, then by updated_at
    result = await db.execute(
        select(UserWatchlist)
        .where(UserWatchlist.user_id == db_user.id)
        .order_by(
            func.coalesce(func.array_length(UserWatchlist.symbols, 1), 0).desc(),
            UserWatchlist.updated_at.desc()
        )
        .limit(1)
    )
    watchlist = result.first()
    watchlist = watchlist[0] if watchlist else None

    if watchlist is None or not watchlist.symbols:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    # Remove symbol
    symbol_upper = symbol.upper()
    symbols = [s for s in watchlist.symbols if s != symbol_upper]
    watchlist.symbols = symbols

    # Update sort_order to match
    sort_order = [s for s in watchlist.sort_order if s != symbol_upper]
    watchlist.sort_order = sort_order

    watchlist.updated_at = datetime.now(timezone.utc)
    # Flag mutable columns as modified so SQLAlchemy persists them
    flag_modified(watchlist, "symbols")
    flag_modified(watchlist, "sort_order")
    await db.commit()
