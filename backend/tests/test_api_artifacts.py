"""Tests for the artifact API endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.services.orchestrator import GenerationRequest, GenerationResponse, KnowledgeOrchestrator


class FakeOrchestrator(KnowledgeOrchestrator):
    def __init__(self) -> None:
        self.requests: list[GenerationRequest] = []

    async def respond(self, request: GenerationRequest) -> GenerationResponse:
        # This is not used by the artifact CRUD endpoints, so we can keep it simple.
        return GenerationResponse(content="...", context=None)

@pytest.fixture()
def fake_orchestrator() -> FakeOrchestrator:
    return FakeOrchestrator()

@pytest.fixture()
def app(monkeypatch: pytest.MonkeyPatch, fake_orchestrator: FakeOrchestrator):
    """Build an application instance backed by an in-memory database."""
    get_settings.cache_clear()
    monkeypatch.setenv("KNOW_DATABASE_URL", "sqlite://")
    # We are not testing the AI services, so we provide a fake orchestrator
    return create_app(orchestrator=fake_orchestrator)


@pytest.fixture()
def client(app):
    with TestClient(app) as client:
        yield client


def test_create_artifact(client):
    response = client.post("/artifacts/", json={"title": "Test Artifact"})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Artifact"
    assert "id" in data

def test_get_artifact(client):
    # First, create an artifact
    create_response = client.post("/artifacts/", json={"title": "Test Artifact"})
    artifact_id = create_response.json()["id"]

    # Now, get the artifact
    get_response = client.get(f"/artifacts/{artifact_id}")
    assert get_response.status_code == 200
    data = get_response.json()
    assert data["title"] == "Test Artifact"
    assert data["id"] == artifact_id

def test_update_artifact(client):
    # First, create an artifact
    create_response = client.post("/artifacts/", json={"title": "Test Artifact"})
    artifact_id = create_response.json()["id"]

    # Now, update the artifact
    update_response = client.patch(f"/artifacts/{artifact_id}", json={"title": "Updated Title"})
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["title"] == "Updated Title"

    # Verify the change was persisted
    get_response = client.get(f"/artifacts/{artifact_id}")
    data = get_response.json()
    assert data["title"] == "Updated Title"

def test_delete_artifact(client):
    # First, create an artifact
    create_response = client.post("/artifacts/", json={"title": "Test Artifact"})
    artifact_id = create_response.json()["id"]

    # Now, delete the artifact
    delete_response = client.delete(f"/artifacts/{artifact_id}")
    assert delete_response.status_code == 204

    # Verify the artifact was deleted
    get_response = client.get(f"/artifacts/{artifact_id}")
    assert get_response.status_code == 404

def test_list_artifacts(client):
    # Create a couple of artifacts
    client.post("/artifacts/", json={"title": "Artifact 1"})
    client.post("/artifacts/", json={"title": "Artifact 2"})

    # List the artifacts
    response = client.get("/artifacts/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["title"] == "Artifact 1"
    assert data[1]["title"] == "Artifact 2"
