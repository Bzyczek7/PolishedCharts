import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.symbol import Symbol
from app.models.candle import Candle
from datetime import datetime, timezone

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Symbol).filter(Symbol.ticker == "IBM"))
        s = res.scalars().first()
        if not s:
            print("IBM not found")
            return
            
        stmt = select(Candle).where(
            Candle.symbol_id == s.id,
            Candle.interval == "1d",
            Candle.timestamp >= datetime(2025, 7, 25, tzinfo=timezone.utc),
            Candle.timestamp <= datetime(2025, 8, 5, tzinfo=timezone.utc)
        ).order_by(Candle.timestamp.asc())
        
        res = await db.execute(stmt)
        candles = res.scalars().all()
        for c in candles:
            print(f"ID: {c.id}, TS: {c.timestamp}, O: {c.open}, C: {c.close}")

if __name__ == "__main__":
    asyncio.run(check())
