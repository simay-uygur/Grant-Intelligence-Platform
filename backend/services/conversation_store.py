from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from backend.core.logging import get_logger

logger = get_logger("services.conversation_store")


class ConversationStore:
    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize_schema()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _initialize_schema(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations (id)
                )
                """
            )
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(conversations)")}
            if "user_id" not in columns:
                connection.execute("ALTER TABLE conversations ADD COLUMN user_id TEXT")
            message_columns = {row["name"] for row in connection.execute("PRAGMA table_info(messages)")}
            if "user_id" not in message_columns:
                connection.execute("ALTER TABLE messages ADD COLUMN user_id TEXT")

    def create_conversation(self, user_id: str | None = None) -> dict[str, str]:
        conversation_id = str(uuid4())
        timestamp = self._timestamp()
        logger.info("Creating conversation '%s' (user_id=%s)", conversation_id, user_id)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO conversations (id, user_id, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (conversation_id, user_id, timestamp, timestamp),
            )
        return {
            "conversation_id": conversation_id,
            "created_at": timestamp,
            "updated_at": timestamp,
        }

    def get_conversation(self, conversation_id: str, user_id: str | None = None) -> dict[str, str] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, created_at, updated_at
                FROM conversations
                WHERE id = ? AND (user_id = ? OR ? IS NULL)
                """,
                (conversation_id, user_id, user_id),
            ).fetchone()
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
            cursor = connection.execute(
                """
                INSERT INTO messages (conversation_id, user_id, role, content, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (conversation_id, user_id, role, content, timestamp),
            )
            connection.execute(
                """
                UPDATE conversations
                SET updated_at = ?
                WHERE id = ?
                """,
                (timestamp, conversation_id),
            )
            message_id = cursor.lastrowid
        if message_id is None:
            raise RuntimeError(f"Failed to insert message into conversation '{conversation_id}'.")
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

        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, conversation_id, role, content, created_at
                FROM messages
                WHERE conversation_id = ? AND (user_id = ? OR ? IS NULL)
                ORDER BY id ASC
                """,
                (conversation_id, user_id, user_id),
            ).fetchall()
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
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT role, content
                FROM messages
                WHERE conversation_id = ? AND role IN ('user', 'assistant')
                  AND (user_id = ? OR ? IS NULL)
                ORDER BY id DESC
                LIMIT ?
                """,
                (conversation_id, user_id, user_id, limit),
            ).fetchall()
        return [
            {
                "role": row["role"],
                "content": row["content"],
            }
            for row in reversed(rows)
        ]

    def _timestamp(self) -> str:
        return datetime.now(UTC).isoformat()
