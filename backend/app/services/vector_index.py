"""Vector index implementations used by the AI services."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Mapping, Sequence

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from .. import models
from .context_navigator import SearchHit, VectorIndex


class NullVectorIndex(VectorIndex):
    """Fallback vector index that returns no results.

    This keeps the orchestration pipeline operational even when a real
    similarity search backend is not yet configured.
    """

    async def search(
        self, namespace: str, vector: Sequence[float], limit: int
    ) -> Sequence[SearchHit]:
        return []


class PGVectorIndex(VectorIndex):
    """Vector index that queries a PostgreSQL database using the pgvector extension."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def search(
        self, namespace: str, vector: Sequence[float], limit: int
    ) -> Sequence[Mapping[str, object]]:
        if namespace not in _NAMESPACE_MAP:
            raise ValueError(f"Unknown vector search namespace: {namespace}")
        config = _NAMESPACE_MAP[namespace]
        query = text(
            f"""
            SELECT
                id,
                l2_distance({config.vector_column}, :vector) AS distance
            FROM {config.table}
            ORDER BY distance
            LIMIT :limit
            """
        )
        results = await self._session.execute(
            query,
            {"vector": json.dumps(list(vector)), "limit": limit},
        )
        return results.mappings().all()


@dataclass(slots=True)
class _TableConfig:
    table: str
    vector_column: str


_NAMESPACE_MAP = {
    "artifacts": _TableConfig(
        table="artifacts",
        vector_column="summary_vector",
    ),
    "messages": _TableConfig(
        table="messages",
        vector_column="content_vector",
    ),
    "structured_entries": _TableConfig(
        table="structured_entries",
        vector_column="text_representation_vector",
    ),
}


__all__ = ["NullVectorIndex", "PGVectorIndex"]
