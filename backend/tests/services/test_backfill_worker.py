import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone
from app.services.backfill_worker import BackfillWorker
from app.services.backfill import BackfillService
from app.models.symbol import Symbol
from sqlalchemy import select

@pytest.mark.asyncio
async def test_backfill_worker_lifecycle(db_session, db_session_factory):
    # 1. Setup job and symbol
    service = BackfillService()
    ticker = "WORKER_TEST"
    
    # Ensure symbol
    result = await db_session.execute(select(Symbol).filter(Symbol.ticker == ticker))
    if not result.scalars().first():
        db_session.add(Symbol(ticker=ticker, name="Worker Test"))
        await db_session.commit()

    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    end = datetime(2025, 1, 2, tzinfo=timezone.utc)
    job = await service.create_job(db_session, ticker, "1h", start, end)
    
    # 2. Mock Orchestrator
    orchestrator = MagicMock()
    orchestrator.fetch_and_save = AsyncMock()
    
    worker = BackfillWorker(service, orchestrator, db_session_factory)
    
    # 3. Run worker
    await worker.run_job(job.id)
    
    # 4. Verify completion
    async with db_session_factory() as db:
        updated_job = await service.get_job(db, job.id)
        assert updated_job.status == "completed"
        assert orchestrator.fetch_and_save.called

@pytest.mark.asyncio
async def test_backfill_worker_failure_handling(db_session, db_session_factory):
    service = BackfillService()
    ticker = "FAIL_TEST"
    
    result = await db_session.execute(select(Symbol).filter(Symbol.ticker == ticker))
    if not result.scalars().first():
        db_session.add(Symbol(ticker=ticker, name="Fail Test"))
        await db_session.commit()

    job = await service.create_job(db_session, ticker, "1h", datetime.now(), datetime.now())
    
    orchestrator = MagicMock()
    orchestrator.fetch_and_save = AsyncMock(side_effect=Exception("Fetch failed"))
    
    worker = BackfillWorker(service, orchestrator, db_session_factory)
    await worker.run_job(job.id)
    
    async with db_session_factory() as db:
        updated_job = await service.get_job(db, job.id)
        assert updated_job.status == "failed"
        assert "Fetch failed" in updated_job.error_message
