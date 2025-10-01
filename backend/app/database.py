"""Database utilities for engine and session management."""
from __future__ import annotations

from typing import Tuple

from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


def create_engine_and_session(*, url: str, echo: bool = False) -> Tuple[Engine, sessionmaker]:
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

    engine = create_engine(url, connect_args=connect_args, **engine_kwargs)
    SQLModel.metadata.bind = engine
    SessionLocal = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    return engine, SessionLocal


# Provide a helper for production usage.
def init_db(url: str) -> Session:
    engine, SessionLocal = create_engine_and_session(url=url)
    SQLModel.metadata.create_all(engine)
    return SessionLocal()
