"""Entry point for the FastAPI backend service."""
from __future__ import annotations

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from sqlmodel import SQLModel

from .api.routes import create_router
from .api.session import SessionProvider
from .config import get_settings
from .database import create_engine_and_session
from .observability import configure_logging, configure_tracing


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    configure_tracing(
        service_name="live-knowledge-backend",
        jaeger_host=settings.jaeger_host,
        jaeger_port=settings.jaeger_port,
        otlp_endpoint=settings.otlp_endpoint,
    )

    engine, session_factory = create_engine_and_session(url=settings.database_url)
    session_provider = SessionProvider(session_factory)

    app = FastAPI(title="Live Knowledge Backend", version="0.1.0")
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.session_provider = session_provider
    FastAPIInstrumentor.instrument_app(app, tracer_provider=trace.get_tracer_provider())

    app.include_router(create_router(session_provider))

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.on_event("startup")
    def _create_tables() -> None:
        SQLModel.metadata.create_all(engine)

    return app


app = create_app()
