import asyncio
import sqlalchemy
import math
from app.db.session import AsyncSessionLocal
from app.models.candle import Candle
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Candle))
        candles = res.scalars().all()
        nan_count = 0
        for c in candles:
            if any(math.isnan(getattr(c, col)) for col in ['open', 'high', 'low', 'close']):
                print(f"NaN found in candle ID {c.id}")
                nan_count += 1
        print(f"Total candles with NaN: {nan_count}")

if __name__ == "__main__":
    asyncio.run(check())
