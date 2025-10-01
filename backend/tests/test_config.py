"""Tests for backend configuration defaults."""
from app.config import Settings


def test_vllm_service_base_urls_default(monkeypatch):
    monkeypatch.delenv("KNOW_VLLM_EMBEDDING_BASE_URL", raising=False)
    monkeypatch.delenv("KNOW_VLLM_CHAT_BASE_URL", raising=False)

    settings = Settings(_env_file=None)

    assert settings.vllm_embedding_base_url == "http://ai-embeddings:8000"
    assert settings.vllm_chat_base_url == "http://ai-chat:8000"


def test_vllm_service_base_urls_override(monkeypatch):
    monkeypatch.setenv("KNOW_VLLM_EMBEDDING_BASE_URL", "http://localhost:9100")
    monkeypatch.setenv("KNOW_VLLM_CHAT_BASE_URL", "http://localhost:9200")

    settings = Settings(_env_file=None)

    assert settings.vllm_embedding_base_url == "http://localhost:9100"
    assert settings.vllm_chat_base_url == "http://localhost:9200"
