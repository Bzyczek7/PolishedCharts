import asyncio
from sqlalchemy import select, delete, update
from app.db.session import AsyncSessionLocal
from app.models.candle import Candle
from app.models.symbol import Symbol
from datetime import datetime, timezone

async def cleanup():
    async with AsyncSessionLocal() as db:
        # 1. Rename '1D' to '1d'
        print("Renaming '1D' to '1d'...")
        await db.execute(update(Candle).where(Candle.interval == '1D').values(interval='1d'))
        await db.commit()
        
        # 2. Fetch all '1d' candles to find duplicates after rename and normalization
        res = await db.execute(select(Candle).filter(Candle.interval == "1d").order_by(Candle.timestamp.asc()))
        candles = res.scalars().all()
        print(f"Checking {len(candles)} daily candles for duplicates...")
        
        seen = {}
        to_delete = []
        for c in candles:
            # Already normalized to midnight in previous step, but let's be sure
            normalized_ts = c.timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
            key = (c.symbol_id, normalized_ts)
            
            if key in seen:
                to_delete.append(c.id)
            else:
                seen[key] = c.id
        
        if to_delete:
            print(f"Removing {len(to_delete)} duplicate '1d' candles...")
            await db.execute(delete(Candle).where(Candle.id.in_(to_delete)))
            await db.commit()
            
        print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(cleanup())
