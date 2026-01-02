import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.data_poller import DataPoller
from app.services.alert_engine import AlertEngine
from app.models.alert import Alert
from app.models.symbol import Symbol
from app.services.providers import YFinanceProvider
from datetime import datetime, timezone

@pytest.mark.asyncio
async def test_e2e_crsi_alert_flow():
    # 1. Setup mocks
    mock_provider = AsyncMock()
    candles = [
        {"timestamp": datetime(2023, 10, i, tzinfo=timezone.utc), "open": 100+i, "high": 110+i, "low": 90+i, "close": 105+i, "volume": 1000}
        for i in range(1, 50)
    ]
    mock_provider.fetch_candles.return_value = candles

    mock_session = AsyncMock()
    mock_symbol = Symbol(id=1, ticker="IBM")
    mock_result_symbol = MagicMock()
    mock_result_symbol.scalars.return_value.first.return_value = mock_symbol

    alert = Alert(id=2, symbol_id=1, condition="crsi_band_cross", threshold=0, is_active=True)
    mock_result_alert = MagicMock()
    mock_result_alert.scalars.return_value.all.return_value = [alert]

    mock_result_candle = MagicMock()
    mock_result_candle.scalars.return_value.first.return_value = None

    mock_session.execute.side_effect = [mock_result_alert]

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = AsyncMock()

    engine = AlertEngine(mock_factory)
    poller = DataPoller(
        yf_provider=mock_provider,
        symbols=["IBM"],
        interval=10,
        db_session_factory=mock_factory,
        alert_engine=engine,
        rate_limit_sleep=0
    )

    # 2. Run the poller cycle
    with patch("app.services.alert_engine.logger.info") as mock_log, \
         patch("app.services.data_poller.logger.error") as mock_err, \
         patch.object(poller, '_save_candles_to_db', new_callable=AsyncMock) as mock_save, \
         patch("app.services.indicators.calculate_crsi") as mock_calc:

        mock_save.return_value = 1

        # Mock DF return with a cross down
        mock_df = MagicMock()
        mock_latest = {"cRSI": 25.0, "cRSI_UpperBand": 70.0, "cRSI_LowerBand": 30.0}
        mock_prev = {"cRSI": 35.0, "cRSI_UpperBand": 70.0, "cRSI_LowerBand": 30.0}

        # We need mock_df.iloc[-1] and mock_df.iloc[-2] to work
        # iloc is usually indexed by integers
        mock_df.iloc = {
            -1: mock_latest,
            -2: mock_prev
        }
        mock_df.__len__.return_value = 50

        mock_calc.return_value = mock_df

        task = asyncio.create_task(poller.start())
        await asyncio.sleep(0.2)
        poller.stop()
        await task

        if mock_err.called:
            print(f"POLLER ERROR: {mock_err.call_args}")

        # 3. Verify expectations
        assert mock_provider.fetch_candles.called

        # Verify that an alert was triggered
        triggered_calls = [call for call in mock_log.call_args_list if "ALERT TRIGGERED: 2" in str(call)]
        assert len(triggered_calls) > 0