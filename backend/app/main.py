"""Entry point for the FastAPI backend service."""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from sqlmodel import SQLModel

from .api.routes import create_router
from .api.session import SessionProvider
from .ai.vllm import VLLMChatClient, VLLMEmbeddingClient
from .config import Settings, get_settings
from .database import create_engine_and_session, ensure_vector_extension
from .observability import configure_logging, configure_tracing
from .services import ContextNavigator, ContextNavigatorConfig, KnowledgeOrchestrator
from .services.vector_index import PGVectorIndex


def create_app(*, orchestrator: Optional[KnowledgeOrchestrator] = None) -> FastAPI:
    settings = get_settings()
    configure_logging()
    configure_tracing(
        service_name="live-knowledge-backend",
        jaeger_host=settings.jaeger_host,
        jaeger_port=settings.jaeger_port,
        otlp_endpoint=settings.otlp_endpoint,
    )

    engine, session_factory = create_engine_and_session(
        url=settings.database_url, is_async=True
    )
    session_provider = SessionProvider(session_factory)
    orchestrator_instance = orchestrator or _build_default_orchestrator(
        settings, session_provider
    )

    app = FastAPI(title="Live Knowledge Backend", version="0.1.0")
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.session_provider = session_provider
    app.state.orchestrator = orchestrator_instance
    FastAPIInstrumentor.instrument_app(app, tracer_provider=trace.get_tracer_provider())

    app.include_router(create_router(session_provider, orchestrator_instance))

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.on_event("startup")
    def _create_tables() -> None:
        ensure_vector_extension(engine)
        SQLModel.metadata.create_all(engine)

    return app


def _build_default_orchestrator(
    settings: Settings, session_provider: SessionProvider
) -> KnowledgeOrchestrator:
    embedding_client = VLLMEmbeddingClient(
        base_url=settings.vllm_embedding_base_url,
        model=settings.vllm_embedding_model,
    )
    chat_client = VLLMChatClient(
        base_url=settings.vllm_chat_base_url,
        model=settings.vllm_chat_model,
    )
    navigator = ContextNavigator(
        embedding_client=embedding_client,
        vector_index=PGVectorIndex(session_provider.get_session()),
        config=ContextNavigatorConfig(
            artifact_namespace="artifacts",
            message_namespace="messages",
            structured_namespace="structured_entries",
            top_k_artifacts=settings.context_top_k_artifacts,
            top_k_messages=settings.context_top_k_messages,
            top_k_structured=settings.context_top_k_structured,
        ),
    )
    return KnowledgeOrchestrator(chat_client=chat_client, navigator=navigator)


app = create_app()
