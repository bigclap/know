"""Helpers for working with database sessions in FastAPI dependencies."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy.orm import sessionmaker
from sqlmodel import Session


class SessionProvider:
    """Wrap a ``sessionmaker`` to expose dependency-friendly interfaces."""

    def __init__(self, session_factory: sessionmaker) -> None:
        self._session_factory = session_factory

    @contextmanager
    def session_scope(self) -> Iterator[Session]:
        """Context manager yielding a managed SQLModel session."""

        session: Session = self._session_factory()
        try:
            yield session
        finally:
            session.close()

    def dependency(self) -> Iterator[Session]:
        """FastAPI dependency that yields a session and ensures cleanup."""

        with self.session_scope() as session:
            yield session
