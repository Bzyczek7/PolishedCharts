import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from app.services.backfill_worker import BackfillWorker
from app.services.incremental_worker import IncrementalUpdateWorker
from app.services.backfill import BackfillService
from app.models.symbol import Symbol
from app.models.candle import Candle
from sqlalchemy import select

@pytest.mark.asyncio
async def test_backfill_worker_full_lifecycle(db_session, db_session_factory):
    service = BackfillService()
    ticker = "COMP_BACKFILL"
    
    # 1. Setup symbol
    result = await db_session.execute(select(Symbol).filter(Symbol.ticker == ticker))
    if not result.scalars().first():
        db_session.add(Symbol(ticker=ticker, name="Comp Backfill"))
        await db_session.commit()

    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    end = datetime(2025, 1, 2, tzinfo=timezone.utc)
    job = await service.create_job(db_session, ticker, "1h", start, end)
    
    # 2. Mock Orchestrator
    orchestrator = MagicMock()
    orchestrator.fetch_and_save = AsyncMock()
    
    worker = BackfillWorker(service, orchestrator, db_session_factory)
    
    # 3. Run worker and verify states
    # Note: run_job updates DB internally using new sessions
    await worker.run_job(job.id)
    
    async with db_session_factory() as db:
        final_job = await service.get_job(db, job.id)
        assert final_job.status == "completed"
        assert final_job.error_message is None

@pytest.mark.asyncio
async def test_backfill_worker_handles_orchestrator_exception(db_session, db_session_factory):
    service = BackfillService()
    ticker = "FAIL_BACKFILL"
    
    result = await db_session.execute(select(Symbol).filter(Symbol.ticker == ticker))
    if not result.scalars().first():
        db_session.add(Symbol(ticker=ticker, name="Fail Backfill"))
        await db_session.commit()

    job = await service.create_job(db_session, ticker, "1h", datetime.now(), datetime.now())
    
    orchestrator = MagicMock()
    orchestrator.fetch_and_save = AsyncMock(side_effect=Exception("API Down"))
    
    worker = BackfillWorker(service, orchestrator, db_session_factory)
    await worker.run_job(job.id)
    
    async with db_session_factory() as db:
        final_job = await service.get_job(db, job.id)
        assert final_job.status == "failed"
        assert "API Down" in final_job.error_message

@pytest.mark.asyncio
async def test_incremental_worker_robustness(db_session, db_session_factory):
    ticker = "ROBUST_INC"
    result = await db_session.execute(select(Symbol).filter(Symbol.ticker == ticker))
    if not result.scalars().first():
        db_session.add(Symbol(ticker=ticker, name="Robust Inc"))
        await db_session.commit()

    orchestrator = MagicMock()
    # Simulate a partial failure that doesn't crash the whole worker
    orchestrator.fetch_and_save = AsyncMock(side_effect=RuntimeError("Transient error"))
    
    alert_engine = MagicMock()
    worker = IncrementalUpdateWorker(orchestrator, db_session_factory, alert_engine=alert_engine)
    
    # Should catch exception and log it instead of crashing
    await worker.run_update(ticker, "1h")
    
    assert orchestrator.fetch_and_save.called
    assert not alert_engine.evaluate_symbol_alerts.called # Alerts skipped on fetch failure
