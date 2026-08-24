"""Shared database engine and Core table definitions.

Every backend store talks to the database through this module so that the
underlying engine can be swapped between local SQLite (default) and a managed
PostgreSQL instance via ``settings.database_url`` / ``DATABASE_URL``.

Engine URL precedence (highest first):
1. Explicit ``database_path`` argument passed by callers/tests -> SQLite file
2. ``DATABASE_URL`` setting (e.g. postgresql://... on Lightsail)
3. Default SQLite file at ``settings.sqlite_db_path``
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Column,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine

from backend.core.config import settings
from backend.core.logging import get_logger

logger = get_logger("core.database")

metadata = MetaData()

# --- Chat history -----------------------------------------------------------
conversations_table = Table(
    "conversations",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("user_id", String(64), nullable=True),
    Column("created_at", String(40), nullable=False),
    Column("updated_at", String(40), nullable=False),
)

messages_table = Table(
    "messages",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("conversation_id", String(64), nullable=False),
    Column("user_id", String(64), nullable=True),
    Column("role", String(32), nullable=False),
    Column("content", Text, nullable=False),
    Column("created_at", String(40), nullable=False),
)

# --- Authentication ---------------------------------------------------------
users_table = Table(
    "users",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("email", String(255), nullable=False, unique=True),
    Column("password_hash", String(255), nullable=False),
    Column("created_at", String(40), nullable=False),
)

revoked_tokens_table = Table(
    "revoked_tokens",
    metadata,
    Column("token", Text, primary_key=True),
    Column("revoked_at", String(40), nullable=False),
)

# --- Applications -----------------------------------------------------------
APPLICATION_STATUSES = ("drafting", "submitted", "under_review", "approved", "rejected", "archived")

applications_table = Table(
    "applications",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("user_id", String(64), nullable=True),
    Column("grant_id", String(128), nullable=False),
    Column("grant_title", Text, nullable=False),
    Column("status", String(32), nullable=False, server_default="drafting"),
    CheckConstraint(
        "status IN ('drafting', 'submitted', 'under_review', 'approved', 'rejected', 'archived')",
        name="ck_applications_status",
    ),
    Column("sections_json", Text, nullable=False),
    Column("grant_json", Text, nullable=False),
    Column("profile_json", Text, nullable=False),
    Column("created_at", String(40), nullable=False),
    Column("updated_at", String(40), nullable=False),
)

Index("idx_applications_updated_at", applications_table.c.updated_at.desc())
Index(
    "idx_applications_grant_updated_at",
    applications_table.c.grant_id,
    applications_table.c.updated_at.desc(),
)

saved_grants_table = Table(
    "saved_grants",
    metadata,
    Column("grant_id", String(128), primary_key=True),
    Column("user_id", String(64), nullable=True),
    Column("title", Text, nullable=False),
    Column("programme", Text),
    Column("funding_amount", Text),
    Column("deadline", Text),
    Column("source_url", Text),
    Column("match_percentage", Integer, server_default="0"),
    Column("why_it_matches", Text),
    Column("grant_json", Text, nullable=False),
    Column("saved_at", String(40), nullable=False),
)


def build_upsert(
    engine: Engine,
    table: Table,
    values: dict,
    key_column: str,
    exclude_from_update: tuple[str, ...] = (),
) -> Any:
    """INSERT ... ON CONFLICT(key) DO UPDATE — portable across SQLite and PostgreSQL.

    ``exclude_from_update`` lists columns that keep their existing value on
    conflict (e.g. ``created_at``) even though they appear in ``values``.
    """
    update_values = {column: value for column, value in values.items() if column != key_column and column not in exclude_from_update}
    if engine.dialect.name == "postgresql":
        pg_stmt = pg_insert(table).values(**values)
        return pg_stmt.on_conflict_do_update(index_elements=[key_column], set_=update_values)
    sqlite_stmt = sqlite_insert(table).values(**values)
    return sqlite_stmt.on_conflict_do_update(index_elements=[key_column], set_=update_values)


def _is_sqlite_url(url: str) -> bool:
    return url.startswith("sqlite")


def resolve_database_url(database_path: str | None = None) -> tuple[str, bool]:
    """Resolve the effective database URL.

    Returns ``(url, is_explicit_sqlite_file)``. An explicit ``database_path``
    always wins so tests can use throwaway SQLite files regardless of the
    configured ``DATABASE_URL``.
    """
    if database_path:
        return f"sqlite:///{database_path}", True
    if settings.database_url:
        return settings.database_url, False
    return f"sqlite:///{settings.sqlite_db_path}", True


def build_engine(database_path: str | None = None) -> Engine:
    """Create a SQLAlchemy engine honouring the precedence rules above."""
    url, explicit_sqlite = resolve_database_url(database_path)
    if _is_sqlite_url(url):
        if explicit_sqlite and database_path:
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        elif not settings.database_url:
            default_file = settings.sqlite_db_path
            Path(default_file).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False, "timeout": 5},
        )
    else:
        # Managed PostgreSQL (Lightsail/RDS): validate connections before reuse.
        engine = create_engine(url, pool_pre_ping=True, pool_recycle=1800)
    logger.debug("Built database engine for %s", engine.url.render_as_string(hide_password=True))
    return engine
