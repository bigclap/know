"""Logging and tracing configuration helpers."""
from __future__ import annotations

import logging
import logging.config
from typing import Optional

from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter


LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "class": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "level": "INFO",
        }
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}


def configure_logging() -> None:
    """Configure structured logging for the service."""

    logging.config.dictConfig(LOGGING_CONFIG)


def configure_tracing(
    *,
    service_name: str,
    jaeger_host: str,
    jaeger_port: int,
    otlp_endpoint: Optional[str] = None,
) -> None:
    """Configure OpenTelemetry tracing with Jaeger fallback."""

    resource = Resource(attributes={SERVICE_NAME: service_name})
    provider = TracerProvider(resource=resource)

    if otlp_endpoint:
        exporter = OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
    else:
        exporter = JaegerExporter(agent_host_name=jaeger_host, agent_port=jaeger_port)

    provider.add_span_processor(BatchSpanProcessor(exporter))
    # Always include console exporter for local debugging.
    provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)
