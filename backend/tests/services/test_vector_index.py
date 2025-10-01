import math
from typing import Sequence
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import literal
from sqlalchemy.sql import Select
from sqlmodel import SQLModel

from app.database import create_async_engine_and_session
from app.models import Artifact, Message, StructuredEntry
from app.services.vector_index import DistanceStrategy, PGVectorIndex


class _FakeResult:
    def __init__(self, items: Sequence[SQLModel]) -> None:
        self._items = list(items)

    def scalars(self) -> "_FakeResult":
        return self

    def all(self) -> list[SQLModel]:
        return list(self._items)


class _FakeSessionContext:
    def __init__(self, session: "_FakeSession") -> None:
        self._session = session

    async def __aenter__(self) -> "_FakeSession":
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover - no cleanup required
        return None


class _FakeSession:
    def __init__(self, items: Sequence[SQLModel]) -> None:
        from types import SimpleNamespace

        self._items = list(items)
        self.statements: list[Select] = []
        self.bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))

    async def execute(self, statement: Select) -> _FakeResult:
        self.statements.append(statement)
        return _FakeResult(self._items)


def _postgres_session_factory(items: Sequence[SQLModel]):
    session = _FakeSession(items)

    def factory() -> _FakeSessionContext:
        return _FakeSessionContext(session)

    factory.session = session  # type: ignore[attr-defined]
    return factory


class FakeEmbeddingClient:
    def __init__(self, vector: Sequence[float]) -> None:
        self._vector = list(vector)
        self.calls: list[tuple[str, ...]] = []

    async def embed(self, texts: Sequence[str]) -> Sequence[Sequence[float]]:
        self.calls.append(tuple(texts))
        return [self._vector]


@pytest_asyncio.fixture()
async def session_factory():
    engine, factory = create_async_engine_and_session(url="sqlite+aiosqlite:///:memory:?cache=shared")
    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)
    try:
        yield factory
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_pgvector_index_filters_by_entity_type(session_factory) -> None:
    embedding = FakeEmbeddingClient([1.0, 0.0, 0.0])
    index = PGVectorIndex(session_factory=session_factory, embedding_client=embedding)

    async with session_factory() as session:
        artifact = Artifact(title="Root", summary="hello", summary_vector=[1.0, 0.0, 0.0])
        other_artifact = Artifact(title="Other", summary="bye", summary_vector=[0.0, 1.0, 0.0])
        message = Message(
            artifact_id=artifact.id,
            content="Message",
            sender="user",
            content_vector=[1.0, 0.0, 0.0],
        )
        session.add(artifact)
        session.add(other_artifact)
        session.add(message)
        await session.commit()
        artifact_id = str(artifact.id)
        other_artifact_id = str(other_artifact.id)

    hits = await index.search("Root", entity_types=["artifact"], limit=2)

    assert embedding.calls == [("Root",)]
    assert [hit.entity_type for hit in hits] == ["artifact", "artifact"]
    assert hits[0].id == artifact_id
    assert hits[1].id == other_artifact_id


@pytest.mark.asyncio
async def test_pgvector_index_supports_l2_distance(session_factory) -> None:
    embedding = FakeEmbeddingClient([0.0, 0.0, 1.0])
    index = PGVectorIndex(session_factory=session_factory, embedding_client=embedding)

    async with session_factory() as session:
        entry = StructuredEntry(
            artifact_id=uuid4(),
            data_json={"value": 1},
            text_representation="value: 1",
            text_representation_vector=[0.0, 0.0, 0.0],
        )
        session.add(entry)
        await session.commit()

    hits = await index.search(
        "value",
        entity_types=["structured_entry"],
        limit=1,
        distance_strategy=DistanceStrategy.L2,
    )

    assert hits[0].entity_type == "structured_entry"
    assert math.isclose(hits[0].score, 0.5, rel_tol=1e-6)


@pytest.mark.asyncio
async def test_pgvector_index_uses_database_distance_on_postgres(monkeypatch) -> None:
    artifact = Artifact(title="Root", summary="hello", summary_vector=[1.0, 0.0, 0.0])
    other = Artifact(title="Other", summary="bye", summary_vector=[0.0, 1.0, 0.0])
    session_factory = _postgres_session_factory([artifact, other])
    embedding = FakeEmbeddingClient([1.0, 0.0, 0.0])
    index = PGVectorIndex(session_factory=session_factory, embedding_client=embedding)

    calls: list[tuple[object, list[float], DistanceStrategy]] = []

    def fake_distance(*, column, query_vector, strategy):
        calls.append((column, list(query_vector), strategy))
        return literal(0)

    monkeypatch.setattr(
        PGVectorIndex,
        "_build_distance_expression",
        staticmethod(fake_distance),
    )

    hits = await index.search("Root", entity_types=["artifact"], limit=1)

    assert len(hits) == 1
    statement = session_factory.session.statements[0]
    assert statement._order_by_clause is not None and statement._order_by_clause.clauses
    assert statement._limit_clause is not None
    assert calls and calls[0][2] is DistanceStrategy.COSINE
