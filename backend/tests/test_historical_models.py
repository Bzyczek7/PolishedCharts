import pytest
from datetime import datetime, timezone
from sqlalchemy import inspect
from app.models.candle import Candle
# This will fail until we create the model
from app.models.backfill_job import BackfillJob

def test_candle_model_structure():
    mapper = inspect(Candle)
    pk_columns = [c.name for c in mapper.primary_key]
    
    # Spec says composite PK: symbol, interval, timestamp
    # Note: Using symbol_id is fine as long as it's part of the PK
    assert "symbol_id" in pk_columns
    assert "interval" in pk_columns
    assert "timestamp" in pk_columns
    assert "id" not in pk_columns

def test_backfill_job_model_creation():
    job = BackfillJob(
        symbol="AAPL",
        interval="1h",
        start_date=datetime(2025, 1, 1, tzinfo=timezone.utc),
        end_date=datetime(2025, 1, 2, tzinfo=timezone.utc),
        status="pending"
    )
    assert job.symbol == "AAPL"
    assert job.status == "pending"
    assert job.interval == "1h"
