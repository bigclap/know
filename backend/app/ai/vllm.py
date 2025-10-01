"""Adapters for interacting with vLLM hosted Qwen models."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Mapping, MutableMapping, Optional, Sequence

import httpx


@dataclass(slots=True)
class _BaseClientConfig:
    base_url: str
    model: str
    timeout: Optional[float] = 30.0


class VLLMEmbeddingClient:
    """Fetch embeddings from a vLLM server."""

    def __init__(self, *, base_url: str, model: str, timeout: float | None = 30.0) -> None:
        self._config = _BaseClientConfig(base_url=base_url, model=model, timeout=timeout)

    async def embed(self, texts: Sequence[str]) -> List[List[float]]:
        if not texts:
            return []

        payload: MutableMapping[str, object] = {
            "model": self._config.model,
            "input": list(texts),
        }

        async with httpx.AsyncClient(base_url=self._config.base_url, timeout=self._config.timeout) as client:
            response = await client.post("/v1/embeddings", json=payload)

        if response.status_code != httpx.codes.OK:
            raise RuntimeError(
                f"Failed to obtain embeddings: status={response.status_code}, body={response.text}"
            )

        data = response.json()
        raw_embeddings = data.get("data", []) if isinstance(data, Mapping) else []
        embeddings: List[List[float]] = []
        for item in raw_embeddings:
            if isinstance(item, Mapping) and "embedding" in item:
                vector = item["embedding"]
                if isinstance(vector, Iterable):
                    embeddings.append([float(v) for v in vector])
        if not embeddings:
            raise RuntimeError("Embedding service returned no vectors")
        return embeddings


class VLLMChatClient:
    """Generate chat responses via a vLLM hosted Qwen model."""

    def __init__(self, *, base_url: str, model: str, timeout: float | None = 60.0) -> None:
        self._config = _BaseClientConfig(base_url=base_url, model=model, timeout=timeout)

    async def generate(self, messages: Sequence[Mapping[str, str]]) -> str:
        if not messages:
            raise ValueError("Chat completion requires at least one message")

        payload: MutableMapping[str, object] = {
            "model": self._config.model,
            "messages": [dict(message) for message in messages],
            "stream": False,
        }

        async with httpx.AsyncClient(base_url=self._config.base_url, timeout=self._config.timeout) as client:
            response = await client.post("/v1/chat/completions", json=payload)

        if response.status_code != httpx.codes.OK:
            raise RuntimeError(
                f"Failed to generate completion: status={response.status_code}, body={response.text}"
            )

        data = response.json()
        choices = data.get("choices", []) if isinstance(data, Mapping) else []
        if not choices:
            raise RuntimeError("Chat completion returned no choices")

        first_choice = choices[0]
        if not isinstance(first_choice, Mapping):
            raise RuntimeError("Chat completion response malformed")

        message = first_choice.get("message")
        if not isinstance(message, Mapping):
            raise RuntimeError("Chat completion message missing")

        content = message.get("content")
        if not isinstance(content, str):
            raise RuntimeError("Chat completion content missing")

        return content
