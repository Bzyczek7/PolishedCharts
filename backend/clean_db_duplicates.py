#!/usr/bin/env python3
"""
Script to clean up duplicate candles in the database by keeping only one per UTC day for 1d/1wk intervals
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def clean_duplicates():
    print("Cleaning up duplicate candles in the database...")

    # Create async engine
    engine = create_async_engine(settings.async_database_url)

    async with engine.connect() as conn:
        # First, let's run the delete query to remove extra duplicates (keep latest timestamp per day)
        delete_query = text("""
            WITH ranked AS (
              SELECT symbol_id, interval, timestamp,
                     row_number() OVER (
                       PARTITION BY symbol_id, interval, (timestamp AT TIME ZONE 'UTC')::date
                       ORDER BY timestamp DESC
                     ) AS rn
              FROM candle
              WHERE interval IN ('1d','1wk')
            )
            DELETE FROM candle c
            USING ranked r
            WHERE c.symbol_id = r.symbol_id 
              AND c.interval = r.interval 
              AND c.timestamp = r.timestamp 
              AND r.rn > 1;
        """)

        result = await conn.execute(delete_query)
        await conn.commit()
        print(f"Deleted duplicate candles. Rows affected: {result.rowcount}")

        # Now normalize the remaining timestamps to midnight UTC for 1d/1wk intervals
        update_query = text("""
            UPDATE candle
            SET timestamp = (date_trunc('day', timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
            WHERE interval IN ('1d','1wk');
        """)

        result = await conn.execute(update_query)
        await conn.commit()
        print(f"Normalized timestamps to midnight UTC. Rows affected: {result.rowcount}")

        # Verify that duplicates are gone
        verify_query = text("""
            SELECT symbol_id,
                   interval,
                   (timestamp AT TIME ZONE 'UTC')::date AS day_utc,
                   COUNT(*) AS n
            FROM candle
            WHERE interval IN ('1d','1wk')
            GROUP BY 1,2,3
            HAVING COUNT(*) > 1
            ORDER BY n DESC
            LIMIT 10;
        """)

        verify_result = await conn.execute(verify_query)
        remaining_duplicates = verify_result.fetchall()

        if remaining_duplicates:
            print(f"WARNING: {len(remaining_duplicates)} groups of duplicates still remain:")
            for dup in remaining_duplicates:
                print(f"  symbol_id: {dup[0]}, interval: {dup[1]}, UTC day: {dup[2]}, count: {dup[3]}")
        else:
            print("SUCCESS: All duplicates have been removed!")

if __name__ == "__main__":
    asyncio.run(clean_duplicates())