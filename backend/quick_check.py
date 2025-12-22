import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.symbol import Symbol
from app.models.candle import Candle

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Symbol).filter(Symbol.ticker == "IBM"))
        s = res.scalars().first()
        print(f"Symbol IBM: {s}")
        if s:
            res = await db.execute(select(Candle).filter(Candle.symbol_id == s.id).limit(1))
            c = res.scalars().first()
            print(f"First candle timestamp: {c.timestamp}, tzinfo: {c.timestamp.tzinfo}")

if __name__ == "__main__":
    asyncio.run(check())
