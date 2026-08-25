"""Link document uploads to chat conversations

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-25

Adds nullable conversations_id to document_uploads so background material
uploaded during a chat can be injected into drafting and Q&A prompts.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {column["name"] for column in sa.inspect(bind).get_columns("document_uploads")}
    if "conversation_id" not in existing:
        op.add_column("document_uploads", sa.Column("conversation_id", sa.String(64), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    existing = {column["name"] for column in sa.inspect(bind).get_columns("document_uploads")}
    if "conversation_id" in existing:
        op.drop_column("document_uploads", "conversation_id")
