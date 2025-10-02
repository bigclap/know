import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.database import ensure_vector_extension


def _make_connection(dialect_name: str) -> AsyncMock:
    connection = AsyncMock()
    connection.dialect = SimpleNamespace(name=dialect_name)
    return connection


def test_ensure_vector_extension_runs_for_postgres() -> None:
    connection = _make_connection("postgresql")

    asyncio.run(ensure_vector_extension(connection))

    connection.execute.assert_awaited_once()
    args, _ = connection.execute.await_args
    assert str(args[0]).strip() == "CREATE EXTENSION IF NOT EXISTS vector"


def test_ensure_vector_extension_noop_for_non_postgres() -> None:
    connection = _make_connection("sqlite")

    asyncio.run(ensure_vector_extension(connection))

    connection.execute.assert_not_awaited()
