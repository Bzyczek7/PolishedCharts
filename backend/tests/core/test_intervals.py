from app.core.intervals import get_canonical_interval, get_interval_delta, get_lookback_cap
from datetime import timedelta

def test_canonical_mapping():
    assert get_canonical_interval("60m") == "1h"
    assert get_canonical_interval("1h") == "1h"
    assert get_canonical_interval("1W") == "1wk"
    assert get_canonical_interval("1d") == "1d"

def test_interval_deltas():
    assert get_interval_delta("1h") == timedelta(hours=1)
    assert get_interval_delta("1d") == timedelta(days=1)
    assert get_interval_delta("60m") == timedelta(hours=1)

def test_lookback_caps():
    assert get_lookback_cap("1m") == timedelta(days=7)
    assert get_lookback_cap("1h") == timedelta(days=729)
    assert get_lookback_cap("1d") >= timedelta(days=365)
