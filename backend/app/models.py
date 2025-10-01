"""Database models based on SQLModel for the knowledge platform."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, DateTime, String, Text, BigInteger
from sqlalchemy.sql import func
from sqlalchemy.types import TypeDecorator
from sqlmodel import Field, Relationship, SQLModel


class Vector(TypeDecorator):
    """Portable vector column.

    Uses pgvector when running on PostgreSQL and falls back to JSON elsewhere,
    which keeps tests light-weight while remaining production ready.
    """

    cache_ok = True
    impl = JSON

    def __init__(self, dim: Optional[int] = None) -> None:
        super().__init__()
        self.dim = dim

    def load_dialect_impl(self, dialect):  # type: ignore[override]
        if dialect.name == "postgresql":
            try:
                from pgvector.sqlalchemy import Vector as PGVector
            except ImportError as exc:  # pragma: no cover - defensive guard
                raise RuntimeError(
                    "pgvector must be installed to use vector columns on PostgreSQL"
                ) from exc
            return dialect.type_descriptor(PGVector(dim=self.dim))
        return dialect.type_descriptor(JSON)

    def process_bind_param(self, value, dialect):  # type: ignore[override]
        if value is None:
            return None
        if isinstance(value, list):
            return value
        return list(value)

    def process_result_value(self, value, dialect):  # type: ignore[override]
        return value


class Artifact(SQLModel, table=True):
    __tablename__ = "artifacts"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
    title: str = Field(sa_column=Column(Text, nullable=False))
    summary: str = Field(default="", sa_column=Column(Text, nullable=False))
    summary_vector: Optional[List[float]] = Field(
        default=None, sa_column=Column(Vector(dim=1536), nullable=True)
    )
    parent_artifact_id: Optional[UUID] = Field(default=None, foreign_key="artifacts.id")
    source_entry_id: Optional[UUID] = Field(default=None, foreign_key="structured_entries.id")
    applied_schema_id: Optional[UUID] = Field(default=None, foreign_key="schemas.id")

    parent: Optional["Artifact"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Artifact.id"},
    )
    children: List["Artifact"] = Relationship(back_populates="parent")
    messages: List["Message"] = Relationship(back_populates="artifact")
    structured_entries: List["StructuredEntry"] = Relationship(
        back_populates="artifact",
        sa_relationship_kwargs={"foreign_keys": "StructuredEntry.artifact_id"},
    )


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
    artifact_id: UUID = Field(foreign_key="artifacts.id")
    content: str = Field(sa_column=Column(Text, nullable=False))
    sender: Optional[str] = Field(default=None, sa_column=Column(String, nullable=True))
    content_vector: Optional[List[float]] = Field(
        default=None, sa_column=Column(Vector(dim=1536), nullable=True)
    )

    artifact: "Artifact" = Relationship(back_populates="messages")


class Schema(SQLModel, table=True):
    __tablename__ = "schemas"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
    name: str = Field(sa_column=Column(String, nullable=False))
    description: str = Field(default="", sa_column=Column(Text, nullable=False))
    schema_json: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    description_vector: Optional[List[float]] = Field(
        default=None, sa_column=Column(Vector(dim=1024), nullable=True)
    )

    structured_entries: List["StructuredEntry"] = Relationship(back_populates="schema")


class StructuredEntry(SQLModel, table=True):
    __tablename__ = "structured_entries"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
    artifact_id: UUID = Field(foreign_key="artifacts.id")
    data_json: dict = Field(sa_column=Column(JSON, nullable=False))
    text_representation: str = Field(sa_column=Column(Text, nullable=False))
    text_representation_vector: Optional[List[float]] = Field(
        default=None, sa_column=Column(Vector(dim=1536), nullable=True)
    )

    artifact: "Artifact" = Relationship(
        back_populates="structured_entries",
        sa_relationship_kwargs={"foreign_keys": "StructuredEntry.artifact_id"},
    )
    schema_id: Optional[UUID] = Field(default=None, foreign_key="schemas.id")
    schema: Optional[Schema] = Relationship(back_populates="structured_entries")


class Link(SQLModel, table=True):
    __tablename__ = "links"

    id: str = Field(
        default_factory=lambda: str(uuid4()),
        sa_column=Column(String, primary_key=True, nullable=False),
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
    source_entity_type: str = Field(sa_column=Column(String, nullable=False))
    source_entity_id: str = Field(sa_column=Column(String, nullable=False))
    target_entity_type: str = Field(sa_column=Column(String, nullable=False))
    target_entity_id: str = Field(sa_column=Column(String, nullable=False))
    link_type: str = Field(sa_column=Column(String, nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))


__all__ = [
    "Artifact",
    "Message",
    "Schema",
    "StructuredEntry",
    "Link",
]
