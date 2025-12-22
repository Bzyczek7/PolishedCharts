from datetime import timedelta
from typing import Dict, Any

# Map user-provided or provider-specific intervals to canonical names
# e.g. '60m' -> '1h'
CANONICAL_INTERVALS: Dict[str, str] = {
    "1m": "1m",
    "2m": "2m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "60m": "1h",
    "90m": "90m",
    "1h": "1h",
    "1d": "1d",
    "5d": "5d",
    "1w": "1wk",
    "1wk": "1wk",
    "1mo": "1mo",
    "3mo": "3mo",
}

# Standard time deltas for each canonical interval
INTERVAL_DELTAS: Dict[str, timedelta] = {
    "1m": timedelta(minutes=1),
    "2m": timedelta(minutes=2),
    "5m": timedelta(minutes=5),
    "15m": timedelta(minutes=15),
    "30m": timedelta(minutes=30),
    "90m": timedelta(minutes=90),
    "1h": timedelta(hours=1),
    "1d": timedelta(days=1),
    "5d": timedelta(days=5),
    "1wk": timedelta(weeks=1),
    "1mo": timedelta(days=30), # Approximation
    "3mo": timedelta(days=90), # Approximation
}

# Best-effort lookback caps (to avoid provider limits or extreme data sizes)
# yfinance limits: 
# 1m: 7 days
# 2m, 5m, 15m, 30m, 90m: 60 days
# 1h: 730 days
# 1d+: decades
LOOKBACK_CAPS: Dict[str, timedelta] = {
    "1m": timedelta(days=7),
    "2m": timedelta(days=59),
    "5m": timedelta(days=59),
    "15m": timedelta(days=59),
    "30m": timedelta(days=59),
    "90m": timedelta(days=59),
    "1h": timedelta(days=729),
    "1d": timedelta(days=365 * 10), # 10 years
    "5d": timedelta(days=365 * 10),
    "1wk": timedelta(days=365 * 20),
    "1mo": timedelta(days=365 * 20),
    "3mo": timedelta(days=365 * 20),
}

def get_canonical_interval(interval: str) -> str:
    return CANONICAL_INTERVALS.get(interval.lower(), interval.lower())

def get_interval_delta(interval: str) -> timedelta:
    canonical = get_canonical_interval(interval)
    return INTERVAL_DELTAS.get(canonical, timedelta(days=1))

def get_lookback_cap(interval: str) -> timedelta:
    canonical = get_canonical_interval(interval)
    return LOOKBACK_CAPS.get(canonical, timedelta(days=365))
