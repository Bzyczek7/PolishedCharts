#!/usr/bin/env python3
"""
Script to check for duplicate candles in the database by UTC day
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def check_duplicates():
    print("Checking for duplicate candles in the database...")

    # Create async engine
    engine = create_async_engine(settings.async_database_url)

    async with engine.connect() as conn:
        # Check for duplicates by UTC day (not exact timestamp)
        duplicate_query = text("""
            SELECT symbol_id,
                   interval,
                   (timestamp AT TIME ZONE 'UTC')::date AS day_utc,
                   COUNT(*) AS n
            FROM candle
            WHERE interval IN ('1d','1wk')
            GROUP BY 1,2,3
            HAVING COUNT(*) > 1
            ORDER BY n DESC
            LIMIT 20;  -- Limit to first 20 results for readability
        """)

        result = await conn.execute(duplicate_query)
        duplicates = result.fetchall()

        print(f"Found {len(duplicates)} groups of duplicate timestamps by UTC day:")
        for dup in duplicates:
            print(f"  symbol_id: {dup[0]}, interval: {dup[1]}, UTC day: {dup[2]}, count: {dup[3]}")

        # If duplicates found, show some sample timestamps
        if duplicates:
            print("\nSample duplicate timestamps for first symbol/interval:")
            for dup in duplicates[:3]:  # Show first 3 duplicates
                symbol_id, interval, day_utc, count = dup
                sample_query = text("""
                    SELECT timestamp
                    FROM candle
                    WHERE symbol_id = :symbol_id
                    AND interval = :interval
                    AND (timestamp AT TIME ZONE 'UTC')::date = :day_utc
                    ORDER BY timestamp
                """)

                sample_result = await conn.execute(sample_query, {
                    "symbol_id": symbol_id,
                    "interval": interval,
                    "day_utc": day_utc
                })
                samples = sample_result.fetchall()

                print(f"  Symbol ID {symbol_id}, Interval {interval}, Day {day_utc}:")
                for sample in samples:
                    print(f"    Timestamp: {sample[0]}")

        # Also check for specific symbols mentioned (EXP, O)
        print("\nChecking for specific symbols EXP and O:")
        symbols_query = text("""
            SELECT s.ticker, c.interval, c.timestamp, COUNT(*) as count
            FROM candle c
            JOIN symbol s ON c.symbol_id = s.id
            WHERE s.ticker IN ('EXP', 'O')
            GROUP BY s.ticker, c.interval, c.timestamp
            HAVING COUNT(*) > 1
            ORDER BY s.ticker, c.interval, c.timestamp
        """)
        
        symbols_result = await conn.execute(symbols_query)
        symbols_duplicates = symbols_result.fetchall()
        
        if symbols_duplicates:
            print("Found duplicates for EXP and O symbols:")
            for dup in symbols_duplicates:
                print(f"  Symbol: {dup[0]}, Interval: {dup[1]}, Timestamp: {dup[2]}, Count: {dup[3]}")
        else:
            print("No duplicates found for EXP and O symbols")

if __name__ == "__main__":
    asyncio.run(check_duplicates())