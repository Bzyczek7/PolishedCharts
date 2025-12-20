import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

def test_settings_load():
    assert settings.PROJECT_NAME == "TradingAlert"
    assert settings.API_V1_STR == "/api/v1"

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
