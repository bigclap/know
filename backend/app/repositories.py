"""Repository layer implementing CRUD operations for domain entities."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence
from uuid import UUID

from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from .models import Artifact, Link, Message, Schema, StructuredEntry
from .services.vector_index import EmbeddingClient


@dataclass
class _EmbeddingHelper:
    client: EmbeddingClient | None

    async def embed(self, text: Optional[str]) -> Optional[List[float]]:
        if text is None:
            return None
        if not text.strip():
            return None
        if self.client is None:
            raise RuntimeError("Embedding client is required for vector operations")
        vectors = await self.client.embed([text])
        if not vectors:
            raise RuntimeError("Embedding service returned no vectors")
        return [float(value) for value in vectors[0]]


class ArtifactRepository:
    """Manage artifact persistence and hierarchy operations."""

    def __init__(self, session: AsyncSession, embedding_client: EmbeddingClient | None = None) -> None:
        self.session = session
        self._embedding = _EmbeddingHelper(embedding_client)

    async def create(
        self,
        *,
        title: str,
        summary: str,
        summary_vector: Optional[Sequence[float]] = None,
        parent_artifact_id: Optional[UUID] = None,
        source_entry_id: Optional[UUID] = None,
        applied_schema_id: Optional[UUID] = None,
    ) -> Artifact:
        vector = list(summary_vector) if summary_vector is not None else await self._embedding.embed(summary)
        artifact = Artifact(
            title=title,
            summary=summary,
            summary_vector=vector,
            parent_artifact_id=parent_artifact_id,
            source_entry_id=source_entry_id,
            applied_schema_id=applied_schema_id,
        )
        self.session.add(artifact)
        await self.session.commit()
        await self.session.refresh(artifact)
        return artifact

    async def get(self, artifact_id: UUID) -> Optional[Artifact]:
        return await self.session.get(Artifact, artifact_id)

    async def get_with_related(self, artifact_id: UUID) -> Optional[Artifact]:
        statement = (
            select(Artifact)
            .where(Artifact.id == artifact_id)
            .options(
                selectinload(Artifact.children),
                selectinload(Artifact.messages),
                selectinload(Artifact.structured_entries),
            )
        )
        result = await self.session.execute(statement)
        return result.scalars().first()

    async def create_child(
        self,
        *,
        parent: Artifact,
        title: str,
        summary: str,
        summary_vector: Optional[Sequence[float]] = None,
        source_entry_id: Optional[UUID] = None,
        applied_schema_id: Optional[UUID] = None,
    ) -> Artifact:
        return await self.create(
            title=title,
            summary=summary,
            summary_vector=summary_vector,
            parent_artifact_id=parent.id,
            source_entry_id=source_entry_id,
            applied_schema_id=applied_schema_id,
        )

    async def update_summary(self, *, artifact: Artifact, summary: str) -> Artifact:
        artifact.summary = summary
        artifact.summary_vector = await self._embedding.embed(summary)
        self.session.add(artifact)
        await self.session.commit()
        await self.session.refresh(artifact)
        return artifact


class SchemaRepository:
    """CRUD operations for schemas."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        name: str,
        description: str,
        schema_json: dict,
        description_vector: Optional[Sequence[float]] = None,
    ) -> Schema:
        schema = Schema(
            name=name,
            description=description,
            schema_json=schema_json,
            description_vector=list(description_vector) if description_vector is not None else None,
        )
        self.session.add(schema)
        await self.session.commit()
        await self.session.refresh(schema)
        return schema

    async def get(self, schema_id: UUID) -> Optional[Schema]:
        return await self.session.get(Schema, schema_id)


class StructuredEntryRepository:
    """Access structured knowledge entries."""

    def __init__(self, session: AsyncSession, embedding_client: EmbeddingClient | None = None) -> None:
        self.session = session
        self._embedding = _EmbeddingHelper(embedding_client)

    async def create(
        self,
        *,
        artifact: Artifact,
        data_json: dict,
        text_representation: str,
        vector: Optional[Sequence[float]] = None,
        schema: Optional[Schema] = None,
    ) -> StructuredEntry:
        entry_vector = list(vector) if vector is not None else await self._embedding.embed(text_representation)
        entry = StructuredEntry(
            artifact_id=artifact.id,
            data_json=data_json,
            text_representation=text_representation,
            text_representation_vector=entry_vector,
            schema_id=schema.id if schema else None,
        )
        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)
        return entry

    async def get(self, entry_id: UUID) -> Optional[StructuredEntry]:
        return await self.session.get(StructuredEntry, entry_id)

    async def update_text_representation(
        self,
        *,
        entry: StructuredEntry,
        text_representation: str,
        data_json: dict | None = None,
    ) -> StructuredEntry:
        entry.text_representation = text_representation
        if data_json is not None:
            entry.data_json = data_json
        entry.text_representation_vector = await self._embedding.embed(text_representation)
        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)
        return entry


class MessageRepository:
    """Persistence helpers for chat messages."""

    def __init__(self, session: AsyncSession, embedding_client: EmbeddingClient | None = None) -> None:
        self.session = session
        self._embedding = _EmbeddingHelper(embedding_client)

    async def create(
        self,
        *,
        artifact: Artifact,
        content: str,
        sender: Optional[str],
        vector: Optional[Sequence[float]] = None,
    ) -> Message:
        message_vector = list(vector) if vector is not None else await self._embedding.embed(content)
        message = Message(
            artifact_id=artifact.id,
            content=content,
            sender=sender,
            content_vector=message_vector,
        )
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return message

    async def update_content(self, *, message: Message, content: str) -> Message:
        message.content = content
        message.content_vector = await self._embedding.embed(content)
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return message

    async def list_for_artifact(self, artifact_id: UUID) -> List[Message]:
        statement = select(Message).where(Message.artifact_id == artifact_id).order_by(Message.created_at)
        result = await self.session.execute(statement)
        return list(result.scalars())


class LinkRepository:
    """Knowledge graph link operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        source_type: str,
        source_id: UUID,
        target_type: str,
        target_id: UUID,
        link_type: str,
        description: Optional[str],
    ) -> Link:
        link = Link(
            source_entity_type=source_type,
            source_entity_id=str(source_id),
            target_entity_type=target_type,
            target_entity_id=str(target_id),
            link_type=link_type,
            description=description,
        )
        self.session.add(link)
        await self.session.commit()
        await self.session.refresh(link)
        return link

    async def list_for_entity(self, *, entity_type: str, entity_id: UUID) -> List[Link]:
        statement = select(Link).where(
            (Link.source_entity_type == entity_type) & (Link.source_entity_id == str(entity_id))
        )
        result = await self.session.execute(statement)
        return list(result.scalars())

    async def delete(self, link: Link) -> None:
        await self.session.delete(link)
        await self.session.commit()
