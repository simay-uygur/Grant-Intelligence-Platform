from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterator

from backend.schemas.documents import ApplicationDocument, ApplicationStatus


class StoredApplicationSectionNotFoundError(ValueError):
    pass


class ApplicationStore:
    """SQLite persistence for generated application documents and their inputs."""

    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize_schema()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path, timeout=5)
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
                CREATE TABLE IF NOT EXISTS applications (
                    id TEXT PRIMARY KEY,
                    grant_id TEXT NOT NULL,
                    grant_title TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'completed', 'archived')),
                    sections_json TEXT NOT NULL,
                    grant_json TEXT NOT NULL,
                    profile_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_applications_updated_at
                ON applications (updated_at DESC)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_applications_grant_updated_at
                ON applications (grant_id, updated_at DESC)
                """
            )

    def save_application(
        self,
        document: ApplicationDocument,
        *,
        grant: dict,
        profile: dict,
    ) -> dict:
        timestamp = self._timestamp()
        sections_json = json.dumps(
            [section.model_dump() for section in document.sections],
            ensure_ascii=False,
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO applications (
                    id,
                    grant_id,
                    grant_title,
                    status,
                    sections_json,
                    grant_json,
                    profile_json,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    grant_id = excluded.grant_id,
                    grant_title = excluded.grant_title,
                    sections_json = excluded.sections_json,
                    grant_json = excluded.grant_json,
                    profile_json = excluded.profile_json,
                    updated_at = excluded.updated_at
                """,
                (
                    document.id,
                    document.grantId,
                    document.grantTitle,
                    sections_json,
                    json.dumps(grant, ensure_ascii=False),
                    json.dumps(profile, ensure_ascii=False),
                    timestamp,
                    document.updatedAt,
                ),
            )
        stored = self.get_application(document.id)
        if stored is None:  # pragma: no cover - protects against unexpected SQLite failures
            raise RuntimeError(f"Application '{document.id}' was not persisted.")
        return stored

    def list_applications(
        self,
        *,
        status: ApplicationStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        where_clause = "WHERE status = ?" if status is not None else ""
        parameters: tuple = (status,) if status is not None else ()
        with self._connect() as connection:
            total = connection.execute(
                f"SELECT COUNT(*) FROM applications {where_clause}",
                parameters,
            ).fetchone()[0]
            rows = connection.execute(
                f"""
                SELECT id, grant_id, grant_title, status, sections_json,
                       created_at, updated_at
                FROM applications
                {where_clause}
                ORDER BY updated_at DESC, id ASC
                LIMIT ? OFFSET ?
                """,
                (*parameters, limit, offset),
            ).fetchall()
        return [self._summary_from_row(row) for row in rows], int(total)

    def get_application(self, application_id: str) -> dict | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, grant_id, grant_title, status, sections_json,
                       grant_json, profile_json, created_at, updated_at
                FROM applications
                WHERE id = ?
                """,
                (application_id,),
            ).fetchone()
        return self._application_from_row(row) if row is not None else None

    def get_latest_application_for_grant(self, grant_id: str) -> dict | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, grant_id, grant_title, status, sections_json,
                       grant_json, profile_json, created_at, updated_at
                FROM applications
                WHERE grant_id = ? AND status != 'archived'
                ORDER BY updated_at DESC, id ASC
                LIMIT 1
                """,
                (grant_id,),
            ).fetchone()
        return self._application_from_row(row) if row is not None else None

    def update_status(
        self,
        application_id: str,
        status: ApplicationStatus,
    ) -> dict | None:
        timestamp = self._timestamp()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE applications
                SET status = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, timestamp, application_id),
            )
        if cursor.rowcount == 0:
            return None
        return self.get_application(application_id)

    def update_section(
        self,
        application_id: str,
        section_id: str,
        content: str,
    ) -> dict | None:
        timestamp = self._timestamp()
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT sections_json FROM applications WHERE id = ?",
                (application_id,),
            ).fetchone()
            if row is None:
                return None

            sections = json.loads(row["sections_json"])
            matching_section = next(
                (section for section in sections if section["id"] == section_id),
                None,
            )
            if matching_section is None:
                raise StoredApplicationSectionNotFoundError(
                    f"Section '{section_id}' does not exist in application "
                    f"'{application_id}'."
                )

            matching_section["content"] = content
            connection.execute(
                """
                UPDATE applications
                SET sections_json = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    json.dumps(sections, ensure_ascii=False),
                    timestamp,
                    application_id,
                ),
            )
        return self.get_application(application_id)

    def _summary_from_row(self, row: sqlite3.Row) -> dict:
        sections = json.loads(row["sections_json"])
        return {
            "id": row["id"],
            "grantId": row["grant_id"],
            "grantTitle": row["grant_title"],
            "status": row["status"],
            "sectionCount": len(sections),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def _application_from_row(self, row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "grantId": row["grant_id"],
            "grantTitle": row["grant_title"],
            "status": row["status"],
            "sections": json.loads(row["sections_json"]),
            "grant": json.loads(row["grant_json"]),
            "profile": json.loads(row["profile_json"]),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def _timestamp(self) -> str:
        return datetime.now(UTC).isoformat()
