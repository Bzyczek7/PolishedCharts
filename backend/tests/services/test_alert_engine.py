import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.alert_engine import AlertEngine
from app.models.alert import Alert
from app.models.candle import Candle

@pytest.mark.asyncio
async def test_evaluate_alerts_triggers():
    mock_session = AsyncMock()
    
    # Mock async context manager
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Active alert: IBM price above 150
    alert = Alert(id=1, symbol_id=1, condition="price_above", threshold=150.0, is_active=True)
    
    # Mock query for active alerts
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result
    
    engine = AlertEngine(mock_factory)
    
    triggered = await engine.evaluate_symbol_alerts(1, 155.0)
    
    assert len(triggered) == 1
    assert triggered[0].id == 1

@pytest.mark.asyncio
async def test_evaluate_alerts_not_triggered():
    mock_session = AsyncMock()
    
    # Mock async context manager
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # IBM price above 150, but current price is 145
    alert = Alert(id=1, symbol_id=1, condition="price_above", threshold=150.0, is_active=True)
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result
    
    engine = AlertEngine(mock_factory)
    
    triggered = await engine.evaluate_symbol_alerts(1, 145.0)
    
    assert len(triggered) == 0
