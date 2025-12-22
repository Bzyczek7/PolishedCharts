import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta
from app.services.orchestrator import DataOrchestrator

@pytest.mark.asyncio
async def test_orchestrator_respects_hard_cap():
    candle_service = MagicMock()
    yf_provider = MagicMock()
    av_provider = MagicMock()
    
    orchestrator = DataOrchestrator(candle_service, yf_provider, av_provider)
    
    # Mock a large gap: 1000 days of daily data
    start = datetime(2020, 1, 1, tzinfo=timezone.utc)
    end = datetime(2023, 1, 1, tzinfo=timezone.utc)
    candle_service.find_gaps = AsyncMock(return_value=[(start, end)])
    
    db = AsyncMock()
    # Mock final fetch from DB
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=mock_result)
    
    with patch.object(orchestrator, '_fill_gap', AsyncMock()) as mock_fill:
        await orchestrator.get_candles(db, 1, "AAPL", "1d", start, end)
        # Should NOT call _fill_gap because 1000 bars > 500 cap
        mock_fill.assert_not_called()

@pytest.mark.asyncio
async def test_orchestrator_timeout_protection():
    candle_service = MagicMock()
    yf_provider = MagicMock()
    av_provider = MagicMock()
    
    orchestrator = DataOrchestrator(candle_service, yf_provider, av_provider)
    
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    end = datetime(2025, 1, 2, tzinfo=timezone.utc)
    candle_service.find_gaps = AsyncMock(return_value=[(start, end)])
    
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=mock_result)
    
    async def slow_fill(*args, **kwargs):
        await asyncio.sleep(2.0)
        
    with patch.object(orchestrator, '_fill_gap', side_effect=slow_fill):
        # Patch the wait_for function itself
        with patch('asyncio.wait_for', side_effect=asyncio.TimeoutError):
            await orchestrator.get_candles(db, 1, "AAPL", "1h", start, end)
            # Should catch TimeoutError and proceed to DB fetch
            assert db.execute.called
