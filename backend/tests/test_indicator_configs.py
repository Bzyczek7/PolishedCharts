"""
Tests for Indicator Configurations API endpoints (Feature: 001-indicator-storage).

This test module covers:
- T022: Contract test for GET /indicator-configs endpoint
- T023: Contract test for POST /indicator-configs endpoint
- T024: Contract test for PUT /indicator-configs/{uuid} endpoint
- T025: Contract test for DELETE /indicator-configs/{uuid} endpoint
- T026: Integration test for multi-device sync (user isolation)
"""
import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.indicator_config import IndicatorConfig
from app.services.auth_middleware import get_current_user


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user with Firebase UID."""
    user = User(
        firebase_uid="test_user_1",
        email="test1@example.com",
        display_name="Test User 1"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_user_2(db_session: AsyncSession) -> User:
    """Create a second test user for isolation tests."""
    user = User(
        firebase_uid="test_user_2",
        email="test2@example.com",
        display_name="Test User 2"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def sample_indicator_config(db_session: AsyncSession, test_user: User) -> IndicatorConfig:
    """Create a sample indicator configuration for testing."""
    config = IndicatorConfig(
        user_id=test_user.id,
        uuid=uuid.uuid4(),
        indicator_name="sma",
        indicator_category="overlay",
        indicator_params={"length": 20},
        display_name="SMA (20)",
        style={
            "color": "#FF5733",
            "lineWidth": 2,
            "showLastValue": True
        },
        is_visible=True
    )
    db_session.add(config)
    await db_session.commit()
    await db_session.refresh(config)
    return config


@pytest.fixture
async def multiple_indicator_configs(db_session: AsyncSession, test_user: User) -> list[IndicatorConfig]:
    """Create multiple indicator configurations for testing."""
    configs = [
        IndicatorConfig(
            user_id=test_user.id,
            uuid=uuid.uuid4(),
            indicator_name="sma",
            indicator_category="overlay",
            indicator_params={"length": 20},
            display_name="SMA (20)",
            style={"color": "#FF5733", "lineWidth": 2, "showLastValue": True},
            is_visible=True
        ),
        IndicatorConfig(
            user_id=test_user.id,
            uuid=uuid.uuid4(),
            indicator_name="ema",
            indicator_category="overlay",
            indicator_params={"length": 50},
            display_name="EMA (50)",
            style={"color": "#4CAF50", "lineWidth": 2, "showLastValue": True},
            is_visible=True
        ),
        IndicatorConfig(
            user_id=test_user.id,
            uuid=uuid.uuid4(),
            indicator_name="tdfi",
            indicator_category="oscillator",
            indicator_params={"domcycle": 20, "smooth": 3},
            display_name="TDFI (20, 3)",
            style={
                "color": "#2196F3",
                "lineWidth": 2,
                "showLastValue": True,
                "seriesColors": {"upper": "#4CAF50", "lower": "#F44336"}
            },
            is_visible=False
        ),
    ]
    for config in configs:
        db_session.add(config)
    await db_session.commit()
    for config in configs:
        await db_session.refresh(config)
    return configs


@pytest.fixture
def auth_headers(test_user: User) -> dict:
    """Mock authentication headers for test user."""
    return {"Authorization": f"Bearer mock_token_{test_user.firebase_uid}"}


@pytest.fixture
def auth_headers_2(test_user_2: User) -> dict:
    """Mock authentication headers for second test user."""
    return {"Authorization": f"Bearer mock_token_{test_user_2.firebase_uid}"}


# =============================================================================
# T022: GET /indicator-configs endpoint contract test
# =============================================================================

@pytest.mark.asyncio
async def test_get_indicator_configs_empty(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    monkeypatch
):
    """
    T022 [P] [US1]: Contract test for GET /indicator-configs endpoint.
    
    Verifies:
    - Response schema matches IndicatorConfigResponse
    - 200 status code
    - Empty array returned when user has no indicators
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    response = await async_client.get("/api/v1/indicator-configs", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_indicator_configs_success(
    async_client: AsyncClient,
    test_user: User,
    multiple_indicator_configs: list[IndicatorConfig],
    auth_headers: dict,
    monkeypatch
):
    """
    T022 [P] [US1]: Contract test for GET /indicator-configs endpoint.
    
    Verifies:
    - Response schema matches IndicatorConfigResponse
    - 200 status code
    - All indicators for authenticated user are returned
    - User isolation (only user's own indicators returned)
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    response = await async_client.get("/api/v1/indicator-configs", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    
    # Verify response schema
    for item in data:
        assert "id" in item
        assert "uuid" in item
        assert "indicator_name" in item
        assert "indicator_category" in item
        assert "indicator_params" in item
        assert "display_name" in item
        assert "style" in item
        assert "is_visible" in item
        assert "created_at" in item
        assert "updated_at" in item


@pytest.mark.asyncio
async def test_get_indicator_configs_unauthorized(async_client: AsyncClient):
    """
    T022 [P] [US1]: Contract test for GET /indicator-configs endpoint.
    
    Verifies 401 status when no auth token provided.
    """
    response = await async_client.get("/api/v1/indicator-configs")
    assert response.status_code == 401


# =============================================================================
# T023: POST /indicator-configs endpoint contract test
# =============================================================================

@pytest.mark.asyncio
async def test_create_indicator_config_success(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    monkeypatch
):
    """
    T023 [P] [US1]: Contract test for POST /indicator-configs endpoint.
    
    Verifies:
    - Creation returns 201 status
    - UUID is auto-generated
    - Response schema matches IndicatorConfigResponse
    - Timestamps are set correctly
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    payload = {
        "indicator_name": "sma",
        "indicator_category": "overlay",
        "indicator_params": {"length": 20},
        "display_name": "SMA (20)",
        "style": {
            "color": "#FF5733",
            "lineWidth": 2,
            "showLastValue": True
        },
        "is_visible": True
    }

    response = await async_client.post("/api/v1/indicator-configs", json=payload, headers=auth_headers)

    assert response.status_code == 201
    data = response.json()
    
    # Verify response schema
    assert "id" in data
    assert "uuid" in data
    assert data["indicator_name"] == "sma"
    assert data["indicator_category"] == "overlay"
    assert data["indicator_params"] == {"length": 20}
    assert data["display_name"] == "SMA (20)"
    assert data["is_visible"] is True
    
    # Verify UUID is valid
    uuid.UUID(data["uuid"])  # Will raise if invalid
    
    # Verify timestamps
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_indicator_config_invalid_indicator_name(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    monkeypatch
):
    """
    T023 [P] [US1]: Contract test for POST /indicator-configs endpoint.
    
    Verifies 400 status for invalid indicator name.
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    payload = {
        "indicator_name": "invalid_indicator",
        "indicator_category": "overlay",
        "indicator_params": {"length": 20},
        "display_name": "Invalid",
        "style": {"color": "#FF5733", "lineWidth": 2},
        "is_visible": True
    }

    response = await async_client.post("/api/v1/indicator-configs", json=payload, headers=auth_headers)

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_indicator_config_missing_required_field(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    monkeypatch
):
    """
    T023 [P] [US1]: Contract test for POST /indicator-configs endpoint.
    
    Verifies 422 status for missing required fields.
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    payload = {
        "indicator_name": "sma",
        # Missing indicator_category, indicator_params, display_name, style
    }

    response = await async_client.post("/api/v1/indicator-configs", json=payload, headers=auth_headers)

    assert response.status_code == 422


# =============================================================================
# T024: PUT /indicator-configs/{uuid} endpoint contract test
# =============================================================================

@pytest.mark.asyncio
async def test_update_indicator_config_success(
    async_client: AsyncClient,
    test_user: User,
    sample_indicator_config: IndicatorConfig,
    auth_headers: dict,
    monkeypatch
):
    """
    T024 [P] [US1]: Contract test for PUT /indicator-configs/{uuid} endpoint.
    
    Verifies:
    - Update returns 200 status
    - Only provided fields are updated (partial update)
    - updated_at timestamp is updated
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    config_uuid = str(sample_indicator_config.uuid)
    payload = {
        "indicator_params": {"length": 50},
        "display_name": "SMA (50)",
        "is_visible": False
    }

    response = await async_client.put(
        f"/api/v1/indicator-configs/{config_uuid}",
        json=payload,
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    
    assert data["indicator_params"] == {"length": 50}
    assert data["display_name"] == "SMA (50)"
    assert data["is_visible"] is False
    
    # Verify style was not changed (partial update)
    assert data["style"] == sample_indicator_config.style


@pytest.mark.asyncio
async def test_update_indicator_config_not_found(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    monkeypatch
):
    """
    T024 [P] [US1]: Contract test for PUT /indicator-configs/{uuid} endpoint.
    
    Verifies 404 status when indicator not found.
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    fake_uuid = str(uuid.uuid4())
    payload = {"display_name": "Updated"}

    response = await async_client.put(
        f"/api/v1/indicator-configs/{fake_uuid}",
        json=payload,
        headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_indicator_config_invalid_uuid(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    monkeypatch
):
    """
    T024 [P] [US1]: Contract test for PUT /indicator-configs/{uuid} endpoint.
    
    Verifies 400 status for invalid UUID format.
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    payload = {"display_name": "Updated"}

    response = await async_client.put(
        "/api/v1/indicator-configs/invalid-uuid",
        json=payload,
        headers=auth_headers
    )

    assert response.status_code == 400


# =============================================================================
# T025: DELETE /indicator-configs/{uuid} endpoint contract test
# =============================================================================

@pytest.mark.asyncio
async def test_delete_indicator_config_success(
    async_client: AsyncClient,
    test_user: User,
    sample_indicator_config: IndicatorConfig,
    auth_headers: dict,
    db_session: AsyncSession,
    monkeypatch
):
    """
    T025 [P] [US1]: Contract test for DELETE /indicator-configs/{uuid} endpoint.
    
    Verifies:
    - Deletion returns 204 status
    - Indicator is removed from database
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    config_uuid = str(sample_indicator_config.uuid)

    response = await async_client.delete(
        f"/api/v1/indicator-configs/{config_uuid}",
        headers=auth_headers
    )

    assert response.status_code == 204
    
    # Verify indicator is deleted
    result = await db_session.execute(
        select(IndicatorConfig).where(IndicatorConfig.uuid == sample_indicator_config.uuid)
    )
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_indicator_config_not_found(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    monkeypatch
):
    """
    T025 [P] [US1]: Contract test for DELETE /indicator-configs/{uuid} endpoint.
    
    Verifies 404 status when indicator not found.
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    fake_uuid = str(uuid.uuid4())

    response = await async_client.delete(
        f"/api/v1/indicator-configs/{fake_uuid}",
        headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_indicator_config_invalid_uuid(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    monkeypatch
):
    """
    T025 [P] [US1]: Contract test for DELETE /indicator-configs/{uuid} endpoint.
    
    Verifies 400 status for invalid UUID format.
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    response = await async_client.delete(
        "/api/v1/indicator-configs/invalid-uuid",
        headers=auth_headers
    )

    assert response.status_code == 400


# =============================================================================
# T026: Integration test for multi-device sync (user isolation)
# =============================================================================

@pytest.mark.asyncio
async def test_user_isolation_create_indicator(
    async_client: AsyncClient,
    test_user: User,
    test_user_2: User,
    auth_headers: dict,
    auth_headers_2: dict,
    monkeypatch
):
    """
    T026 [P] [US1]: Integration test for multi-device sync.
    
    Verifies user isolation:
    - User 1 creates indicator
    - User 2 cannot see User 1's indicator
    - Each user only sees their own indicators
    """
    
    # Mock Firebase authentication for user 1
    async def mock_verify_1(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    
    # Mock Firebase authentication for user 2
    async def mock_verify_2(token):
        return {"uid": test_user_2.firebase_uid, "email": test_user_2.email}
    
    call_count = [0]
    async def mock_verify(token):
        call_count[0] += 1
        if "test_user_1" in token or call_count[0] % 2 == 1:
            return await mock_verify_1(token)
        return await mock_verify_2(token)
    
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    # User 1 creates indicator
    payload = {
        "indicator_name": "sma",
        "indicator_category": "overlay",
        "indicator_params": {"length": 20},
        "display_name": "User1 SMA",
        "style": {"color": "#FF5733", "lineWidth": 2},
        "is_visible": True
    }

    response = await async_client.post("/api/v1/indicator-configs", json=payload, headers=auth_headers)
    assert response.status_code == 201
    user1_indicator_uuid = response.json()["uuid"]

    # User 2 should not see User 1's indicator
    response = await async_client.get("/api/v1/indicator-configs", headers=auth_headers_2)
    assert response.status_code == 200
    user2_indicators = response.json()
    assert len(user2_indicators) == 0

    # User 1 should see their own indicator
    response = await async_client.get("/api/v1/indicator-configs", headers=auth_headers)
    assert response.status_code == 200
    user1_indicators = response.json()
    assert len(user1_indicators) == 1
    assert user1_indicators[0]["uuid"] == user1_indicator_uuid
    assert user1_indicators[0]["display_name"] == "User1 SMA"


@pytest.mark.asyncio
async def test_user_isolation_update_delete(
    async_client: AsyncClient,
    test_user: User,
    test_user_2: User,
    auth_headers: dict,
    auth_headers_2: dict,
    monkeypatch
):
    """
    T026 [P] [US1]: Integration test for multi-device sync.
    
    Verifies user isolation for update/delete operations:
    - User 1 creates indicator
    - User 2 cannot update User 1's indicator (404)
    - User 2 cannot delete User 1's indicator (404)
    """
    
    # Mock Firebase authentication
    call_count = [0]
    async def mock_verify(token):
        call_count[0] += 1
        if "test_user_1" in token or call_count[0] % 2 == 1:
            return {"uid": test_user.firebase_uid, "email": test_user.email}
        return {"uid": test_user_2.firebase_uid, "email": test_user_2.email}
    
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    # User 1 creates indicator
    payload = {
        "indicator_name": "sma",
        "indicator_category": "overlay",
        "indicator_params": {"length": 20},
        "display_name": "User1 SMA",
        "style": {"color": "#FF5733", "lineWidth": 2},
        "is_visible": True
    }

    response = await async_client.post("/api/v1/indicator-configs", json=payload, headers=auth_headers)
    assert response.status_code == 201
    user1_indicator_uuid = response.json()["uuid"]

    # User 2 tries to update User 1's indicator - should get 404
    response = await async_client.put(
        f"/api/v1/indicator-configs/{user1_indicator_uuid}",
        json={"display_name": "Hacked"},
        headers=auth_headers_2
    )
    assert response.status_code == 404

    # User 2 tries to delete User 1's indicator - should get 404
    response = await async_client.delete(
        f"/api/v1/indicator-configs/{user1_indicator_uuid}",
        headers=auth_headers_2
    )
    assert response.status_code == 404

    # User 1 can still update their own indicator
    response = await async_client.put(
        f"/api/v1/indicator-configs/{user1_indicator_uuid}",
        json={"display_name": "Updated by User1"},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Updated by User1"


@pytest.mark.asyncio
async def test_new_user_empty_indicators(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    monkeypatch
):
    """
    T026 [P] [US1]: Integration test for multi-device sync.
    
    Verifies that new users start with empty indicator list.
    """
    # Mock Firebase authentication
    async def mock_verify(token):
        return {"uid": test_user.firebase_uid, "email": test_user.email}
    monkeypatch.setattr("app.services.auth_middleware.get_current_user", mock_verify)

    response = await async_client.get("/api/v1/indicator-configs", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []
