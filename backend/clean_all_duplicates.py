#!/usr/bin/env python3
"""
Script to clean up all duplicate candles in the database by keeping only one per timestamp for each symbol/interval
"""

import asyncio
from datetime import datetime, date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete, func, text
from app.models.candle import Candle
from app.models.symbol import Symbol
from app.core.config import settings

async def clean_all_duplicate_candles():
    print("Cleaning up all duplicate candles...")

    # Create async engine and session
    engine = create_async_engine(settings.async_database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Find all duplicate entries (same symbol_id, interval, timestamp)
        duplicate_query = text("""
            SELECT symbol_id, interval, timestamp, COUNT(*) as count
            FROM candle
            GROUP BY symbol_id, interval, timestamp
            HAVING COUNT(*) > 1
            ORDER BY count DESC
            LIMIT 100  -- Limit to avoid huge result sets
        """)

        result = await session.execute(duplicate_query)
        duplicates = result.fetchall()

        print(f"Found {len(duplicates)} groups of duplicate timestamps")

        if duplicates:
            print("Cleaning duplicates...")

            total_removed = 0
            for dup in duplicates:
                symbol_id, interval, timestamp, count = dup

                # Get all candles for this specific duplicate group
                candles_query = text("""
                    SELECT id, timestamp, open, high, low, close, volume
                    FROM candle
                    WHERE symbol_id = :symbol_id
                    AND interval = :interval
                    AND timestamp = :timestamp
                    ORDER BY id ASC  -- Order by ID to keep the first one
                """)

                result = await session.execute(candles_query, {
                    "symbol_id": symbol_id,
                    "interval": interval,
                    "timestamp": timestamp
                })
                candles = result.fetchall()

                # Keep the first one (lowest ID), delete the rest
                if len(candles) > 1:
                    ids_to_delete = [candle[0] for candle in candles[1:]]  # Skip first (keep lowest ID)

                    delete_query = text("""
                        DELETE FROM candle
                        WHERE id = ANY(:ids_to_delete)
                    """)

                    await session.execute(delete_query, {"ids_to_delete": ids_to_delete})
                    removed_count = len(ids_to_delete)
                    total_removed += removed_count
                    print(f"  Removed {removed_count} duplicate(s) for symbol_id {symbol_id}, interval {interval}, timestamp {timestamp}")

            await session.commit()
            print(f"Total duplicates removed: {total_removed}")
        else:
            print("No duplicates found!")

        # Verify the cleanup by checking for any remaining duplicates
        remaining_duplicates_query = text("""
            SELECT COUNT(*) as remaining_count
            FROM (
                SELECT symbol_id, interval, timestamp
                FROM candle
                GROUP BY symbol_id, interval, timestamp
                HAVING COUNT(*) > 1
            ) AS duplicates
        """)

        result = await session.execute(remaining_duplicates_query)
        remaining_count = result.scalar()
        print(f"Remaining duplicate groups after cleanup: {remaining_count}")

if __name__ == "__main__":
    asyncio.run(clean_all_duplicate_candles())