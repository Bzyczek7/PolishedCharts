import pytest
from typing import Generator, AsyncGenerator
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import engine, AsyncSessionLocal
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

@pytest.fixture(scope="session")
def client() -> Generator:
    with TestClient(app) as c:
        yield c

from app.db.base import Base
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine

# Use a separate engine for tests with NullPool
test_engine = create_async_engine(settings.async_database_url, poolclass=NullPool)
test_session_factory = sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)

@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_session_factory() as session:
        yield session

@pytest.fixture
def db_session_factory():
    return test_session_factory
