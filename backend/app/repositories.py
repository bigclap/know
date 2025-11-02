"""Repository layer implementing CRUD operations for domain entities."""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from .models import Artifact, Link, Message, Schema, StructuredEntry


class ArtifactRepository:
    """Manage artifact persistence and hierarchy operations."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, *, title: str, parent_id: Optional[UUID] = None) -> Artifact:
        artifact = Artifact(
            title=title,
            parent_artifact_id=parent_id,
        )
        self.session.add(artifact)
        self.session.commit()
        self.session.refresh(artifact)
        return artifact

    def delete(self, *, artifact: Artifact) -> None:
        self.session.delete(artifact)
        self.session.commit()

    def list(self) -> list[Artifact]:
        statement = select(Artifact).order_by(Artifact.created_at)
        return list(self.session.exec(statement))

    def get(self, artifact_id: UUID) -> Optional[Artifact]:
        statement = select(Artifact).where(Artifact.id == artifact_id)
        return self.session.exec(statement).first()

    def get_with_related(self, artifact_id: UUID) -> Optional[Artifact]:
        statement = (
            select(Artifact)
            .where(Artifact.id == artifact_id)
            .options(
                selectinload(Artifact.children),
                selectinload(Artifact.messages),
                selectinload(Artifact.structured_entries),
            )
        )
        return self.session.exec(statement).first()

    def update(self, *, artifact: Artifact, **kwargs) -> Artifact:
        for key, value in kwargs.items():
            setattr(artifact, key, value)
        self.session.add(artifact)
        self.session.commit()
        self.session.refresh(artifact)
        return artifact


class SchemaRepository:
    """CRUD operations for schemas."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def create(
        self,
        *,
        name: str,
        description: str,
        schema_json: dict,
        description_vector: Optional[List[float]],
    ) -> Schema:
        schema = Schema(
            name=name,
            description=description,
            schema_json=schema_json,
            description_vector=description_vector,
        )
        self.session.add(schema)
        self.session.commit()
        self.session.refresh(schema)
        return schema

    def get(self, schema_id: UUID) -> Optional[Schema]:
        return self.session.get(Schema, schema_id)


class StructuredEntryRepository:
    """Access structured knowledge entries."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def create(
        self,
        *,
        artifact: Artifact,
        data_json: dict,
        text_representation: str,
        vector: Optional[List[float]],
        schema: Optional[Schema] = None,
    ) -> StructuredEntry:
        entry = StructuredEntry(
            artifact_id=artifact.id,
            data_json=data_json,
            text_representation=text_representation,
            text_representation_vector=vector,
            schema_id=schema.id if schema else None,
        )
        self.session.add(entry)
        self.session.commit()
        self.session.refresh(entry)
        return entry

    def get(self, entry_id: UUID) -> Optional[StructuredEntry]:
        return self.session.get(StructuredEntry, entry_id)


class MessageRepository:
    """Persistence helpers for chat messages."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def create(
        self,
        *,
        artifact: Artifact,
        content: str,
        sender: Optional[str],
        vector: Optional[List[float]] = None,
    ) -> Message:
        message = Message(
            artifact_id=artifact.id,
            content=content,
            sender=sender,
            content_vector=vector,
        )
        self.session.add(message)
        self.session.commit()
        self.session.refresh(message)
        return message

    def list_for_artifact(self, artifact_id: UUID) -> List[Message]:
        statement = (
            select(Message)
            .where(Message.artifact_id == artifact_id)
            .order_by(Message.created_at)
        )
        return list(self.session.exec(statement))


class LinkRepository:
    """Knowledge graph link operations."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def create(
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
        self.session.commit()
        self.session.refresh(link)
        return link

    def list_for_entity(self, *, entity_type: str, entity_id: UUID) -> List[Link]:
        statement = select(Link).where(
            (Link.source_entity_type == entity_type) & (Link.source_entity_id == str(entity_id))
        )
        return list(self.session.exec(statement))

    def delete(self, link: Link) -> None:
        self.session.delete(link)
        self.session.commit()
