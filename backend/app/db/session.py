from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_async_engine(
    settings.async_database_url, 
    echo=False, # Disable echo to reduce log noise
    pool_size=50,
    max_overflow=20,
    pool_timeout=60,
    pool_recycle=1800,
    pool_pre_ping=True
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
