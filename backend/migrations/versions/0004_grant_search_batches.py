"""Add grant_search_batches table for storing offered grant history

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-28

Adds grant_search_batches table to persist offered grant groups/batches
associated with conversations and users.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from backend.core.database import grant_search_batches_table

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "grant_search_batches" not in inspector.get_table_names():
        grant_search_batches_table.create(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "grant_search_batches" in inspector.get_table_names():
        op.drop_table("grant_search_batches")
