"""
Watchlist Service for managing the global shared watchlist (User Story 1)

Handles adding, removing, and listing watchlist entries with automatic
historical data backfill.
"""
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.watchlist import WatchlistEntry
from app.models.symbol import Symbol
from app.services.backfill import BackfillService

logger = logging.getLogger(__name__)


async def get_symbol_by_ticker(db: AsyncSession, ticker: str) -> Symbol | None:
    """Get a symbol by ticker.

    Args:
        db: Database session
        ticker: Stock ticker symbol

    Returns:
        Symbol instance or None if not found
    """
    stmt = select(Symbol).where(Symbol.ticker == ticker.upper())
    result = await db.execute(stmt)
    return result.scalars().first()


async def get_or_create_symbol(db: AsyncSession, ticker: str) -> Symbol | None:
    """Get existing symbol or create new one.

    Args:
        db: Database session
        ticker: Stock ticker symbol

    Returns:
        Symbol instance or None if invalid ticker
    """
    # Try to get existing symbol from DB first
    symbol = await get_symbol_by_ticker(db, ticker)
    if symbol:
        return symbol

    # Validate ticker with Yahoo Finance if not found in DB
    import yfinance as yf
    try:
        # Use asyncio.to_thread to avoid blocking the event loop
        def fetch_info():
            ticker_obj = yf.Ticker(ticker.upper())
            return ticker_obj.info

        info = await asyncio.to_thread(fetch_info)

        # Check if ticker has valid data from Yahoo Finance
        if not info or 'symbol' not in info or not info.get('symbol'):
            return None  # Invalid ticker

        # Use the symbol from Yahoo Finance as name
        name = info.get('longName', info.get('shortName', f"{ticker.upper()} Stock"))

        # Attempt to create symbol with concurrency safety
        symbol = Symbol(ticker=ticker.upper(), name=name)
        db.add(symbol)

        # Use a retry pattern to handle potential IntegrityError from concurrent requests
        try:
            await db.flush()
        except IntegrityError:
            # Another request may have created the same symbol concurrently
            await db.rollback()
            # Re-query to get the symbol created by the other request
            symbol = await get_symbol_by_ticker(db, ticker)
            return symbol

    except Exception:
        return None  # Invalid ticker

    return symbol


class WatchlistService:
    """Service for managing the global shared watchlist."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.backfill_service = BackfillService(db)

    async def add_to_watchlist(self, ticker: str) -> dict:
        """Add a ticker to the watchlist with historical data backfill.

        Transaction flow (atomic):
        1. Get or create symbol entry (validates with Yahoo Finance if not in DB)
        2. Backfill full historical daily data (60s timeout)
        3. Create watchlist entry
        4. Commit transaction

        If any step fails, the entire transaction is rolled back.

        Args:
            ticker: Stock ticker symbol (e.g., "AAPL")

        Returns:
            Dict with:
                - status: "added" or "already_present"
                - symbol: The ticker symbol
                - candles_backfilled: Number of candles (only when status="added")

        Raises:
            ValueError: With specific error messages:
                - "invalid_ticker: {ticker} not found in Yahoo Finance"
                - "no_data: No historical data available for {ticker}"
            asyncio.TimeoutError: "timeout: Backfill for {ticker} exceeded 60 second limit"
            Exception: "rate_limited: yfinance rate limit exceeded, please try again later"
        """
        import asyncio  # Import here to avoid issues
        ticker_upper = ticker.upper()

        # Step 1 & 2: Get or create symbol
        print(f"[DEBUG] Resolving symbol for {ticker_upper}...")
        symbol = await get_or_create_symbol(self.db, ticker_upper)
        if not symbol:
            # T050: Specific error message for invalid ticker
            raise ValueError(
                f"invalid_ticker: {ticker} not found in Yahoo Finance"
            )
        print(f"[DEBUG] Symbol resolved: {symbol.id} ({symbol.ticker})")

        # Check if already in watchlist
        existing_stmt = select(WatchlistEntry).where(
            WatchlistEntry.symbol_id == symbol.id
        )
        existing_result = await self.db.execute(existing_stmt)
        entry = existing_result.scalars().first()
        if entry:
            print(f"[DEBUG] Symbol {ticker_upper} already in watchlist (ID: {entry.id})")
            return {
                'status': 'already_present',
                'symbol': ticker_upper,
                'id': entry.id,
                'added_at': entry.added_at.isoformat() if entry.added_at else None,
                'sort_order': entry.sort_order
            }

        # Step 3: Backfill historical data (only if needed)
        # Check if we already have data to avoid re-downloading on re-add
        from app.models.candle import Candle
        from sqlalchemy import func
        
        print(f"[DEBUG] Checking existing candle count for {ticker_upper}...")
        count_stmt = select(func.count()).select_from(Candle).where(
            Candle.symbol_id == symbol.id,
            Candle.interval == '1d'
        )
        count_result = await self.db.execute(count_stmt)
        existing_candles_count = count_result.scalar() or 0
        print(f"[DEBUG] Found {existing_candles_count} existing candles for {ticker_upper}")
        
        candles_count = 0
        # If we have less than 200 candles (approx 1 year trading days), backfill
        if existing_candles_count < 200:
            print(f"[DEBUG] Candle count < 200. Initiating backfill for {ticker_upper}...")
            try:
                candles_count = await self.backfill_service.backfill_historical(symbol)
                print(f"[DEBUG] Backfill complete. Added {candles_count} candles.")
            except asyncio.TimeoutError as e:
                # T050: Specific error message for timeout
                logger.error(f"timeout: Backfill for {ticker_upper} exceeded 60 second limit")
                raise asyncio.TimeoutError(
                    f"timeout: Backfill for {ticker_upper} exceeded 60 second limit"
                ) from e
            except ValueError as e:
                if "No historical data available" in str(e):
                    # T050: Specific error message for no data
                    logger.error(f"no_data: No historical data available for {ticker_upper}")
                    raise ValueError(
                        f"no_data: No historical data available for {ticker_upper}"
                    ) from e
                else:
                    # Re-raise other ValueErrors
                    raise
            except Exception as e:
                # Check for rate limit error from yfinance
                error_msg = str(e).lower()
                if 'rate limit' in error_msg or 'too many requests' in error_msg:
                    # T050: Specific error message for rate limiting
                    logger.error(f"rate_limited: yfinance rate limit exceeded for {ticker_upper}")
                    raise Exception(
                        f"rate_limited: yfinance rate limit exceeded, please try again later"
                    ) from e
                else:
                    # Log and re-raise other exceptions
                    logger.error(f"backfill_failed for {ticker_upper}: {e}")
                    raise
        else:
            logger.info(f"skipping_backfill: {ticker_upper} has {existing_candles_count} candles")
            print(f"[DEBUG] Skipping backfill. {ticker_upper} has sufficient data ({existing_candles_count} candles).")
            candles_count = existing_candles_count

        # Step 4: Create watchlist entry (only after successful backfill)
        print(f"[DEBUG] Creating WatchlistEntry for {ticker_upper}...")

        # Calculate next sort_order value (single-statement approach to avoid race condition)
        from sqlalchemy import func
        max_order_stmt = select(func.coalesce(func.max(WatchlistEntry.sort_order), -1))
        max_order_result = await self.db.execute(max_order_stmt)
        max_order = max_order_result.scalar()
        next_order = max_order + 1 if max_order is not None else 0
        print(f"[DEBUG] Assigning sort_order={next_order} to {ticker_upper}")

        entry = WatchlistEntry(symbol_id=symbol.id, sort_order=next_order)
        self.db.add(entry)
        await self.db.commit()  # Explicitly commit the transaction
        await self.db.refresh(entry)
        print(f"[DEBUG] WatchlistEntry created. ID: {entry.id}")

        return {
            'status': 'added',
            'symbol': ticker_upper,
            'candles_backfilled': candles_count,
            'id': entry.id,
            'added_at': entry.added_at.isoformat() if entry.added_at else None,
            'sort_order': entry.sort_order
        }

    async def remove_from_watchlist(self, ticker: str) -> None:
        """Remove a ticker from the watchlist.

        Args:
            ticker: Stock ticker symbol

        Raises:
            ValueError: If ticker not found or not in watchlist
        """
        ticker_upper = ticker.upper()

        # Get symbol
        symbol = await get_symbol_by_ticker(self.db, ticker_upper)
        if not symbol:
            raise ValueError(f"Invalid ticker: {ticker}")

        # Get watchlist entry
        stmt = select(WatchlistEntry).where(
            WatchlistEntry.symbol_id == symbol.id
        )
        result = await self.db.execute(stmt)
        entry = result.scalars().first()

        if not entry:
            raise ValueError(f"{ticker} not found in watchlist")

        # Delete entry
        await self.db.delete(entry)
        await self.db.commit()

    async def list_watchlist(self) -> list[dict]:
        """List all watchlist entries ordered by custom sort_order.

        Returns:
            List of dicts with:
                - id: Watchlist entry ID
                - symbol: Ticker symbol
                - added_at: When the symbol was added (ISO format)
                - sort_order: Custom display order
        """
        stmt = (
            select(WatchlistEntry)
            .options(joinedload(WatchlistEntry.symbol))
            .order_by(WatchlistEntry.sort_order, WatchlistEntry.id)
        )
        result = await self.db.execute(stmt)
        entries = result.scalars().all()

        print(f"[DEBUG] DB returned {len(entries)} watchlist entries")

        return [
            {
                'id': entry.id,
                'symbol': entry.symbol.ticker,
                'added_at': entry.added_at.isoformat() if entry.added_at else None,
                'sort_order': entry.sort_order
            }
            for entry in entries
        ]

    async def update_watchlist_order(self, ordered_symbols: list[str]) -> None:
        """Update the sort_order of watchlist entries.

        Validates that all symbols exist in the watchlist and that there are no
        duplicates in the ordered list. Uses row-level locking to prevent race
        conditions during concurrent updates.

        Args:
            ordered_symbols: List of ticker symbols in their desired order (0-based)

        Raises:
            ValueError: If any symbol is not found in watchlist or if duplicates exist
        """
        # Validate no duplicates in ordered_symbols
        if len(ordered_symbols) != len(set(ordered_symbols)):
            duplicates = [sym for sym in ordered_symbols if ordered_symbols.count(sym) > 1]
            raise ValueError(f"Duplicate symbols in order list: {set(duplicates)}")

        # Use transaction with row-level locking to prevent concurrent updates
        async with self.db.begin():
            # Lock rows to prevent concurrent reorders
            # Note: Can't use joinedload with for_update() due to PostgreSQL limitation
            # Fetch entries first, then symbols separately
            stmt = (
                select(WatchlistEntry)
                .with_for_update()
            )
            result = await self.db.execute(stmt)
            entries = result.scalars().all()

            # Fetch all symbols in a separate query
            symbol_ids = [entry.symbol_id for entry in entries]
            symbol_stmt = select(Symbol).where(Symbol.id.in_(symbol_ids))
            symbol_result = await self.db.execute(symbol_stmt)
            symbols = symbol_result.scalars().all()

            # Build symbol_id -> symbol mapping
            id_to_symbol = {s.id: s for s in symbols}

            # Build symbol -> entry mapping
            symbol_to_entry = {}
            for entry in entries:
                symbol = id_to_symbol.get(entry.symbol_id)
                if symbol:
                    symbol_to_entry[symbol.ticker] = entry

            # Validate all symbols exist in watchlist
            missing_symbols = set(ordered_symbols) - set(symbol_to_entry.keys())
            if missing_symbols:
                raise ValueError(f"Symbols not in watchlist: {missing_symbols}")

            # Validate we're updating all entries (no partial reorders)
            if len(ordered_symbols) != len(entries):
                raise ValueError(
                    f"Must provide all {len(entries)} watchlist symbols, "
                    f"but got {len(ordered_symbols)}"
                )

            # Update sort_order values (0-based sequential)
            for index, symbol in enumerate(ordered_symbols):
                entry = symbol_to_entry[symbol]
                entry.sort_order = index

            # Transaction commits automatically on success
            logger.info(f"Updated sort_order for {len(ordered_symbols)} watchlist entries")
