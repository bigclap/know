"""Initial schema for knowledge platform."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = "20240101_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "schemas",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("schema_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("description_vector", Vector(dim=1024), nullable=True),
    )

    op.create_table(
        "artifacts",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("summary_vector", Vector(dim=1536), nullable=True),
        sa.Column("parent_artifact_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_entry_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("applied_schema_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["parent_artifact_id"], ["artifacts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["applied_schema_id"], ["schemas.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column("artifact_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sender", sa.String(), nullable=True),
        sa.Column("content_vector", Vector(dim=1536), nullable=True),
        sa.ForeignKeyConstraint(["artifact_id"], ["artifacts.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "structured_entries",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column("artifact_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("schema_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("data_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("text_representation", sa.Text(), nullable=False),
        sa.Column("text_representation_vector", Vector(dim=1536), nullable=True),
        sa.ForeignKeyConstraint(["artifact_id"], ["artifacts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["schema_id"], ["schemas.id"], ondelete="SET NULL"),
    )

    op.create_foreign_key(
        "fk_artifacts_source_entry",
        "artifacts",
        "structured_entries",
        ["source_entry_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "links",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column("source_entity_type", sa.String(), nullable=False),
        sa.Column("source_entity_id", sa.String(), nullable=False),
        sa.Column("target_entity_type", sa.String(), nullable=False),
        sa.Column("target_entity_id", sa.String(), nullable=False),
        sa.Column("link_type", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )

    op.create_index("ix_artifacts_summary_vector", "artifacts", ["summary_vector"], postgresql_using="ivfflat")
    op.create_index("ix_messages_content_vector", "messages", ["content_vector"], postgresql_using="ivfflat")
    op.create_index(
        "ix_structured_entries_text_vector",
        "structured_entries",
        ["text_representation_vector"],
        postgresql_using="ivfflat",
    )
    op.create_index(
        "ix_schemas_description_vector",
        "schemas",
        ["description_vector"],
        postgresql_using="ivfflat",
    )


def downgrade() -> None:
    op.drop_index("ix_schemas_description_vector", table_name="schemas")
    op.drop_index("ix_structured_entries_text_vector", table_name="structured_entries")
    op.drop_index("ix_messages_content_vector", table_name="messages")
    op.drop_index("ix_artifacts_summary_vector", table_name="artifacts")
    op.drop_table("links")
    op.drop_constraint("fk_artifacts_source_entry", "artifacts", type_="foreignkey")
    op.drop_table("structured_entries")
    op.drop_table("messages")
    op.drop_table("artifacts")
    op.drop_table("schemas")
    op.execute("DROP EXTENSION IF EXISTS vector")
