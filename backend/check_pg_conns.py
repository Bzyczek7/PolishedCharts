import asyncio
import sqlalchemy
from app.db.session import engine

async def check():
    try:
        async with engine.connect() as conn:
            res = await conn.execute(sqlalchemy.text("SELECT count(*) FROM pg_stat_activity"))
            count = res.scalar()
            print(f"Active connections: {count}")
            
            res = await conn.execute(sqlalchemy.text("SELECT state, count(*) FROM pg_stat_activity GROUP BY state"))
            for row in res:
                print(f"State: {row[0]}, Count: {row[1]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
