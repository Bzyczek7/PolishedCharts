import asyncio
from app.db.session import AsyncSessionLocal
from app.models.candle import Candle
from app.models.symbol import Symbol
from sqlalchemy import select, func

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Symbol).filter(Symbol.ticker == 'IBM'))
        s = res.scalars().first()
        if not s:
            print("IBM not found")
            return
        res = await db.execute(
            select(Candle.interval, func.count(Candle.id))
            .filter(Candle.symbol_id == s.id)
            .group_by(Candle.interval)
        )
        for row in res:
            print(f"Interval: {row[0]}, Count: {row[1]}")

if __name__ == "__main__":
    asyncio.run(check())
