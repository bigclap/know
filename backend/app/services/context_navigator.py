"""Context retrieval service that leverages embeddings and vector search."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Protocol, Sequence


class EmbeddingClient(Protocol):
    async def embed(self, texts: Sequence[str]) -> Sequence[Sequence[float]]: ...


class VectorIndex(Protocol):
    async def search(
        self, namespace: str, vector: Sequence[float], limit: int
    ) -> Sequence["SearchHit"] | Sequence[Mapping[str, object]]: ...


@dataclass(slots=True)
class SearchHit:
    """Structured representation of a vector search result."""

    id: str
    score: float
    payload: Mapping[str, object]


@dataclass(slots=True)
class ContextResult:
    """Aggregated context slices used for generation."""

    query: str
    artifacts: list[SearchHit]
    messages: list[SearchHit]
    structured_entries: list[SearchHit]


@dataclass(slots=True)
class ContextNavigatorConfig:
    artifact_namespace: str
    message_namespace: str
    structured_namespace: str
    top_k_artifacts: int = 5
    top_k_messages: int = 5
    top_k_structured: int = 5


class ContextNavigator:
    """Collect semantic context using embeddings and a vector index."""

    def __init__(
        self,
        *,
        embedding_client: EmbeddingClient,
        vector_index: VectorIndex,
        config: ContextNavigatorConfig,
    ) -> None:
        self._embedding = embedding_client
        self._index = vector_index
        self._config = config

    async def collect(self, query: str) -> ContextResult:
        vectors = await self._embedding.embed([query])
        if not vectors:
            raise RuntimeError("Embedding client returned no vectors for query")
        vector = list(vectors[0])

        artifacts = await self._search(
            namespace=self._config.artifact_namespace,
            vector=vector,
            limit=self._config.top_k_artifacts,
        )
        messages = await self._search(
            namespace=self._config.message_namespace,
            vector=vector,
            limit=self._config.top_k_messages,
        )
        structured = await self._search(
            namespace=self._config.structured_namespace,
            vector=vector,
            limit=self._config.top_k_structured,
        )

        return ContextResult(
            query=query,
            artifacts=artifacts,
            messages=messages,
            structured_entries=structured,
        )

    async def _search(self, *, namespace: str, vector: Sequence[float], limit: int) -> list[SearchHit]:
        if limit <= 0:
            return []
        raw_results = await self._index.search(namespace, vector, limit)
        hits = [_coerce_hit(result) for result in raw_results]
        return hits[:limit]


def _coerce_hit(result: SearchHit | Mapping[str, object]) -> SearchHit:
    if isinstance(result, SearchHit):
        return result

    if isinstance(result, Mapping):
        identifier = result.get("id")
        score = result.get("score")
        payload = result.get("payload")
    else:
        identifier = getattr(result, "id", None)
        score = getattr(result, "score", None)
        payload = getattr(result, "payload", {})

    if not isinstance(identifier, str) or not isinstance(score, (int, float)):
        raise TypeError("Vector index result missing id or score")
    if not isinstance(payload, Mapping):
        payload = {}

    return SearchHit(id=identifier, score=float(score), payload=payload)
