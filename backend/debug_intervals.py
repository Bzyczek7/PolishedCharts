import asyncio
from sqlalchemy import select, func
from app.db.session import AsyncSessionLocal
from app.models.candle import Candle
from app.models.symbol import Symbol

async def debug():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Candle.interval, func.count(Candle.id)).group_by(Candle.interval))
        print("Interval counts across all symbols:")
        for row in res:
            print(f" - '{row[0]}': {row[1]}")
            
        res = await db.execute(select(Symbol.ticker, Candle.interval, func.count(Candle.id))
                               .join(Candle)
                               .group_by(Symbol.ticker, Candle.interval))
        print("\nBreakdown by Ticker:")
        for row in res:
            print(f" - {row[0]} | '{row[1]}': {row[2]}")

if __name__ == "__main__":
    asyncio.run(debug())

