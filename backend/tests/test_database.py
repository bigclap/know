"""Tests for database utilities."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.database import ensure_vector_extension


def _build_engine_mock(dialect_name: str) -> MagicMock:
    engine = MagicMock()
    engine.dialect.name = dialect_name
    connection = MagicMock()
    context_manager = MagicMock()
    context_manager.__enter__.return_value = connection
    context_manager.__exit__.return_value = False
    engine.connect.return_value = context_manager
    return engine


def test_ensure_vector_extension_executes_on_postgres() -> None:
    engine = _build_engine_mock("postgresql")

    ensure_vector_extension(engine)

    connection = engine.connect.return_value.__enter__.return_value
    execute_calls = connection.execute.call_args_list
    assert execute_calls, "Expected CREATE EXTENSION to be executed"
    executed_statement = str(execute_calls[0].args[0]).strip()
    assert executed_statement == "CREATE EXTENSION IF NOT EXISTS vector"


def test_ensure_vector_extension_is_noop_on_sqlite() -> None:
    engine = _build_engine_mock("sqlite")

    ensure_vector_extension(engine)

    connection = engine.connect.return_value.__enter__.return_value
    connection.execute.assert_not_called()
