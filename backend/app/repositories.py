"""Repository layer implementing CRUD operations for domain entities."""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlmodel import Session, select

from .models import Artifact, Link, Schema, StructuredEntry


class ArtifactRepository:
    """Manage artifact persistence and hierarchy operations."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def create(
        self,
        *,
        title: str,
        summary: str,
        summary_vector: Optional[List[float]],
        parent_artifact_id: Optional[UUID] = None,
        source_entry_id: Optional[UUID] = None,
        applied_schema_id: Optional[UUID] = None,
    ) -> Artifact:
        artifact = Artifact(
            title=title,
            summary=summary,
            summary_vector=summary_vector,
            parent_artifact_id=parent_artifact_id,
            source_entry_id=source_entry_id,
            applied_schema_id=applied_schema_id,
        )
        self.session.add(artifact)
        self.session.commit()
        self.session.refresh(artifact)
        return artifact

    def get(self, artifact_id: UUID) -> Optional[Artifact]:
        statement = select(Artifact).where(Artifact.id == artifact_id)
        return self.session.exec(statement).first()

    def create_child(
        self,
        *,
        parent: Artifact,
        title: str,
        summary: str,
        summary_vector: Optional[List[float]],
        source_entry_id: Optional[UUID] = None,
        applied_schema_id: Optional[UUID] = None,
    ) -> Artifact:
        return self.create(
            title=title,
            summary=summary,
            summary_vector=summary_vector,
            parent_artifact_id=parent.id,
            source_entry_id=source_entry_id,
            applied_schema_id=applied_schema_id,
        )


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
