#!/usr/bin/env python3
"""Add tickers to a user's watchlist directly via database."""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timezone
from uuid import UUID

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.core.config import settings
from app.models.user import User
from app.models.user_watchlist import UserWatchlist

# Tickers to add
TICKERS = [
    "ROG", "AGNC", "T", "SDIV", "AMD", "DIS", "PATH", "PPG", "TMO", "ADC",
    "LMT", "MARA", "UNP", "NVO", "TTED", "TROW", "EXP", "O", "PFF", "AWK",
    "ADP", "GOOG", "MSFT", "RIOT", "PG", "NKE", "PBR.A", "AMT", "NVDA", "CYTK",
    "ESS", "CDI^D", "TDOC", "ABBV", "AMZN", "AXON", "UPS", "HSY", "BITF", "ARM",
    "FTNT", "HOOD", "CBA^D", "JNJ", "SMCI", "COIN", "PFE", "ENB", "RIO", "MQ",
    "HD", "FDX", "DGX", "SYK", "MCD", "VZ", "PYPL", "SMSNL", "XYZ", "MBG",
    "BMW", "RIVN", "BA", "WFC", "CTSH", "PH", "BNP", "SIE", "MRK", "WBD",
    "WMT", "SAN"
]

DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


async def list_users(engine):
    """List all users in the database."""
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, firebase_uid, email FROM users ORDER BY id"))
        users = result.fetchall()
        print("\nExisting users:")
        for i, user in enumerate(users, 1):
            print(f"  {i}. ID={user[0]} UID={user[1]} Email={user[2]}")
        return users


async def add_tickers_for_user(engine, user_id: int):
    """Add tickers to the specified user's watchlist."""
    async with AsyncSession(engine) as db:
        # Get user's watchlist(s)
        stmt = select(UserWatchlist).where(UserWatchlist.user_id == user_id)
        result = await db.execute(stmt)
        watchlists = result.scalars().all()

        now = datetime.now(timezone.utc)

        if watchlists:
            # Use the first watchlist
            watchlist = watchlists[0]
            existing = set(watchlist.symbols or [])
            new_tickers = [t for t in TICKERS if t not in existing]
            watchlist.symbols = (watchlist.symbols or []) + new_tickers
            watchlist.sort_order = watchlist.symbols
            watchlist.updated_at = now
            print(f"Updated watchlist: added {len(new_tickers)} new tickers")
            print(f"Total tickers: {len(watchlist.symbols)}")
        else:
            # Create new watchlist
            watchlist = UserWatchlist(
                user_id=user_id,
                uuid=UUID("00000000-0000-0000-0000-000000000000"),
                symbols=TICKERS,
                sort_order=TICKERS,
                created_at=now,
                updated_at=now
            )
            db.add(watchlist)
            print(f"Created new watchlist with {len(TICKERS)} tickers")

        await db.commit()


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)

    # List users
    users = await list_users(engine)

    if not users:
        print("No users found in database.")
        return

    # Get user ID from command line or input
    user_id = None
    if len(sys.argv) > 1:
        try:
            user_id = int(sys.argv[1])
            print(f"\nUsing user_id from argument: {user_id}")
        except ValueError:
            print(f"Invalid user_id: {sys.argv[1]}")
            return
    else:
        try:
            selection = int(input("\nEnter the number of your user: ")) - 1
            if 0 <= selection < len(users):
                user_id = users[selection][0]
            else:
                print("Invalid selection.")
                return
        except ValueError:
            print("Please enter a number.")
            return

    if user_id is not None:
        await add_tickers_for_user(engine, user_id)
        print("\nDone!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
