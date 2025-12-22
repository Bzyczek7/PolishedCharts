import logging
import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.backfill import BackfillService
from app.services.orchestrator import DataOrchestrator
from app.models.symbol import Symbol
from sqlalchemy.future import select

logger = logging.getLogger(__name__)

class BackfillWorker:
    def __init__(
        self, 
        backfill_service: BackfillService, 
        orchestrator: DataOrchestrator,
        db_session_factory
    ):
        self.backfill_service = backfill_service
        self.orchestrator = orchestrator
        self.db_session_factory = db_session_factory

    async def run_job(self, job_id: int):
        """
        Execute a backfill job.
        """
        async with self.db_session_factory() as db:
            job = await self.backfill_service.get_job(db, job_id)
            if not job:
                logger.error(f"Job {job_id} not found.")
                return

            if job.status != "pending":
                logger.warning(f"Job {job_id} is already in state: {job.status}. Skipping.")
                return

            # Update to in_progress
            await self.backfill_service.update_job_status(db, job_id, "in_progress")
            
            try:
                # 1. Resolve symbol_id
                stmt = select(Symbol).where(Symbol.ticker == job.symbol)
                result = await db.execute(stmt)
                symbol_obj = result.scalars().first()
                if not symbol_obj:
                    raise Exception(f"Symbol {job.symbol} not found in database.")

                # 2. Trigger orchestrator fetch_and_save (which handles provider selection and caching)
                # No timeout here, background worker can take its time.
                await self.orchestrator.fetch_and_save(
                    db=db,
                    symbol_id=symbol_obj.id,
                    ticker=job.symbol,
                    interval=job.interval,
                    start=job.start_date,
                    end=job.end_date
                )

                # 3. Update to completed
                await self.backfill_service.update_job_status(db, job_id, "completed")
                logger.info(f"Backfill job {job_id} for {job.symbol} ({job.interval}) completed successfully.")

            except Exception as e:
                logger.error(f"Backfill job {job_id} failed: {e}")
                await self.backfill_service.update_job_status(db, job_id, "failed", str(e))
