"""Vector index implementations used by the AI services."""
from __future__ import annotations

from typing import Sequence

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


__all__ = ["NullVectorIndex"]
