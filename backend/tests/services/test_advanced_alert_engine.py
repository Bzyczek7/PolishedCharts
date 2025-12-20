import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.alert_engine import AlertEngine
from app.models.alert import Alert

@pytest.mark.asyncio
async def test_evaluate_crsi_band_cross_up():
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    # Alert: cRSI band-cross
    alert = Alert(id=2, symbol_id=1, condition="crsi_band_cross", threshold=0, is_active=True)
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result
    
    engine = AlertEngine(mock_factory)
    
    # Mock indicator data: crossing above upper band
    # current: crsi=75, upper=70
    # previous: crsi=65, upper=70
    indicator_data = {
        "crsi": 75.0,
        "crsi_upper": 70.0,
        "crsi_lower": 30.0,
        "prev_crsi": 65.0,
        "prev_crsi_upper": 70.0,
        "prev_crsi_lower": 30.0
    }
    
    triggered = await engine.evaluate_symbol_alerts(1, 150.0, indicator_data=indicator_data)
    
    assert len(triggered) == 1
    assert triggered[0].id == 2

@pytest.mark.asyncio
async def test_evaluate_crsi_band_cross_down():
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    alert = Alert(id=3, symbol_id=1, condition="crsi_band_cross", threshold=0, is_active=True)
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result
    
    engine = AlertEngine(mock_factory)
    
    # Mock indicator data: crossing below lower band
    # current: crsi=25, lower=30
    # previous: crsi=35, lower=30
    indicator_data = {
        "crsi": 25.0,
        "crsi_upper": 70.0,
        "crsi_lower": 30.0,
        "prev_crsi": 35.0,
        "prev_crsi_upper": 70.0,
        "prev_crsi_lower": 30.0
    }
    
    triggered = await engine.evaluate_symbol_alerts(1, 150.0, indicator_data=indicator_data)
    
    assert len(triggered) == 1
    assert triggered[0].id == 3

@pytest.mark.asyncio
async def test_evaluate_crsi_no_cross():
    mock_session = AsyncMock()
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    alert = Alert(id=4, symbol_id=1, condition="crsi_band_cross", threshold=0, is_active=True)
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [alert]
    mock_session.execute.return_value = mock_result
    
    engine = AlertEngine(mock_factory)
    
    # Still above upper band, but not a CROSS
    indicator_data = {
        "crsi": 75.0,
        "crsi_upper": 70.0,
        "crsi_lower": 30.0,
        "prev_crsi": 72.0,
        "prev_crsi_upper": 70.0,
        "prev_crsi_lower": 30.0
    }
    
    triggered = await engine.evaluate_symbol_alerts(1, 150.0, indicator_data=indicator_data)
    
    assert len(triggered) == 0
