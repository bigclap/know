"""Pydantic schemas for the HTTP and WebSocket API."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageRequest(BaseModel):
    """Incoming payload for creating a chat message."""

    artifact_id: UUID
    content: str
    sender: Optional[str] = None


class ChatMessageResponse(BaseModel):
    """Representation of a chat message returned to clients."""

    id: int
    artifact_id: UUID
    content: str
    sender: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StructuredEntryResponse(BaseModel):
    """Structured entry embedded into artifact details."""

    id: UUID
    artifact_id: UUID
    data_json: dict[str, Any]
    text_representation: str
    schema_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SearchHitResponse(BaseModel):
    """Serialized form of a context search result."""

    id: str
    score: float
    payload: dict[str, Any] = Field(default_factory=dict)


class ContextResponse(BaseModel):
    """Aggregated retrieval context returned with chat responses."""

    query: str
    artifacts: list[SearchHitResponse]
    messages: list[SearchHitResponse]
    structured_entries: list[SearchHitResponse]


class ChatResponse(BaseModel):
    """Full chat response including AI output and retrieval context."""

    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    context: ContextResponse


class ArtifactChildSummary(BaseModel):
    """Summary information about a child artifact."""

    id: UUID
    title: str

    model_config = ConfigDict(from_attributes=True)


class ArtifactDetailResponse(BaseModel):
    """Full artifact representation with nested resources."""

    id: UUID
    title: str
    summary: str
    parent_artifact_id: Optional[UUID] = None
    children: list[ArtifactChildSummary]
    messages: list[ChatMessageResponse]
    structured_entries: list[StructuredEntryResponse]


class LinkCreateRequest(BaseModel):
    """Payload for creating a knowledge graph link."""

    target_entity_type: str
    target_entity_id: str
    link_type: str
    description: Optional[str] = None


class LinkResponse(BaseModel):
    """Representation of a knowledge graph link."""

    id: str
    source_entity_type: str
    source_entity_id: str
    target_entity_type: str
    target_entity_id: str
    link_type: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
