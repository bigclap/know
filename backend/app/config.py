"""Configuration primitives for the backend service."""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application level configuration sourced from environment variables."""

    model_config = SettingsConfigDict(env_prefix="KNOW_", env_file=".env", env_file_encoding="utf-8")

    database_url: str = (
        "postgresql+psycopg://postgres:postgres@postgres:5432/knowledge"
    )
    otlp_endpoint: Optional[str] = None
    jaeger_host: str = "jaeger"
    jaeger_port: int = 6831
    vllm_embedding_base_url: str = "http://ai-embeddings:8000"
    vllm_chat_base_url: str = "http://ai-chat:8000"
    vllm_embedding_model: str = "Qwen/Qwen3-Embedding-8B"
    vllm_chat_model: str = "Qwen/Qwen3-Omni-30B-A3B-Instruct"
    context_top_k_artifacts: int = 5
    context_top_k_messages: int = 5
    context_top_k_structured: int = 5


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
