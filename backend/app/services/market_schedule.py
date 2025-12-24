"""
MarketSchedule Service - Detects US market hours for polling optimization.

Feature: 004-candle-data-refresh
Purpose: Reduce unnecessary polling during market closures
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional


class MarketSchedule:
    """
    Detects US market hours for polling optimization.

    US Market Hours: 9:30 AM - 4:00 PM Eastern Time, Monday-Friday
    """

    # Market hours in ET (24-hour format)
    MARKET_OPEN_HOUR = 9
    MARKET_OPEN_MINUTE = 30  # 9:30 AM
    MARKET_CLOSE_HOUR = 16
    MARKET_CLOSE_MINUTE = 0  # 4:00 PM

    def __init__(self):
        """Initialize MarketSchedule with Eastern Time zone."""
        self.et_zone = ZoneInfo('America/New_York')

    def is_market_open(self) -> bool:
        """
        Check if US market is currently open.

        Returns:
            bool: True if market is open (9:30 AM - 4:00 PM ET, Mon-Fri), False otherwise
        """
        now = datetime.now(timezone.utc).astimezone(self.et_zone)

        # Weekend check (Saturday=5, Sunday=6)
        if now.weekday() >= 5:
            return False

        # Hours check: convert to decimal hour for comparison
        hour_decimal = now.hour + now.minute / 60
        open_time = self.MARKET_OPEN_HOUR + self.MARKET_OPEN_MINUTE / 60  # 9.5
        close_time = self.MARKET_CLOSE_HOUR + self.MARKET_CLOSE_MINUTE / 60  # 16.0

        return open_time <= hour_decimal <= close_time

    def next_market_open(self, dt: Optional[datetime] = None) -> datetime:
        """
        Get the next market open time from the given datetime.

        Args:
            dt: Reference datetime (defaults to now if None). Should be timezone-aware.

        Returns:
            datetime: Next market open time in UTC
        """
        if dt is None:
            dt = datetime.now(timezone.utc)

        # Convert to ET for comparison
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt_et = dt.astimezone(self.et_zone)

        # If it's weekend, go to next Monday 9:30 AM
        if dt_et.weekday() >= 5:
            days_until_monday = 7 - dt_et.weekday()
            next_open = dt_et.replace(
                hour=self.MARKET_OPEN_HOUR,
                minute=self.MARKET_OPEN_MINUTE,
                second=0,
                microsecond=0
            ) + __import__('datetime').timedelta(days=days_until_monday)
        else:
            # Weekday - check if before or after market hours
            hour_decimal = dt_et.hour + dt_et.minute / 60
            open_time = self.MARKET_OPEN_HOUR + self.MARKET_OPEN_MINUTE / 60
            close_time = self.MARKET_CLOSE_HOUR + self.MARKET_CLOSE_MINUTE / 60

            if hour_decimal < open_time:
                # Before market opens today
                next_open = dt_et.replace(
                    hour=self.MARKET_OPEN_HOUR,
                    minute=self.MARKET_OPEN_MINUTE,
                    second=0,
                    microsecond=0
                )
            elif hour_decimal > close_time:
                # After market closes today - next opening is tomorrow 9:30 AM
                next_open = dt_et.replace(
                    hour=self.MARKET_OPEN_HOUR,
                    minute=self.MARKET_OPEN_MINUTE,
                    second=0,
                    microsecond=0
                ) + __import__('datetime').timedelta(days=1)
            else:
                # Market is currently open
                next_open = dt_et

        # Convert back to UTC
        return next_open.astimezone(timezone.utc)

    def next_market_close(self, dt: Optional[datetime] = None) -> datetime:
        """
        Get the next market close time from the given datetime.

        Args:
            dt: Reference datetime (defaults to now if None). Should be timezone-aware.

        Returns:
            datetime: Next market close time in UTC
        """
        if dt is None:
            dt = datetime.now(timezone.utc)

        # Convert to ET for comparison
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt_et = dt.astimezone(self.et_zone)

        # If it's weekend, next close is next Monday 4:00 PM
        if dt_et.weekday() >= 5:
            days_until_monday = 7 - dt_et.weekday()
            next_close = dt_et.replace(
                hour=self.MARKET_CLOSE_HOUR,
                minute=self.MARKET_CLOSE_MINUTE,
                second=0,
                microsecond=0
            ) + __import__('datetime').timedelta(days=days_until_monday)
        else:
            # Weekday - check if before or after market hours
            hour_decimal = dt_et.hour + dt_et.minute / 60
            close_time = self.MARKET_CLOSE_HOUR + self.MARKET_CLOSE_MINUTE / 60

            if hour_decimal < close_time:
                # Before or at market close today
                next_close = dt_et.replace(
                    hour=self.MARKET_CLOSE_HOUR,
                    minute=self.MARKET_CLOSE_MINUTE,
                    second=0,
                    microsecond=0
                )
            else:
                # After market closes today - next close is tomorrow 4:00 PM
                next_close = dt_et.replace(
                    hour=self.MARKET_CLOSE_HOUR,
                    minute=self.MARKET_CLOSE_MINUTE,
                    second=0,
                    microsecond=0
                ) + __import__('datetime').timedelta(days=1)

        # Convert back to UTC
        return next_close.astimezone(timezone.utc)
