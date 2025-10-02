"""Helpers for working with database sessions in FastAPI dependencies."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


class SessionProvider:
    """Wrap an async ``sessionmaker`` to expose dependency-friendly interfaces."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    @asynccontextmanager
    async def session_scope(self) -> AsyncIterator[AsyncSession]:
        """Context manager yielding a managed SQLModel async session."""

        session: AsyncSession = self._session_factory()
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    async def dependency(self) -> AsyncIterator[AsyncSession]:
        """FastAPI dependency that yields a session and ensures cleanup."""

        async with self.session_scope() as session:
            yield session
