from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Connection, select
from sqlalchemy.engine import Engine

from backend.core.database import build_engine, conversations_table, messages_table, metadata
from backend.core.logging import get_logger

logger = get_logger("services.conversation_store")


class ConversationStore:
    def __init__(self, database_path: str | None = None) -> None:
        self.engine: Engine = build_engine(database_path)
        self._initialize_schema()

    @contextmanager
    def _connect(self) -> Iterator[Connection]:
        # engine.begin() commits on success and rolls back on error.
        with self.engine.begin() as connection:
            yield connection

    def _initialize_schema(self) -> None:
        metadata.create_all(self.engine)

    def create_conversation(self, user_id: str | None = None) -> dict[str, str]:
        conversation_id = str(uuid4())
        timestamp = self._timestamp()
        logger.info("Creating conversation '%s' (user_id=%s)", conversation_id, user_id)
        with self._connect() as connection:
            connection.execute(
                conversations_table.insert().values(
                    id=conversation_id,
                    user_id=user_id,
                    created_at=timestamp,
                    updated_at=timestamp,
                )
            )
        return {
            "conversation_id": conversation_id,
            "created_at": timestamp,
            "updated_at": timestamp,
        }

    def get_conversation(self, conversation_id: str, user_id: str | None = None) -> dict[str, str] | None:
        stmt = select(
            conversations_table.c.id,
            conversations_table.c.created_at,
            conversations_table.c.updated_at,
        ).where(conversations_table.c.id == conversation_id)
        if user_id is not None:
            stmt = stmt.where(conversations_table.c.user_id == user_id)
        with self._connect() as connection:
            row = connection.execute(stmt).mappings().first()
        if row is None:
            return None
        return {
            "conversation_id": row["id"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def append_message(self, conversation_id: str, role: str, content: str, user_id: str | None = None) -> dict[str, str | int]:
        if self.get_conversation(conversation_id, user_id) is None:
            logger.warning("Attempted to append message to non-existent conversation '%s'", conversation_id)
            raise ValueError(f"Conversation '{conversation_id}' does not exist.")

        timestamp = self._timestamp()
        with self._connect() as connection:
            result = connection.execute(
                messages_table.insert()
                .values(
                    conversation_id=conversation_id,
                    user_id=user_id,
                    role=role,
                    content=content,
                    created_at=timestamp,
                )
                .returning(messages_table.c.id)
            )
            message_id = result.scalar_one()
            connection.execute(conversations_table.update().where(conversations_table.c.id == conversation_id).values(updated_at=timestamp))
        return {
            "message_id": int(message_id),
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "created_at": timestamp,
        }

    def list_messages(self, conversation_id: str, user_id: str | None = None) -> list[dict[str, str | int]]:
        if self.get_conversation(conversation_id, user_id) is None:
            raise ValueError(f"Conversation '{conversation_id}' does not exist.")

        stmt = (
            select(
                messages_table.c.id,
                messages_table.c.conversation_id,
                messages_table.c.role,
                messages_table.c.content,
                messages_table.c.created_at,
            )
            .where(messages_table.c.conversation_id == conversation_id)
            .order_by(messages_table.c.id.asc())
        )
        if user_id is not None:
            stmt = stmt.where(messages_table.c.user_id == user_id)
        with self._connect() as connection:
            rows = connection.execute(stmt).mappings().all()
        return [
            {
                "message_id": row["id"],
                "conversation_id": row["conversation_id"],
                "role": row["role"],
                "content": row["content"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def get_recent_model_messages(self, conversation_id: str, limit: int, user_id: str | None = None) -> list[dict[str, str]]:
        stmt = select(messages_table.c.role, messages_table.c.content).where(messages_table.c.conversation_id == conversation_id).where(messages_table.c.role.in_(("user", "assistant"))).order_by(messages_table.c.id.desc()).limit(limit)
        if user_id is not None:
            stmt = stmt.where(messages_table.c.user_id == user_id)
        with self._connect() as connection:
            rows = connection.execute(stmt).mappings().all()
        return [{"role": row["role"], "content": row["content"]} for row in reversed(list(rows))]

    def _timestamp(self) -> str:
        return datetime.now(UTC).isoformat()

    # Kept for API compatibility with code that inspected the path directly.
    @property
    def database_path(self) -> Any:
        url = self.engine.url.render_as_string(hide_password=False)
        return url.removeprefix("sqlite:///")
