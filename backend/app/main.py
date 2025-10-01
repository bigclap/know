"""Entry point for the FastAPI backend service."""
from __future__ import annotations

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from sqlmodel import SQLModel

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

    app = FastAPI(title="Live Knowledge Backend", version="0.1.0")
    FastAPIInstrumentor.instrument_app(app, tracer_provider=trace.get_tracer_provider())

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.on_event("startup")
    def _create_tables() -> None:
        engine, _ = create_engine_and_session(url=settings.database_url)
        SQLModel.metadata.create_all(engine)

    return app


app = create_app()
