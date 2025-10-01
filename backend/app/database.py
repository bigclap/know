"""Database utilities for engine and session management."""
from __future__ import annotations

from typing import Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel


def create_async_engine_and_session(
    *, url: str, echo: bool = False
) -> Tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Create an async engine and session factory for the given URL."""

    engine_kwargs: dict[str, object] = {"echo": echo, "future": True}
    if url.startswith("sqlite+aiosqlite"):  # pragma: no cover - deterministic branch
        engine_kwargs["connect_args"] = {"check_same_thread": False}
        engine_kwargs["poolclass"] = StaticPool
    else:
        engine_kwargs["pool_pre_ping"] = True

    engine = create_async_engine(url, **engine_kwargs)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    return engine, session_factory


async def init_db(url: str) -> AsyncSession:
    engine, session_factory = create_async_engine_and_session(url=url)
    async with engine.begin() as connection:
        await ensure_vector_extension(connection)
        await connection.run_sync(SQLModel.metadata.create_all)
    return session_factory()


async def ensure_vector_extension(connection: AsyncConnection) -> None:
    """Install pgvector extension when connected to PostgreSQL."""

    dialect_name = getattr(connection.dialect, "name", "")
    if dialect_name != "postgresql":
        return

    await connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
