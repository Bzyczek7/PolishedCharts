import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.alpha_vantage import AlphaVantageService
from app.services.data_poller import DataPoller
from app.services.alert_engine import AlertEngine
from app.models.alert import Alert
from app.models.symbol import Symbol

@pytest.mark.asyncio
async def test_e2e_alert_flow():
    # 1. Setup mocks
    mock_av = AsyncMock()
    # IBM price goes from 100 to 110
    mock_av.fetch_daily_candles.return_value = [
        {"date": "2023-10-27", "open": 100, "high": 110, "low": 90, "close": 110, "volume": 1000}
    ]
    
    mock_session = AsyncMock()
    
    # Mock Symbol query (IBM exists with id 1)
    mock_symbol = Symbol(id=1, ticker="IBM")
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol
    
    # Mock Alert query (Active alert for IBM, threshold 105)
    alert = Alert(id=1, symbol_id=1, condition="price_above", threshold=105.0, is_active=True)
    mock_result_alert = MagicMock()
    mock_result_alert.scalars.return_value.all.return_value = [alert]
    
    # Mock Candle query (no latest candle)
    mock_result_candle = MagicMock()
    mock_result_candle.scalars.return_value.first.return_value = None

    # session.execute side effects for:
    # 1. _save_candles_to_db -> select symbol
    # 2. _save_candles_to_db -> select latest candle
    # 3. evaluate_symbol_alerts -> select active alerts
    mock_session.execute.side_effect = [mock_result_symbol, mock_result_candle, mock_result_alert]
    
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    engine = AlertEngine(mock_factory)
    poller = DataPoller(
        alpha_vantage_service=mock_av,
        symbols=["IBM"],
        interval=0.1,
        db_session_factory=mock_factory,
        alert_engine=engine,
        rate_limit_sleep=0
    )

    # 2. Run the poller cycle
    # We use a logger patch to verify "ALERT TRIGGERED" log
    with patch("app.services.alert_engine.logger.info") as mock_log:
        task = asyncio.create_task(poller.start())
        await asyncio.sleep(0.15)
        poller.stop()
        await task
        
        # 3. Verify expectations
        assert mock_av.fetch_daily_candles.called
        assert mock_session.add.called # Candle was added
        
        # Check if ALERT TRIGGERED log was called
        # The log message is: f"ALERT TRIGGERED: {alert.id} for symbol {symbol_id} at {current_price}"
        mock_log.assert_called_with("ALERT TRIGGERED: 1 for symbol 1 at 110")
