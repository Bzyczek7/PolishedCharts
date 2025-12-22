import asyncio
from sqlalchemy import select, delete
from app.db.session import AsyncSessionLocal
from app.models.candle import Candle
from app.models.symbol import Symbol
from datetime import datetime, timezone, timedelta

async def cleanup():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Symbol).filter(Symbol.ticker == "IBM"))
        s = res.scalars().first()
        if not s: return

        res = await db.execute(select(Candle).filter(Candle.symbol_id == s.id, Candle.interval == "1d").order_by(Candle.timestamp.asc()))
        candles = res.scalars().all()
        
        to_delete = []
        for i in range(len(candles) - 1):
            c1 = candles[i]
            c2 = candles[i+1]
            
            # If they are very close in price and exactly 1 day apart
            price_diff = abs(c1.open - c2.open)
            time_diff = c2.timestamp - c1.timestamp
            
            if time_diff == timedelta(days=1) and price_diff < 0.001:
                # Check weekdays (0=Mon, 6=Sun)
                # If c1 is Sunday and c2 is Monday, delete Sunday (c1)
                if c1.timestamp.weekday() == 6:
                    print(f"Sunday Duplicate: Removing ID {c1.id} ({c1.timestamp}) in favor of Monday {c2.id}")
                    to_delete.append(c1.id)
                else:
                    print(f"Generic Duplicate: Removing ID {c2.id} ({c2.timestamp})")
                    to_delete.append(c2.id)
        
        if to_delete:
            # dedupe to_delete
            to_delete = list(set(to_delete))
            await db.execute(delete(Candle).where(Candle.id.in_(to_delete)))
            await db.commit()
            print(f"Removed {len(to_delete)} staggered duplicates")

if __name__ == "__main__":
    asyncio.run(cleanup())