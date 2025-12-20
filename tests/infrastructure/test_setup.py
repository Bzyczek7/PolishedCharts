import os
import yaml

def test_project_structure():
    assert os.path.isdir("backend")
    assert os.path.isdir("frontend")
    assert os.path.isfile("docker-compose.yml")

def test_docker_compose_services():
    with open("docker-compose.yml", "r") as f:
        config = yaml.safe_load(f)
    
    services = config.get("services", {})
    assert "db" in services
    assert "redis" in services
    
    # Check db config
    db = services["db"]
    assert db["image"] == "postgres:15-alpine"
    
    # Check redis config
    redis = services["redis"]
    assert redis["image"] == "redis:7-alpine"
