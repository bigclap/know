import pytest
from sqlmodel import Session

from app.database import create_engine_and_session
from app.models import Artifact, Link, Message, Schema, StructuredEntry
from app.repositories import (
    ArtifactRepository,
    LinkRepository,
    SchemaRepository,
    StructuredEntryRepository,
)


@pytest.fixture()
def session():
    engine, SessionLocal = create_engine_and_session(url="sqlite://")
    Artifact.metadata.create_all(engine)
    Schema.metadata.create_all(engine)
    Message.metadata.create_all(engine)
    StructuredEntry.metadata.create_all(engine)
    Link.metadata.create_all(engine)

    with SessionLocal() as session:
        yield session


def test_artifact_hierarchy(session: Session):
    repo = ArtifactRepository(session)

    root = repo.create(title="Root", summary="", summary_vector=[0.1, 0.2])
    child = repo.create_child(
        parent=root,
        title="Child",
        summary="Child summary",
        summary_vector=[0.2, 0.4],
    )

    fetched_root = repo.get(root.id)
    assert fetched_root is not None
    assert fetched_root.id == root.id
    assert fetched_root.children[0].id == child.id
    assert child.parent_artifact_id == root.id


def test_structured_entry_schema_linkage(session: Session):
    artifact_repo = ArtifactRepository(session)
    schema_repo = SchemaRepository(session)
    entry_repo = StructuredEntryRepository(session)

    artifact = artifact_repo.create(title="Artifact", summary="", summary_vector=None)
    schema = schema_repo.create(
        name="Task Schema",
        description="Tracks tasks",
        schema_json={"Task": "string"},
        description_vector=[0.1, 0.3],
    )
    artifact.applied_schema_id = schema.id
    session.commit()

    entry = entry_repo.create(
        artifact=artifact,
        data_json={"Task": "Ship"},
        text_representation="Ship",
        vector=[0.2, 0.5],
    )

    refreshed = entry_repo.get(entry.id)
    assert refreshed is not None
    assert refreshed.artifact_id == artifact.id
    assert refreshed.schema is None  # no direct relation but ensures ORM fields exist
    assert artifact.applied_schema_id == schema.id


def test_link_repository(session: Session):
    artifact_repo = ArtifactRepository(session)
    link_repo = LinkRepository(session)

    source = artifact_repo.create(title="Source", summary="", summary_vector=None)
    target = artifact_repo.create(title="Target", summary="", summary_vector=None)

    link = link_repo.create(
        source_type="artifact",
        source_id=source.id,
        target_type="artifact",
        target_id=target.id,
        link_type="relates_to",
        description="Related artifacts",
    )

    retrieved = link_repo.list_for_entity(entity_type="artifact", entity_id=source.id)
    assert retrieved == [link]
