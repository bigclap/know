"""Tests for database utilities."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.database import ensure_vector_extension


def _build_engine_mock(dialect_name: str) -> tuple[MagicMock, MagicMock, MagicMock]:
    engine = MagicMock()
    engine.dialect.name = dialect_name
    connection = MagicMock(name="connection")
    autocommit_connection = MagicMock(name="autocommit_connection")
    connection.execution_options.return_value = autocommit_connection
    context_manager = MagicMock()
    context_manager.__enter__.return_value = connection
    context_manager.__exit__.return_value = False
    engine.connect.return_value = context_manager
    return engine, connection, autocommit_connection


def test_ensure_vector_extension_executes_on_postgres() -> None:
    engine, connection, autocommit_connection = _build_engine_mock("postgresql")

    ensure_vector_extension(engine)

    connection.execution_options.assert_called_once_with(isolation_level="AUTOCOMMIT")
    autocommit_connection.exec_driver_sql.assert_called_once_with(
        "CREATE EXTENSION IF NOT EXISTS vector"
    )


def test_ensure_vector_extension_is_noop_on_sqlite() -> None:
    engine, connection, autocommit_connection = _build_engine_mock("sqlite")

    ensure_vector_extension(engine)

    connection.execution_options.assert_not_called()
    autocommit_connection.exec_driver_sql.assert_not_called()
