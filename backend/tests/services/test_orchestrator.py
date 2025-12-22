import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.orchestrator import DataOrchestrator

@pytest.mark.asyncio
async def test_orchestrator_fills_middle_gap(db_session):
    # Setup mocks
    mock_candle_service = AsyncMock()
    
    # Use MagicMock for the provider because it has synchronous helper methods
    # but override fetch_candles with AsyncMock
    mock_yf = MagicMock()
    mock_yf.fetch_candles = AsyncMock()
    # Explicitly return a timedelta for the heuristic calculation
    mock_yf._get_default_lookback.return_value = timedelta(days=1)
    
    mock_av = MagicMock()
    mock_av.fetch_candles = AsyncMock()
    
    orchestrator = DataOrchestrator(mock_candle_service, mock_yf, mock_av)
    
    symbol_id = 1
    ticker = "IBM"
    interval = "1d"
    start = datetime(2023, 10, 20, tzinfo=timezone.utc)
    end = datetime(2023, 10, 25, tzinfo=timezone.utc)
    
    # 1. Simulate a middle gap found by CandleService
    gap_start = datetime(2023, 10, 22, tzinfo=timezone.utc)
    gap_end = datetime(2023, 10, 23, tzinfo=timezone.utc)
    mock_candle_service.find_gaps.return_value = [(gap_start, gap_end)]
    
    # 2. Mock providers
    mock_yf.fetch_candles.return_value = [
        {"timestamp": gap_start, "open": 1, "high": 2, "low": 0, "close": 1},
        {"timestamp": gap_end, "open": 1, "high": 2, "low": 0, "close": 1},
    ]
    
    # 3. Mock DB results for the final fetch (simplified)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    db_session.execute = AsyncMock(return_value=mock_result)

    # Execute
    # We patch datetime.now to make the heuristic predictable (force yfinance)
    with patch("app.services.orchestrator.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2023, 11, 1, tzinfo=timezone.utc)
        await orchestrator.get_candles(db_session, symbol_id, ticker, interval, start, end)

    # Verify
    mock_candle_service.find_gaps.assert_called_once()
    mock_yf.fetch_candles.assert_called_once_with(ticker, interval, gap_start, gap_end)
    mock_candle_service.upsert_candles.assert_called_once()
