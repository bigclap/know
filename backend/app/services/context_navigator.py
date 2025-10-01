"""Context retrieval service that leverages embeddings and vector search."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

from .search_types import SearchHit, VectorIndex
from .vector_index import DistanceStrategy


@dataclass(slots=True)
class ContextResult:
    """Aggregated context slices used for generation."""

    query: str
    artifacts: list[SearchHit]
    messages: list[SearchHit]
    structured_entries: list[SearchHit]


@dataclass(slots=True)
class ContextNavigatorConfig:
    artifact_entity_type: str
    message_entity_type: str
    structured_entity_type: str
    top_k_artifacts: int = 5
    top_k_messages: int = 5
    top_k_structured: int = 5
    distance_strategy: DistanceStrategy = DistanceStrategy.COSINE


class ContextNavigator:
    """Collect semantic context using embeddings and a vector index."""

    def __init__(
        self,
        *,
        vector_index: VectorIndex,
        config: ContextNavigatorConfig,
    ) -> None:
        self._index = vector_index
        self._config = config

    async def collect(self, query: str) -> ContextResult:
        artifacts = await self._search(
            query=query,
            entity_type=self._config.artifact_entity_type,
            limit=self._config.top_k_artifacts,
        )
        messages = await self._search(
            query=query,
            entity_type=self._config.message_entity_type,
            limit=self._config.top_k_messages,
        )
        structured = await self._search(
            query=query,
            entity_type=self._config.structured_entity_type,
            limit=self._config.top_k_structured,
        )

        return ContextResult(
            query=query,
            artifacts=artifacts,
            messages=messages,
            structured_entries=structured,
        )

    async def _search(self, *, query: str, entity_type: str, limit: int) -> list[SearchHit]:
        if limit <= 0:
            return []
        raw_results = await self._index.search(
            query,
            entity_types=[entity_type],
            limit=limit,
            distance_strategy=self._config.distance_strategy,
        )
        hits = [_coerce_hit(result, default_entity_type=entity_type) for result in raw_results]
        return hits[:limit]


def _coerce_hit(result: SearchHit | Mapping[str, object], *, default_entity_type: str) -> SearchHit:
    if isinstance(result, SearchHit):
        return result

    if isinstance(result, Mapping):
        identifier = result.get("id")
        score = result.get("score")
        payload = result.get("payload")
        entity_type = result.get("entity_type")
    else:
        identifier = getattr(result, "id", None)
        score = getattr(result, "score", None)
        payload = getattr(result, "payload", {})
        entity_type = getattr(result, "entity_type", None)

    if not isinstance(identifier, str) or not isinstance(score, (int, float)):
        raise TypeError("Vector index result missing id or score")
    if not isinstance(payload, Mapping):
        payload = {}
    if not isinstance(entity_type, str):
        entity_type = default_entity_type

    return SearchHit(id=identifier, score=float(score), payload=payload, entity_type=entity_type)
