import pytest

from app.services.context_navigator import ContextResult, SearchHit
from app.services.orchestrator import GenerationRequest, KnowledgeOrchestrator


class FakeNavigator:
    async def collect(self, message: str) -> ContextResult:
        return ContextResult(
            query=message,
            artifacts=[
                SearchHit(
                    id="a1",
                    score=0.9,
                    payload={"title": "Artifact A", "summary": "Summary"},
                    entity_type="artifact",
                )
            ],
            messages=[
                SearchHit(
                    id="m1",
                    score=0.8,
                    payload={"content": "Message content"},
                    entity_type="message",
                )
            ],
            structured_entries=[
                SearchHit(
                    id="s1",
                    score=0.7,
                    payload={"text": "Structured"},
                    entity_type="structured_entry",
                )
            ],
        )


class FakeChatClient:
    def __init__(self) -> None:
        self.calls: list[list[dict[str, str]]] = []

    async def generate(self, messages: list[dict[str, str]]) -> str:
        self.calls.append(messages)
        return "Assistant response"


@pytest.mark.asyncio
async def test_orchestrator_builds_prompt_from_context() -> None:
    navigator = FakeNavigator()
    chat = FakeChatClient()
    orchestrator = KnowledgeOrchestrator(chat_client=chat, navigator=navigator)

    request = GenerationRequest(user_message="Tell me about the project")
    response = await orchestrator.respond(request)

    assert response.content == "Assistant response"
    assert chat.calls
    prompt_messages = chat.calls[0]
    assert prompt_messages[0]["role"] == "system"
    assert "Artifact A" in prompt_messages[0]["content"]
    assert prompt_messages[-1]["content"] == "Tell me about the project"
