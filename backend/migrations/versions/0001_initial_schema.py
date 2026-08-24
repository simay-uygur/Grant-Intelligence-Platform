"""Initial baseline schema: conversations, messages, users, revoked_tokens, applications, saved_grants

Revision ID: 0001
Revises:
Create Date: 2026-08-24

Creates the full schema from the shared Core metadata (single source of truth).
For existing SQLite databases that predate Alembic, run `alembic stamp head`
instead of upgrading — their tables already exist.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

from backend.core.database import metadata

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Baseline is generated from the same Core definitions the app uses,
    # so schema and code can never drift.
    metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    metadata.drop_all(bind=op.get_bind())
