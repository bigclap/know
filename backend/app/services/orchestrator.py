"""Orchestrator that fuses context retrieval and generation."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Protocol, Sequence

from .context_navigator import ContextNavigator, ContextResult, SearchHit


class ChatClient(Protocol):
    async def generate(self, messages: Sequence[Mapping[str, str]]) -> str: ...


@dataclass(slots=True)
class GenerationRequest:
    user_message: str
    conversation_history: Sequence[Mapping[str, str]] = ()
    system_prompt: str | None = None


@dataclass(slots=True)
class GenerationResponse:
    content: str
    context: ContextResult


class KnowledgeOrchestrator:
    """Coordinates context navigation and response generation."""

    def __init__(self, *, chat_client: ChatClient, navigator: ContextNavigator) -> None:
        self._chat_client = chat_client
        self._navigator = navigator

    async def respond(self, request: GenerationRequest) -> GenerationResponse:
        context = await self._navigator.collect(request.user_message)
        system_prompt = request.system_prompt or _render_system_prompt(context)

        messages: list[Mapping[str, str]] = [{"role": "system", "content": system_prompt}]
        messages.extend(dict(item) for item in request.conversation_history)
        messages.append({"role": "user", "content": request.user_message})

        content = await self._chat_client.generate(messages)
        return GenerationResponse(content=content, context=context)


def _render_system_prompt(context: ContextResult) -> str:
    sections = [
        "You are the Live Knowledge assistant. Use the provided context to answer clearly and update knowledge structures when appropriate.",
        _render_section("Artifacts", context.artifacts),
        _render_section("Messages", context.messages),
        _render_section("Structured Entries", context.structured_entries),
    ]
    return "\n\n".join(section for section in sections if section)


def _render_section(title: str, hits: Iterable[SearchHit]) -> str:
    lines = []
    for hit in hits:
        summary = _summarise_payload(hit.payload)
        lines.append(f"- score={hit.score:.2f} id={hit.id} {summary}")
    if not lines:
        return ""
    joined = "\n".join(lines)
    return f"{title}:\n{joined}"


def _summarise_payload(payload: Mapping[str, object]) -> str:
    if not payload:
        return ""
    parts = []
    for key, value in payload.items():
        parts.append(f"{key}={value}")
    return "; ".join(parts)
