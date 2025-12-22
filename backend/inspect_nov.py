import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.candle import Candle
from app.models.symbol import Symbol
from datetime import datetime, timezone

async def inspect():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Symbol).filter(Symbol.ticker == "IBM"))
        s = res.scalars().first()
        
        print("--- 1d Candles from Nov 20 ---")
        stmt = select(Candle).where(
            Candle.symbol_id == s.id,
            Candle.interval == "1d",
            Candle.timestamp >= datetime(2025, 11, 20, tzinfo=timezone.utc)
        ).order_by(Candle.timestamp.asc())
        res = await db.execute(stmt)
        for c in res.scalars().all():
            print(f"ID: {c.id}, TS: {c.timestamp}, O: {c.open}")

        print("\n--- 1m Candles ---")
        stmt = select(Candle).where(
            Candle.symbol_id == s.id,
            Candle.interval == "1m"
        ).order_by(Candle.timestamp.desc()).limit(5)
        res = await db.execute(stmt)
        for c in res.scalars().all():
            print(f"ID: {c.id}, TS: {c.timestamp}, O: {c.open}")

if __name__ == "__main__":
    asyncio.run(inspect())
