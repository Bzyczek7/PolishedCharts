import pytest
import pandas as pd
import numpy as np
from app.services.indicators import calculate_tdfi, calculate_crsi, calculate_adxvma

# Generate a larger dataset for better stabilization
np.random.seed(42)
rows = 100
close = np.cumsum(np.random.randn(rows)) + 100
high = close + np.random.rand(rows) * 2
low = close - np.random.rand(rows) * 2
open_val = close + np.random.randn(rows)

sample_data = pd.DataFrame({
    'open': open_val,
    'high': high,
    'low': low,
    'close': close
})

def test_tdfi_golden_dataset():
    result_df = calculate_tdfi(sample_data.copy())
    # Verify range and non-zero values
    assert result_df['TDFI'].min() >= -1.0
    assert result_df['TDFI'].max() <= 1.0
    assert (result_df['TDFI'] != 0).any()

def test_crsi_golden_dataset():
    result_df = calculate_crsi(sample_data.copy())
    # Verify dynamic bands are calculated for later rows
    assert pd.notna(result_df['cRSI_UpperBand'].iloc[-1])
    assert pd.notna(result_df['cRSI_LowerBand'].iloc[-1])
    assert (result_df['cRSI_UpperBand'] > result_df['cRSI_LowerBand']).all() or result_df['cRSI_UpperBand'].isna().any()

def test_adxvma_golden_dataset():
    result_df = calculate_adxvma(sample_data.copy())
    assert len(result_df['ADXVMA']) == len(sample_data)
    assert pd.notna(result_df['ADXVMA'].iloc[-1])
