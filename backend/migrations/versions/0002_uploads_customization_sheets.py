"""Add uploads, customization, and structured sheets support

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-25

- applications: + custom_instructions, template_type, sheets_json columns
- new document_uploads table for extracted upload text

Guarded operations so legacy SQLite databases (created via metadata.create_all
before Alembic) upgrade cleanly.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op

from backend.core.database import document_uploads_table

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_APPLICATION_COLUMNS = (
    ("custom_instructions", sa.Column("custom_instructions", sa.Text(), nullable=True)),
    ("template_type", sa.Column("template_type", sa.String(32), nullable=True)),
    ("sheets_json", sa.Column("sheets_json", sa.Text(), nullable=True)),
)


def _existing_column_names(bind: Any, table: str) -> set[str]:
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    existing_columns = _existing_column_names(bind, "applications")
    for column_name, column in NEW_APPLICATION_COLUMNS:
        if column_name not in existing_columns:
            op.add_column("applications", column)

    inspector = sa.inspect(bind)
    if "document_uploads" not in inspector.get_table_names():
        document_uploads_table.create(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "document_uploads" in inspector.get_table_names():
        op.drop_table("document_uploads")
    existing_columns = _existing_column_names(bind, "applications")
    for column_name, _column in reversed(NEW_APPLICATION_COLUMNS):
        if column_name in existing_columns:
            op.drop_column("applications", column_name)
