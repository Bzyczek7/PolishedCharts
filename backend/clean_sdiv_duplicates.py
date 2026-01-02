#!/usr/bin/env python3
"""
Script to clean up duplicate SDIV candles by keeping only one per day for 1d interval
"""

import asyncio
from datetime import datetime, date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete, func
from app.models.candle import Candle
from app.models.symbol import Symbol
from app.core.config import settings

async def clean_duplicate_candles():
    print("Cleaning up duplicate SDIV 1d candles...")

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

        # Find duplicate timestamps by date for 1d interval
        from sqlalchemy import text
        duplicate_dates_query = text("""
            SELECT DATE(timestamp) as date, COUNT(*) as count
            FROM candle 
            WHERE symbol_id = :symbol_id AND interval = '1d'
            GROUP BY DATE(timestamp)
            HAVING COUNT(*) > 1
            ORDER BY date DESC
        """)
        
        result = await session.execute(duplicate_dates_query, {"symbol_id": symbol_obj.id})
        duplicate_dates = result.fetchall()
        
        print(f"Found {len(duplicate_dates)} dates with duplicate candles")
        
        if duplicate_dates:
            print("Cleaning duplicates...")
            
            # For each duplicate date, keep only the candle with latest timestamp
            for date_row in duplicate_dates:
                date_val = date_row[0]  # This is the date part
                
                # Get all candles for this date
                candles_query = text("""
                    SELECT id, timestamp 
                    FROM candle 
                    WHERE symbol_id = :symbol_id 
                    AND interval = '1d' 
                    AND DATE(timestamp) = :date_val
                    ORDER BY timestamp DESC
                """)
                
                result = await session.execute(candles_query, {
                    "symbol_id": symbol_obj.id,
                    "date_val": date_val
                })
                candles = result.fetchall()
                
                # Keep the first one (latest timestamp), delete the rest
                if len(candles) > 1:
                    ids_to_delete = [candle[0] for candle in candles[1:]]  # Skip first (keep latest)
                    
                    delete_query = text("""
                        DELETE FROM candle 
                        WHERE id = ANY(:ids_to_delete)
                    """)
                    
                    await session.execute(delete_query, {"ids_to_delete": ids_to_delete})
                    print(f"  Removed {len(ids_to_delete)} duplicate(s) for date {date_val}")
        
        await session.commit()
        print("Duplicate cleanup completed!")

        # Verify the cleanup
        result = await session.execute(
            select(func.count(Candle.id))
            .where(Candle.symbol_id == symbol_obj.id)
            .where(Candle.interval == '1d')
        )
        count = result.scalar()
        print(f"Total SDIV 1d candles after cleanup: {count}")

if __name__ == "__main__":
    asyncio.run(clean_duplicate_candles())