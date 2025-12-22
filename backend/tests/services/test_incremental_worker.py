import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from app.services.incremental_worker import IncrementalUpdateWorker
from app.models.symbol import Symbol
from app.models.candle import Candle
from sqlalchemy import select

@pytest.mark.asyncio
async def test_incremental_worker_runs_update_and_alerts(db_session, db_session_factory):
    # 1. Setup symbol and some candles
    ticker = "INC_TEST"
    result = await db_session.execute(select(Symbol).filter(Symbol.ticker == ticker))
    symbol = result.scalars().first()
    if not symbol:
        symbol = Symbol(ticker=ticker, name="Inc Test")
        db_session.add(symbol)
        await db_session.commit()
        await db_session.refresh(symbol)

    # Add a candle so indicator calculation has data
    db_session.add(Candle(
        symbol_id=symbol.id, timestamp=datetime.now(timezone.utc), 
        interval="1h", open=100, high=100, low=100, close=100, volume=100
    ))
    await db_session.commit()

    # 2. Mock Orchestrator and AlertEngine
    orchestrator = MagicMock()
    orchestrator.fetch_and_save = AsyncMock()
    
    alert_engine = MagicMock()
    alert_engine.evaluate_symbol_alerts = AsyncMock()
    
    worker = IncrementalUpdateWorker(orchestrator, db_session_factory, alert_engine=alert_engine)
    
    # 3. Run update
    await worker.run_update(ticker, "1h")
    
    # 4. Verify
    assert orchestrator.fetch_and_save.called
    assert alert_engine.evaluate_symbol_alerts.called
    # Check that it passed symbol_id and close price
    call_args = alert_engine.evaluate_symbol_alerts.call_args
    assert call_args[0][0] == symbol.id
    assert call_args[0][1] == 100.0
