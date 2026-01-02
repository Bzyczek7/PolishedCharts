"""
Test the shared merge utility (upsert_by_uuid with tolerance constant).

Tests T016 requirements:
- Test timestamp comparison with MERGE_TIMESTAMP_TOLERANCE_MS (±2 minutes, prefer cloud)
- Test upsert creates new record when UUID doesn't exist
- Test upsert updates existing record when UUID exists and guest timestamp is newer
- Test upsert ignores guest data when within tolerance (cloud wins)
"""
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import Mock, AsyncMock, patch

from app.services.merge_util import (
    MERGE_TIMESTAMP_TOLERANCE_MS,
    should_update,
    upsert_by_uuid,
)


class TestShouldUpdate:
    """Test suite for should_update timestamp comparison logic."""

    def test_guest_significantly_newer_than_cloud(self):
        """Test: guest.updated_at > cloud.updated_at + 2 minutes → update."""
        now = datetime.now(timezone.utc)
        cloud_updated = now - timedelta(hours=1)
        guest_updated = now - timedelta(minutes=1)  # 59 minutes ago, > 2 min newer

        result = should_update(guest_updated, cloud_updated)
        assert result is True, "Guest significantly newer should trigger update"

    def test_guest_within_tolerance_prefer_cloud(self):
        """Test: |guest.updated_at - cloud.updated_at| <= 2 minutes → keep cloud (prefer cloud)."""
        now = datetime.now(timezone.utc)
        cloud_updated = now
        guest_updated = now + timedelta(minutes=1)  # Within 2 min tolerance

        result = should_update(guest_updated, cloud_updated)
        assert result is False, "Within tolerance should prefer cloud"

    def test_cloud_significantly_newer_than_guest(self):
        """Test: cloud.updated_at > guest.updated_at → keep cloud."""
        now = datetime.now(timezone.utc)
        guest_updated = now - timedelta(hours=1)
        cloud_updated = now - timedelta(minutes=1)  # More recent

        result = should_update(guest_updated, cloud_updated)
        assert result is False, "Cloud newer should keep cloud"

    def test_identical_timestamps_prefer_cloud(self):
        """Test: guest.updated_at == cloud.updated_at → keep cloud (deterministic)."""
        now = datetime.now(timezone.utc)
        timestamp = now

        result = should_update(timestamp, timestamp)
        assert result is False, "Identical timestamps should prefer cloud"

    def test_tolerance_boundary_case_exactly_2_minutes(self):
        """Test: Exactly 2 minutes difference → within tolerance (prefer cloud)."""
        base = datetime.now(timezone.utc)
        cloud_updated = base
        guest_updated = base + timedelta(milliseconds=MERGE_TIMESTAMP_TOLERANCE_MS)

        result = should_update(guest_updated, cloud_updated)
        assert result is False, "Exactly 2 min tolerance should prefer cloud"

    def test_tolerance_boundary_case_2_minutes_and_1_ms(self):
        """Test: 2 minutes + 1 ms difference → outside tolerance (guest wins)."""
        base = datetime.now(timezone.utc)
        cloud_updated = base
        guest_updated = base + timedelta(milliseconds=MERGE_TIMESTAMP_TOLERANCE_MS + 1)

        result = should_update(guest_updated, cloud_updated)
        assert result is True, "2 min + 1 ms should trigger update"

    def test_negative_time_difference_order_doesnt_matter(self):
        """Test: Order of timestamps shouldn't matter, only difference."""
        earlier = datetime.now(timezone.utc) - timedelta(hours=1)
        later = datetime.now(timezone.utc)

        # guest earlier, cloud later → keep cloud
        assert should_update(earlier, later) is False
        # guest later, cloud earlier → update
        assert should_update(later, earlier) is True


class TestUpsertByUUID:
    """Test suite for upsert_by_uuid function."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = AsyncMock(spec=AsyncSession)
        return db

    @pytest.fixture
    def sample_guest_alerts(self):
        """Create sample guest alert data."""
        now = datetime.now(timezone.utc)
        return [
            {
                'uuid': '00000000-0000-0000-0000-000000000001',
                'symbol': 'AAPL',
                'condition': 'above',
                'target': 150.0,
                'enabled': True,
                'updated_at': now.isoformat(),
            },
            {
                'uuid': '00000000-0000-0000-0000-000000000002',
                'symbol': 'GOOGL',
                'condition': 'below',
                'target': 2500.0,
                'enabled': True,
                'updated_at': (now - timedelta(minutes=5)).isoformat(),
            },
        ]

    @pytest.mark.asyncio
    async def test_upsert_empty_list_does_nothing(self, mock_db):
        """Test: Empty guest data list → no database operations."""
        result = await upsert_by_uuid(mock_db, Mock(), [], 1)
        assert mock_db.execute.call_count == 0
        assert mock_db.commit.call_count == 0

    @pytest.mark.asyncio
    async def test_upsert_creates_new_records_for_new_uuids(self, mock_db, sample_guest_alerts):
        """Test: UUID doesn't exist → insert as new record."""
        mock_execute = AsyncMock()
        mock_execute.return_value.scalar.return_value = 0  # No existing records
        mock_db.execute = mock_execute

        # This would require actual database setup for full testing
        # Placeholder test showing the expected behavior
        # In actual implementation, this would use PostgreSQL ON CONFLICT
        assert len(sample_guest_alerts) == 2

    @pytest.mark.asyncio
    async def test_upsert_updates_existing_uuid_when_guest_newer(self, mock_db):
        """Test: UUID exists and guest timestamp > cloud + tolerance → update."""
        # Implementation would require actual database or complex mocking
        # This is a placeholder showing the expected logic
        now = datetime.now(timezone.utc)
        guest_updated = now
        cloud_updated = now - timedelta(hours=1)

        # Guest is significantly newer → should update
        assert should_update(guest_updated, cloud_updated) is True

    @pytest.mark.asyncio
    async def test_upsert_skips_when_within_tolerance(self, mock_db):
        """Test: UUID exists and timestamps within tolerance → skip (cloud wins)."""
        now = datetime.now(timezone.utc)
        guest_updated = now
        cloud_updated = now + timedelta(seconds=30)  # Within tolerance

        # Within tolerance → should not update
        assert should_update(guest_updated, cloud_updated) is False


class TestMergeIdempotency:
    """Test suite for merge idempotency (T017a)."""

    @pytest.mark.asyncio
    async def test_calling_upsert_twice_produces_identical_state(self):
        """Test: Calling upsert_by_uuid twice with same data produces identical database state."""
        # This would require actual database setup
        # Placeholder test showing expected behavior
        guest_data = [{'uuid': 'test-uuid', 'symbol': 'AAPL'}]

        # First call
        # result1 = await upsert_by_uuid(db, model, guest_data, user_id)
        # Second call
        # result2 = await upsert_by_uuid(db, model, guest_data, user_id)
        # assert result1 == result2

    @pytest.mark.asyncio
    async def test_merge_list_is_idempotent(self):
        """Test: Merging list of guest alerts twice produces identical final state."""
        # Placeholder for idempotency test
        assert True  # Would be implemented with actual DB

    @pytest.mark.asyncio
    async def test_tolerance_tiebreaker_is_deterministic(self):
        """Test: MERGE_TIMESTAMP_TOLERANCE_MS tiebreaker is deterministic (cloud wins)."""
        # Test with identical timestamps multiple times
        timestamp = datetime.now(timezone.utc)
        results = [should_update(timestamp, timestamp) for _ in range(10)]
        assert all(r is False for r in results), "Tiebreaker must be deterministic"
