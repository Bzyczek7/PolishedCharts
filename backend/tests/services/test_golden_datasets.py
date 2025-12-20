import pytest
import pandas as pd
from app.services.indicators import calculate_tdfi, calculate_crsi, calculate_adxvma

# Sample data for testing
sample_data = pd.DataFrame({
    'open': [100, 102, 105, 103, 106, 108, 110, 109, 112, 115, 114, 116, 118, 117, 119],
    'high': [103, 105, 107, 106, 108, 111, 112, 111, 114, 117, 116, 118, 120, 119, 121],
    'low': [99, 101, 103, 102, 104, 106, 108, 107, 110, 113, 112, 114, 116, 115, 117],
    'close': [102, 104, 106, 104, 107, 109, 111, 110, 113, 116, 115, 117, 119, 118, 120]
})

# --- Golden Datasets (Expected Values) ---
# These values would be derived from running the Pine Script code with the sample data
# For now, these are placeholder values and will need to be updated with actual results from TradingView
tdfi_golden_values = {
    'TDFI': [0.0, 0.0, 0.0, -0.0, 0.0, 0.0, 0.0, -0.0, 0.0, 0.0, -0.0, 0.0, 0.0, -0.0, 0.0],
    'TDFI_Signal': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}
crsi_golden_values = {
    'cRSI': [50.0, 53.5, 56.8, 55.2, 58.0, 60.1, 58.9, 61.2, 63.0, 60.5, 62.8, 64.5, 66.0, 64.0, 67.0], # Placeholder, will need to be updated with actual results
    'cRSI_UpperBand': [70.0] * 15,
    'cRSI_LowerBand': [30.0] * 15
}
adxvma_golden_values = {
    'ADXVMA': [102.0, 103.0, 104.5, 104.0, 105.5, 107.0, 109.0, 109.5, 111.0, 113.5, 114.0, 115.5, 117.0, 117.5, 118.5]
}

def test_tdfi_golden_dataset():
    result_df = calculate_tdfi(sample_data.copy())
    for i, expected in enumerate(tdfi_golden_values['TDFI']):
        assert result_df['TDFI'].iloc[-len(tdfi_golden_values['TDFI']) + i] == pytest.approx(expected, abs=0.1)

def test_crsi_golden_dataset():
    result_df = calculate_crsi(sample_data.copy())
    for i, expected in enumerate(crsi_golden_values['cRSI']):
        assert result_df['cRSI'].iloc[-len(crsi_golden_values['cRSI']) + i] == pytest.approx(expected, abs=1.0) # Higher tolerance for cRSI

def test_adxvma_golden_dataset():
    result_df = calculate_adxvma(sample_data.copy())
    for i, expected in enumerate(adxvma_golden_values['ADXVMA']):
        assert result_df['ADXVMA'].iloc[-len(adxvma_golden_values['ADXVMA']) + i] == pytest.approx(expected, abs=0.1)
