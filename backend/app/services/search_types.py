"""Shared types for vector search operations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Protocol, Sequence


@dataclass(slots=True)
class SearchHit:
    id: str
    score: float
    payload: Mapping[str, object]
    entity_type: str


class VectorIndex(Protocol):
    async def search(
        self,
        query: str,
        *,
        entity_types: Sequence[str],
        limit: int,
        distance_strategy: object,
    ) -> Sequence[SearchHit] | Sequence[Mapping[str, object]]:
        ...
