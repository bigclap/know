"""Unit tests for the vector index implementations."""
from __future__ import annotations

from typing import AsyncGenerator

import json

import pytest
import pytest_asyncio
from sqlalchemy import Column, event, text
from sqlalchemy.engine import Engine
from sqlmodel import Field, SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import create_engine_and_session
from typing import List, Optional
from app.services.vector_index import PGVectorIndex
from app.models import Vector


class Artifact(SQLModel, table=True):
    __tablename__ = "artifacts"
    __table_args__ = {"extend_existing": True}

    id: str = Field(primary_key=True)
    summary_vector: Optional[List[float]] = Field(
        default=None, sa_column=Column(Vector(1536))
    )


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session for the tests."""
    engine, session_factory = create_engine_and_session(
        url="sqlite+aiosqlite:///:memory:", is_async=True
    )

    # The vector functions are not available in SQLite, so we need to create
    # them as user-defined functions for the tests to pass.
    @event.listens_for(Engine, "connect")
    def connect(dbapi_connection, _connection_record):  # pragma: no cover
        dbapi_connection.create_function(
            "l2_distance", 2, lambda a, b: sum((x - y) ** 2 for x, y in zip(json.loads(a), json.loads(b)))
        )

    # The custom function needs to be registered on the raw DBAPI connection,
    # so we need to create the engine and session factory before the listener.
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    session_generator = session_factory()
    yield session_generator
    await session_generator.close()
    await engine.dispose()


@pytest.mark.asyncio
async def test_pg_vector_index_search(session: AsyncSession) -> None:
    """Verify that PGVectorIndex returns the nearest neighbors."""
    # Insert some test data.
    async with session.begin():
        await session.execute(
            text(
                """
                INSERT INTO artifacts (id, title, summary, summary_vector)
                VALUES
                    ('a', 'dummy', 'dummy', '[1.0, 0.0, 0.0]'),
                    ('b', 'dummy', 'dummy', '[0.0, 1.0, 0.0]'),
                    ('c', 'dummy', 'dummy', '[0.8, 0.2, 0.0]');
                """
            )
        )

    index = PGVectorIndex(session)
    results = await index.search(
        namespace="artifacts",
        vector=[0.85, 0.15, 0.0],
        limit=2,
    )

    assert len(results) == 2
    assert results[0]["id"] == "c"
    assert results[1]["id"] == "a"


@pytest.mark.asyncio
async def test_pg_vector_index_search_unknown_namespace(session: AsyncSession) -> None:
    """Verify that PGVectorIndex raises an error for unknown namespaces."""
    index = PGVectorIndex(session)
    with pytest.raises(ValueError, match="Unknown vector search namespace: unknown"):
        await index.search(namespace="unknown", vector=[1.0, 0.0, 0.0], limit=1)
