import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.backfill_job import BackfillJob
from app.models.candle import Candle
from app.models.symbol import Symbol
from app.services.providers import YFinanceProvider

logger = logging.getLogger(__name__)

class BackfillService:
    """Service for backfill operations.

    Includes both job-based backfill tracking and direct historical data fetching
    for watchlist functionality.
    """

    def __init__(self, db: AsyncSession = None):
        self.db = db
        self.provider = YFinanceProvider()

    async def backfill_historical(
        self,
        symbol: Symbol,
        interval: str = "1d"
    ) -> int:
        """Fetch and store historical daily candles for a symbol (watchlist use).

        Args:
            symbol: Symbol model instance with id and ticker
            interval: Candle interval (default: "1d")

        Returns:
            Number of candles backfilled

        Raises:
            ValueError: If no historical data available
            asyncio.TimeoutError: If backfill exceeds 60 seconds
        """
        # T034: Log backfill start
        logger.info(f"backfill_started: ticker={symbol.ticker}, interval={interval}")

        # Limit the backfill range to avoid timeouts for symbols with extensive history
        # For daily intervals, fetch data in chunks of 2 years at a time
        if interval == "1d":
            # Start with recent 2 years of data for initial watchlist addition
            from datetime import datetime, timedelta
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365*2)  # 2 years of data

            all_candles = []
            chunk_size = timedelta(days=365)  # 1 year chunks

            current_start = start_date
            while current_start < end_date:
                current_end = min(current_start + chunk_size, end_date)

                try:
                    # Fetch chunk with timeout
                    chunk_candles = await asyncio.wait_for(
                        self._fetch_with_backoff_range(symbol.ticker, interval, current_start, current_end),
                        timeout=30.0  # Shorter timeout per chunk
                    )
                    all_candles.extend(chunk_candles)

                    # Move to next chunk
                    current_start = current_end

                except asyncio.TimeoutError:
                    logger.warning(f"Chunk timeout for {symbol.ticker} from {current_start} to {current_end}")
                    # Continue with data collected so far
                    break
                except Exception as e:
                    logger.warning(f"Chunk error for {symbol.ticker} from {current_start} to {current_end}: {e}")
                    # Continue with data collected so far
                    break

            candles = all_candles
        else:
            # For other intervals, use original method
            try:
                candles = await asyncio.wait_for(
                    self._fetch_with_backoff(symbol.ticker, interval),
                    timeout=60.0
                )
            except asyncio.TimeoutError:
                logger.error(f"backfill_timeout: ticker={symbol.ticker}, interval={interval}")
                raise asyncio.TimeoutError(
                    f"Backfill for {symbol.ticker} exceeded 60 second timeout"
                )

        if not candles:
            logger.error(f"backfill_failed: ticker={symbol.ticker}, reason=no_data")
            raise ValueError(
                f"No historical data available for {symbol.ticker} from Yahoo Finance"
            )

        # Store candles in database
        count = await self._store_candles(symbol.id, interval, candles)

        # T034: Log backfill completion
        logger.info(f"backfill_completed: ticker={symbol.ticker}, candles={count}")
        return count

    async def _fetch_with_backoff(self, ticker: str, interval: str) -> List[dict]:
        """Fetch candles using YFinanceProvider (retry logic in providers.py).

        NOTE: Retry/backoff is handled by YFinanceProvider via tenacity.
        We do NOT duplicate retry logic here.
        """
        # YFinanceProvider.fetch_candles handles YFRateLimitError retry
        return await self.provider.fetch_candles(ticker, interval)

    async def _fetch_with_backoff_range(self, ticker: str, interval: str, start_date: datetime, end_date: datetime) -> List[dict]:
        """Fetch candles for a specific date range using YFinanceProvider.

        Args:
            ticker: Stock ticker symbol
            interval: Candle interval
            start_date: Start date for the range
            end_date: End date for the range

        Returns:
            List of candle dictionaries
        """
        # YFinanceProvider.fetch_candles handles YFRateLimitError retry
        return await self.provider.fetch_candles(ticker, interval, start=start_date, end=end_date)

    async def _store_candles(
        self,
        symbol_id: int,
        interval: str,
        candles: List[dict]
    ) -> int:
        """Store candles in database using idempotent upsert pattern.

        T046 [US2]: Uses ON CONFLICT DO UPDATE to ensure idempotent storage.
        Re-running backfill doesn't create duplicate candles.

        Args:
            symbol_id: Database ID of the symbol
            interval: Candle interval
            candles: List of candle dicts from YFinanceProvider

        Returns:
            Number of candles stored
        """
        if not candles:
            return 0

        # T047: Verify unique constraint on (symbol_id, timestamp, interval)
        # The constraint exists in Candle model: uix_candle_symbol_timestamp_interval

        # Process candles in chunks to avoid PostgreSQL parameter limits
        chunk_size = 1000  # Safe limit to stay well below 32767 parameter limit
        total_processed = 0

        for i in range(0, len(candles), chunk_size):
            chunk = candles[i:i + chunk_size]

            # Prepare values for bulk upsert
            values = []
            for candle_data in chunk:
                timestamp = candle_data['timestamp']

                # Normalize timestamps to midnight for 1d intervals
                # This prevents duplicate entries where one has time component and one doesn't
                if interval == '1d':
                    if isinstance(timestamp, str):
                        timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    if timestamp.tzinfo is None:
                        timestamp = timestamp.replace(tzinfo=timezone.utc)
                    # Truncate to midnight (00:00:00) for daily intervals
                    timestamp = timestamp.replace(hour=0, minute=0, second=0, microsecond=0)

                values.append({
                    "symbol_id": symbol_id,
                    "interval": interval,
                    "timestamp": timestamp,
                    "open": candle_data['open'],
                    "high": candle_data['high'],
                    "low": candle_data['low'],
                    "close": candle_data['close'],
                    "volume": candle_data.get('volume', 0)
                })

            # T046: Use PostgreSQL ON CONFLICT DO UPDATE for idempotent upsert
            from sqlalchemy.dialects.postgresql import insert

            stmt = insert(Candle).values(values)

            update_dict = {
                "open": stmt.excluded.open,
                "high": stmt.excluded.high,
                "low": stmt.excluded.low,
                "close": stmt.excluded.close,
                "volume": stmt.excluded.volume,
            }

            stmt = stmt.on_conflict_do_update(
                index_elements=["symbol_id", "interval", "timestamp"],
                set_=update_dict
            )

            result = await self.db.execute(stmt)
            await self.db.commit()

            total_processed += len(values)

        # T048: Return actual count of candles processed
        # Note: result.rowcount may be affected by upserts, so we return input count
        return total_processed

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
