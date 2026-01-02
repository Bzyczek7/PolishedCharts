"""
Fixture Integrity Tests

Tests for validating generated fixture files.
Tests schema compliance, data consistency, and format correctness.

Feature: 005-indicator-parity
Phase 3: Fixture Validation (T016-T022)
"""

import json
import pytest
from pathlib import Path
from datetime import datetime
from typing import Dict, Any


# Path to fixtures directory
FIXTURES_DIR = Path(__file__).parent.parent.parent.parent / "specs" / "005-indicator-parity" / "fixtures"


def load_fixture(fixture_id: str) -> Dict[str, Any]:
    """Load fixture JSON file."""
    fixture_path = FIXTURES_DIR / f"{fixture_id}.json"
    with open(fixture_path, 'r') as f:
        return json.load(f)


def validate_fixture_schema(fixture: Dict[str, Any]) -> None:
    """
    Validate fixture has all required fields and correct structure.

    Required top-level fields:
    - fixture_id: str
    - symbol: str
    - interval: str
    - timestamp_range: {start: str, end: str}
    - candles: array of {time, open, high, low, close, volume}
    - indicators: {crsi, tdfi, adxvma, ema_20, sma_50}
    - generated_at: str (ISO-8601)
    """
    assert 'fixture_id' in fixture, "Missing fixture_id"
    assert 'symbol' in fixture, "Missing symbol"
    assert 'interval' in fixture, "Missing interval"
    assert 'timestamp_range' in fixture, "Missing timestamp_range"
    assert 'candles' in fixture, "Missing candles"
    assert 'indicators' in fixture, "Missing indicators"
    assert 'generated_at' in fixture, "Missing generated_at"

    # Validate timestamp_range
    ts_range = fixture['timestamp_range']
    assert 'start' in ts_range, "Missing timestamp_range.start"
    assert 'end' in ts_range, "Missing timestamp_range.end"

    # Validate candles array
    assert isinstance(fixture['candles'], list), "candles must be an array"
    if len(fixture['candles']) > 0:
        candle = fixture['candles'][0]
        assert 'time' in candle, "Candle missing time field"
        assert 'open' in candle, "Candle missing open field"
        assert 'high' in candle, "Candle missing high field"
        assert 'low' in candle, "Candle missing low field"
        assert 'close' in candle, "Candle missing close field"
        assert 'volume' in candle, "Candle missing volume field"

    # Validate indicators
    indicators = fixture['indicators']
    assert 'crsi' in indicators, "Missing crsi indicator"
    assert 'tdfi' in indicators, "Missing tdfi indicator"
    assert 'adxvma' in indicators, "Missing adxvma indicator"


@pytest.mark.parametrize("fixture_id,expected_symbol,expected_interval", [
    ("fixture-aapl-1d-100", "AAPL", "1d"),
    ("fixture-tsla-1h-200", "TSLA", "1h"),
    ("fixture-spy-5m-150", "SPY", "5m"),
])
def test_fixture_schema_and_metadata(fixture_id: str, expected_symbol: str, expected_interval: str) -> None:
    """
    T017, T018, T019: Validate fixture structure and required fields.

    Combined parametrized test for all three fixtures.
    """
    fixture = load_fixture(fixture_id)

    # Validate schema
    validate_fixture_schema(fixture)

    # Validate fixture_id matches
    assert fixture['fixture_id'] == fixture_id, f"fixture_id mismatch: {fixture['fixture_id']} != {fixture_id}"

    # Validate symbol matches
    assert fixture['symbol'] == expected_symbol, f"symbol mismatch: {fixture['symbol']} != {expected_symbol}"

    # Validate interval matches
    assert fixture['interval'] == expected_interval, f"interval mismatch: {fixture['interval']} != {expected_interval}"

    # Validate candles exist
    assert len(fixture['candles']) > 0, "candles array is empty"

    # Validate generated_at is ISO-8601 format
    generated_at = fixture['generated_at']
    try:
        datetime.fromisoformat(generated_at.replace('Z', '+00:00'))
    except ValueError:
        pytest.fail(f"generated_at is not valid ISO-8601: {generated_at}")


def test_array_length_consistency() -> None:
    """
    T020: Verify indicator value arrays match candle array length.

    All indicator value arrays should have the same length as the candles array.
    Null values are expected for early periods where indicators cannot be computed.
    """
    fixtures = [
        load_fixture("fixture-aapl-1d-100"),
        load_fixture("fixture-tsla-1h-200"),
        load_fixture("fixture-spy-5m-150"),
    ]

    for fixture in fixtures:
        candle_count = len(fixture['candles'])
        fixture_id = fixture['fixture_id']

        # Check cRSI values
        crsi_values = fixture['indicators']['crsi']['values']
        assert len(crsi_values) == candle_count, (
            f"{fixture_id}: cRSI values length {len(crsi_values)} != candles {candle_count}"
        )

        # Check TDFI values
        tdfi_values = fixture['indicators']['tdfi']['values']
        assert len(tdfi_values) == candle_count, (
            f"{fixture_id}: TDFI values length {len(tdfi_values)} != candles {candle_count}"
        )

        # Check ADXVMA values
        adxvma_values = fixture['indicators']['adxvma']['values']
        assert len(adxvma_values) == candle_count, (
            f"{fixture_id}: ADXVMA values length {len(adxvma_values)} != candles {candle_count}"
        )

        # Check EMA values
        ema_values = fixture['indicators']['ema_20']['values']
        assert len(ema_values) == candle_count, (
            f"{fixture_id}: EMA values length {len(ema_values)} != candles {candle_count}"
        )

        # Check SMA values
        sma_values = fixture['indicators']['sma_50']['values']
        assert len(sma_values) == candle_count, (
            f"{fixture_id}: SMA values length {len(sma_values)} != candles {candle_count}"
        )


def test_timestamp_format() -> None:
    """
    T021: Validate ISO-8601 format for all timestamps.

    All candle timestamps should be valid ISO-8601 strings.
    """
    fixtures = [
        load_fixture("fixture-aapl-1d-100"),
        load_fixture("fixture-tsla-1h-200"),
        load_fixture("fixture-spy-5m-150"),
    ]

    for fixture in fixtures:
        fixture_id = fixture['fixture_id']

        # Validate timestamp_range format
        start_ts = fixture['timestamp_range']['start']
        end_ts = fixture['timestamp_range']['end']

        try:
            datetime.fromisoformat(start_ts.replace('Z', '+00:00'))
        except ValueError:
            pytest.fail(f"{fixture_id}: Invalid start timestamp format: {start_ts}")

        try:
            datetime.fromisoformat(end_ts.replace('Z', '+00:00'))
        except ValueError:
            pytest.fail(f"{fixture_id}: Invalid end timestamp format: {end_ts}")

        # Validate all candle timestamps
        for i, candle in enumerate(fixture['candles']):
            ts = candle['time']
            try:
                datetime.fromisoformat(ts.replace('Z', '+00:00'))
            except ValueError:
                pytest.fail(f"{fixture_id}: Candle {i} has invalid timestamp format: {ts}")


def test_indicator_params_frozen() -> None:
    """
    T022: Verify indicator parameters are stored in fixture metadata.

    Each indicator should have frozen parameters stored in the fixture.
    """
    fixtures = [
        load_fixture("fixture-aapl-1d-100"),
        load_fixture("fixture-tsla-1h-200"),
        load_fixture("fixture-spy-5m-150"),
    ]

    for fixture in fixtures:
        fixture_id = fixture['fixture_id']

        # Check cRSI params
        crsi_params = fixture['indicators']['crsi']['params']
        assert 'period' in crsi_params, f"{fixture_id}: cRSI missing period param"
        assert 'source' in crsi_params, f"{fixture_id}: cRSI missing source param"
        assert crsi_params['period'] == 14, f"{fixture_id}: cRSI period should be 14"

        # Check cRSI thresholds
        assert 'upper_band' in fixture['indicators']['crsi'], f"{fixture_id}: cRSI missing upper_band"
        assert 'lower_band' in fixture['indicators']['crsi'], f"{fixture_id}: cRSI missing lower_band"

        # Check TDFI params
        tdfi_params = fixture['indicators']['tdfi']['params']
        assert 'rsi_period' in tdfi_params, f"{fixture_id}: TDFI missing rsi_period param"
        assert 'band_period' in tdfi_params, f"{fixture_id}: TDFI missing band_period param"

        # Check TDFI thresholds
        assert 'thresholds' in fixture['indicators']['tdfi'], f"{fixture_id}: TDFI missing thresholds"
        assert 'upper' in fixture['indicators']['tdfi']['thresholds'], f"{fixture_id}: TDFI missing upper threshold"
        assert 'lower' in fixture['indicators']['tdfi']['thresholds'], f"{fixture_id}: TDFI missing lower threshold"

        # Check ADXVMA params
        adxvma_params = fixture['indicators']['adxvma']['params']
        assert 'period' in adxvma_params, f"{fixture_id}: ADXVMA missing period param"

        # Check EMA params
        ema_params = fixture['indicators']['ema_20']['params']
        assert 'period' in ema_params, f"{fixture_id}: EMA missing period param"
        assert ema_params['period'] == 20, f"{fixture_id}: EMA period should be 20"

        # Check SMA params
        sma_params = fixture['indicators']['sma_50']['params']
        assert 'period' in sma_params, f"{fixture_id}: SMA missing period param"
        assert sma_params['period'] == 50, f"{fixture_id}: SMA period should be 50"


def test_fixture_files_exist() -> None:
    """Verify all fixture files exist in the fixtures directory."""
    expected_fixtures = [
        "fixture-aapl-1d-100.json",
        "fixture-tsla-1h-200.json",
        "fixture-spy-5m-150.json",
    ]

    for fixture_file in expected_fixtures:
        fixture_path = FIXTURES_DIR / fixture_file
        assert fixture_path.exists(), f"Fixture file not found: {fixture_path}"
        assert fixture_path.is_file(), f"Fixture path is not a file: {fixture_path}"


def test_manifest_exists_and_is_valid() -> None:
    """Verify manifest.json exists and contains all fixtures."""
    manifest_path = FIXTURES_DIR / "manifest.json"
    assert manifest_path.exists(), "manifest.json not found"

    with open(manifest_path, 'r') as f:
        manifest = json.load(f)

    assert 'fixtures' in manifest, "manifest missing 'fixtures' key"
    assert isinstance(manifest['fixtures'], list), "manifest 'fixtures' must be a list"

    fixture_ids = [f['fixture_id'] for f in manifest['fixtures']]
    assert 'fixture-aapl-1d-100' in fixture_ids, "manifest missing fixture-aapl-1d-100"
    assert 'fixture-tsla-1h-200' in fixture_ids, "manifest missing fixture-tsla-1h-200"
    assert 'fixture-spy-5m-150' in fixture_ids, "manifest missing fixture-spy-5m-150"
