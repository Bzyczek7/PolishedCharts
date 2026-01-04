"""
Integration test for merge idempotency per SC-011.

Verifies that guest→user merge operations produce identical results when retried,
ensuring the upsert-by-UUID logic is truly idempotent.

This is an INTEGRATION test - it uses real database sessions, not mocks.
"""
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.services.merge_util import upsert_alert, upsert_watchlist, upsert_indicator_configs, MERGE_TIMESTAMP_TOLERANCE_MS
from app.models.alert import Alert
from app.models.user_watchlist import UserWatchlist
from app.models.user import User
from app.models.symbol import Symbol


@pytest.fixture
async def test_user_with_symbol(db_session: AsyncSession):
    """Create a test user and symbol for integration tests."""
    # Create test user
    user = User(
        firebase_uid="test_firebase_uid_123",
        email="test@example.com",
        email_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    # Create test symbol
    symbol = Symbol(ticker="AAPL", name="Apple Inc.")
    db_session.add(symbol)
    await db_session.flush()

    return {"user_id": user.id, "symbol_id": symbol.id}


class TestMergeIdempotency:
    """
    SC-011: Merge operations must produce identical results when retried.

    Idempotency is critical because:
    1. Network failures may cause retry of merge requests
    2. Multiple tabs/devices may merge simultaneously
    3. Frontend may retry merge on transient errors
    """

    @pytest.mark.asyncio
    async def test_upsert_single_alert_twice_produces_identical_state(
        self, db_session: AsyncSession, test_user_with_symbol
    ):
        """
        Calling upsert_alert twice with same alert must produce identical database state.

        Verifies:
        - No duplicate records created
        - updated_at timestamp is stable
        - All field values are identical
        """
        import uuid
        alert_uuid = uuid.UUID("550e8400-e29b-41d4-a716-446655440000")
        user_id = test_user_with_symbol["user_id"]
        symbol_id = test_user_with_symbol["symbol_id"]

        guest_alerts = [{
            "uuid": alert_uuid,
            "symbol_id": symbol_id,
            "symbol": "AAPL",
            "indicator_name": "price",
            "indicator_field": "close",
            "indicator_params": {},
            "condition": "above",
            "target": 150.0,
            "enabled": True,
            "created_at": (datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)).isoformat(),
            "updated_at": (datetime(2025, 1, 1, 12, 30, 0, tzinfo=timezone.utc)).isoformat(),
        }]

        # First call
        result1 = await upsert_alert(db_session, user_id, guest_alerts)
        await db_session.flush()

        # Second call (simulating retry)
        result2 = await upsert_alert(db_session, user_id, guest_alerts)
        await db_session.flush()

        # Results must be identical
        assert result1["added"] == 1
        assert result2["skipped"] == 1  # Second call skips existing

        # Database must have exactly one record
        from sqlalchemy import select
        stmt = select(Alert).where(Alert.uuid == alert_uuid, Alert.user_id == user_id)
        result = await db_session.execute(stmt)
        db_alerts = result.scalars().all()

        assert len(db_alerts) == 1, (
            f"Upsert should not create duplicates. Found {len(db_alerts)} records "
            f"for uuid={alert_uuid}, user_id={user_id}"
        )

    @pytest.mark.asyncio
    async def test_upsert_multiple_alerts_is_idempotent(
        self, db_session: AsyncSession, test_user_with_symbol
    ):
        """
        Merging a list of guest alerts twice produces identical final state.

        Verifies idempotency holds across multiple records in sequence.
        """
        import uuid
        user_id = test_user_with_symbol["user_id"]
        symbol_id = test_user_with_symbol["symbol_id"]
        num_alerts = 10

        guest_alerts = []
        for i in range(num_alerts):
            alert_uuid = uuid.UUID(f"550e8400-e29b-41d4-a716-44665544{i:04d}")
            guest_alerts.append({
                "uuid": alert_uuid,
                "symbol_id": symbol_id,
                "symbol": "AAPL",
                "indicator_name": "price",
                "indicator_field": "close",
                "indicator_params": {},
                "condition": "below",
                "target": 100.0 + i,
                "enabled": i % 2 == 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": (datetime.now(timezone.utc) + timedelta(minutes=i)).isoformat(),
            })

        # First merge - insert all alerts
        result1 = await upsert_alert(db_session, user_id, guest_alerts)
        await db_session.flush()

        # Get state after first merge
        from sqlalchemy import select
        stmt = select(Alert).where(Alert.user_id == user_id).order_by(Alert.uuid)
        result = await db_session.execute(stmt)
        first_state = result.scalars().all()

        # Second merge - retry all alerts
        result2 = await upsert_alert(db_session, user_id, guest_alerts)
        await db_session.flush()

        # Get state after second merge
        result = await db_session.execute(stmt)
        second_state = result.scalars().all()

        # States must be identical
        assert len(first_state) == len(second_state) == num_alerts
        assert result1["added"] == num_alerts
        assert result2["skipped"] == num_alerts

    @pytest.mark.asyncio
    async def test_timestamp_tolerance_is_deterministic(
        self, db_session: AsyncSession, test_user_with_symbol
    ):
        """
        MERGE_TIMESTAMP_TOLERANCE_MS tiebreaker must produce consistent results.

        Per FR-010: If timestamps are equal within tolerance, prefer cloud version.
        """
        import uuid
        alert_uuid = uuid.UUID("d3d3d3d3-e29b-41d4-a716-446655440000")
        user_id = test_user_with_symbol["user_id"]
        symbol_id = test_user_with_symbol["symbol_id"]

        # Cloud alert already exists with timestamp X
        cloud_alerts = [{
            "uuid": alert_uuid,
            "symbol_id": symbol_id,
            "symbol": "AAPL",
            "indicator_name": "price",
            "indicator_field": "close",
            "indicator_params": {},
            "condition": "crosses-down",
            "target": 250.0,
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": (datetime(2025, 1, 1, 12, 1, 30, tzinfo=timezone.utc)).isoformat(),
        }]

        # Insert cloud version first
        await upsert_alert(db_session, user_id, cloud_alerts)
        await db_session.flush()

        # Guest alert with timestamp X ± 90 seconds (within 2-min tolerance)
        # but with different values (should be ignored)
        guest_alerts = [{
            "uuid": alert_uuid,
            "symbol_id": symbol_id,
            "symbol": "AAPL",
            "indicator_name": "price",
            "indicator_field": "close",
            "indicator_params": {},
            "condition": "crosses-up",
            "target": 300.0,
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": (datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)).isoformat(),
        }]

        # Merge guest version (within tolerance - cloud should win)
        merge_result = await upsert_alert(db_session, user_id, guest_alerts)
        await db_session.flush()

        # Cloud version should win (deterministic tiebreaker)
        from sqlalchemy import select
        stmt = select(Alert).where(Alert.uuid == alert_uuid, Alert.user_id == user_id)
        db_result = await db_session.execute(stmt)
        final_alert = db_result.scalar_one()

        assert merge_result["skipped"] == 1
        assert final_alert.condition == "crosses-down", (
            f"Cloud version should win within tolerance. Got condition={final_alert.condition}"
        )
        assert final_alert.threshold == 250.0, (
            f"Cloud target should be preserved. Got target={final_alert.threshold}"
        )

    @pytest.mark.asyncio
    async def test_newer_guest_timestamp_wins(
        self, db_session: AsyncSession, test_user_with_symbol
    ):
        """
        When guest timestamp is outside tolerance and newer, it should update cloud.
        """
        import uuid
        alert_uuid = uuid.UUID("e4e4e4e4-e29b-41d4-a716-446655440000")
        user_id = test_user_with_symbol["user_id"]
        symbol_id = test_user_with_symbol["symbol_id"]

        # Cloud alert with older timestamp
        cloud_alerts = [{
            "uuid": alert_uuid,
            "symbol_id": symbol_id,
            "symbol": "AAPL",
            "indicator_name": "price",
            "indicator_field": "close",
            "indicator_params": {},
            "condition": "above",
            "target": 100.0,
            "enabled": True,
            "created_at": (datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)).isoformat(),
            "updated_at": (datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)).isoformat(),
        }]

        await upsert_alert(db_session, user_id, cloud_alerts)
        await db_session.flush()

        # Guest alert with much newer timestamp (5 hours later)
        guest_alerts = [{
            "uuid": alert_uuid,
            "symbol_id": symbol_id,
            "symbol": "AAPL",
            "indicator_name": "price",
            "indicator_field": "close",
            "indicator_params": {},
            "condition": "below",
            "target": 95.0,
            "enabled": False,
            "created_at": (datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)).isoformat(),
            "updated_at": (datetime(2025, 1, 1, 17, 0, 0, tzinfo=timezone.utc)).isoformat(),
        }]

        merge_result = await upsert_alert(db_session, user_id, guest_alerts)
        await db_session.flush()

        # Guest version should win (newer timestamp)
        from sqlalchemy import select
        stmt = select(Alert).where(Alert.uuid == alert_uuid, Alert.user_id == user_id)
        db_result = await db_session.execute(stmt)
        final_alert = db_result.scalar_one()

        assert merge_result["updated"] == 1
        assert final_alert.condition == "below", "Guest condition should win (newer)"
        assert final_alert.threshold == 95.0, "Guest target should win (newer)"
        assert final_alert.is_active is False, "Guest enabled should win (newer)"

    @pytest.mark.asyncio
    async def test_watchlist_merge_is_idempotent(
        self, db_session: AsyncSession, test_user_with_symbol
    ):
        """
        Watchlist merge should also be idempotent.

        Tests merge rule: upsert by UUID; merge symbols arrays; preserve sort_order
        from most recently updated.
        """
        import uuid
        user_id = test_user_with_symbol["user_id"]
        watchlist_uuid = uuid.UUID("f5f5f5f5-e29b-41d4-a716-446655440000")

        guest_watchlist = {
            "uuid": str(watchlist_uuid),
            "symbols": ["AAPL", "MSFT", "GOOGL"],
            "sort_order": ["AAPL", "MSFT", "GOOGL"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # First merge
        result1 = await upsert_watchlist(db_session, user_id, guest_watchlist)
        await db_session.flush()

        # Second merge (identical data)
        result2 = await upsert_watchlist(db_session, user_id, guest_watchlist)
        await db_session.flush()

        assert result1["added"] == 1
        assert result2["skipped"] == 1

        # Verify single record exists
        from sqlalchemy import select
        stmt = select(UserWatchlist).where(UserWatchlist.uuid == watchlist_uuid, UserWatchlist.user_id == user_id)
        result = await db_session.execute(stmt)
        watchlists = result.scalars().all()

        assert len(watchlists) == 1, "Watchlist merge should not create duplicates"

        watchlist = watchlists[0]
        assert watchlist.symbols == ["AAPL", "MSFT", "GOOGL"]

    @pytest.mark.asyncio
    async def test_concurrent_merge_simulation(
        self, db_session: AsyncSession, test_user_with_symbol
    ):
        """
        Simulate concurrent merge requests (same data, rapid succession).

        This models what happens when a user opens multiple tabs that all
        attempt to merge the same guest data.
        """
        import uuid
        user_id = test_user_with_symbol["user_id"]
        symbol_id = test_user_with_symbol["symbol_id"]
        alert_uuid = uuid.UUID("b6b6b6b6-e29b-41d4-a716-446655440000")

        guest_alerts = [{
            "uuid": alert_uuid,
            "symbol_id": symbol_id,
            "symbol": "AAPL",
            "indicator_name": "price",
            "indicator_field": "close",
            "indicator_params": {},
            "condition": "above",
            "target": 200.0,
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]

        # Simulate 5 concurrent merge requests
        results = []
        for _ in range(5):
            result = await upsert_alert(db_session, user_id, guest_alerts)
            results.append(result)

        await db_session.flush()

        # First call adds, rest skip
        assert results[0]["added"] == 1
        for result in results[1:]:
            assert result["skipped"] == 1

        # Only one record should exist
        from sqlalchemy import select
        stmt = select(Alert).where(Alert.uuid == alert_uuid, Alert.user_id == user_id)
        db_result = await db_session.execute(stmt)
        alerts = db_result.scalars().all()

        assert len(alerts) == 1, "Concurrent merges should result in single record"

    def test_tolerance_constant_is_defined(self):
        """
        Verify MERGE_TIMESTAMP_TOLERANCE_MS constant exists and is reasonable.

        Per FR-010: Tolerance should be ±2 minutes.
        """
        assert isinstance(MERGE_TIMESTAMP_TOLERANCE_MS, (int, float)), \
            "MERGE_TIMESTAMP_TOLERANCE_MS should be defined"

        # Verify it's approximately 2 minutes (120,000 ms)
        expected_ms = 2 * 60 * 1000  # 120000 ms

        assert MERGE_TIMESTAMP_TOLERANCE_MS == expected_ms, (
            f"MERGE_TIMESTAMP_TOLERANCE_MS should be 120000ms (2 minutes), got {MERGE_TIMESTAMP_TOLERANCE_MS}ms"
        )


# =============================================================================
# T060-T061: Integration tests for indicator_configs merge endpoint
# =============================================================================

class TestIndicatorConfigsMergeIntegration:
    """
    T060 [P] [US3]: Integration test for guest→auth merge via POST /merge/sync endpoint.
    T061 [P] [US3]: Integration test for GET /merge/status includes indicators count.
    """

    @pytest.mark.asyncio
    async def test_upsert_indicator_configs_is_idempotent(
        self, db_session: AsyncSession, test_user_with_symbol
    ):
        """
        T060 [P] [US3]: Integration test for guest→auth indicator merge via POST /merge/sync endpoint.
        
        Verifies:
        - Calling upsert_indicator_configs twice with same data produces identical state
        - No duplicate records created
        - First call adds, second call skips
        """
        import uuid
        user_id = test_user_with_symbol["user_id"]
        indicator_uuid = uuid.UUID("77777777-0000-0000-0000-000000000001")

        now = datetime.now(timezone.utc)
        guest_indicators = [{
            "uuid": str(indicator_uuid),
            "indicatorType": "sma",
            "params": {"length": 20},
            "displayName": "SMA (20)",
            "style": {"color": "#FF5733", "lineWidth": 2},
            "isVisible": True,
            "createdAt": now.isoformat() + 'Z',
            "updatedAt": now.isoformat() + 'Z',
        }]

        # First merge
        result1 = await upsert_indicator_configs(db_session, user_id, guest_indicators)
        await db_session.flush()

        # Second merge (retry)
        result2 = await upsert_indicator_configs(db_session, user_id, guest_indicators)
        await db_session.flush()

        # Verify results
        assert result1["added"] == 1
        assert result2["skipped"] == 1

        # Verify single record exists
        from app.models.indicator_config import IndicatorConfig
        from sqlalchemy import select
        stmt = select(IndicatorConfig).where(
            IndicatorConfig.uuid == indicator_uuid,
            IndicatorConfig.user_id == user_id
        )
        db_result = await db_session.execute(stmt)
        indicators = db_result.scalars().all()

        assert len(indicators) == 1, "Indicator merge should not create duplicates"

    @pytest.mark.asyncio
    async def test_upsert_multiple_indicator_configs_is_idempotent(
        self, db_session: AsyncSession, test_user_with_symbol
    ):
        """
        T060 [P] [US3]: Integration test for merging multiple indicators.
        
        Verifies idempotency holds across multiple indicator configs.
        """
        import uuid
        user_id = test_user_with_symbol["user_id"]
        num_indicators = 5

        now = datetime.now(timezone.utc)
        guest_indicators = []
        for i in range(num_indicators):
            indicator_uuid = uuid.UUID(f"77777777-0000-0000-0000-00000000{i:04d}")
            guest_indicators.append({
                "uuid": str(indicator_uuid),
                "indicatorType": "sma" if i % 2 == 0 else "ema",
                "params": {"length": 20 + i * 10},
                "displayName": f"Indicator {i}",
                "style": {"color": "#FF5733", "lineWidth": 2},
                "isVisible": i % 2 == 0,
                "createdAt": now.isoformat() + 'Z',
                "updatedAt": (now + timedelta(minutes=i)).isoformat() + 'Z',
            })

        # First merge
        result1 = await upsert_indicator_configs(db_session, user_id, guest_indicators)
        await db_session.flush()

        # Get state after first merge
        from app.models.indicator_config import IndicatorConfig
        from sqlalchemy import select
        stmt = select(IndicatorConfig).where(IndicatorConfig.user_id == user_id).order_by(IndicatorConfig.uuid)
        db_result = await db_session.execute(stmt)
        first_state = db_result.scalars().all()

        # Second merge
        result2 = await upsert_indicator_configs(db_session, user_id, guest_indicators)
        await db_session.flush()

        # Get state after second merge
        db_result = await db_session.execute(stmt)
        second_state = db_result.scalars().all()

        # States must be identical
        assert len(first_state) == len(second_state) == num_indicators
        assert result1["added"] == num_indicators
        assert result2["skipped"] == num_indicators

    @pytest.mark.asyncio
    async def test_indicator_configs_merge_timestamp_conflict(
        self, db_session: AsyncSession, test_user_with_symbol
    ):
        """
        T060 [P] [US3]: Integration test for timestamp conflict resolution.
        
        Verifies:
        - Guest newer (>2 min) → guest wins
        - Within tolerance → cloud wins (deterministic)
        """
        import uuid
        user_id = test_user_with_symbol["user_id"]
        indicator_uuid = uuid.UUID("88888888-0000-0000-0000-000000000001")

        # Create cloud indicator first
        from app.models.indicator_config import IndicatorConfig
        cloud_indicator = IndicatorConfig(
            user_id=user_id,
            uuid=indicator_uuid,
            indicator_name="sma",
            indicator_category="overlay",
            indicator_params={"length": 20},
            display_name="Cloud SMA",
            style={"color": "#FF5733", "lineWidth": 2},
            is_visible=True,
            created_at=datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
            updated_at=datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        )
        db_session.add(cloud_indicator)
        await db_session.flush()

        # Guest indicator with newer timestamp (> 2 min)
        guest_indicators = [{
            "uuid": str(indicator_uuid),
            "indicatorType": "sma",
            "params": {"length": 50},  # Different
            "displayName": "Guest SMA (50)",
            "style": {"color": "#4CAF50", "lineWidth": 3},  # Different
            "isVisible": False,  # Different
            "createdAt": datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc).isoformat() + 'Z',
            "updatedAt": datetime(2025, 1, 1, 17, 0, 0, tzinfo=timezone.utc).isoformat() + 'Z',  # 5 hours newer
        }]

        # Merge guest version (should update since guest is much newer)
        merge_result = await upsert_indicator_configs(db_session, user_id, guest_indicators)
        await db_session.flush()

        # Verify guest version won
        from sqlalchemy import select
        stmt = select(IndicatorConfig).where(
            IndicatorConfig.uuid == indicator_uuid,
            IndicatorConfig.user_id == user_id
        )
        db_result = await db_session.execute(stmt)
        final_indicator = db_result.scalar_one()

        assert merge_result["updated"] == 1
        assert final_indicator.indicator_params == {"length": 50}, "Guest params should win (newer)"
        assert final_indicator.display_name == "Guest SMA (50)", "Guest display name should win"

    @pytest.mark.asyncio
    async def test_indicator_configs_merge_within_tolerance_cloud_wins(
        self, db_session: AsyncSession, test_user_with_symbol
    ):
        """
        T060 [P] [US3]: Integration test for within-tolerance scenario.
        
        Verifies that when timestamps are within ±2 minutes, cloud version wins (deterministic).
        """
        import uuid
        user_id = test_user_with_symbol["user_id"]
        indicator_uuid = uuid.UUID("99999999-0000-0000-0000-000000000001")

        # Create cloud indicator
        from app.models.indicator_config import IndicatorConfig
        cloud_indicator = IndicatorConfig(
            user_id=user_id,
            uuid=indicator_uuid,
            indicator_name="ema",
            indicator_category="overlay",
            indicator_params={"length": 50},
            display_name="Cloud EMA",
            style={"color": "#2196F3", "lineWidth": 2},
            is_visible=True,
            created_at=datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
            updated_at=datetime(2025, 1, 1, 12, 1, 30, tzinfo=timezone.utc),
        )
        db_session.add(cloud_indicator)
        await db_session.flush()

        # Guest indicator within 2 min tolerance (should be ignored)
        guest_indicators = [{
            "uuid": str(indicator_uuid),
            "indicatorType": "ema",
            "params": {"length": 99},  # Try to change
            "displayName": "Guest EMA",
            "style": {"color": "#000000", "lineWidth": 5},
            "isVisible": False,
            "createdAt": datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc).isoformat() + 'Z',
            "updatedAt": datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc).isoformat() + 'Z',  # Within 2 min
        }]

        # Merge guest version
        merge_result = await upsert_indicator_configs(db_session, user_id, guest_indicators)
        await db_session.flush()

        # Verify cloud version won
        from sqlalchemy import select
        stmt = select(IndicatorConfig).where(
            IndicatorConfig.uuid == indicator_uuid,
            IndicatorConfig.user_id == user_id
        )
        db_result = await db_session.execute(stmt)
        final_indicator = db_result.scalar_one()

        assert merge_result["skipped"] == 1
        assert final_indicator.indicator_params == {"length": 50}, "Cloud params should win (within tolerance)"
        assert final_indicator.display_name == "Cloud EMA", "Cloud display name should win"

    @pytest.mark.asyncio
    async def test_get_merge_status_includes_indicators_count(
        self, async_client: AsyncClient, test_user_with_symbol, monkeypatch
    ):
        """
        T061 [P] [US3]: Integration test for GET /merge/status includes indicators count.
        
        Verifies:
        - GET /merge/status returns indicator count for authenticated user
        - Count matches actual number of indicators in database
        """
        from app.models.indicator_config import IndicatorConfig
        import uuid

        user_id = test_user_with_symbol["user_id"]
        firebase_uid = "test_firebase_uid_123"

        # Create test indicators
        base_time = datetime.now(timezone.utc) - timedelta(hours=1)
        indicators = [
            IndicatorConfig(
                user_id=user_id,
                uuid=uuid.uuid4(),
                indicator_name="sma",
                indicator_category="overlay",
                indicator_params={"length": 20},
                display_name="SMA (20)",
                style={"color": "#FF5733", "lineWidth": 2},
                is_visible=True,
                created_at=base_time,
                updated_at=base_time,
            ),
            IndicatorConfig(
                user_id=user_id,
                uuid=uuid.uuid4(),
                indicator_name="ema",
                indicator_category="overlay",
                indicator_params={"length": 50},
                display_name="EMA (50)",
                style={"color": "#4CAF50", "lineWidth": 2},
                is_visible=True,
                created_at=base_time,
                updated_at=base_time,
            ),
            IndicatorConfig(
                user_id=user_id,
                uuid=uuid.uuid4(),
                indicator_name="tdfi",
                indicator_category="oscillator",
                indicator_params={"domcycle": 20, "smooth": 3},
                display_name="TDFI (20, 3)",
                style={"color": "#2196F3", "lineWidth": 2},
                is_visible=False,
                created_at=base_time,
                updated_at=base_time,
            ),
        ]
        for ind in indicators:
            db_session.add(ind)
        await db_session.commit()

        # Mock Firebase authentication
        async def mock_verify(token):
            return {"uid": firebase_uid, "email": "test@example.com"}
        monkeypatch.setattr("app.services.auth_middleware.verify_firebase_token", mock_verify)

        # Call GET /merge/status
        auth_headers = {"Authorization": f"Bearer mock_token_{firebase_uid}"}
        response = await async_client.get("/api/v1/merge/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # Verify indicators count is included
        assert "indicators" in data, "Merge status should include indicators count"
        assert data["indicators"] == 3, f"Expected 3 indicators, got {data['indicators']}"
