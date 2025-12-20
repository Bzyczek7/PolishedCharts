from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime
from app.main import app
from app.db.session import get_db

client = TestClient(app)

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
        "condition": "price_above",
        "threshold": 150.0
    }
    
    response = client.post("/api/v1/alerts/", json=alert_data)
    
    # Clean up
    app.dependency_overrides = {}
    
    assert response.status_code == 201
    data = response.json()
    assert data["condition"] == "price_above"
    assert data["threshold"] == 150.0
    assert data["id"] == 1
