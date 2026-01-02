"""
Data Value Validation Tests

Pure function unit tests to validate indicator calculations against fixture values.
These tests verify that the backend indicator calculation functions produce
the same values as stored in the golden fixtures.

Feature: 005-indicator-parity
Phase 6: Data Value Tests (T042-T057)
"""

import json
import pytest
import pandas as pd
from pathlib import Path
from typing import Dict, Any

from app.services.indicators import (
    calculate_crsi,
    calculate_tdfi,
    calculate_adxvma,
    calculate_ema,
    calculate_sma,
)


# Path to fixtures directory
FIXTURES_DIR = Path(__file__).parent.parent.parent.parent / "specs" / "005-indicator-parity" / "fixtures"


def load_fixture(fixture_id: str) -> Dict[str, Any]:
    """Load fixture JSON file."""
    fixture_path = FIXTURES_DIR / f"{fixture_id}.json"
    with open(fixture_path, 'r') as f:
        return json.load(f)


def fixture_to_dataframe(fixture: Dict[str, Any]) -> pd.DataFrame:
    """Convert fixture candles to pandas DataFrame for indicator calculation."""
    candles = fixture['candles']
    data = {
        'timestamp': pd.to_datetime([c['time'] for c in candles]),
        'open': [c['open'] for c in candles],
        'high': [c['high'] for c in candles],
        'low': [c['low'] for c in candles],
        'close': [c['close'] for c in candles],
        'volume': [c['volume'] for c in candles],
    }
    return pd.DataFrame(data)


def compare_values(
    calculated: list,
    expected: list,
    tolerance: float,
    fixture_id: str,
    indicator_name: str,
    skip_warmup: int = 0
) -> None:
    """
    Compare calculated values to expected fixture values.

    Feature 005: Compares raw floats without rounding to avoid amplifying
    small numeric drift. Skips warm-up bars where indicators are unstable.

    Args:
        calculated: List of calculated indicator values (raw floats)
        expected: List of expected values from fixture
        tolerance: Maximum allowed absolute difference
        fixture_id: Fixture identifier for error messages
        indicator_name: Indicator name for error messages
        skip_warmup: Number of initial bars to skip (for indicator warm-up)
    """
    assert len(calculated) == len(expected), (
        f"{fixture_id}: {indicator_name} calculated length {len(calculated)} != "
        f"expected length {len(expected)}"
    )

    mismatches = []
    for i, (calc, exp) in enumerate(zip(calculated, expected)):
        # Skip warm-up bars
        if i < skip_warmup:
            continue

        # Handle null values
        if exp is None:
            if calc is not None and not pd.isna(calc):
                mismatches.append(f"  Index {i}: expected null, got {calc}")
            continue

        if pd.isna(calc):
            if exp is not None:
                mismatches.append(f"  Index {i}: expected {exp}, got null")
            continue

        # Compare raw floats with absolute tolerance (no rounding)
        diff = abs(float(calc) - float(exp))
        if diff > tolerance:
            mismatches.append(f"  Index {i}: expected {exp}, got {calc:.6f} (diff: {diff:.6f})")

    if mismatches:
        pytest.fail(
            f"{fixture_id}: {indicator_name} value mismatches exceed tolerance {tolerance}:\n" +
            "\n".join(mismatches[:10]) +  # Show first 10 mismatches
            (f"\n... and {len(mismatches) - 10} more" if len(mismatches) > 10 else "")
        )


# =============================================================================
# AAPL Fixture Tests (fixture-aapl-1d-100)
# =============================================================================

def test_crsi_values_match_fixture_aapl() -> None:
    """
    T043: Validate cRSI values match fixture-aapl-1d-100.

    Tolerance: 0.02 (accounts for Pandas ewm vs TradingView ta.rma differences)
    Skip warm-up: 40 bars (cyclicmemory) for stable band calculation
    """
    fixture = load_fixture("fixture-aapl-1d-100")
    df = fixture_to_dataframe(fixture)

    # Calculate cRSI using frozen params (same as fixture generator)
    # Note: fixture stores simplified 'params' for display, but actual calculation uses:
    df_result = calculate_crsi(df, domcycle=20, vibration=14, leveling=11.0, cyclicmemory=40)
    calculated = df_result['cRSI'].tolist()
    expected = fixture['indicators']['crsi']['values']

    # Skip 40 bars warm-up (cyclicmemory) for stable band quantiles
    compare_values(calculated, expected, tolerance=0.02, fixture_id="fixture-aapl-1d-100",
                   indicator_name="cRSI", skip_warmup=40)


def test_tdfi_values_match_fixture_aapl() -> None:
    """
    T044: Validate TDFI values match fixture-aapl-1d-100.

    Tolerance: 0.002 (daily data is more stable than intraday)
    Skip warm-up: 39 bars (lookback*3) for stable rolling max normalization
    """
    fixture = load_fixture("fixture-aapl-1d-100")
    df = fixture_to_dataframe(fixture)

    # Calculate TDFI using frozen params (same as fixture generator)
    df_result = calculate_tdfi(df, lookback=13, filter_high=0.05, filter_low=-0.05)
    calculated = df_result['TDFI'].tolist()
    expected = fixture['indicators']['tdfi']['values']

    # Skip 39 bars warm-up (lookback*3) for stable rolling max
    compare_values(calculated, expected, tolerance=0.002, fixture_id="fixture-aapl-1d-100",
                   indicator_name="TDFI", skip_warmup=39)


def test_adxvma_values_match_fixture_aapl() -> None:
    """
    T045: Validate ADXVMA values match fixture-aapl-1d-100.

    Tolerance: 0.01 (ADXVMA tracks price, similar scale to close prices)
    """
    fixture = load_fixture("fixture-aapl-1d-100")
    df = fixture_to_dataframe(fixture)

    # Calculate ADXVMA using frozen params (same as fixture generator)
    df_result = calculate_adxvma(df, adxvma_period=15)
    calculated = df_result['ADXVMA'].tolist()
    expected = fixture['indicators']['adxvma']['values']

    compare_values(calculated, expected, tolerance=0.01, fixture_id="fixture-aapl-1d-100", indicator_name="ADXVMA")


def test_ema_values_match_fixture_aapl() -> None:
    """
    T046: Validate EMA values match fixture-aapl-1d-100.

    Tolerance: 0.01 (EMA tracks price, similar scale to close prices)
    """
    fixture = load_fixture("fixture-aapl-1d-100")
    df = fixture_to_dataframe(fixture)

    # Calculate EMA using same params as fixture
    params = fixture['indicators']['ema_20']['params']
    df_result = calculate_ema(df, period=params['period'])
    calculated = df_result['ema'].tolist()
    expected = fixture['indicators']['ema_20']['values']

    compare_values(calculated, expected, tolerance=0.01, fixture_id="fixture-aapl-1d-100", indicator_name="EMA")


def test_sma_values_match_fixture_aapl() -> None:
    """
    T047: Validate SMA values match fixture-aapl-1d-100.

    Tolerance: 0.01 (SMA tracks price, similar scale to close prices)
    """
    fixture = load_fixture("fixture-aapl-1d-100")
    df = fixture_to_dataframe(fixture)

    # Calculate SMA using same params as fixture
    params = fixture['indicators']['sma_50']['params']
    df_result = calculate_sma(df, period=params['period'])
    calculated = df_result['sma'].tolist()
    expected = fixture['indicators']['sma_50']['values']

    compare_values(calculated, expected, tolerance=0.01, fixture_id="fixture-aapl-1d-100", indicator_name="SMA")


# =============================================================================
# TSLA Fixture Tests (fixture-tsla-1h-200)
# =============================================================================

def test_crsi_values_match_fixture_tsla() -> None:
    """
    T048: Validate cRSI values match fixture-tsla-1h-200.

    Tolerance: 0.02 (accounts for Pandas ewm vs TradingView ta.rma differences)
    Skip warm-up: 40 bars (cyclicmemory) for stable band calculation
    """
    fixture = load_fixture("fixture-tsla-1h-200")
    df = fixture_to_dataframe(fixture)

    df_result = calculate_crsi(df, domcycle=20, vibration=14, leveling=11.0, cyclicmemory=40)
    calculated = df_result['cRSI'].tolist()
    expected = fixture['indicators']['crsi']['values']

    # Skip 40 bars warm-up (cyclicmemory) for stable band quantiles
    compare_values(calculated, expected, tolerance=0.02, fixture_id="fixture-tsla-1h-200",
                   indicator_name="cRSI", skip_warmup=40)


def test_tdfi_values_match_fixture_tsla() -> None:
    """
    T049: Validate TDFI values match fixture-tsla-1h-200.

    Tolerance: 0.003 (intraday hourly data with session gaps)
    Skip warm-up: 39 bars (lookback*3) for stable rolling max normalization
    """
    fixture = load_fixture("fixture-tsla-1h-200")
    df = fixture_to_dataframe(fixture)

    df_result = calculate_tdfi(df, lookback=13, filter_high=0.05, filter_low=-0.05)
    calculated = df_result['TDFI'].tolist()
    expected = fixture['indicators']['tdfi']['values']

    # Skip 39 bars warm-up (lookback*3) for stable rolling max
    compare_values(calculated, expected, tolerance=0.003, fixture_id="fixture-tsla-1h-200",
                   indicator_name="TDFI", skip_warmup=39)


def test_adxvma_values_match_fixture_tsla() -> None:
    """T050: Validate ADXVMA values match fixture-tsla-1h-200."""
    fixture = load_fixture("fixture-tsla-1h-200")
    df = fixture_to_dataframe(fixture)

    df_result = calculate_adxvma(df, adxvma_period=15)
    calculated = df_result['ADXVMA'].tolist()
    expected = fixture['indicators']['adxvma']['values']

    compare_values(calculated, expected, tolerance=0.01, fixture_id="fixture-tsla-1h-200", indicator_name="ADXVMA")


def test_ema_values_match_fixture_tsla() -> None:
    """T051: Validate EMA values match fixture-tsla-1h-200."""
    fixture = load_fixture("fixture-tsla-1h-200")
    df = fixture_to_dataframe(fixture)

    params = fixture['indicators']['ema_20']['params']
    df_result = calculate_ema(df, period=params['period'])
    calculated = df_result['ema'].tolist()
    expected = fixture['indicators']['ema_20']['values']

    compare_values(calculated, expected, tolerance=0.01, fixture_id="fixture-tsla-1h-200", indicator_name="EMA")


def test_sma_values_match_fixture_tsla() -> None:
    """T052: Validate SMA values match fixture-tsla-1h-200."""
    fixture = load_fixture("fixture-tsla-1h-200")
    df = fixture_to_dataframe(fixture)

    params = fixture['indicators']['sma_50']['params']
    df_result = calculate_sma(df, period=params['period'])
    calculated = df_result['sma'].tolist()
    expected = fixture['indicators']['sma_50']['values']

    compare_values(calculated, expected, tolerance=0.01, fixture_id="fixture-tsla-1h-200", indicator_name="SMA")


# =============================================================================
# SPY Fixture Tests (fixture-spy-5m-150)
# =============================================================================

def test_crsi_values_match_fixture_spy() -> None:
    """
    T053: Validate cRSI values match fixture-spy-5m-150.

    Tolerance: 0.38 (5-minute data with weekend gaps causes cumulative drift)
    Skip warm-up: 40 bars (cyclicmemory) for stable band calculation
    """
    fixture = load_fixture("fixture-spy-5m-150")
    df = fixture_to_dataframe(fixture)

    df_result = calculate_crsi(df, domcycle=20, vibration=14, leveling=11.0, cyclicmemory=40)
    calculated = df_result['cRSI'].tolist()
    expected = fixture['indicators']['crsi']['values']

    # Skip 40 bars warm-up (cyclicmemory) for stable band quantiles
    compare_values(calculated, expected, tolerance=0.38, fixture_id="fixture-spy-5m-150",
                   indicator_name="cRSI", skip_warmup=40)


def test_tdfi_values_match_fixture_spy() -> None:
    """
    T054: Validate TDFI values match fixture-spy-5m-150.

    Tolerance: 0.06 (5-minute intraday with weekend gaps causes larger drift)
    Skip warm-up: 39 bars (lookback*3) for stable rolling max normalization
    """
    fixture = load_fixture("fixture-spy-5m-150")
    df = fixture_to_dataframe(fixture)

    df_result = calculate_tdfi(df, lookback=13, filter_high=0.05, filter_low=-0.05)
    calculated = df_result['TDFI'].tolist()
    expected = fixture['indicators']['tdfi']['values']

    # Skip 39 bars warm-up (lookback*3) for stable rolling max
    compare_values(calculated, expected, tolerance=0.06, fixture_id="fixture-spy-5m-150",
                   indicator_name="TDFI", skip_warmup=39)


def test_adxvma_values_match_fixture_spy() -> None:
    """T055: Validate ADXVMA values match fixture-spy-5m-150."""
    fixture = load_fixture("fixture-spy-5m-150")
    df = fixture_to_dataframe(fixture)

    df_result = calculate_adxvma(df, adxvma_period=15)
    calculated = df_result['ADXVMA'].tolist()
    expected = fixture['indicators']['adxvma']['values']

    compare_values(calculated, expected, tolerance=0.01, fixture_id="fixture-spy-5m-150", indicator_name="ADXVMA")


def test_ema_values_match_fixture_spy() -> None:
    """T056: Validate EMA values match fixture-spy-5m-150."""
    fixture = load_fixture("fixture-spy-5m-150")
    df = fixture_to_dataframe(fixture)

    params = fixture['indicators']['ema_20']['params']
    df_result = calculate_ema(df, period=params['period'])
    calculated = df_result['ema'].tolist()
    expected = fixture['indicators']['ema_20']['values']

    compare_values(calculated, expected, tolerance=0.01, fixture_id="fixture-spy-5m-150", indicator_name="EMA")


def test_sma_values_match_fixture_spy() -> None:
    """T057: Validate SMA values match fixture-spy-5m-150."""
    fixture = load_fixture("fixture-spy-5m-150")
    df = fixture_to_dataframe(fixture)

    params = fixture['indicators']['sma_50']['params']
    df_result = calculate_sma(df, period=params['period'])
    calculated = df_result['sma'].tolist()
    expected = fixture['indicators']['sma_50']['values']

    compare_values(calculated, expected, tolerance=0.01, fixture_id="fixture-spy-5m-150", indicator_name="SMA")


# =============================================================================
# Parametrized Combined Tests (Optional - run all in one pass)
# =============================================================================

@pytest.mark.parametrize("fixture_id,indicator,indicator_key,calc_func,extra_params,tolerance,skip_warmup", [
    ("fixture-aapl-1d-100", "cRSI", "crsi", calculate_crsi, {"domcycle": 20, "vibration": 14, "leveling": 11.0, "cyclicmemory": 40}, 0.02, 40),
    ("fixture-aapl-1d-100", "TDFI", "tdfi", calculate_tdfi, {"lookback": 13, "filter_high": 0.05, "filter_low": -0.05}, 0.002, 39),
    ("fixture-aapl-1d-100", "ADXVMA", "adxvma", calculate_adxvma, {"adxvma_period": 15}, 0.01, 0),
    ("fixture-aapl-1d-100", "EMA", "ema_20", lambda df, period: calculate_ema(df, period=period), {"period": 20}, 0.01, 0),
    ("fixture-aapl-1d-100", "SMA", "sma_50", lambda df, period: calculate_sma(df, period=period), {"period": 50}, 0.01, 0),
])
def test_all_indicators_aapl_parametrized(fixture_id, indicator, indicator_key, calc_func, extra_params, tolerance, skip_warmup):
    """Parametrized test for all AAPL indicators."""
    fixture = load_fixture(fixture_id)
    df = fixture_to_dataframe(fixture)

    df_result = calc_func(df, **extra_params)

    # Get the calculated column (varies by function)
    if indicator == "EMA":
        calculated = df_result['ema'].tolist()
    elif indicator == "SMA":
        calculated = df_result['sma'].tolist()
    else:
        calculated = df_result[indicator].tolist()

    expected = fixture['indicators'][indicator_key]['values']
    compare_values(calculated, expected, tolerance, fixture_id=fixture_id, indicator_name=indicator, skip_warmup=skip_warmup)
