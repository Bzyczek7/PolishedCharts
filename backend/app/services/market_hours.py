"""
Market Hours Service for US Equity Trading.

Provides market-hours gating for the data poller, ensuring that equity
data is only fetched during NYSE regular trading hours (9:30 AM - 4:00 PM ET,
Monday-Friday, excluding holidays).

Crypto assets (24/7) bypass this check.
"""

import logging
from datetime import datetime, timezone
from typing import Tuple

import pandas_market_calendars as mcal
import pytz

logger = logging.getLogger(__name__)


class MarketHoursService:
    """
    Service for checking US market hours and holidays.

    Uses pandas_market_calendars with NYSE calendar to determine:
    - Whether a given datetime is a market day (not weekend/holiday)
    - Whether current time is within market hours (9:30 AM - 4:00 PM ET)
    - Whether equity polling should be skipped with a reason
    """

    def __init__(self) -> None:
        """Initialize the MarketHoursService with NYSE calendar."""
        self._nyse = mcal.get_calendar('NYSE')
        self._et_tz = pytz.timezone('US/Eastern')

    def is_market_day(self, dt: datetime) -> bool:
        """
        Check if a given datetime is a market trading day.

        Returns False if the date is a weekend or NYSE holiday.
        Time component is ignored for this check.

        Args:
            dt: Datetime to check (timezone-aware or naive)

        Returns:
            True if the date is a market day, False otherwise
        """
        # Convert to Eastern Time
        et_dt = self._to_eastern(dt)

        # Get the date string
        date_str = et_dt.strftime('%Y-%m-%d')

        # Check if this date is in the NYSE trading calendar
        schedule = self._nyse.schedule(start_date=date_str, end_date=date_str)

        # If schedule is empty, it's a weekend or holiday
        return not schedule.empty

    def should_skip_equity_polling(self, dt: datetime | None = None) -> Tuple[bool, str]:
        """
        Determine if equity polling should be skipped based on market hours.

        Args:
            dt: Datetime to check (defaults to current time if None)

        Returns:
            Tuple of (should_skip: bool, reason: str)
            - should_skip: True if polling should be skipped
            - reason: "weekend_or_holiday" or "outside_market_hours" or "" if not skipped
        """
        if dt is None:
            dt = datetime.now(timezone.utc)

        # First check if today is a market day (not weekend/holiday)
        if not self.is_market_day(dt):
            logger.debug(f"Skipping equity polling: weekend_or_holiday (datetime={dt})")
            return True, "weekend_or_holiday"

        # Check if current time is within market hours
        et_dt = self._to_eastern(dt)
        date_str = et_dt.strftime('%Y-%m-%d')

        # Get today's market schedule
        schedule = self._nyse.schedule(start_date=date_str, end_date=date_str)

        if schedule.empty:
            # Should not happen given is_market_day check, but handle gracefully
            logger.debug(f"Skipping equity polling: weekend_or_holiday (no schedule, datetime={dt})")
            return True, "weekend_or_holiday"

        # Get market open and close times
        market_open = schedule.iloc[0]['market_open'].tz_convert(self._et_tz)
        market_close = schedule.iloc[0]['market_close'].tz_convert(self._et_tz)

        # Check if current time is within market hours
        if not (market_open <= et_dt <= market_close):
            logger.debug(
                f"Skipping equity polling: outside_market_hours "
                f"(current={et_dt.strftime('%H:%M:%S %Z')}, "
                f"open={market_open.strftime('%H:%M:%S %Z')}, "
                f"close={market_close.strftime('%H:%M:%S %Z')})"
            )
            return True, "outside_market_hours"

        # Within market hours - do not skip
        logger.debug(f"Not skipping equity polling: within market hours (datetime={dt})")
        return False, ""

    def _to_eastern(self, dt: datetime) -> datetime:
        """
        Convert a datetime to US/Eastern timezone.

        Args:
            dt: Datetime to convert (can be naive or timezone-aware)

        Returns:
            Datetime in US/Eastern timezone
        """
        if dt.tzinfo is None:
            # Naive datetime - assume UTC
            dt = dt.replace(tzinfo=timezone.utc)

        # Convert to Eastern Time
        return dt.astimezone(self._et_tz)
