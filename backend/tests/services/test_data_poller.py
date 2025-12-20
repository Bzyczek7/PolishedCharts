import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.data_poller import DataPoller

@pytest.mark.asyncio
async def test_poller_loop_runs():
    mock_service = AsyncMock()
    poller = DataPoller(alpha_vantage_service=mock_service, symbols=["IBM"], interval=0.1)
    
    # Run the poller for a short time
    task = asyncio.create_task(poller.start())
    await asyncio.sleep(0.15)
    poller.stop()
    await task
    
    # Check if fetch_daily_candles was called
    assert mock_service.fetch_daily_candles.called
    assert mock_service.fetch_daily_candles.call_count >= 1

@pytest.mark.asyncio
async def test_save_candles_to_db_logic():
    # Setup mocks
    mock_service = AsyncMock()
    mock_session = AsyncMock()
    
    # Mock result for Symbol query (return None so it creates a new one)
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = None
    
    # Mock result for Candle query (return None for latest candle)
    mock_result_candle = MagicMock()
    mock_result_candle.scalars.return_value.first.return_value = None
    
    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candle]
    
    # Context manager mock for session
    mock_session_factory = MagicMock()
    mock_session_factory.return_value.__aenter__.return_value = mock_session
    mock_session_factory.return_value.__aexit__.return_value = None

    poller = DataPoller(
        alpha_vantage_service=mock_service, 
        symbols=["IBM"], 
        db_session_factory=mock_session_factory
    )

    candles_data = [
        {"date": "2023-10-27", "open": 100, "high": 110, "low": 90, "close": 105, "volume": 1000}
    ]

    await poller._save_candles_to_db("IBM", candles_data)

    # Verify Symbol creation
    assert mock_session.add.call_count >= 2 # Symbol + Candle
    assert mock_session.commit.call_count == 2
