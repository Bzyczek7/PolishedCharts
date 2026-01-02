"""
Unit tests for MarketHoursService.

Tests market-hours gating logic including NYSE holiday detection
and trading session hours (9:30 AM - 4:00 PM ET).
"""

import pytest
from datetime import datetime, timezone
import pytz

from app.services.market_hours import MarketHoursService


@pytest.fixture
def market_hours_service():
    """Create a MarketHoursService instance for testing."""
    return MarketHoursService()


class TestMarketHoursService:
    """Test suite for MarketHoursService."""

    def test_is_market_day_weekday(self, market_hours_service):
        """Test that a regular weekday is a market day."""
        # Tuesday, December 17, 2024 (not a holiday)
        dt = datetime(2024, 12, 17, 12, 0, 0, tzinfo=timezone.utc)
        assert market_hours_service.is_market_day(dt) is True

    def test_is_market_day_weekend(self, market_hours_service):
        """Test that weekend is not a market day."""
        # Saturday, December 21, 2024
        dt = datetime(2024, 12, 21, 12, 0, 0, tzinfo=timezone.utc)
        assert market_hours_service.is_market_day(dt) is False

        # Sunday, December 22, 2024
        dt = datetime(2024, 12, 22, 12, 0, 0, tzinfo=timezone.utc)
        assert market_hours_service.is_market_day(dt) is False

    def test_is_market_day_holiday(self, market_hours_service):
        """Test that NYSE holidays are not market days."""
        # Christmas Day 2024 (December 25, Wednesday)
        dt = datetime(2024, 12, 25, 12, 0, 0, tzinfo=timezone.utc)
        assert market_hours_service.is_market_day(dt) is False

        # July 4, 2024 (Independence Day, Thursday)
        dt = datetime(2024, 7, 4, 12, 0, 0, tzinfo=timezone.utc)
        assert market_hours_service.is_market_day(dt) is False

        # January 1, 2024 (New Year's Day, Monday)
        dt = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        assert market_hours_service.is_market_day(dt) is False

    def test_should_skip_equity_polling_weekend(self, market_hours_service):
        """Test that polling is skipped on weekend."""
        # Saturday morning UTC
        dt = datetime(2024, 12, 21, 14, 0, 0, tzinfo=timezone.utc)
        skip, reason = market_hours_service.should_skip_equity_polling(dt)
        assert skip is True
        assert reason == "weekend_or_holiday"

    def test_should_skip_equity_polling_holiday(self, market_hours_service):
        """Test that polling is skipped on holidays."""
        # Christmas Day 2024
        dt = datetime(2024, 12, 25, 14, 0, 0, tzinfo=timezone.utc)
        skip, reason = market_hours_service.should_skip_equity_polling(dt)
        assert skip is True
        assert reason == "weekend_or_holiday"

    def test_should_skip_equity_polling_before_market_open(self, market_hours_service):
        """Test that polling is skipped before market opens (9:30 AM ET)."""
        # 6:00 AM ET = 11:00 AM UTC (Tuesday, December 17, 2024)
        dt = datetime(2024, 12, 17, 11, 0, 0, tzinfo=timezone.utc)
        skip, reason = market_hours_service.should_skip_equity_polling(dt)
        assert skip is True
        assert reason == "outside_market_hours"

    def test_should_skip_equity_polling_after_market_close(self, market_hours_service):
        """Test that polling is skipped after market closes (4:00 PM ET)."""
        # 5:00 PM ET = 10:00 PM UTC (Tuesday, December 17, 2024)
        dt = datetime(2024, 12, 17, 22, 0, 0, tzinfo=timezone.utc)
        skip, reason = market_hours_service.should_skip_equity_polling(dt)
        assert skip is True
        assert reason == "outside_market_hours"

    def test_should_not_skip_during_market_hours(self, market_hours_service):
        """Test that polling is NOT skipped during market hours."""
        # 10:30 AM ET = 3:30 PM UTC (Tuesday, December 17, 2024)
        dt = datetime(2024, 12, 17, 15, 30, 0, tzinfo=timezone.utc)
        skip, reason = market_hours_service.should_skip_equity_polling(dt)
        assert skip is False
        assert reason == ""

    def test_should_not_skip_at_market_open(self, market_hours_service):
        """Test that polling is NOT skipped exactly at market open (9:30 AM ET)."""
        # 9:30 AM ET = 2:30 PM UTC (Tuesday, December 17, 2024)
        dt = datetime(2024, 12, 17, 14, 30, 0, tzinfo=timezone.utc)
        skip, reason = market_hours_service.should_skip_equity_polling(dt)
        assert skip is False
        assert reason == ""

    def test_should_not_skip_at_market_close(self, market_hours_service):
        """Test that polling is NOT skipped exactly at market close (4:00 PM ET)."""
        # 4:00 PM ET = 9:00 PM UTC (Tuesday, December 17, 2024)
        dt = datetime(2024, 12, 17, 21, 0, 0, tzinfo=timezone.utc)
        skip, reason = market_hours_service.should_skip_equity_polling(dt)
        assert skip is False
        assert reason == ""

    def test_timezone_conversion_eastern(self, market_hours_service):
        """Test that timezone conversion to Eastern Time works correctly."""
        # Create a datetime in UTC
        dt_utc = datetime(2024, 12, 17, 15, 0, 0, tzinfo=timezone.utc)

        # Convert to Eastern
        et_tz = pytz.timezone('US/Eastern')
        dt_et = dt_utc.astimezone(et_tz)

        # 3:00 PM UTC = 10:00 AM ET (during market hours)
        assert dt_et.hour == 10
        assert dt_et.minute == 0

        # Should not skip
        skip, reason = market_hours_service.should_skip_equity_polling(dt_utc)
        assert skip is False
