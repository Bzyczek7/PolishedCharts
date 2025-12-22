import logging
from datetime import datetime
from typing import Optional, List
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.backfill_job import BackfillJob

logger = logging.getLogger(__name__)

class BackfillService:
    async def create_job(
        self,
        db: AsyncSession,
        symbol: str,
        interval: str,
        start_date: datetime,
        end_date: datetime
    ) -> BackfillJob:
        job = BackfillJob(
            symbol=symbol,
            interval=interval,
            start_date=start_date,
            end_date=end_date,
            status="pending"
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        return job

    async def get_job(self, db: AsyncSession, job_id: int) -> Optional[BackfillJob]:
        stmt = select(BackfillJob).where(BackfillJob.id == job_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def update_job_status(
        self,
        db: AsyncSession,
        job_id: int,
        status: str,
        error_message: Optional[str] = None
    ) -> Optional[BackfillJob]:
        job = await self.get_job(db, job_id)
        if job:
            job.status = status
            if error_message:
                job.error_message = error_message
            await db.commit()
            await db.refresh(job)
        return job

    async def get_active_jobs(self, db: AsyncSession, symbol: str, interval: str) -> List[BackfillJob]:
        stmt = select(BackfillJob).where(
            BackfillJob.symbol == symbol,
            BackfillJob.interval == interval,
            BackfillJob.status.in_(["pending", "in_progress"])
        )
        result = await db.execute(stmt)
        return result.scalars().all()
