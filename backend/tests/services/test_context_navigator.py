from dataclasses import dataclass
from typing import List

from typing import Sequence

import pytest

from app.services.context_navigator import (
    ContextNavigator,
    ContextNavigatorConfig,
    ContextResult,
    SearchHit,
)
from app.services.vector_index import DistanceStrategy


class FakeVectorIndex:
    def __init__(self) -> None:
        self.requests: list[tuple[str, tuple[str, ...], int, DistanceStrategy]] = []

    async def search(
        self,
        query: str,
        *,
        entity_types: Sequence[str],
        limit: int,
        distance_strategy: DistanceStrategy,
    ) -> list[SearchHit]:
        self.requests.append((query, tuple(entity_types), limit, distance_strategy))
        entity_type = entity_types[0]
        if entity_type == "artifact":
            return [
                SearchHit(
                    id="1",
                    score=0.9,
                    payload={"title": "Artifact"},
                    entity_type="artifact",
                )
            ]
        if entity_type == "message":
            return [
                SearchHit(
                    id="2",
                    score=0.8,
                    payload={"content": "Message"},
                    entity_type="message",
                )
            ]
        return [
            SearchHit(
                id="3",
                score=0.7,
                payload={"text": "Structured"},
                entity_type="structured_entry",
            )
        ]


@pytest.mark.asyncio
async def test_navigator_queries_index_per_entity_type() -> None:
    index = FakeVectorIndex()
    navigator = ContextNavigator(
        vector_index=index,
        config=ContextNavigatorConfig(
            artifact_entity_type="artifact",
            message_entity_type="message",
            structured_entity_type="structured_entry",
            top_k_artifacts=1,
            top_k_messages=1,
            top_k_structured=1,
        ),
    )

    result = await navigator.collect("Hello world")

    assert index.requests == [
        ("Hello world", ("artifact",), 1, DistanceStrategy.COSINE),
        ("Hello world", ("message",), 1, DistanceStrategy.COSINE),
        ("Hello world", ("structured_entry",), 1, DistanceStrategy.COSINE),
    ]
    assert isinstance(result, ContextResult)
    assert result.artifacts[0].payload["title"] == "Artifact"
    assert result.messages[0].payload["content"] == "Message"
