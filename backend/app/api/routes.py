"""API routers for the backend application."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlmodel import Session

from ..repositories import ArtifactRepository, LinkRepository, MessageRepository
from .schemas import (
    ArtifactChildSummary,
    ArtifactDetailResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    LinkCreateRequest,
    LinkResponse,
    StructuredEntryResponse,
)
from .session import SessionProvider


def _sorted_by_created(items: list[Any]) -> list[Any]:
    return sorted(items, key=lambda item: getattr(item, "created_at", datetime.min))


def create_router(session_provider: SessionProvider) -> APIRouter:
    """Build an ``APIRouter`` wired with repository dependencies."""

    router = APIRouter()

    def get_session() -> Any:
        yield from session_provider.dependency()

    @router.post("/chat/message", response_model=ChatMessageResponse)
    def post_chat_message(
        payload: ChatMessageRequest,
        session: Session = Depends(get_session),
    ) -> ChatMessageResponse:
        artifact_repo = ArtifactRepository(session)
        message_repo = MessageRepository(session)

        artifact = artifact_repo.get(payload.artifact_id)
        if artifact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

        message = message_repo.create(
            artifact=artifact,
            content=payload.content,
            sender=payload.sender,
        )

        return ChatMessageResponse.model_validate(message)

    @router.get("/artifacts/{artifact_id}", response_model=ArtifactDetailResponse)
    def get_artifact(
        artifact_id: UUID,
        session: Session = Depends(get_session),
    ) -> ArtifactDetailResponse:
        repo = ArtifactRepository(session)
        artifact = repo.get_with_related(artifact_id)
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
    def create_link(
        artifact_id: UUID,
        payload: LinkCreateRequest,
        session: Session = Depends(get_session),
    ) -> LinkResponse:
        artifact_repo = ArtifactRepository(session)
        if artifact_repo.get(artifact_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

        link_repo = LinkRepository(session)
        link = link_repo.create(
            source_type="artifact",
            source_id=artifact_id,
            target_type=payload.target_entity_type,
            target_id=UUID(payload.target_entity_id),
            link_type=payload.link_type,
            description=payload.description,
        )

        return LinkResponse.model_validate(link)

    @router.websocket("/ws/chat/{artifact_id}")
    async def websocket_chat(websocket: WebSocket, artifact_id: UUID) -> None:
        await websocket.accept()

        try:
            while True:
                payload = await websocket.receive_json()
                content = payload.get("content")
                sender = payload.get("sender")
                if not content:
                    await websocket.send_json({"error": "content_required"})
                    continue

                with session_provider.session_scope() as session:
                    artifact_repo = ArtifactRepository(session)
                    message_repo = MessageRepository(session)

                    artifact = artifact_repo.get(artifact_id)
                    if artifact is None:
                        await websocket.send_json({"error": "artifact_not_found"})
                        continue

                    message = message_repo.create(
                        artifact=artifact,
                        content=str(content),
                        sender=sender,
                    )

                encoded = ChatMessageResponse.model_validate(message).model_dump(mode="json")
                await websocket.send_json(encoded)
        except WebSocketDisconnect:
            return

    return router
