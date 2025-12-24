"""
Tests for alert delivery task with retry logic.

T088 [P] [US5]: Write tests for delivery retry logic
"""

import pytest
from app.tasks.alert_delivery import RETRY_DELAYS, MAX_RETRIES


class TestAlertDeliveryRetry:
    """Test alert delivery retry logic."""

    @pytest.mark.asyncio
    async def test_exponential_backoff_schedule(self):
        """Test that retry delays follow exponential backoff."""
        # Expected delays: 30s, 2min, 8min, 32min, 128min
        expected = [30, 120, 480, 1920, 7680]
        assert RETRY_DELAYS == expected

    @pytest.mark.asyncio
    async def test_max_retries_limit(self):
        """Test that MAX_RETRIES matches retry delays length."""
        assert MAX_RETRIES == len(RETRY_DELAYS)
        assert MAX_RETRIES == 5

    @pytest.mark.asyncio
    async def test_retry_delays_are_exponential(self):
        """Verify that retry delays follow an exponential pattern."""
        # Each delay should be approximately 4x the previous (with some variance)
        for i in range(1, len(RETRY_DELAYS)):
            ratio = RETRY_DELAYS[i] / RETRY_DELAYS[i - 1]
            # Allow for some variance but generally exponential
            assert 2 <= ratio <= 8, f"Delay {i} doesn't follow exponential pattern: {RETRY_DELAYS[i]} / {RETRY_DELAYS[i-1]} = {ratio}"
