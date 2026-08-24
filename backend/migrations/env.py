"""Alembic migration environment.

Imports every module that contributes tables to ``backend.core.database.metadata``
so autogenerate sees the full schema, and points at the database resolved from
``DATABASE_URL`` (default: local SQLite).
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Import store modules so their tables register on the shared metadata.
import backend.services.application_store  # noqa: F401
import backend.services.auth_service  # noqa: F401
import backend.services.conversation_store  # noqa: F401
from backend.core.config import settings
from backend.core.database import metadata  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Inject the effective URL from application settings.
database_url = settings.database_url or f"sqlite:///{settings.sqlite_db_path}"
config.set_main_option("sqlalchemy.url", database_url)

target_metadata = metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL without a DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=database_url.startswith("sqlite"),
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connect and apply)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Batch mode lets SQLite "alter" tables via recreate (required for ALTERs there).
            render_as_batch=database_url.startswith("sqlite"),
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
