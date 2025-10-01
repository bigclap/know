import pytest
import respx
from httpx import Response
from respx import MockRouter

from app.ai.vllm import VLLMChatClient, VLLMEmbeddingClient


@pytest.mark.asyncio
@respx.mock
async def test_embedding_client_returns_vectors(respx_mock: MockRouter) -> None:
    route = respx_mock.post("http://llm/v1/embeddings").mock(
        return_value=Response(
            200,
            json={
                "data": [
                    {"embedding": [0.1, 0.2, 0.3]},
                    {"embedding": [0.4, 0.5, 0.6]},
                ]
            },
        )
    )

    client = VLLMEmbeddingClient(base_url="http://llm", model="qwen3-embedding")

    vectors = await client.embed(["hello", "world"])

    assert route.called
    assert vectors == [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]


@pytest.mark.asyncio
@respx.mock
async def test_embedding_client_raises_on_error(respx_mock: MockRouter) -> None:
    respx_mock.post("http://llm/v1/embeddings").mock(return_value=Response(500, json={"error": "boom"}))
    client = VLLMEmbeddingClient(base_url="http://llm", model="qwen3-embedding")

    with pytest.raises(RuntimeError):
        await client.embed(["text"])


@pytest.mark.asyncio
@respx.mock
async def test_chat_client_returns_content(respx_mock: MockRouter) -> None:
    route = respx_mock.post("http://llm/v1/chat/completions").mock(
        return_value=Response(
            200,
            json={
                "choices": [
                    {
                        "message": {"role": "assistant", "content": "Hello there"},
                    }
                ]
            },
        )
    )

    client = VLLMChatClient(base_url="http://llm", model="qwen3-30b-a3")

    content = await client.generate([
        {"role": "system", "content": "Be concise."},
        {"role": "user", "content": "Hi"},
    ])

    assert route.called
    assert content == "Hello there"


@pytest.mark.asyncio
@respx.mock
async def test_chat_client_raises_on_missing_choices(respx_mock: MockRouter) -> None:
    respx_mock.post("http://llm/v1/chat/completions").mock(return_value=Response(200, json={"choices": []}))
    client = VLLMChatClient(base_url="http://llm", model="qwen3-30b-a3")

    with pytest.raises(RuntimeError):
        await client.generate([
            {"role": "system", "content": "Be concise."},
            {"role": "user", "content": "Hi"},
        ])
