from typing import Sequence

import pytest
import pytest_asyncio
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import create_async_engine_and_session
from app.models import Artifact, Schema, StructuredEntry
from app.repositories import (
    ArtifactRepository,
    LinkRepository,
    MessageRepository,
    SchemaRepository,
    StructuredEntryRepository,
)


class RecordingEmbeddingClient:
    def __init__(self, *, vector: Sequence[float]) -> None:
        self.vector = list(vector)
        self.calls: list[Sequence[str]] = []

    async def embed(self, texts: Sequence[str]) -> Sequence[Sequence[float]]:
        self.calls.append(tuple(texts))
        return [list(self.vector) for _ in texts]


@pytest_asyncio.fixture()
async def session() -> AsyncSession:
    engine, session_factory = create_async_engine_and_session(url="sqlite+aiosqlite:///:memory:?cache=shared")
    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture()
def embedding_client() -> RecordingEmbeddingClient:
    return RecordingEmbeddingClient(vector=[0.1, 0.2, 0.3])


@pytest.mark.asyncio
async def test_artifact_hierarchy(session: AsyncSession, embedding_client: RecordingEmbeddingClient) -> None:
    repo = ArtifactRepository(session=session, embedding_client=embedding_client)

    root = await repo.create(title="Root", summary="Root summary")
    child = await repo.create_child(parent=root, title="Child", summary="Child summary")

    fetched_root = await repo.get_with_related(root.id)
    assert fetched_root is not None
    assert fetched_root.id == root.id
    assert fetched_root.children[0].id == child.id
    assert child.parent_artifact_id == root.id
    assert embedding_client.calls == [("Root summary",), ("Child summary",)]
    assert root.summary_vector is not None
    assert child.summary_vector is not None


@pytest.mark.asyncio
async def test_structured_entry_schema_linkage(
    session: AsyncSession, embedding_client: RecordingEmbeddingClient
) -> None:
    artifact_repo = ArtifactRepository(session=session, embedding_client=embedding_client)
    schema_repo = SchemaRepository(session=session)
    entry_repo = StructuredEntryRepository(session=session, embedding_client=embedding_client)

    artifact = await artifact_repo.create(title="Artifact", summary="Artifact summary")
    schema = await schema_repo.create(
        name="Task Schema",
        description="Tracks tasks",
        schema_json={"Task": "string"},
        description_vector=[0.1, 0.3],
    )
    artifact.applied_schema_id = schema.id
    await session.commit()

    entry = await entry_repo.create(
        artifact=artifact,
        data_json={"Task": "Ship"},
        text_representation="Ship",
    )

    refreshed = await entry_repo.get(entry.id)
    assert refreshed is not None
    assert refreshed.artifact_id == artifact.id
    assert refreshed.schema is None
    assert artifact.applied_schema_id == schema.id
    assert embedding_client.calls[-1] == ("Ship",)
    assert refreshed.text_representation_vector is not None


@pytest.mark.asyncio
async def test_link_repository(session: AsyncSession) -> None:
    artifact_repo = ArtifactRepository(session=session)
    link_repo = LinkRepository(session=session)

    source = await artifact_repo.create(title="Source", summary="")
    target = await artifact_repo.create(title="Target", summary="")

    link = await link_repo.create(
        source_type="artifact",
        source_id=source.id,
        target_type="artifact",
        target_id=target.id,
        link_type="relates_to",
        description="Related artifacts",
    )

    retrieved = await link_repo.list_for_entity(entity_type="artifact", entity_id=source.id)
    assert retrieved == [link]


@pytest.mark.asyncio
async def test_artifact_update_recalculates_vector(
    session: AsyncSession, embedding_client: RecordingEmbeddingClient
) -> None:
    repo = ArtifactRepository(session=session, embedding_client=embedding_client)
    artifact = await repo.create(title="Original", summary="Initial summary")

    embedding_client.vector = [0.9, 0.8, 0.7]
    updated = await repo.update_summary(artifact=artifact, summary="Updated summary")

    assert updated.summary == "Updated summary"
    assert updated.summary_vector == [0.9, 0.8, 0.7]
    assert embedding_client.calls[-1] == ("Updated summary",)


@pytest.mark.asyncio
async def test_message_update_recalculates_vector(
    session: AsyncSession, embedding_client: RecordingEmbeddingClient
) -> None:
    artifact_repo = ArtifactRepository(session=session, embedding_client=embedding_client)
    message_repo = MessageRepository(session=session, embedding_client=embedding_client)
    artifact = await artifact_repo.create(title="Artifact", summary="Summary")
    message = await message_repo.create(artifact=artifact, content="Old", sender="user")

    embedding_client.vector = [0.4, 0.4, 0.4]
    updated = await message_repo.update_content(message=message, content="New content")

    assert updated.content == "New content"
    assert updated.content_vector == [0.4, 0.4, 0.4]
    assert embedding_client.calls[-1] == ("New content",)


@pytest.mark.asyncio
async def test_structured_entry_update_recalculates_vector(
    session: AsyncSession, embedding_client: RecordingEmbeddingClient
) -> None:
    artifact_repo = ArtifactRepository(session=session, embedding_client=embedding_client)
    entry_repo = StructuredEntryRepository(session=session, embedding_client=embedding_client)
    artifact = await artifact_repo.create(title="Artifact", summary="Summary")
    entry = await entry_repo.create(
        artifact=artifact,
        data_json={"Task": "Ship"},
        text_representation="Ship",
    )

    embedding_client.vector = [0.6, 0.6, 0.6]
    updated = await entry_repo.update_text_representation(
        entry=entry,
        text_representation="Ship updated",
        data_json={"Task": "Ship", "Status": "Done"},
    )

    assert updated.text_representation == "Ship updated"
    assert updated.text_representation_vector == [0.6, 0.6, 0.6]
    assert embedding_client.calls[-1] == ("Ship updated",)
