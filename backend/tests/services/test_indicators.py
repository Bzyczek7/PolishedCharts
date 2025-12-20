import pytest
import pandas as pd
from app.services.indicators import calculate_tdfi

def test_calculate_tdfi_basic():
    # Example data (replace with realistic values for a proper test)
    data = pd.DataFrame({
        'open': [100, 102, 105, 103, 106, 108, 110, 109, 112, 115],
        'high': [103, 105, 107, 106, 108, 111, 112, 111, 114, 117],
        'low': [99, 101, 103, 102, 104, 106, 108, 107, 110, 113],
        'close': [102, 104, 106, 104, 107, 109, 111, 110, 113, 116]
    })
    
    tdfi_data = calculate_tdfi(data)
    
    # Assertions for expected TDFI output structure and values
    assert 'TDFI' in tdfi_data.columns
    assert 'TDFI_Signal' in tdfi_data.columns
    assert not tdfi_data['TDFI'].isnull().all()
    assert not tdfi_data['TDFI_Signal'].isnull().all()
    
    # Placeholder for more specific value checks once implementation is done
    # e.g., assert tdfi_data['TDFI'].iloc[-1] == pytest.approx(expected_value)
    # assert tdfi_data['TDFI_Signal'].iloc[-1] == pytest.approx(expected_signal_value)
