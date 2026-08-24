from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from backend.core.logging import get_logger
from backend.schemas.documents import ApplicationDocument, ApplicationStatus

logger = get_logger("services.application_store")


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
                    status TEXT NOT NULL DEFAULT 'drafting'
                        CHECK (status IN (
                            'drafting',
                            'submitted',
                            'under_review',
                            'approved',
                            'rejected',
                            'archived'
                        )),
                    sections_json TEXT NOT NULL,
                    grant_json TEXT NOT NULL,
                    profile_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(applications)")}
            if "user_id" not in columns:
                connection.execute("ALTER TABLE applications ADD COLUMN user_id TEXT")
            create_sql_row = connection.execute(
                """
                SELECT sql
                FROM sqlite_master
                WHERE type = 'table' AND name = 'applications'
                """
            ).fetchone()
            create_sql = create_sql_row["sql"] if create_sql_row else ""
            if "'under_review'" not in create_sql:
                self._migrate_status_values(connection)
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
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS saved_grants (
                    grant_id TEXT PRIMARY KEY,
                    user_id TEXT,
                    title TEXT NOT NULL,
                    programme TEXT,
                    funding_amount TEXT,
                    deadline TEXT,
                    source_url TEXT,
                    match_percentage INTEGER DEFAULT 0,
                    why_it_matches TEXT,
                    grant_json TEXT NOT NULL,
                    saved_at TEXT NOT NULL
                )
                """
            )

    def save_application(
        self,
        document: ApplicationDocument,
        *,
        grant: dict,
        profile: dict,
        user_id: str | None = None,
    ) -> dict:
        logger.info("Saving application '%s' for grant '%s' (user_id=%s)", document.id, document.grantId, user_id)
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
                    user_id,
                    grant_id,
                    grant_title,
                    status,
                    sections_json,
                    grant_json,
                    profile_json,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, 'drafting', ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    grant_id = excluded.grant_id,
                    grant_title = excluded.grant_title,
                    sections_json = excluded.sections_json,
                    grant_json = excluded.grant_json,
                    profile_json = excluded.profile_json,
                    updated_at = excluded.updated_at,
                    user_id = excluded.user_id
                """,
                (
                    document.id,
                    user_id,
                    document.grantId,
                    document.grantTitle,
                    sections_json,
                    json.dumps(grant, ensure_ascii=False),
                    json.dumps(profile, ensure_ascii=False),
                    timestamp,
                    document.updatedAt,
                ),
            )
        stored = self.get_application(document.id, user_id)
        if stored is None:  # pragma: no cover - protects against unexpected SQLite failures
            raise RuntimeError(f"Application '{document.id}' was not persisted.")
        return stored

    def list_applications(
        self,
        *,
        status: ApplicationStatus | None = None,
        limit: int = 50,
        offset: int = 0,
        user_id: str | None = None,
    ) -> tuple[list[dict], int]:
        conditions = []
        parameters: list = []
        if status is not None:
            conditions.append("status = ?")
            parameters.append(status)
        if user_id is not None:
            conditions.append("user_id = ?")
            parameters.append(user_id)
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        with self._connect() as connection:
            total = connection.execute(
                f"SELECT COUNT(*) FROM applications {where_clause}",
                tuple(parameters),
            ).fetchone()[0]
            rows = connection.execute(
                f"""
                SELECT id, grant_id, grant_title, status, sections_json,
                       grant_json, profile_json, created_at, updated_at
                FROM applications
                {where_clause}
                ORDER BY updated_at DESC, id ASC
                LIMIT ? OFFSET ?
                """,
                (*parameters, limit, offset),
            ).fetchall()
        return [self._summary_from_row(row) for row in rows], int(total)

    def get_application(self, application_id: str, user_id: str | None = None) -> dict | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, grant_id, grant_title, status, sections_json,
                       grant_json, profile_json, created_at, updated_at
                FROM applications
                WHERE id = ? AND (user_id = ? OR ? IS NULL)
                """,
                (application_id, user_id, user_id),
            ).fetchone()
        return self._application_from_row(row) if row is not None else None

    def get_latest_application_for_grant(self, grant_id: str, user_id: str | None = None) -> dict | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, grant_id, grant_title, status, sections_json,
                       grant_json, profile_json, created_at, updated_at
                FROM applications
                WHERE grant_id = ? AND status != 'archived'
                  AND (user_id = ? OR ? IS NULL)
                ORDER BY updated_at DESC, id ASC
                LIMIT 1
                """,
                (grant_id, user_id, user_id),
            ).fetchone()
        return self._application_from_row(row) if row is not None else None

    def update_status(
        self,
        application_id: str,
        status: ApplicationStatus,
        user_id: str | None = None,
    ) -> dict | None:
        timestamp = self._timestamp()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE applications
                SET status = ?, updated_at = ?
                WHERE id = ? AND (user_id = ? OR ? IS NULL)
                """,
                (status, timestamp, application_id, user_id, user_id),
            )
        if cursor.rowcount == 0:
            return None
        return self.get_application(application_id, user_id)

    def delete_application(self, application_id: str, user_id: str | None = None) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM applications WHERE id = ? AND (user_id = ? OR ? IS NULL)",
                (application_id, user_id, user_id),
            )
            return cursor.rowcount > 0

    def update_section(
        self,
        application_id: str,
        section_id: str,
        content: str,
        user_id: str | None = None,
    ) -> dict | None:
        timestamp = self._timestamp()
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT sections_json FROM applications WHERE id = ? AND (user_id = ? OR ? IS NULL)",
                (application_id, user_id, user_id),
            ).fetchone()
            if row is None:
                return None

            sections = json.loads(row["sections_json"])
            matching_section = next(
                (section for section in sections if section["id"] == section_id),
                None,
            )
            if matching_section is None:
                raise StoredApplicationSectionNotFoundError(f"Section '{section_id}' does not exist in application '{application_id}'.")

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
        return self.get_application(application_id, user_id)

    def _summary_from_row(self, row: sqlite3.Row) -> dict:
        sections = json.loads(row["sections_json"])
        grant = json.loads(row["grant_json"])
        profile = json.loads(row["profile_json"])
        return {
            "id": row["id"],
            "grantId": row["grant_id"],
            "grantTitle": row["grant_title"],
            "grantOrganisation": self._grant_organisation(grant),
            "applicantOrganisation": str(profile.get("organisationName") or "Unknown applicant"),
            "status": row["status"],
            "fundingAmount": str(grant.get("fundingAmount") or grant.get("amount") or profile.get("fundingAmount") or "Not specified"),
            "deadline": str(grant.get("deadline") or ""),
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

    def _migrate_status_values(self, connection: sqlite3.Connection) -> None:
        connection.execute("ALTER TABLE applications RENAME TO applications_legacy")
        connection.execute(
            """
            CREATE TABLE applications (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                grant_id TEXT NOT NULL,
                grant_title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'drafting'
                    CHECK (status IN (
                        'drafting',
                        'submitted',
                        'under_review',
                        'approved',
                        'rejected',
                        'archived'
                    )),
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
            INSERT INTO applications (
                id,
                user_id,
                grant_id,
                grant_title,
                status,
                sections_json,
                grant_json,
                profile_json,
                created_at,
                updated_at
            )
            SELECT
                id,
                user_id,
                grant_id,
                grant_title,
                CASE status
                    WHEN 'draft' THEN 'drafting'
                    WHEN 'completed' THEN 'approved'
                    ELSE status
                END,
                sections_json,
                grant_json,
                profile_json,
                created_at,
                updated_at
            FROM applications_legacy
            """
        )
        connection.execute("DROP TABLE applications_legacy")

    @staticmethod
    def _grant_organisation(grant: dict) -> str:
        return str(grant.get("programme") or grant.get("source") or grant.get("fundingType") or "Unknown funder")

    def save_grant(self, grant: dict, user_id: str | None = None) -> dict:
        grant_id = str(grant.get("id") or grant.get("identifier") or "")
        title = str(grant.get("title") or "Grant Opportunity")
        programme = str(grant.get("programme") or grant.get("source") or "")
        funding_amount = str(grant.get("fundingAmount") or grant.get("budget") or "")
        deadline = str(grant.get("deadline") or "")
        raw_source_url = str(grant.get("sourceUrl") or grant.get("url") or "")
        source_url = _normalize_eu_url(raw_source_url, grant_id)
        match_percentage = int(grant.get("matchPercentage") or 0)
        why_it_matches = str(grant.get("whyItMatches") or "")
        timestamp = self._timestamp()

        grant["sourceUrl"] = source_url

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO saved_grants (
                    grant_id, user_id, title, programme, funding_amount,
                    deadline, source_url, match_percentage, why_it_matches,
                    grant_json, saved_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(grant_id) DO UPDATE SET
                    title = excluded.title,
                    programme = excluded.programme,
                    funding_amount = excluded.funding_amount,
                    deadline = excluded.deadline,
                    source_url = excluded.source_url,
                    match_percentage = excluded.match_percentage,
                    why_it_matches = excluded.why_it_matches,
                    grant_json = excluded.grant_json,
                    saved_at = excluded.saved_at,
                    user_id = excluded.user_id
                """,
                (
                    grant_id,
                    user_id,
                    title,
                    programme,
                    funding_amount,
                    deadline,
                    source_url,
                    match_percentage,
                    why_it_matches,
                    json.dumps(grant, ensure_ascii=False),
                    timestamp,
                ),
            )
        return {
            "id": grant_id,
            "title": title,
            "programme": programme,
            "fundingAmount": funding_amount,
            "deadline": deadline,
            "sourceUrl": source_url,
            "matchPercentage": match_percentage,
            "whyItMatches": why_it_matches,
            "savedAt": timestamp,
            "grant": grant,
        }

    def list_saved_grants(self, user_id: str | None = None) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT grant_id, title, programme, funding_amount, deadline,
                       source_url, match_percentage, why_it_matches, grant_json, saved_at
                FROM saved_grants
                WHERE user_id = ? OR ? IS NULL
                ORDER BY saved_at DESC
                """,
                (user_id, user_id),
            ).fetchall()
        return [
            {
                "id": row["grant_id"],
                "title": row["title"],
                "programme": row["programme"],
                "fundingAmount": row["funding_amount"],
                "deadline": row["deadline"],
                "sourceUrl": _normalize_eu_url(row["source_url"], row["grant_id"]),
                "matchPercentage": row["match_percentage"],
                "whyItMatches": row["why_it_matches"],
                "savedAt": row["saved_at"],
                "grant": json.loads(row["grant_json"]),
            }
            for row in rows
        ]

    def delete_saved_grant(self, grant_id: str, user_id: str | None = None) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM saved_grants WHERE grant_id = ? AND (user_id = ? OR ? IS NULL)",
                (grant_id, user_id, user_id),
            )
            return cursor.rowcount > 0


def _normalize_eu_url(source_url: str, grant_id: str = "") -> str:
    """Fix raw/broken API URLs into canonical working EU Funding & Tenders Portal topic links."""
    if "commission.europa.eu/funding-tenders" in source_url or "topicDetails" in source_url:
        topic = source_url.split("/")[-1].replace(".html", "").lower()
        return f"https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/{topic}"
    if not source_url and grant_id.startswith("HORIZON"):
        return f"https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/{grant_id.lower()}"
    return source_url
