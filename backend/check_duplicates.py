from app.db.session import AsyncSessionLocal
from sqlalchemy import text
import asyncio

async def cleanup_duplicates():
    async with AsyncSessionLocal() as db:
        print("Cleaning up duplicate candles...")
        # Use the same logic as the migration but more targeted
        await db.execute(text("""
            DELETE FROM candle
            WHERE (symbol_id, interval, timestamp) IN (
                SELECT symbol_id, interval, timestamp
                FROM candle
                GROUP BY symbol_id, interval, timestamp
                HAVING COUNT(*) > 1
            )
            AND ctid NOT IN (
                SELECT MIN(ctid)
                FROM candle
                GROUP BY symbol_id, interval, timestamp
                HAVING COUNT(*) > 1
            )
        """))
        await db.commit()
        print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(cleanup_duplicates())