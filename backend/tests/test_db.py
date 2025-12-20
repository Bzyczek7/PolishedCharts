from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal, get_db
import pytest

def test_session_init():
    session = AsyncSessionLocal()
    assert isinstance(session, AsyncSession)

@pytest.mark.anyio
async def test_get_db():
    async for session in get_db():
        assert isinstance(session, AsyncSession)
        break # Just test initialization
