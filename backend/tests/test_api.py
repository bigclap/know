"""End-to-end tests for the FastAPI application (stream D)."""

from __future__ import annotations

from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.repositories import (
    ArtifactRepository,
    MessageRepository,
    StructuredEntryRepository,
)


@pytest.fixture()
def app(monkeypatch: pytest.MonkeyPatch):
    """Build an application instance backed by an in-memory database."""

    get_settings.cache_clear()
    monkeypatch.setenv("KNOW_DATABASE_URL", "sqlite://")
    return create_app()


@pytest.fixture()
def client(app):
    with TestClient(app) as client:
        yield client


@pytest.fixture()
def session_factory(app):
    return app.state.session_factory


@pytest.fixture()
def artifact(session_factory) -> UUID:
    with session_factory() as session:
        repo = ArtifactRepository(session)
        artifact = repo.create(title="Root", summary="", summary_vector=None)
        return artifact.id


def test_post_chat_message_creates_message(client, session_factory, artifact):
    payload = {"artifact_id": str(artifact), "content": "Привет", "sender": "user"}

    response = client.post("/chat/message", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["artifact_id"] == str(artifact)
    assert body["content"] == "Привет"
    assert body["sender"] == "user"

    with session_factory() as session:
        messages = MessageRepository(session).list_for_artifact(artifact_id=artifact)
        assert len(messages) == 1
        assert messages[0].content == "Привет"


def test_get_artifact_returns_nested_payload(client, session_factory, artifact):
    with session_factory() as session:
        artifact_repo = ArtifactRepository(session)
        entry_repo = StructuredEntryRepository(session)
        message_repo = MessageRepository(session)

        stored_artifact = artifact_repo.get(artifact)
        assert stored_artifact is not None

        message_repo.create(
            artifact=stored_artifact,
            content="Запланировать релиз",
            sender="alice",
        )

        entry_repo.create(
            artifact=stored_artifact,
            data_json={"task": "Release"},
            text_representation="task: Release",
            vector=None,
        )

    response = client.get(f"/artifacts/{artifact}")
    assert response.status_code == 200

    body = response.json()
    assert body["id"] == str(artifact)
    assert body["messages"][0]["content"] == "Запланировать релиз"
    assert body["structured_entries"][0]["data_json"] == {"task": "Release"}


def test_post_artifact_link(client, session_factory, artifact):
    with session_factory() as session:
        target = ArtifactRepository(session).create(
            title="Target", summary="", summary_vector=None
        )
        target_id = target.id

    response = client.post(
        f"/artifacts/{artifact}/links",
        json={
            "target_entity_type": "artifact",
            "target_entity_id": str(target_id),
            "link_type": "relates_to",
            "description": "Связанные артефакты",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["source_entity_id"] == str(artifact)
    assert data["target_entity_id"] == str(target_id)


def test_websocket_chat_persists_messages(client, session_factory, artifact):
    with client.websocket_connect(f"/ws/chat/{artifact}") as websocket:
        websocket.send_json({"content": "Через WS", "sender": "bob"})
        response = websocket.receive_json()

    assert response["content"] == "Через WS"
    assert response["artifact_id"] == str(artifact)

    with session_factory() as session:
        messages = MessageRepository(session).list_for_artifact(artifact_id=artifact)
        assert len(messages) == 1
        assert messages[0].sender == "bob"
