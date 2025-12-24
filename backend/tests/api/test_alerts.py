from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime
from app.main import app
from app.db.session import get_db
from app.core.enums import AlertCondition

client = TestClient(app)


# T043 [US2] Contract test: POST /api/v1/alerts success
def test_create_alert_success():
    """Test: POST /api/v1/alerts creates alert successfully and returns 201"""
    # Mock DB dependency
    mock_session = AsyncMock()

    # Define a side effect for refresh to set id and created_at
    async def mock_refresh(obj):
        obj.id = 1
        obj.created_at = datetime.now()

    mock_session.refresh.side_effect = mock_refresh

    # Override dependency
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    alert_data = {
        "symbol_id": 1,
        "condition": AlertCondition.ABOVE.value,  # "above"
        "threshold": 150.0,
        "cooldown": 300
    }

    response = client.post("/api/v1/alerts/", json=alert_data)

    # Clean up
    app.dependency_overrides = {}

    assert response.status_code == 201
    data = response.json()
    assert data["condition"] == AlertCondition.ABOVE.value
    assert data["threshold"] == 150.0
    assert data["id"] == 1
    assert data["symbol_id"] == 1
    assert "cooldown" in data


# T044 [US2] Contract test: negative threshold rejected
def test_negative_threshold_rejected():
    """Test: POST /api/v1/alerts rejects negative threshold with 422"""
    # Mock DB dependency
    mock_session = AsyncMock()

    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    alert_data = {
        "symbol_id": 1,
        "condition": AlertCondition.ABOVE.value,
        "threshold": -10.0,  # Invalid: negative threshold
    }

    response = client.post("/api/v1/alerts/", json=alert_data)

    # Clean up
    app.dependency_overrides = {}

    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    # Error should mention threshold validation
    assert any("threshold" in str(d).lower() for d in data["detail"] if isinstance(d, (str, dict)))


# Original test - keep for backward compatibility
def test_create_alert_endpoint():
    # Mock DB dependency
    mock_session = AsyncMock()

    # Define a side effect for refresh to set id and created_at
    async def mock_refresh(obj):
        obj.id = 1
        obj.created_at = datetime.now()

    mock_session.refresh.side_effect = mock_refresh

    # Override dependency
    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    alert_data = {
        "symbol_id": 1,
        "condition": "above",
        "threshold": 150.0
    }

    response = client.post("/api/v1/alerts/", json=alert_data)

    # Clean up
    app.dependency_overrides = {}

    assert response.status_code == 201
    data = response.json()
    assert data["condition"] == "above"
    assert data["threshold"] == 150.0
    assert data["id"] == 1
