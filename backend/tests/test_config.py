"""Tests for backend configuration defaults."""
from app.config import Settings


def test_vllm_service_base_urls_default(monkeypatch):
    monkeypatch.delenv("KNOW_VLLM_EMBEDDING_BASE_URL", raising=False)
    monkeypatch.delenv("KNOW_VLLM_CHAT_BASE_URL", raising=False)

    settings = Settings(_env_file=None)

    assert settings.vllm_embedding_base_url == "http://ai-embeddings:8000"
    assert settings.vllm_chat_base_url == "http://ai-chat:8000"
    assert settings.vllm_embedding_model == "Qwen/Qwen3-Embedding-8B"
    assert settings.vllm_chat_model == "Qwen/Qwen3-Omni-30B-A3B-Instruct"
    assert settings.context_top_k_artifacts == 5
    assert settings.context_top_k_messages == 5
    assert settings.context_top_k_structured == 5


def test_vllm_service_base_urls_override(monkeypatch):
    monkeypatch.setenv("KNOW_VLLM_EMBEDDING_BASE_URL", "http://localhost:9100")
    monkeypatch.setenv("KNOW_VLLM_CHAT_BASE_URL", "http://localhost:9200")
    monkeypatch.setenv("KNOW_VLLM_EMBEDDING_MODEL", "local-embed")
    monkeypatch.setenv("KNOW_VLLM_CHAT_MODEL", "local-chat")
    monkeypatch.setenv("KNOW_CONTEXT_TOP_K_ARTIFACTS", "3")
    monkeypatch.setenv("KNOW_CONTEXT_TOP_K_MESSAGES", "4")
    monkeypatch.setenv("KNOW_CONTEXT_TOP_K_STRUCTURED", "2")

    settings = Settings(_env_file=None)

    assert settings.vllm_embedding_base_url == "http://localhost:9100"
    assert settings.vllm_chat_base_url == "http://localhost:9200"
    assert settings.vllm_embedding_model == "local-embed"
    assert settings.vllm_chat_model == "local-chat"
    assert settings.context_top_k_artifacts == 3
    assert settings.context_top_k_messages == 4
    assert settings.context_top_k_structured == 2
