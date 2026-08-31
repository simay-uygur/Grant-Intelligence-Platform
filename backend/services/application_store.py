from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.engine import Engine

from backend.core.database import (
    applications_table,
    build_engine,
    build_upsert,
    document_uploads_table,
    grant_search_batches_table,
    metadata,
    saved_grants_table,
)
from backend.core.logging import get_logger
from backend.schemas.documents import ApplicationDocument, ApplicationStatus

logger = get_logger("services.application_store")


class StoredApplicationSectionNotFoundError(ValueError):
    pass


class StoredApplicationRevisionConflictError(ValueError):
    pass


class ApplicationStore:
    """Persistence for generated application documents and their inputs.

    Uses SQLAlchemy Core so the same code runs against local SQLite and a
    managed PostgreSQL instance (see ``backend/core/database.py``).
    """

    def __init__(self, database_path: str | None = None) -> None:
        self.engine: Engine = build_engine(database_path)
        self._initialize_schema()

    def _initialize_schema(self) -> None:
        metadata.create_all(self.engine)
        self._ensure_table_columns(
            "applications",
            {
                "custom_instructions": "TEXT",
                "template_type": "VARCHAR(32)",
                "sheets_json": "TEXT",
            },
        )
        self._ensure_table_columns(
            "document_uploads",
            {"conversation_id": "VARCHAR(64)"},
        )
        if self.engine.dialect.name == "sqlite":
            self._migrate_legacy_status_values()

    def _ensure_table_columns(self, table: str, new_columns: dict[str, str]) -> None:
        """Add columns introduced after the baseline to databases created by create_all.

        Keeps older local SQLite files working without requiring a manual
        `alembic upgrade head`; Alembic remains the source of truth for
        managed PostgreSQL deployments.
        """
        from sqlalchemy import inspect

        try:
            inspector = inspect(self.engine)
            existing = {column["name"] for column in inspector.get_columns(table)}
        except Exception as exc:  # pragma: no cover - fresh database race
            logger.debug("Schema inspection skipped for %s: %s", table, exc)
            return
        missing = {name: ddl for name, ddl in new_columns.items() if name not in existing}
        if not missing:
            return
        logger.info("Adding missing %s columns: %s", table, ", ".join(missing))
        with self.engine.begin() as connection:
            for name, ddl in missing.items():
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))

    def _migrate_legacy_status_values(self) -> None:
        """One-time SQLite migration for pre-'under_review' databases (legacy path)."""
        with self.engine.begin() as connection:
            row = connection.execute(text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'applications'")).first()
            if row and "'under_review'" not in (row[0] or ""):
                logger.info("Migrating legacy application status values")
                connection.execute(text("ALTER TABLE applications RENAME TO applications_legacy"))
                connection.execute(
                    text(
                        """
                        CREATE TABLE applications (
                            id TEXT PRIMARY KEY,
                            user_id TEXT,
                            grant_id TEXT NOT NULL,
                            grant_title TEXT NOT NULL,
                            status TEXT NOT NULL DEFAULT 'drafting'
                                CHECK (status IN ('drafting','submitted','under_review','approved','rejected','archived')),
                            sections_json TEXT NOT NULL,
                            grant_json TEXT NOT NULL,
                            profile_json TEXT NOT NULL,
                            created_at TEXT NOT NULL,
                            updated_at TEXT NOT NULL
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        """
                        INSERT INTO applications (
                            id, user_id, grant_id, grant_title, status,
                            sections_json, grant_json, profile_json, created_at, updated_at
                        )
                        SELECT id, user_id, grant_id, grant_title,
                               CASE status WHEN 'draft' THEN 'drafting' WHEN 'completed' THEN 'approved' ELSE status END,
                               sections_json, grant_json, profile_json, created_at, updated_at
                        FROM applications_legacy
                        """
                    )
                )
                connection.execute(text("DROP TABLE applications_legacy"))

    # ------------------------------------------------------------------
    # Applications
    # ------------------------------------------------------------------

    def save_application(
        self,
        document: ApplicationDocument,
        *,
        grant: dict,
        profile: dict,
        user_id: str | None = None,
        custom_instructions: str | None = None,
        template_type: str | None = None,
    ) -> dict:
        logger.info("Saving application '%s' for grant '%s' (user_id=%s)", document.id, document.grantId, user_id)
        timestamp = self._timestamp()
        values = {
            "id": document.id,
            "user_id": user_id,
            "grant_id": document.grantId,
            "grant_title": document.grantTitle,
            "status": "drafting",
            "sections_json": json.dumps([_section_with_revision(section.model_dump()) for section in document.sections], ensure_ascii=False),
            "grant_json": json.dumps(grant, ensure_ascii=False),
            "profile_json": json.dumps(profile, ensure_ascii=False),
            "custom_instructions": custom_instructions,
            "template_type": template_type,
            "created_at": timestamp,
            "updated_at": document.updatedAt,
        }
        with self.engine.begin() as connection:
            connection.execute(build_upsert(self.engine, applications_table, values, key_column="id", exclude_from_update=("created_at",)))
        stored = self.get_application(document.id, user_id)
        if stored is None:  # pragma: no cover - protects against unexpected database failures
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
        columns = [
            applications_table.c.id,
            applications_table.c.grant_id,
            applications_table.c.grant_title,
            applications_table.c.status,
            applications_table.c.sections_json,
            applications_table.c.grant_json,
            applications_table.c.profile_json,
            applications_table.c.custom_instructions,
            applications_table.c.template_type,
            applications_table.c.sheets_json,
            applications_table.c.created_at,
            applications_table.c.updated_at,
        ]
        count_stmt = select(func.count()).select_from(applications_table)
        rows_stmt = select(*columns)
        if status is not None:
            count_stmt = count_stmt.where(applications_table.c.status == str(status))
            rows_stmt = rows_stmt.where(applications_table.c.status == str(status))
        if user_id is not None:
            count_stmt = count_stmt.where(applications_table.c.user_id == user_id)
            rows_stmt = rows_stmt.where(applications_table.c.user_id == user_id)
        rows_stmt = rows_stmt.order_by(applications_table.c.updated_at.desc(), applications_table.c.id.asc()).limit(limit).offset(offset)
        with self.engine.begin() as connection:
            total = connection.execute(count_stmt).scalar_one()
            rows = connection.execute(rows_stmt).mappings().all()
        return [self._summary_from_row(row) for row in rows], int(total)

    def get_application(self, application_id: str, user_id: str | None = None) -> dict | None:
        stmt = _application_select().where(applications_table.c.id == application_id)
        if user_id is not None:
            stmt = stmt.where(applications_table.c.user_id == user_id)
        with self.engine.begin() as connection:
            row = connection.execute(stmt).mappings().first()
        return self._application_from_row(row) if row is not None else None

    def get_latest_application_for_grant(self, grant_id: str, user_id: str | None = None) -> dict | None:
        stmt = _application_select().where(applications_table.c.grant_id == grant_id).where(applications_table.c.status != "archived")
        if user_id is not None:
            stmt = stmt.where(applications_table.c.user_id == user_id)
        stmt = stmt.order_by(applications_table.c.updated_at.desc(), applications_table.c.id.asc()).limit(1)
        with self.engine.begin() as connection:
            row = connection.execute(stmt).mappings().first()
        return self._application_from_row(row) if row is not None else None

    def update_status(
        self,
        application_id: str,
        status: ApplicationStatus,
        user_id: str | None = None,
    ) -> dict | None:
        timestamp = self._timestamp()
        stmt = update(applications_table).where(applications_table.c.id == application_id).values(status=str(status), updated_at=timestamp)
        if user_id is not None:
            stmt = stmt.where(applications_table.c.user_id == user_id)
        with self.engine.begin() as connection:
            result = connection.execute(stmt)
            updated = result.rowcount > 0
        if not updated:
            return None
        return self.get_application(application_id, user_id)

    def delete_application(self, application_id: str, user_id: str | None = None) -> bool:
        stmt = delete(applications_table).where(applications_table.c.id == application_id)
        if user_id is not None:
            stmt = stmt.where(applications_table.c.user_id == user_id)
        with self.engine.begin() as connection:
            result = connection.execute(stmt)
            return result.rowcount > 0

    def update_section(
        self,
        application_id: str,
        section_id: str,
        content: str,
        user_id: str | None = None,
        base_revision: int | None = None,
    ) -> dict | None:
        timestamp = self._timestamp()
        with self.engine.begin() as connection:
            stmt = select(applications_table.c.sections_json).where(applications_table.c.id == application_id)
            if user_id is not None:
                stmt = stmt.where(applications_table.c.user_id == user_id)
            row = connection.execute(stmt).mappings().first()
            if row is None:
                return None

            original_sections_json = row["sections_json"]
            sections = [_section_with_revision(section) for section in json.loads(original_sections_json)]
            matching_section = next(
                (section for section in sections if section["id"] == section_id),
                None,
            )
            if matching_section is None:
                raise StoredApplicationSectionNotFoundError(f"Section '{section_id}' does not exist in application '{application_id}'.")
            current_revision = int(matching_section.get("revision") or 1)
            if base_revision is not None and current_revision != base_revision:
                raise StoredApplicationRevisionConflictError(f"Section '{section_id}' changed since this edit started. Current revision is {current_revision}; edit was based on {base_revision}.")

            matching_section["content"] = content
            matching_section["revision"] = current_revision + 1
            update_stmt = (
                applications_table.update()
                .where(applications_table.c.id == application_id)
                .where(applications_table.c.sections_json == original_sections_json)
                .values(
                    sections_json=json.dumps(sections, ensure_ascii=False),
                    updated_at=timestamp,
                )
            )
            if user_id is not None:
                update_stmt = update_stmt.where(applications_table.c.user_id == user_id)
            result = connection.execute(update_stmt)
            if result.rowcount == 0:
                raise StoredApplicationRevisionConflictError(f"Section '{section_id}' changed while this edit was being saved. Please refresh and try again.")
        return self.get_application(application_id, user_id)

    # ------------------------------------------------------------------
    # Structured sheets (work packages / budget / risks / consortium)
    # ------------------------------------------------------------------

    def get_sheets(self, application_id: str, user_id: str | None = None) -> dict | None:
        stmt = select(applications_table.c.sheets_json).where(applications_table.c.id == application_id)
        if user_id is not None:
            stmt = stmt.where(applications_table.c.user_id == user_id)
        with self.engine.begin() as connection:
            row = connection.execute(stmt).mappings().first()
        if row is None:
            return None
        return json.loads(row["sheets_json"]) if row["sheets_json"] else None

    def save_sheets(self, application_id: str, sheets: dict, user_id: str | None = None) -> bool:
        timestamp = self._timestamp()
        with self.engine.begin() as connection:
            stmt = (
                applications_table.update()
                .where(applications_table.c.id == application_id)
                .values(
                    sheets_json=json.dumps(sheets, ensure_ascii=False),
                    updated_at=timestamp,
                )
            )
            if user_id is not None:
                stmt = stmt.where(applications_table.c.user_id == user_id)
            result = connection.execute(stmt)
            return result.rowcount > 0

    # ------------------------------------------------------------------
    # Document uploads
    # ------------------------------------------------------------------

    def save_upload(
        self,
        *,
        filename: str,
        content_type: str,
        extracted_text: str,
        user_id: str | None = None,
        application_id: str | None = None,
        conversation_id: str | None = None,
    ) -> dict:
        upload_id = f"upload-{uuid.uuid4().hex[:12]}"
        timestamp = self._timestamp()
        values = {
            "id": upload_id,
            "user_id": user_id,
            "application_id": application_id,
            "conversation_id": conversation_id,
            "filename": filename,
            "content_type": content_type,
            "extracted_text": extracted_text,
            "character_count": len(extracted_text),
            "created_at": timestamp,
        }
        with self.engine.begin() as connection:
            connection.execute(document_uploads_table.insert().values(**values))
        return {
            "id": upload_id,
            "filename": filename,
            "contentType": content_type,
            "characterCount": len(extracted_text),
            "textSnippet": extracted_text[:500],
            "applicationId": application_id,
            "conversationId": conversation_id,
            "uploadedAt": timestamp,
        }

    def list_uploads_for_application(self, application_id: str, user_id: str | None = None) -> list[dict]:
        stmt = select(document_uploads_table).where(document_uploads_table.c.application_id == application_id)
        if user_id is not None:
            stmt = stmt.where(document_uploads_table.c.user_id == user_id)
        with self.engine.begin() as connection:
            rows = connection.execute(stmt).mappings().all()
        return [self._upload_from_row(row) for row in rows]

    def list_uploads_for_conversation(self, conversation_id: str, user_id: str | None = None) -> list[dict]:
        stmt = select(document_uploads_table).where(document_uploads_table.c.conversation_id == conversation_id)
        if user_id is not None:
            stmt = stmt.where(document_uploads_table.c.user_id == user_id)
        stmt = stmt.order_by(document_uploads_table.c.created_at.desc()).limit(10)
        with self.engine.begin() as connection:
            rows = connection.execute(stmt).mappings().all()
        return [self._upload_from_row(row) for row in rows]

    @staticmethod
    def _upload_from_row(row: Any) -> dict:
        extracted_text = row["extracted_text"]
        return {
            "id": row["id"],
            "filename": row["filename"],
            "contentType": row["content_type"],
            "characterCount": row["character_count"],
            "textSnippet": extracted_text[:500],
            "extractedText": extracted_text,
            "applicationId": row["application_id"],
            "conversationId": row["conversation_id"] if "conversation_id" in row.keys() else None,
            "uploadedAt": row["created_at"],
        }

    # ------------------------------------------------------------------
    # Saved grants
    # ------------------------------------------------------------------

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

        values = {
            "grant_id": grant_id,
            "user_id": user_id,
            "title": title,
            "programme": programme,
            "funding_amount": funding_amount,
            "deadline": deadline,
            "source_url": source_url,
            "match_percentage": match_percentage,
            "why_it_matches": why_it_matches,
            "grant_json": json.dumps(grant, ensure_ascii=False),
            "saved_at": timestamp,
        }
        with self.engine.begin() as connection:
            connection.execute(build_upsert(self.engine, saved_grants_table, values, key_column="grant_id"))
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
        stmt = select(
            saved_grants_table.c.grant_id,
            saved_grants_table.c.title,
            saved_grants_table.c.programme,
            saved_grants_table.c.funding_amount,
            saved_grants_table.c.deadline,
            saved_grants_table.c.source_url,
            saved_grants_table.c.match_percentage,
            saved_grants_table.c.why_it_matches,
            saved_grants_table.c.grant_json,
            saved_grants_table.c.saved_at,
        ).order_by(saved_grants_table.c.saved_at.desc())
        if user_id is not None:
            stmt = stmt.where(saved_grants_table.c.user_id == user_id)
        with self.engine.begin() as connection:
            rows = connection.execute(stmt).mappings().all()
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
        stmt = saved_grants_table.delete().where(saved_grants_table.c.grant_id == grant_id)
        if user_id is not None:
            stmt = stmt.where(saved_grants_table.c.user_id == user_id)
        with self.engine.begin() as connection:
            result = connection.execute(stmt)
            return result.rowcount > 0

    # ------------------------------------------------------------------
    # Search batch history (offered grants groups)
    # ------------------------------------------------------------------

    def record_search_batch(
        self,
        grants: list[dict[str, Any]],
        profile: dict[str, Any],
        conversation_id: str | None = None,
        user_id: str | None = None,
        query: str | None = None,
        source_summary: str | None = None,
    ) -> dict[str, Any]:
        """Persist a batch of offered grants returned for a conversation/user search."""
        batch_id = str(uuid.uuid4())
        timestamp = self._timestamp()

        # Calculate batch index for this conversation
        batch_index = 1
        if conversation_id:
            with self.engine.begin() as connection:
                count_stmt = select(func.count()).select_from(grant_search_batches_table).where(grant_search_batches_table.c.conversation_id == conversation_id)
                existing_count = connection.execute(count_stmt).scalar() or 0
                batch_index = int(existing_count) + 1

        record = {
            "id": batch_id,
            "conversation_id": conversation_id,
            "user_id": user_id,
            "batch_index": batch_index,
            "query": query,
            "profile_json": json.dumps(profile, ensure_ascii=False),
            "grants_json": json.dumps(grants, ensure_ascii=False),
            "source_summary": source_summary,
            "created_at": timestamp,
        }

        with self.engine.begin() as connection:
            connection.execute(grant_search_batches_table.insert().values(**record))

        logger.info(
            "Recorded grant search batch '%s' (#%d) with %d grants for conversation=%s (user_id=%s)",
            batch_id,
            batch_index,
            len(grants),
            conversation_id,
            user_id,
        )

        return {
            "id": batch_id,
            "conversationId": conversation_id,
            "userId": user_id,
            "batchIndex": batch_index,
            "query": query,
            "profile": profile,
            "grants": grants,
            "sourceSummary": source_summary,
            "createdAt": timestamp,
        }

    def list_search_batches(
        self,
        conversation_id: str | None = None,
        user_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List search batches, optionally filtered by conversation_id or user_id."""
        stmt = (
            select(
                grant_search_batches_table.c.id,
                grant_search_batches_table.c.conversation_id,
                grant_search_batches_table.c.user_id,
                grant_search_batches_table.c.batch_index,
                grant_search_batches_table.c.query,
                grant_search_batches_table.c.profile_json,
                grant_search_batches_table.c.grants_json,
                grant_search_batches_table.c.source_summary,
                grant_search_batches_table.c.created_at,
            )
            .order_by(grant_search_batches_table.c.created_at.asc(), grant_search_batches_table.c.batch_index.asc())
            .limit(limit)
            .offset(offset)
        )
        if conversation_id is not None:
            stmt = stmt.where(grant_search_batches_table.c.conversation_id == conversation_id)
        if user_id is not None:
            stmt = stmt.where(grant_search_batches_table.c.user_id == user_id)

        with self.engine.begin() as connection:
            rows = connection.execute(stmt).mappings().all()

        return [
            {
                "id": row["id"],
                "conversationId": row["conversation_id"],
                "userId": row["user_id"],
                "batchIndex": row["batch_index"],
                "query": row["query"],
                "profile": json.loads(row["profile_json"]),
                "grants": json.loads(row["grants_json"]),
                "sourceSummary": row["source_summary"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ]

    def get_search_batch(self, batch_id: str, user_id: str | None = None) -> dict[str, Any] | None:
        """Fetch a specific search batch by ID."""
        stmt = select(
            grant_search_batches_table.c.id,
            grant_search_batches_table.c.conversation_id,
            grant_search_batches_table.c.user_id,
            grant_search_batches_table.c.batch_index,
            grant_search_batches_table.c.query,
            grant_search_batches_table.c.profile_json,
            grant_search_batches_table.c.grants_json,
            grant_search_batches_table.c.source_summary,
            grant_search_batches_table.c.created_at,
        ).where(grant_search_batches_table.c.id == batch_id)

        if user_id is not None:
            stmt = stmt.where(grant_search_batches_table.c.user_id == user_id)

        with self.engine.begin() as connection:
            row = connection.execute(stmt).mappings().first()

        if row is None:
            return None

        return {
            "id": row["id"],
            "conversationId": row["conversation_id"],
            "userId": row["user_id"],
            "batchIndex": row["batch_index"],
            "query": row["query"],
            "profile": json.loads(row["profile_json"]),
            "grants": json.loads(row["grants_json"]),
            "sourceSummary": row["source_summary"],
            "createdAt": row["created_at"],
        }

    def get_offered_grant_ids_for_conversation(self, conversation_id: str, user_id: str | None = None) -> list[str]:
        """Extract all grant IDs previously presented across all search batches for a conversation."""
        if not conversation_id:
            return []

        stmt = select(grant_search_batches_table.c.grants_json).where(grant_search_batches_table.c.conversation_id == conversation_id)
        if user_id is not None:
            stmt = stmt.where(grant_search_batches_table.c.user_id == user_id)

        with self.engine.begin() as connection:
            rows = connection.execute(stmt).scalars().all()

        offered_ids: list[str] = []
        seen = set()
        for raw_grants in rows:
            try:
                grants = json.loads(raw_grants)
                if isinstance(grants, list):
                    for g in grants:
                        if isinstance(g, dict):
                            for key in ("id", "identifier", "title"):
                                val = g.get(key)
                                if val and isinstance(val, str) and val.strip():
                                    cleaned = val.strip()
                                    if cleaned.lower() not in seen:
                                        seen.add(cleaned.lower())
                                        offered_ids.append(cleaned)
            except Exception as e:
                logger.warning("Error parsing grants_json in batch: %s", e)

        return offered_ids

    # ------------------------------------------------------------------
    # Row helpers
    # ------------------------------------------------------------------

    def _summary_from_row(self, row: Any) -> dict:  # row is a SQLAlchemy RowMapping
        sections = [_section_with_revision(section) for section in json.loads(row["sections_json"])]
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

    def _application_from_row(self, row: Any) -> dict:
        grant_dict = json.loads(row["grant_json"]) if row["grant_json"] else {}
        source_url = _normalize_eu_url(str(grant_dict.get("sourceUrl") or grant_dict.get("url") or ""), row["grant_id"])
        programme = str(grant_dict.get("programme") or "")
        return {
            "id": row["id"],
            "grantId": row["grant_id"],
            "grantTitle": row["grant_title"],
            "sourceUrl": source_url if source_url else None,
            "programme": programme if programme else None,
            "status": row["status"],
            "sections": [_section_with_revision(section) for section in json.loads(row["sections_json"])],
            "grant": grant_dict,
            "profile": json.loads(row["profile_json"]),
            "customInstructions": row["custom_instructions"],
            "templateType": row["template_type"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def _timestamp(self) -> str:
        return datetime.now(UTC).isoformat()

    @staticmethod
    def _grant_organisation(grant: dict) -> str:
        return str(grant.get("programme") or grant.get("source") or grant.get("fundingType") or "Unknown funder")


def select_func_count():
    from sqlalchemy import func, select

    return select(func.count()).select_from(applications_table)


def _section_with_revision(section: dict[str, Any]) -> dict[str, Any]:
    next_section = dict(section)
    try:
        revision = int(next_section.get("revision") or 1)
    except (TypeError, ValueError):
        revision = 1
    next_section["revision"] = max(1, revision)
    return next_section


def _application_select():
    """Standard column projection for full application rows."""
    return select(
        applications_table.c.id,
        applications_table.c.grant_id,
        applications_table.c.grant_title,
        applications_table.c.status,
        applications_table.c.sections_json,
        applications_table.c.grant_json,
        applications_table.c.profile_json,
        applications_table.c.custom_instructions,
        applications_table.c.template_type,
        applications_table.c.sheets_json,
        applications_table.c.created_at,
        applications_table.c.updated_at,
    )


def _normalize_eu_url(source_url: str, grant_id: str = "") -> str:
    """Fix raw/broken API URLs into canonical working EU Funding & Tenders Portal topic links."""
    if "commission.europa.eu/funding-tenders" in source_url or "topicDetails" in source_url:
        topic = source_url.split("/")[-1].replace(".html", "").lower()
        return f"https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/{topic}"
    if not source_url and grant_id.startswith("HORIZON"):
        return f"https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/{grant_id.lower()}"
    return source_url
