from dataclasses import dataclass
from typing import List

import pytest

from app.services.context_navigator import ContextNavigator, ContextNavigatorConfig, ContextResult


class FakeEmbeddingClient:
    def __init__(self) -> None:
        self.calls: List[List[str]] = []

    async def embed(self, texts: List[str]) -> List[List[float]]:
        self.calls.append(texts)
        return [[0.1, 0.2, 0.3]]


@dataclass
class FakeSearchResult:
    id: str
    score: float
    payload: dict


class FakeVectorIndex:
    def __init__(self) -> None:
        self.requests: list[tuple[str, List[float], int]] = []

    async def search(self, namespace: str, vector: List[float], limit: int) -> List[FakeSearchResult]:
        self.requests.append((namespace, vector, limit))
        if namespace == "artifacts":
            return [
                FakeSearchResult(id="1", score=0.9, payload={"title": "Artifact"}),
            ]
        if namespace == "messages":
            return [
                FakeSearchResult(id="2", score=0.8, payload={"content": "Message"}),
            ]
        return [
            FakeSearchResult(id="3", score=0.7, payload={"text": "Structured"}),
        ]


@pytest.mark.asyncio
async def test_navigator_embeds_and_queries_index() -> None:
    embedding = FakeEmbeddingClient()
    index = FakeVectorIndex()
    navigator = ContextNavigator(
        embedding_client=embedding,
        vector_index=index,
        config=ContextNavigatorConfig(
            artifact_namespace="artifacts",
            message_namespace="messages",
            structured_namespace="structured_entries",
            top_k_artifacts=1,
            top_k_messages=1,
            top_k_structured=1,
        ),
    )

    result = await navigator.collect("Hello world")

    assert embedding.calls == [["Hello world"]]
    assert index.requests == [
        ("artifacts", [0.1, 0.2, 0.3], 1),
        ("messages", [0.1, 0.2, 0.3], 1),
        ("structured_entries", [0.1, 0.2, 0.3], 1),
    ]
    assert isinstance(result, ContextResult)
    assert result.artifacts[0].payload["title"] == "Artifact"
    assert result.messages[0].payload["content"] == "Message"
