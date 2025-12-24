import pytest
from typing import Generator, AsyncGenerator
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from app.main import app
from app.db.session import engine, AsyncSessionLocal
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.symbol import Symbol
from app.models.candle import Candle
from app.models.alert import Alert
from app.models.alert_trigger import AlertTrigger

@pytest.fixture(scope="session")
def client() -> Generator:
    with TestClient(app) as c:
        yield c

@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

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
    """Create a test database session that rolls back after each test."""
    async with test_session_factory() as session:
        # Clean up existing data before each test
        # This ensures tests start with a clean state
        await session.execute(text("TRUNCATE TABLE alert_trigger CASCADE"))
        await session.execute(text("TRUNCATE TABLE alert CASCADE"))
        await session.execute(text("TRUNCATE TABLE candle CASCADE"))
        await session.execute(text("TRUNCATE TABLE symbol CASCADE"))
        await session.commit()

        # Begin a transaction that will be rolled back
        await session.begin()
        try:
            yield session
        finally:
            # Always rollback to keep tests isolated
            await session.rollback()

@pytest.fixture
def db_session_factory():
    return test_session_factory


@pytest.fixture
async def sample_symbol(db_session: AsyncSession) -> Symbol:
    """Create a sample symbol for testing."""
    symbol = Symbol(
        ticker="AAPL",
        name="Apple Inc."
    )
    db_session.add(symbol)
    await db_session.commit()
    await db_session.refresh(symbol)
    return symbol


@pytest.fixture
async def sample_symbols(db_session: AsyncSession) -> list[Symbol]:
    """Create multiple sample symbols for testing."""
    symbols = [
        Symbol(ticker="AAPL", name="Apple Inc."),
        Symbol(ticker="SPY", name="SPDR S&P 500 ETF"),
        Symbol(ticker="TSLA", name="Tesla Inc."),
    ]
    for symbol in symbols:
        db_session.add(symbol)
    await db_session.commit()
    for symbol in symbols:
        await db_session.refresh(symbol)
    return symbols


@pytest.fixture
async def sample_candles(db_session: AsyncSession, sample_symbol: Symbol) -> list[Candle]:
    """Create sample candles for testing."""
    candles = []
    base_time = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    for i in range(100):
        candle = Candle(
            symbol_id=sample_symbol.id,
            timestamp=base_time + timedelta(hours=i),
            interval="1h",
            open=150.0 + i,
            high=152.0 + i,
            low=149.0 + i,
            close=151.0 + i,
            volume=1000000 + i * 1000
        )
        db_session.add(candle)
        candles.append(candle)

    await db_session.commit()
    for candle in candles:
        await db_session.refresh(candle)
    return candles


@pytest.fixture
async def sample_alert(db_session: AsyncSession, sample_symbol: Symbol) -> Alert:
    """Create a sample alert for testing."""
    from app.core.enums import AlertCondition

    alert = Alert(
        symbol_id=sample_symbol.id,
        condition=AlertCondition.CROSSES_UP.value,
        threshold=200.0,
        is_active=True,
        cooldown=300
    )
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)
    return alert
