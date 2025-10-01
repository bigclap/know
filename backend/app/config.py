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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
