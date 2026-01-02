#!/usr/bin/env python3
"""
Script to clean up duplicate SDIV candles by keeping only one per day for 1d interval
This version handles timezone-aware timestamps properly
"""

import asyncio
from datetime import datetime, date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete, func, text
from app.models.candle import Candle
from app.models.symbol import Symbol
from app.core.config import settings

async def clean_duplicate_candles():
    print("Cleaning up duplicate SDIV 1d candles (timezone-aware)...")

    # Create async engine and session
    engine = create_async_engine(settings.async_database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get SDIV symbol
        result = await session.execute(select(Symbol).filter(Symbol.ticker == 'SDIV'))
        symbol_obj = result.scalars().first()
        
        if not symbol_obj:
            print("SDIV symbol not found")
            return

        # Find candles for the same date (ignoring time component) for 1d interval
        # Group by date and keep only the one with latest time of day
        duplicate_dates_query = text("""
            SELECT 
                DATE(timestamp AT TIME ZONE 'UTC') as date_part,
                id,
                timestamp,
                ROW_NUMBER() OVER (
                    PARTITION BY DATE(timestamp AT TIME ZONE 'UTC') 
                    ORDER BY timestamp DESC
                ) as rn
            FROM candle 
            WHERE symbol_id = :symbol_id AND interval = '1d'
            ORDER BY timestamp DESC
        """)
        
        result = await session.execute(duplicate_dates_query, {"symbol_id": symbol_obj.id})
        all_candles = result.fetchall()
        
        # Group by date and identify which IDs to keep/delete
        from collections import defaultdict
        date_groups = defaultdict(list)
        for row in all_candles:
            date_part = row[0]
            candle_id = row[1]
            timestamp = row[2]
            rank = row[3]
            date_groups[date_part].append((candle_id, timestamp, rank))
        
        # Find IDs to delete (all except rank 1)
        ids_to_delete = []
        for date_val, candles in date_groups.items():
            for candle_id, timestamp, rank in candles:
                if rank > 1:  # Keep only rank 1 (latest timestamp for each date)
                    ids_to_delete.append(candle_id)
        
        print(f"Found {len(ids_to_delete)} duplicate candles to delete")
        
        if ids_to_delete:
            # Delete duplicates in batches to avoid parameter limit
            batch_size = 1000
            for i in range(0, len(ids_to_delete), batch_size):
                batch = ids_to_delete[i:i + batch_size]
                
                delete_query = text("""
                    DELETE FROM candle 
                    WHERE id = ANY(:ids_to_delete)
                """)
                
                await session.execute(delete_query, {"ids_to_delete": batch})
                print(f"  Deleted batch of {len(batch)} duplicates")
        
        await session.commit()
        print("Duplicate cleanup completed!")

        # Verify the cleanup
        result = await session.execute(
            text("SELECT COUNT(*) FROM candle WHERE symbol_id = :symbol_id AND interval = '1d'"),
            {"symbol_id": symbol_obj.id}
        )
        count = result.scalar()
        print(f"Total SDIV 1d candles after cleanup: {count}")

        # Check for any remaining duplicates
        result = await session.execute(
            text("""
                SELECT DATE(timestamp AT TIME ZONE 'UTC') as date_part, COUNT(*) as count
                FROM candle 
                WHERE symbol_id = :symbol_id AND interval = '1d'
                GROUP BY DATE(timestamp AT TIME ZONE 'UTC')
                HAVING COUNT(*) > 1
                ORDER BY date_part DESC
                LIMIT 10
            """),
            {"symbol_id": symbol_obj.id}
        )
        remaining_duplicates = result.fetchall()
        print(f"Remaining dates with duplicates: {len(remaining_duplicates)}")
        
        if remaining_duplicates:
            print("Sample remaining duplicates:")
            for dup in remaining_duplicates[:5]:
                print(f"  {dup[0]}: {dup[1]} entries")

if __name__ == "__main__":
    asyncio.run(clean_duplicate_candles())