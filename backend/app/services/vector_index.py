"""Vector index implementations used by the AI services."""
from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Iterable, Mapping, Sequence, Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.sql import Select
from sqlmodel import SQLModel

from ..models import Artifact, Message, StructuredEntry
from .search_types import SearchHit, VectorIndex


class DistanceStrategy(str, Enum):
    COSINE = "cosine_distance"
    L2 = "l2_distance"


class EmbeddingClient(Protocol):
    async def embed(self, texts: Sequence[str]) -> Sequence[Sequence[float]]: ...


@dataclass(frozen=True)
class EntityConfig:
    model: type[SQLModel]
    id_attribute: str
    vector_attribute: str
    payload_factory: Callable[[SQLModel], Mapping[str, object]]


_DEFAULT_ENTITY_CONFIG: Mapping[str, EntityConfig] = {
    "artifact": EntityConfig(
        model=Artifact,
        id_attribute="id",
        vector_attribute="summary_vector",
        payload_factory=lambda instance: {
            "title": getattr(instance, "title", ""),
            "summary": getattr(instance, "summary", ""),
            "parent_artifact_id": getattr(instance, "parent_artifact_id", None),
        },
    ),
    "message": EntityConfig(
        model=Message,
        id_attribute="id",
        vector_attribute="content_vector",
        payload_factory=lambda instance: {
            "artifact_id": getattr(instance, "artifact_id", None),
            "sender": getattr(instance, "sender", None),
            "content": getattr(instance, "content", ""),
        },
    ),
    "structured_entry": EntityConfig(
        model=StructuredEntry,
        id_attribute="id",
        vector_attribute="text_representation_vector",
        payload_factory=lambda instance: {
            "artifact_id": getattr(instance, "artifact_id", None),
            "schema_id": getattr(instance, "schema_id", None),
            "text_representation": getattr(instance, "text_representation", ""),
        },
    ),
}


class PGVectorIndex(VectorIndex):
    """Run semantic search queries against the application's database."""

    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession],
        embedding_client: EmbeddingClient,
        entity_config: Mapping[str, EntityConfig] | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._embedding = embedding_client
        self._entity_config = dict(entity_config or _DEFAULT_ENTITY_CONFIG)

    async def search(
        self,
        query: str,
        *,
        entity_types: Sequence[str],
        limit: int,
        distance_strategy: DistanceStrategy = DistanceStrategy.COSINE,
    ) -> list[SearchHit]:
        if not query or limit <= 0:
            return []

        vectors = await self._embedding.embed([query])
        if not vectors:
            raise RuntimeError("Embedding client returned no vectors for query")
        query_vector = list(vectors[0])

        hits: list[SearchHit] = []
        async with self._session_factory() as session:
            for entity_type in entity_types:
                config = self._entity_config.get(entity_type)
                if not config:
                    continue
                rows = await self._load_candidates(
                    session=session,
                    config=config,
                    limit=limit,
                    query_vector=query_vector,
                    strategy=distance_strategy,
                )
                hits.extend(
                    self._score_candidates(
                        candidates=rows,
                        config=config,
                        entity_type=entity_type,
                        query_vector=query_vector,
                        strategy=distance_strategy,
                    )
                )

        hits.sort(key=lambda item: item.score, reverse=True)
        return hits[:limit]

    async def _load_candidates(
        self,
        *,
        session: AsyncSession,
        config: EntityConfig,
        limit: int,
        query_vector: Sequence[float],
        strategy: DistanceStrategy,
    ) -> Sequence[SQLModel]:
        column = getattr(config.model, config.vector_attribute)
        statement: Select[tuple[SQLModel]] = select(config.model).where(column.is_not(None))
        if self._supports_database_vectors(session):
            distance_expression = self._build_distance_expression(
                column=column,
                query_vector=query_vector,
                strategy=strategy,
            )
            statement = statement.order_by(distance_expression).limit(limit)
        result = await session.execute(statement)
        return result.scalars().all()

    @staticmethod
    def _supports_database_vectors(session: AsyncSession) -> bool:
        bind = session.bind
        if bind is None:  # pragma: no cover - defensive guard
            return False
        return getattr(bind.dialect, "name", "") == "postgresql"

    @staticmethod
    def _build_distance_expression(
        *, column, query_vector: Sequence[float], strategy: DistanceStrategy
    ):
        try:
            distance_callable = getattr(column, strategy.value)
        except AttributeError as exc:  # pragma: no cover - database misconfiguration
            raise RuntimeError(
                f"Vector column does not support distance strategy {strategy}"
            ) from exc
        return distance_callable(list(query_vector))

    def _score_candidates(
        self,
        *,
        candidates: Iterable[SQLModel],
        config: EntityConfig,
        entity_type: str,
        query_vector: Sequence[float],
        strategy: DistanceStrategy,
    ) -> list[SearchHit]:
        hits: list[SearchHit] = []
        for candidate in candidates:
            candidate_vector = getattr(candidate, config.vector_attribute, None)
            if not candidate_vector:
                continue
            score = _compute_similarity(query_vector, candidate_vector, strategy)
            payload = dict(config.payload_factory(candidate))
            hits.append(
                SearchHit(
                    id=str(getattr(candidate, config.id_attribute)),
                    score=score,
                    payload=payload,
                    entity_type=entity_type,
                )
            )
        return hits


def _compute_similarity(
    query_vector: Sequence[float],
    candidate_vector: Sequence[float],
    strategy: DistanceStrategy,
) -> float:
    if strategy is DistanceStrategy.COSINE:
        return _cosine_similarity(query_vector, candidate_vector)
    if strategy is DistanceStrategy.L2:
        return _l2_similarity(query_vector, candidate_vector)
    raise ValueError(f"Unsupported distance strategy: {strategy}")


def _cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    similarity = dot / (norm_a * norm_b)
    similarity = max(-1.0, min(1.0, similarity))
    # Normalize from [-1, 1] to [0, 1]
    return 0.5 * (similarity + 1.0)


def _l2_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    distance = math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))
    return 1.0 / (1.0 + distance)


class NullVectorIndex(VectorIndex):
    """Fallback vector index that returns no results."""

    async def search(
        self,
        query: str,
        *,
        entity_types: Sequence[str],
        limit: int,
        distance_strategy: DistanceStrategy,
    ) -> list[SearchHit]:
        return []


__all__ = ["DistanceStrategy", "EntityConfig", "NullVectorIndex", "PGVectorIndex"]
