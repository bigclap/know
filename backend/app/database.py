"""Database utilities for engine and session management."""
from __future__ import annotations

from typing import Tuple, Union

from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.ext.asyncio.session import AsyncSession


def create_engine_and_session(
    *, url: str, echo: bool = False, is_async: bool = False
) -> Tuple[Union[Engine, AsyncEngine], sessionmaker]:
    """Create an engine and a session factory for the given URL.

    SQLite is configured with an in-memory friendly setup for tests while
    PostgreSQL benefits from connection pre-ping for long running sessions.
    """

    connect_args = {}
    engine_kwargs = {"echo": echo, "future": True}
    if url.startswith("sqlite"):  # pragma: no cover - deterministic branch
        connect_args = {"check_same_thread": False}
        engine_kwargs["poolclass"] = StaticPool
    else:
        engine_kwargs["pool_pre_ping"] = True

    if is_async:
        engine = create_async_engine(url, connect_args=connect_args, **engine_kwargs)
        session_class = AsyncSession
    else:
        engine = create_engine(url, connect_args=connect_args, **engine_kwargs)
        session_class = Session

    SQLModel.metadata.bind = engine
    SessionLocal = sessionmaker(
        bind=engine, class_=session_class, expire_on_commit=False
    )
    return engine, SessionLocal


def ensure_vector_extension(engine: Engine) -> None:
    """Ensure the pgvector extension exists when using PostgreSQL."""

    if engine.dialect.name != "postgresql":
        return

    with engine.connect() as connection:
        autocommit_connection = connection.execution_options(isolation_level="AUTOCOMMIT")
        autocommit_connection.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector")


# Provide a helper for production usage.
def init_db(url: str) -> Session:
    engine, SessionLocal = create_engine_and_session(url=url)
    ensure_vector_extension(engine)
    SQLModel.metadata.create_all(engine)
    return SessionLocal()
