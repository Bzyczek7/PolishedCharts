import pytest
from datetime import datetime, timezone, timedelta
from app.services.gap_detector import GapDetector

def test_is_crypto():
    detector = GapDetector()
    assert detector.is_crypto("BTC-USD") is True
    assert detector.is_crypto("ETH-BTC") is True
    assert detector.is_crypto("AAPL") is False
    assert detector.is_crypto("MSFT") is False

def test_expected_timestamps_equities_skips_weekends():
    detector = GapDetector()
    # 2025-01-03 is Friday, 2025-01-06 is Monday
    start = datetime(2025, 1, 3, 10, 0, tzinfo=timezone.utc)
    end = datetime(2025, 1, 6, 10, 0, tzinfo=timezone.utc)
    
    ts = detector.get_expected_timestamps(start, end, "1d", "AAPL")
    
    # Friday, Monday
    # (Depending on inclusive logic, could be more, but should not contain Saturday/Sunday)
    days = [t.weekday() for t in ts]
    assert 5 not in days # Saturday
    assert 6 not in days # Sunday

def test_expected_timestamps_crypto_includes_weekends():
    detector = GapDetector()
    start = datetime(2025, 1, 3, 10, 0, tzinfo=timezone.utc)
    end = datetime(2025, 1, 6, 10, 0, tzinfo=timezone.utc)
    
    ts = detector.get_expected_timestamps(start, end, "1d", "BTC-USD")
    
    days = [t.weekday() for t in ts]
    assert 5 in days # Saturday
    assert 6 in days # Sunday

def test_detect_gaps_identifies_missing_data():
    detector = GapDetector()
    # Friday to Monday (Daily)
    start = datetime(2025, 1, 3, tzinfo=timezone.utc)
    end = datetime(2025, 1, 6, tzinfo=timezone.utc)
    
    # Friday (3rd) and Monday (6th) are expected for equities
    # Give it only Monday
    existing = [datetime(2025, 1, 6, tzinfo=timezone.utc)]
    
    gaps = detector.detect_gaps(existing, start, end, "1d", "AAPL")
    
    assert len(gaps) == 1
    assert gaps[0][0] == datetime(2025, 1, 3, tzinfo=timezone.utc)
    assert gaps[0][1] == datetime(2025, 1, 3, tzinfo=timezone.utc)

def test_detect_gaps_1h_interval():
    detector = GapDetector()
    start = datetime(2025, 1, 3, 9, 0, tzinfo=timezone.utc)
    end = datetime(2025, 1, 3, 12, 0, tzinfo=timezone.utc)
    
    # Expected: 9:00, 10:00, 11:00, 12:00
    existing = [
        datetime(2025, 1, 3, 9, 0, tzinfo=timezone.utc),
        # 10:00 missing
        datetime(2025, 1, 3, 11, 0, tzinfo=timezone.utc),
        datetime(2025, 1, 3, 12, 0, tzinfo=timezone.utc),
    ]
    
    gaps = detector.detect_gaps(existing, start, end, "1h", "AAPL")
    
    assert len(gaps) == 1
    assert gaps[0][0] == datetime(2025, 1, 3, 10, 0, tzinfo=timezone.utc)
    assert gaps[0][1] == datetime(2025, 1, 3, 10, 0, tzinfo=timezone.utc)
