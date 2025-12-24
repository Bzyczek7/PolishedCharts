import pytest
import pandas as pd
import numpy as np
from app.services.indicators import calculate_tdfi, calculate_crsi, calculate_adxvma, calculate_sma

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

def test_calculate_crsi_basic():
    # Example data for cRSI (longer series to allow calculations to fill)
    data = pd.DataFrame({
        'close': [
            100, 101, 102, 101, 103, 105, 104, 106, 107, 105,
            108, 109, 110, 112, 111, 113, 115, 114, 116, 118,
            117, 119, 120, 119, 121, 123, 122, 124, 125, 123,
            126, 128, 127, 129, 130, 128, 131, 133, 132, 134,
            135, 133, 136, 138, 137, 139, 140, 138, 141, 143
        ]
    })

    # Assuming default parameters for now
    crsi_data = calculate_crsi(data)

    assert 'cRSI' in crsi_data.columns
    assert 'cRSI_UpperBand' in crsi_data.columns
    assert 'cRSI_LowerBand' in crsi_data.columns
    assert not crsi_data['cRSI'].isnull().all()

def test_calculate_adxvma_basic():
    # Example data for ADXVMA
    data = pd.DataFrame({
        'high': [103, 105, 107, 106, 108, 111, 112, 111, 114, 117],
        'low': [99, 101, 103, 102, 104, 106, 108, 107, 110, 113],
        'close': [102, 104, 106, 104, 107, 109, 111, 110, 113, 116]
    })

    adxvma_data = calculate_adxvma(data)

    assert 'ADXVMA' in adxvma_data.columns
    assert not adxvma_data['ADXVMA'].isnull().all()


# T057 [US3] Test SMA calculation with known values
def test_sma_calculation_known_values():
    """Test: SMA calculation returns known correct values for simple dataset"""
    # Simple dataset where SMA is easy to verify
    data = pd.DataFrame({
        'close': [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0]
    })

    result = calculate_sma(data, period=5)

    # Check SMA column exists (note: column name is lowercase 'sma')
    assert 'sma' in result.columns

    # First 4 values should be NaN (need period=5 data points)
    assert pd.isna(result['sma'].iloc[0])
    assert pd.isna(result['sma'].iloc[1])
    assert pd.isna(result['sma'].iloc[2])
    assert pd.isna(result['sma'].iloc[3])

    # 5th value: average of 10, 20, 30, 40, 50 = 30
    assert result['sma'].iloc[4] == pytest.approx(30.0)

    # 6th value: average of 20, 30, 40, 50, 60 = 40
    assert result['sma'].iloc[5] == pytest.approx(40.0)

    # 10th value: average of 60, 70, 80, 90, 100 = 80
    assert result['sma'].iloc[9] == pytest.approx(80.0)


def test_sma_period_3():
    """Test: SMA with period=3"""
    data = pd.DataFrame({
        'close': [10.0, 20.0, 30.0, 40.0, 50.0]
    })

    result = calculate_sma(data, period=3)

    # First 2 values should be NaN
    assert pd.isna(result['sma'].iloc[0])
    assert pd.isna(result['sma'].iloc[1])

    # 3rd value: average of 10, 20, 30 = 20
    assert result['sma'].iloc[2] == pytest.approx(20.0)

    # 5th value: average of 30, 40, 50 = 40
    assert result['sma'].iloc[4] == pytest.approx(40.0)


class TestInsufficientDataHandling:
    """T110b: Test insufficient data handling (partial null values)."""

    def test_crsi_handles_insufficient_data(self):
        """
        T110b: Verify cRSI handles datasets shorter than required period gracefully.
        Note: cRSI may produce 50 (midpoint) values for small datasets rather than NaN.
        """
        # Create minimal dataset (shorter than typical cRSI period of 14)
        data = pd.DataFrame({
            'close': [100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0]
        })

        result = calculate_crsi(data)

        # Verify cRSI column exists
        assert 'cRSI' in result.columns

        # cRSI should handle small datasets without crashing
        # Values may be 50 (midpoint) for insufficient data, not necessarily NaN
        assert len(result) == 8, "Output length should match input length"

    def test_tdfi_handles_insufficient_data(self):
        """
        T110b: Verify TDFI handles datasets shorter than required period gracefully.
        Note: TDFI returns 0/1 values for small datasets rather than NaN.
        """
        data = pd.DataFrame({
            'open': [100.0, 102.0, 105.0],
            'high': [103.0, 105.0, 107.0],
            'low': [99.0, 101.0, 103.0],
            'close': [102.0, 104.0, 106.0]
        })

        result = calculate_tdfi(data)

        # Verify TDFI columns exist
        assert 'TDFI' in result.columns

        # TDFI should handle small datasets without crashing
        # Values may be 0 or 1 for insufficient data, not necessarily NaN
        assert len(result) == 3, "Output length should match input length"

    def test_adxvma_handles_insufficient_data(self):
        """
        T110b: Verify ADXVMA handles datasets shorter than required period gracefully.
        """
        data = pd.DataFrame({
            'high': [103.0, 105.0, 107.0],
            'low': [99.0, 101.0, 103.0],
            'close': [102.0, 104.0, 106.0]
        })

        result = calculate_adxvma(data)

        # Verify ADXVMA column exists
        assert 'ADXVMA' in result.columns

        # All values might be NaN if dataset is too small
        # This is expected - no crash should occur
        assert len(result) == 3, "Output length should match input length"

    def test_sma_handles_single_value(self):
        """
        T110b: Verify SMA handles single-value datasets without crashing.
        """
        data = pd.DataFrame({
            'close': [100.0]
        })

        result = calculate_sma(data, period=5)

        # Verify SMA column exists (note: lowercase 'sma')
        assert 'sma' in result.columns

        # Value should be NaN since we have insufficient data
        assert pd.isna(result['sma'].iloc[0])

    def test_sma_handles_exactly_period_length(self):
        """
        T110b: Verify SMA produces exactly one non-NaN value when input length equals period.
        """
        data = pd.DataFrame({
            'close': [10.0, 20.0, 30.0, 40.0, 50.0]
        })

        result = calculate_sma(data, period=5)

        # First 4 should be NaN
        for i in range(4):
            assert pd.isna(result['sma'].iloc[i])

        # Last value should be valid
        assert not pd.isna(result['sma'].iloc[4])
        assert result['sma'].iloc[4] == pytest.approx(30.0)

    def test_indicators_preserve_input_length(self):
        """
        T110b: Verify all indicators preserve input DataFrame length.
        Even with partial null values, output length should match input.
        """
        data = pd.DataFrame({
            'close': [100.0, 101.0, 102.0, 103.0, 104.0]
        })

        # Test various indicators
        indicators = [
            ('cRSI', lambda df: calculate_crsi(df)),
            ('TDFI', lambda df: calculate_tdfi(df)),
            ('ADXVMA', lambda df: calculate_adxvma(df)),
            ('SMA', lambda df: calculate_sma(df, period=3))
        ]

        for name, calc_func in indicators:
            if name == 'TDFI':
                # TDFI requires open, high, low
                test_df = pd.DataFrame({
                    'open': data['close'] - 1,
                    'high': data['close'] + 1,
                    'low': data['close'] - 2,
                    'close': data['close']
                })
            elif name == 'ADXVMA':
                test_df = pd.DataFrame({
                    'high': data['close'] + 1,
                    'low': data['close'] - 2,
                    'close': data['close']
                })
            else:
                test_df = data.copy()

            try:
                result = calc_func(test_df)
                assert len(result) == len(test_df), (
                    f"{name} should preserve input length: "
                    f"expected {len(test_df)}, got {len(result)}"
                )
            except Exception as e:
                pytest.fail(f"{name} calculation failed with insufficient data: {e}")

    def test_null_values_propagate_correctly(self):
        """
        T110b: Verify null values appear at the start of the series and valid values after.
        """
        data = pd.DataFrame({
            'close': list(range(100, 120))  # 20 data points
        })

        result = calculate_sma(data, period=10)

        # First 9 should be NaN
        for i in range(9):
            assert pd.isna(result['sma'].iloc[i]), f"Expected NaN at index {i}"

        # From index 9 onwards, should have valid values
        for i in range(9, 20):
            assert not pd.isna(result['sma'].iloc[i]), f"Expected valid value at index {i}"

