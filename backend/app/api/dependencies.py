"""Shared FastAPI dependencies for repositories and infrastructure."""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Depends, Request

from sqlalchemy.ext.asyncio import AsyncSession

from ..services.vector_index import EmbeddingClient
from .session import SessionProvider


def get_session_provider(request: Request) -> SessionProvider:
    provider = getattr(request.app.state, "session_provider", None)
    if provider is None:
        raise RuntimeError("Session provider is not configured")
    return provider


async def get_session(
    provider: SessionProvider = Depends(get_session_provider),
) -> AsyncIterator[AsyncSession]:
    async with provider.session_scope() as session:
        yield session


def get_embedding_client(request: Request) -> EmbeddingClient:
    client = getattr(request.app.state, "embedding_client", None)
    if client is None:
        raise RuntimeError("Embedding client is not configured")
    return client


def get_orchestrator(request: Request):
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if orchestrator is None:
        raise RuntimeError("Knowledge orchestrator is not configured")
    return orchestrator
