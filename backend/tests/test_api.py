import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import get_embedding_client
from app.config import get_settings
from app.main import create_app
from app.repositories import ArtifactRepository, MessageRepository, StructuredEntryRepository
from app.services.context_navigator import ContextResult, SearchHit
from app.services.orchestrator import GenerationRequest, GenerationResponse


class FakeEmbeddingClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, ...]] = []
        self.vector = [0.5, 0.5, 0.5]

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(tuple(texts))
        return [self.vector for _ in texts]


class FakeOrchestrator:
    def __init__(self) -> None:
        self.requests: list[GenerationRequest] = []

    async def respond(self, request: GenerationRequest) -> GenerationResponse:
        self.requests.append(request)
        return GenerationResponse(
            content="Ответ ассистента",
            context=ContextResult(
                query=request.user_message,
                artifacts=[SearchHit(id="a1", score=0.9, payload={"title": "Artifact"}, entity_type="artifact")],
                messages=[SearchHit(id="m1", score=0.8, payload={"content": "Message"}, entity_type="message")],
                structured_entries=[
                    SearchHit(
                        id="s1",
                        score=0.7,
                        payload={"text": "Structured"},
                        entity_type="structured_entry",
                    )
                ],
            ),
        )


@pytest.fixture()
def fake_orchestrator() -> FakeOrchestrator:
    return FakeOrchestrator()


@pytest_asyncio.fixture()
async def app(monkeypatch: pytest.MonkeyPatch, fake_orchestrator: FakeOrchestrator):
    get_settings.cache_clear()
    monkeypatch.setenv("KNOW_DATABASE_URL", "sqlite+aiosqlite:///./test_api.db")
    application = create_app(orchestrator=fake_orchestrator)
    return application


@pytest_asyncio.fixture()
async def client(app, embedding_client: FakeEmbeddingClient):
    app.dependency_overrides[get_embedding_client] = lambda: embedding_client
    transport = ASGITransport(app=app)
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
            yield async_client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def embedding_client() -> FakeEmbeddingClient:
    return FakeEmbeddingClient()


@pytest_asyncio.fixture()
async def session_factory(app):
    return app.state.session_factory


@pytest_asyncio.fixture()
async def artifact(session_factory, embedding_client: FakeEmbeddingClient):
    async with session_factory() as session:
        repo = ArtifactRepository(session=session, embedding_client=embedding_client)
        artifact = await repo.create(title="Root", summary="Root summary")
        return artifact.id


@pytest.mark.asyncio
async def test_post_chat_message_triggers_ai_and_persists_messages(
    client: AsyncClient, session_factory, artifact, fake_orchestrator, embedding_client: FakeEmbeddingClient
):
    payload = {"artifact_id": str(artifact), "content": "Привет", "sender": "user"}

    response = await client.post("/chat/message", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["user_message"]["artifact_id"] == str(artifact)
    assert body["user_message"]["content"] == "Привет"
    assert body["assistant_message"]["content"] == "Ответ ассистента"
    assert body["assistant_message"]["sender"] == "assistant"
    assert body["context"]["query"] == "Привет"
    assert body["context"]["artifacts"][0]["id"] == "a1"

    assert fake_orchestrator.requests
    request = fake_orchestrator.requests[0]
    assert request.user_message == "Привет"
    assert list(request.conversation_history) == []

    async with session_factory() as session:
        messages = await MessageRepository(session=session).list_for_artifact(artifact_id=artifact)
        assert len(messages) == 2
        assert messages[0].content == "Привет"
        assert messages[0].sender == "user"
        assert messages[0].content_vector == embedding_client.vector
        assert messages[1].content == "Ответ ассистента"
        assert messages[1].sender == "assistant"
        assert messages[1].content_vector == embedding_client.vector


@pytest.mark.asyncio
async def test_get_artifact_returns_nested_payload(client: AsyncClient, session_factory, artifact, embedding_client):
    async with session_factory() as session:
        artifact_repo = ArtifactRepository(session=session, embedding_client=embedding_client)
        entry_repo = StructuredEntryRepository(session=session, embedding_client=embedding_client)
        message_repo = MessageRepository(session=session, embedding_client=embedding_client)

        stored_artifact = await artifact_repo.get(artifact)
        assert stored_artifact is not None

        await message_repo.create(artifact=stored_artifact, content="Запланировать релиз", sender="alice")

        await entry_repo.create(
            artifact=stored_artifact,
            data_json={"task": "Release"},
            text_representation="task: Release",
        )

    response = await client.get(f"/artifacts/{artifact}")
    assert response.status_code == 200

    body = response.json()
    assert body["id"] == str(artifact)
    assert body["messages"][0]["content"] == "Запланировать релиз"
    assert body["structured_entries"][0]["data_json"] == {"task": "Release"}


@pytest.mark.asyncio
async def test_post_artifact_link(client: AsyncClient, session_factory, artifact, embedding_client):
    async with session_factory() as session:
        target = await ArtifactRepository(session=session, embedding_client=embedding_client).create(
            title="Target", summary="Target summary"
        )
        target_id = target.id

    response = await client.post(
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


@pytest.mark.asyncio
async def test_websocket_chat_persists_messages(app, session_factory, artifact, embedding_client):
    app.dependency_overrides[get_embedding_client] = lambda: embedding_client
    with TestClient(app) as sync_client:
        with sync_client.websocket_connect(f"/ws/chat/{artifact}") as websocket:
            websocket.send_json({"content": "Через WS", "sender": "bob"})
            response = websocket.receive_json()

    app.dependency_overrides.clear()

    assert response["content"] == "Через WS"
    assert response["artifact_id"] == str(artifact)

    async with session_factory() as session:
        messages = await MessageRepository(session=session, embedding_client=embedding_client).list_for_artifact(
            artifact_id=artifact
        )
        assert len(messages) == 1
        assert messages[0].sender == "bob"
        assert messages[0].content_vector == embedding_client.vector
