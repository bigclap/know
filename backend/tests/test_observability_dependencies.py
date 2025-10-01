"""Tests for observability module dependencies."""

import importlib


def test_jaeger_exporter_dependency_is_available() -> None:
    """Jaeger exporter module should be importable with all dependencies."""

    module = importlib.import_module("opentelemetry.exporter.jaeger.thrift")

    assert hasattr(module, "JaegerExporter"), "JaegerExporter must be provided by the jaeger exporter module."
