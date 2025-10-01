"""API routers for the backend application."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Message
from ..repositories import ArtifactRepository, LinkRepository, MessageRepository
from ..services.context_navigator import ContextResult, SearchHit
from ..services.orchestrator import GenerationRequest, KnowledgeOrchestrator
from ..services.vector_index import EmbeddingClient
from .dependencies import get_embedding_client, get_orchestrator, get_session
from .schemas import (
    ArtifactChildSummary,
    ArtifactDetailResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    ChatResponse,
    ContextResponse,
    LinkCreateRequest,
    LinkResponse,
    SearchHitResponse,
    StructuredEntryResponse,
)
from .session import SessionProvider


def _sorted_by_created(items: list[Any]) -> list[Any]:
    return sorted(items, key=lambda item: getattr(item, "created_at", datetime.min))


def create_router(session_provider: SessionProvider, orchestrator: KnowledgeOrchestrator) -> APIRouter:
    """Build an ``APIRouter`` wired with repository dependencies."""

    router = APIRouter()

    @router.post("/chat/message", response_model=ChatResponse)
    async def post_chat_message(
        payload: ChatMessageRequest,
        session: AsyncSession = Depends(get_session),
        ai_orchestrator: KnowledgeOrchestrator = Depends(get_orchestrator),
        embedding_client: EmbeddingClient = Depends(get_embedding_client),
    ) -> ChatResponse:
        artifact_repo = ArtifactRepository(session=session, embedding_client=embedding_client)
        message_repo = MessageRepository(session=session, embedding_client=embedding_client)

        artifact = await artifact_repo.get(payload.artifact_id)
        if artifact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

        history_messages = await message_repo.list_for_artifact(artifact_id=artifact.id)
        conversation_history = tuple(_message_to_prompt_dict(message) for message in history_messages)

        user_message = await message_repo.create(
            artifact=artifact,
            content=payload.content,
            sender=payload.sender,
        )

        generation = await ai_orchestrator.respond(
            GenerationRequest(
                user_message=user_message.content,
                conversation_history=conversation_history,
            )
        )

        assistant_message = await message_repo.create(
            artifact=artifact,
            content=generation.content,
            sender="assistant",
        )

        return ChatResponse(
            user_message=ChatMessageResponse.model_validate(user_message),
            assistant_message=ChatMessageResponse.model_validate(assistant_message),
            context=_map_context_result(generation.context),
        )

    @router.get("/artifacts/{artifact_id}", response_model=ArtifactDetailResponse)
    async def get_artifact(
        artifact_id: UUID,
        session: AsyncSession = Depends(get_session),
    ) -> ArtifactDetailResponse:
        repo = ArtifactRepository(session=session)
        artifact = await repo.get_with_related(artifact_id)
        if artifact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

        children = [ArtifactChildSummary.model_validate(child) for child in _sorted_by_created(list(artifact.children))]
        messages = [ChatMessageResponse.model_validate(message) for message in _sorted_by_created(list(artifact.messages))]
        structured_entries = [
            StructuredEntryResponse.model_validate(entry)
            for entry in _sorted_by_created(list(artifact.structured_entries))
        ]

        return ArtifactDetailResponse(
            id=artifact.id,
            title=artifact.title,
            summary=artifact.summary,
            parent_artifact_id=artifact.parent_artifact_id,
            children=children,
            messages=messages,
            structured_entries=structured_entries,
        )

    @router.post(
        "/artifacts/{artifact_id}/links",
        status_code=status.HTTP_201_CREATED,
        response_model=LinkResponse,
    )
    async def create_link(
        artifact_id: UUID,
        payload: LinkCreateRequest,
        session: AsyncSession = Depends(get_session),
    ) -> LinkResponse:
        artifact_repo = ArtifactRepository(session=session)
        if await artifact_repo.get(artifact_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

        link_repo = LinkRepository(session=session)
        link = await link_repo.create(
            source_type="artifact",
            source_id=artifact_id,
            target_type=payload.target_entity_type,
            target_id=UUID(payload.target_entity_id),
            link_type=payload.link_type,
            description=payload.description,
        )

        return LinkResponse.model_validate(link)

    @router.websocket("/ws/chat/{artifact_id}")
    async def websocket_chat(
        websocket: WebSocket,
        artifact_id: UUID,
        embedding_client: EmbeddingClient = Depends(get_embedding_client),
    ) -> None:
        await websocket.accept()

        try:
            while True:
                payload = await websocket.receive_json()
                content = payload.get("content")
                sender = payload.get("sender")
                if not content:
                    await websocket.send_json({"error": "content_required"})
                    continue

                async with session_provider.session_scope() as session:
                    artifact_repo = ArtifactRepository(session=session)
                    message_repo = MessageRepository(session=session, embedding_client=embedding_client)

                    artifact = await artifact_repo.get(artifact_id)
                    if artifact is None:
                        await websocket.send_json({"error": "artifact_not_found"})
                        continue

                    message = await message_repo.create(
                        artifact=artifact,
                        content=str(content),
                        sender=sender,
                    )

                encoded = ChatMessageResponse.model_validate(message).model_dump(mode="json")
                await websocket.send_json(encoded)
        except WebSocketDisconnect:
            return

    return router


def _message_to_prompt_dict(message: Message) -> Mapping[str, str]:
    sender = (message.sender or "user").lower()
    if sender not in {"assistant", "system", "user"}:
        sender = "user"
    return {"role": sender, "content": message.content}


def _map_context_result(result: ContextResult) -> ContextResponse:
    return ContextResponse(
        query=result.query,
        artifacts=[_map_search_hit(hit) for hit in result.artifacts],
        messages=[_map_search_hit(hit) for hit in result.messages],
        structured_entries=[_map_search_hit(hit) for hit in result.structured_entries],
    )


def _map_search_hit(hit: SearchHit) -> SearchHitResponse:
    payload: Mapping[str, Any]
    if isinstance(hit.payload, Mapping):
        payload = hit.payload
    else:
        payload = {}
    return SearchHitResponse(id=hit.id, score=hit.score, payload=dict(payload))
