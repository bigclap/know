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
from .database import create_async_engine_and_session
from .observability import configure_logging, configure_tracing
from .services import ContextNavigator, ContextNavigatorConfig, KnowledgeOrchestrator
from .services.vector_index import DistanceStrategy, PGVectorIndex


def create_app(*, orchestrator: Optional[KnowledgeOrchestrator] = None) -> FastAPI:
    settings = get_settings()
    configure_logging()
    configure_tracing(
        service_name="live-knowledge-backend",
        jaeger_host=settings.jaeger_host,
        jaeger_port=settings.jaeger_port,
        otlp_endpoint=settings.otlp_endpoint,
    )

    engine, session_factory = create_async_engine_and_session(url=settings.database_url)
    session_provider = SessionProvider(session_factory)
    embedding_client = VLLMEmbeddingClient(
        base_url=settings.vllm_embedding_base_url,
        model=settings.vllm_embedding_model,
    )
    orchestrator_instance = orchestrator or _build_default_orchestrator(
        settings=settings,
        session_factory=session_factory,
        embedding_client=embedding_client,
    )

    app = FastAPI(title="Live Knowledge Backend", version="0.1.0")
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.session_provider = session_provider
    app.state.orchestrator = orchestrator_instance
    app.state.embedding_client = embedding_client
    FastAPIInstrumentor.instrument_app(app, tracer_provider=trace.get_tracer_provider())

    app.include_router(create_router(session_provider, orchestrator_instance))

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.on_event("startup")
    async def _create_tables() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(SQLModel.metadata.create_all)

    return app


def _build_default_orchestrator(
    *,
    settings: Settings,
    session_factory,
    embedding_client: VLLMEmbeddingClient,
) -> KnowledgeOrchestrator:
    chat_client = VLLMChatClient(
        base_url=settings.vllm_chat_base_url,
        model=settings.vllm_chat_model,
    )
    vector_index = PGVectorIndex(session_factory=session_factory, embedding_client=embedding_client)
    navigator = ContextNavigator(
        vector_index=vector_index,
        config=ContextNavigatorConfig(
            artifact_entity_type="artifact",
            message_entity_type="message",
            structured_entity_type="structured_entry",
            top_k_artifacts=settings.context_top_k_artifacts,
            top_k_messages=settings.context_top_k_messages,
            top_k_structured=settings.context_top_k_structured,
            distance_strategy=DistanceStrategy.COSINE,
        ),
    )
    return KnowledgeOrchestrator(chat_client=chat_client, navigator=navigator)


app = create_app()
