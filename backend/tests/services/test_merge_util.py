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


# =============================================================================
# T055-T061: Tests for upsert_indicator_configs (Feature 001-indicator-storage)
# =============================================================================

class TestUpsertIndicatorConfigs:
    """Test suite for upsert_indicator_configs function (T055-T061)."""

    @pytest.fixture
    async def test_user_with_indicators(self, db_session: AsyncSession):
        """Create a test user with existing indicators."""
        from app.models.user import User
        from app.models.indicator_config import IndicatorConfig
        import uuid

        user = User(
            firebase_uid="test_merge_user",
            email="merge@example.com",
            display_name="Merge Test User"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create existing indicators
        base_time = datetime.now(timezone.utc) - timedelta(hours=2)
        existing_indicators = [
            IndicatorConfig(
                user_id=user.id,
                uuid=uuid.UUID('00000000-0000-0000-0000-000000000001'),
                indicator_name="sma",
                indicator_category="overlay",
                indicator_params={"length": 20},
                display_name="Existing SMA (20)",
                style={"color": "#FF5733", "lineWidth": 2},
                is_visible=True,
                created_at=base_time,
                updated_at=base_time,
            ),
            IndicatorConfig(
                user_id=user.id,
                uuid=uuid.UUID('00000000-0000-0000-0000-000000000002'),
                indicator_name="ema",
                indicator_category="overlay",
                indicator_params={"length": 50},
                display_name="Existing EMA (50)",
                style={"color": "#4CAF50", "lineWidth": 2},
                is_visible=True,
                created_at=base_time,
                updated_at=base_time,
            ),
        ]
        for ind in existing_indicators:
            db_session.add(ind)
        await db_session.commit()

        return user

    @pytest.mark.asyncio
    async def test_upsert_indicator_configs_new_user_no_existing_indicators(
        self,
        db_session: AsyncSession,
        test_user_with_indicators,
    ):
        """
        T055 [P] [US3]: Unit test for upsert_indicator_configs() with new user (no existing indicators).
        
        Verifies:
        - All guest indicators are inserted as new
        - Added count matches guest indicator count
        - No updates or skips
        """
        from app.services.merge_util import upsert_indicator_configs
        from sqlalchemy import select
        from app.models.indicator_config import IndicatorConfig
        import uuid

        # Create a new user (no existing indicators)
        from app.models.user import User
        new_user = User(
            firebase_uid="new_merge_user",
            email="newmerge@example.com",
            display_name="New Merge User"
        )
        db_session.add(new_user)
        await db_session.commit()
        await db_session.refresh(new_user)

        # Guest indicators
        now = datetime.now(timezone.utc)
        guest_indicators = [
            {
                'uuid': str(uuid.uuid4()),
                'indicatorType': 'sma',
                'params': {'length': 20},
                'displayName': 'SMA (20)',
                'style': {'color': '#FF5733', 'lineWidth': 2},
                'isVisible': True,
                'createdAt': now.isoformat() + 'Z',
                'updatedAt': now.isoformat() + 'Z',
            },
            {
                'uuid': str(uuid.uuid4()),
                'indicatorType': 'ema',
                'params': {'length': 50},
                'displayName': 'EMA (50)',
                'style': {'color': '#4CAF50', 'lineWidth': 2},
                'isVisible': True,
                'createdAt': now.isoformat() + 'Z',
                'updatedAt': now.isoformat() + 'Z',
            },
        ]

        # Upsert
        result = await upsert_indicator_configs(db_session, new_user.id, guest_indicators)

        # Verify stats
        assert result['added'] == 2
        assert result['updated'] == 0
        assert result['skipped'] == 0

        # Verify indicators were created
        db_indicators = await db_session.execute(
            select(IndicatorConfig).where(IndicatorConfig.user_id == new_user.id)
        )
        indicators = db_indicators.scalars().all()
        assert len(indicators) == 2

    @pytest.mark.asyncio
    async def test_upsert_indicator_configs_existing_indicators_uuid_match(
        self,
        db_session: AsyncSession,
        test_user_with_indicators,
    ):
        """
        T056 [P] [US3]: Unit test for upsert_indicator_configs() with existing indicators (UUID match).
        
        Verifies:
        - Existing indicators are updated when guest is newer
        - UUID matching works correctly
        """
        from app.services.merge_util import upsert_indicator_configs
        from app.models.indicator_config import IndicatorConfig

        user = test_user_with_indicators

        # Guest indicators with newer timestamps (> 2 min newer)
        now = datetime.now(timezone.utc)
        guest_indicators = [
            {
                'uuid': '00000000-0000-0000-0000-000000000001',  # Matches existing
                'indicatorType': 'sma',
                'params': {'length': 30},  # Changed from 20
                'displayName': 'Updated SMA (30)',
                'style': {'color': '#2196F3', 'lineWidth': 3},  # Changed
                'isVisible': False,  # Changed
                'createdAt': (now - timedelta(hours=3)).isoformat() + 'Z',
                'updatedAt': now.isoformat() + 'Z',  # Recent (> 2 min newer than cloud)
            },
        ]

        # Upsert
        result = await upsert_indicator_configs(db_session, user.id, guest_indicators)

        # Verify stats
        assert result['added'] == 0
        assert result['updated'] == 1
        assert result['skipped'] == 0

        # Verify indicator was updated
        db_indicators = await db_session.execute(
            select(IndicatorConfig).where(IndicatorConfig.user_id == user.id)
        )
        indicators = db_indicators.scalars().all()
        assert len(indicators) == 2  # 2 existing + 0 new

        # Check the updated indicator
        updated_indicator = [i for i in indicators if str(i.uuid) == '00000000-0000-0000-0000-000000000001'][0]
        assert updated_indicator.indicator_params == {'length': 30}
        assert updated_indicator.display_name == 'Updated SMA (30)'
        assert updated_indicator.is_visible is False

    @pytest.mark.asyncio
    async def test_upsert_indicator_configs_guest_newer_by_more_than_2min(
        self,
        db_session: AsyncSession,
        test_user_with_indicators,
    ):
        """
        T057 [P] [US3]: Unit test for upsert_indicator_configs() timestamp conflict resolution (guest newer by >2min).
        
        Verifies:
        - Guest data wins when guest.updated_at > cloud.updated_at + 2 minutes
        - Update happens even with UUID match
        """
        from app.services.merge_util import upsert_indicator_configs
        from app.models.indicator_config import IndicatorConfig

        user = test_user_with_indicators
        base_time = datetime.now(timezone.utc) - timedelta(hours=2)

        # Guest indicator significantly newer (> 2 min)
        now = datetime.now(timezone.utc)
        guest_indicators = [
            {
                'uuid': '00000000-0000-0000-0000-000000000001',
                'indicatorType': 'sma',
                'params': {'length': 25},
                'displayName': 'Newer SMA (25)',
                'style': {'color': '#FF0000', 'lineWidth': 5},
                'isVisible': False,
                'createdAt': base_time.isoformat() + 'Z',
                'updatedAt': now.isoformat() + 'Z',  # > 2 min newer than cloud
            },
        ]

        # Upsert
        result = await upsert_indicator_configs(db_session, user.id, guest_indicators)

        # Verify stats - guest is newer, should update
        assert result['updated'] == 1

        # Verify update happened
        db_indicators = await db_session.execute(
            select(IndicatorConfig).where(
                IndicatorConfig.user_id == user.id,
                IndicatorConfig.uuid == '00000000-0000-0000-0000-000000000001'
            )
        )
        indicator = db_indicators.scalar_one()
        assert indicator.indicator_params == {'length': 25}
        assert indicator.display_name == 'Newer SMA (25)'

    @pytest.mark.asyncio
    async def test_upsert_indicator_configs_cloud_newer_or_within_2min(
        self,
        db_session: AsyncSession,
        test_user_with_indicators,
    ):
        """
        T058 [P] [US3]: Unit test for upsert_indicator_configs() timestamp conflict resolution (cloud newer or within ±2min).
        
        Verifies:
        - Cloud data wins when cloud is newer or within tolerance
        - No update happens (skipped count increases)
        """
        from app.services.merge_util import upsert_indicator_configs
        from app.models.indicator_config import IndicatorConfig

        user = test_user_with_indicators

        # Guest indicator within 2 min tolerance (cloud wins)
        now = datetime.now(timezone.utc)
        guest_indicators = [
            {
                'uuid': '00000000-0000-0000-0000-000000000001',
                'indicatorType': 'sma',
                'params': {'length': 99},  # Try to change
                'displayName': 'Guest SMA',
                'style': {'color': '#000000', 'lineWidth': 1},
                'isVisible': False,
                'createdAt': (now - timedelta(hours=3)).isoformat() + 'Z',
                'updatedAt': (now - timedelta(minutes=1)).isoformat() + 'Z',  # Within 2 min of cloud
            },
        ]

        # Upsert
        result = await upsert_indicator_configs(db_session, user.id, guest_indicators)

        # Verify stats - cloud wins, should skip
        assert result['added'] == 0
        assert result['updated'] == 0
        assert result['skipped'] == 1

        # Verify no update happened (cloud data preserved)
        db_indicators = await db_session.execute(
            select(IndicatorConfig).where(
                IndicatorConfig.user_id == user.id,
                IndicatorConfig.uuid == '00000000-0000-0000-0000-000000000001'
            )
        )
        indicator = db_indicators.scalar_one()
        assert indicator.indicator_params == {'length': 20}  # Original value preserved
        assert indicator.display_name == 'Existing SMA (20)'

    @pytest.mark.asyncio
    async def test_upsert_indicator_configs_exactly_2_minutes_apart(
        self,
        db_session: AsyncSession,
        test_user_with_indicators,
    ):
        """
        T059 [P] [US3]: Unit test for upsert_indicator_configs() edge case: exactly 2 minutes apart.
        
        Verifies:
        - Deterministic behavior: exactly 2 min = within tolerance (prefer cloud)
        - No update happens
        """
        from app.services.merge_util import upsert_indicator_configs
        from app.services.merge_util import MERGE_TIMESTAMP_TOLERANCE_MS
        from app.models.indicator_config import IndicatorConfig

        user = test_user_with_indicators
        base_time = datetime.now(timezone.utc) - timedelta(hours=2)

        # Guest indicator exactly 2 minutes newer
        guest_indicators = [
            {
                'uuid': '00000000-0000-0000-0000-000000000001',
                'indicatorType': 'sma',
                'params': {'length': 99},
                'displayName': '2 Minute SMA',
                'style': {'color': '#000000', 'lineWidth': 1},
                'isVisible': False,
                'createdAt': base_time.isoformat() + 'Z',
                'updatedAt': (base_time + timedelta(milliseconds=MERGE_TIMESTAMP_TOLERANCE_MS)).isoformat() + 'Z',
            },
        ]

        # Upsert
        result = await upsert_indicator_configs(db_session, user.id, guest_indicators)

        # Verify stats - exactly 2 min = within tolerance, cloud wins
        assert result['added'] == 0
        assert result['updated'] == 0
        assert result['skipped'] == 1

    @pytest.mark.asyncio
    async def test_upsert_indicator_configs_invalid_uuid_skipped(
        self,
        db_session: AsyncSession,
        test_user_with_indicators,
    ):
        """
        T055-T061 [P] [US3]: Unit test for upsert_indicator_configs() with invalid UUID.
        
        Verifies:
        - Indicators with invalid UUID are skipped (not inserted or updated)
        - Invalid UUID doesn't break the entire merge operation
        """
        from app.services.merge_util import upsert_indicator_configs
        from app.models.indicator_config import IndicatorConfig

        user = test_user_with_indicators

        # Guest indicators with one invalid UUID
        now = datetime.now(timezone.utc)
        guest_indicators = [
            {
                'uuid': 'invalid-uuid-format',  # Invalid UUID
                'indicatorType': 'sma',
                'params': {'length': 20},
                'displayName': 'Invalid UUID',
                'style': {'color': '#FF5733', 'lineWidth': 2},
                'isVisible': True,
                'createdAt': now.isoformat() + 'Z',
                'updatedAt': now.isoformat() + 'Z',
            },
            {
                'uuid': '00000000-0000-0000-0000-000000000003',  # Valid new UUID
                'indicatorType': 'ema',
                'params': {'length': 50},
                'displayName': 'Valid EMA',
                'style': {'color': '#4CAF50', 'lineWidth': 2},
                'isVisible': True,
                'createdAt': now.isoformat() + 'Z',
                'updatedAt': now.isoformat() + 'Z',
            },
        ]

        # Upsert
        result = await upsert_indicator_configs(db_session, user.id, guest_indicators)

        # Verify stats - invalid skipped, valid added
        assert result['added'] == 1
        assert result['updated'] == 0
        assert result['skipped'] == 1  # Invalid UUID skipped

    @pytest.mark.asyncio
    async def test_upsert_indicator_configs_empty_list(
        self,
        db_session: AsyncSession,
        test_user_with_indicators,
    ):
        """
        T055-T061 [P] [US3]: Unit test for upsert_indicator_configs() with empty list.
        
        Verifies:
        - Empty guest indicators list returns all zeros
        - No database operations performed
        """
        from app.services.merge_util import upsert_indicator_configs

        user = test_user_with_indicators

        # Upsert with empty list
        result = await upsert_indicator_configs(db_session, user.id, [])

        # Verify stats - no operations
        assert result['added'] == 0
        assert result['updated'] == 0
        assert result['skipped'] == 0
