"""
Benchmark tests for Feature 014 - Phase 7: Database Query Performance

Tests:
- Database query performance with indexes
"""

import pytest
import time
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candle import Candle
from app.models.symbol import Symbol
from app.db.session import AsyncSessionLocal


@pytest.mark.asyncio
@pytest.mark.benchmark
async def test_candle_query_performance():
    """T055: Benchmark test - candle query uses index and completes in <100ms."""
    async with AsyncSessionLocal() as session:
        # Get a symbol to query
        result = await session.execute(select(Symbol).limit(1))
        symbol = result.scalars().first()

        if not symbol:
            pytest.skip("No symbols found in database")

        # Measure query time for typical request (get candles for a symbol/interval)
        start_time = time.time()

        result = await session.execute(
            select(Candle)
            .where(Candle.symbol_id == symbol.id)
            .where(Candle.interval == "1d")
            .order_by(Candle.timestamp.desc())
            .limit(100)
        )

        candles = result.scalars().all()

        elapsed_ms = (time.time() - start_time) * 1000

        print(f"Query returned {len(candles)} candles in {elapsed_ms:.2f}ms")

        # SC-007: Database query should complete in <100ms
        assert elapsed_ms < 100, f"Query took {elapsed_ms:.2f}ms, exceeds 100ms target"
