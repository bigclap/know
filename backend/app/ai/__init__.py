"""AI related adapters for external services."""

from .vllm import VLLMChatClient, VLLMEmbeddingClient

__all__ = ["VLLMChatClient", "VLLMEmbeddingClient"]
