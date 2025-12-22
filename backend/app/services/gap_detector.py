import logging
from datetime import datetime, timedelta, timezone
from typing import List, Tuple
from app.core.intervals import get_interval_delta

logger = logging.getLogger(__name__)

class GapDetector:
    def is_crypto(self, ticker: str) -> bool:
        """
        Heuristic to determine if a ticker is a crypto pair.
        Commonly ends in -USD, -BTC, etc. or is just 3-5 chars without .
        """
        ticker = ticker.upper()
        # yfinance crypto often looks like BTC-USD
        if "-USD" in ticker or "-BTC" in ticker or "-ETH" in ticker:
            return True
        # For this project, we'll assume anything with '-' is likely crypto or special
        return "-" in ticker

    def get_expected_timestamps(
        self, 
        start: datetime, 
        end: datetime, 
        interval: str, 
        ticker: str
    ) -> List[datetime]:
        """
        Generate a list of expected timestamps for a given range and interval,
        accounting for market hours (Equities vs Crypto).
        """
        delta = get_interval_delta(interval)
        crypto = self.is_crypto(ticker)
        
        # Ensure aware
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        expected = []
        current = start
        
        while current <= end:
            # Venue awareness: Skip weekends for equities
            if not crypto:
                # 0=Monday, 5=Saturday, 6=Sunday
                if current.weekday() >= 5:
                    current += delta
                    continue
            
            expected.append(current)
            current += delta
            
        return expected

    def detect_gaps(
        self,
        existing_ts: List[datetime],
        start: datetime,
        end: datetime,
        interval: str,
        ticker: str
    ) -> List[Tuple[datetime, datetime]]:
        """
        Compare existing timestamps against expected timestamps to find gaps.
        Returns a list of (gap_start, gap_end) tuples.
        """
        if not existing_ts:
            return [(start, end)]

        expected_ts = self.get_expected_timestamps(start, end, interval, ticker)
        if not expected_ts:
            return []

        # Convert existing to a set for fast lookup
        # Ensure they are all aware
        existing_set = set()
        for ts in existing_ts:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            else:
                ts = ts.astimezone(timezone.utc)
            existing_set.add(ts)

        gaps = []
        current_gap_start = None
        current_gap_end = None
        
        for ts in expected_ts:
            if ts not in existing_set:
                if current_gap_start is None:
                    current_gap_start = ts
                current_gap_end = ts
            else:
                if current_gap_start is not None:
                    gaps.append((current_gap_start, current_gap_end))
                    current_gap_start = None
        
        if current_gap_start is not None:
            gaps.append((current_gap_start, current_gap_end))

        return gaps