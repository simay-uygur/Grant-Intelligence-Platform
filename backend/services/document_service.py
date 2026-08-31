from collections.abc import Iterator
from typing import Any

from backend.core.logging import get_logger
from backend.schemas.documents import (
    ApplicationDocument,
    ApplicationListResponse,
    ApplicationStatus,
    ApplicationSummary,
    DocumentQARequest,
    DocumentQAResponse,
    GenerateOutlineRequest,
    GenerateOutlineResponse,
    OutlineSection,
    RewriteSectionRequest,
    RewriteSectionResponse,
    StartApplicationRequest,
    StoredApplication,
)
from backend.schemas.grants import GrantResult
from backend.schemas.sheets import SheetsBundle, UpdateSheetTabRequest
from backend.services.agent_service import AgentService
from backend.services.application_store import (
    ApplicationStore,
    StoredApplicationRevisionConflictError,
    StoredApplicationSectionNotFoundError,
)
from backend.services.export_service import build_export
from backend.services.sheets_service import (
    build_generation_prompt,
    empty_sheets,
    generate_sheets_via_bedrock,
    parse_generated_sheets,
    recompute_bundle,
    validate_and_replace_tab,
)

logger = get_logger("services.document")


class ApplicationNotFoundError(ValueError):
    pass


class ApplicationSectionNotFoundError(ValueError):
    pass


class ApplicationRevisionConflictError(ValueError):
    pass


def _grant_to_dict(grant: Any) -> dict[str, Any]:
    """Normalize the grant payload (Pydantic model, raw dict, or absent) to a plain dict."""
    if grant is None:
        return {}
    if isinstance(grant, GrantResult):
        return grant.model_dump(exclude_none=True, exclude_defaults=True)
    if hasattr(grant, "model_dump"):
        res: dict[str, Any] = grant.model_dump(exclude_none=True, exclude_defaults=True)
        return res
    if isinstance(grant, dict):
        return grant
    return {}


def _profile_to_dict(profile: Any) -> dict[str, Any] | None:
    """Normalize the profile payload (AgentProfile, raw dict, or absent) to a plain dict."""
    if profile is None:
        return None
    if hasattr(profile, "to_agent_profile"):
        res: dict[str, Any] = profile.to_agent_profile()
        return res
    if hasattr(profile, "model_dump"):
        res_dump: dict[str, Any] = profile.model_dump(exclude_none=True)
        return res_dump
    if isinstance(profile, dict):
        return profile
    return None


class DocumentService:
    def __init__(self, database_path: str | None = None) -> None:
        self.agent_service = AgentService()
        self.application_store = ApplicationStore(database_path=database_path)

    def generate_outline(self, payload: GenerateOutlineRequest, user_id: str | None = None) -> GenerateOutlineResponse:
        logger.info("Generating adaptive section outline (user_id=%s)", user_id)
        grant = _grant_to_dict(payload.grant)
        attachments = self._conversation_attachments(payload.conversationId, user_id)
        raw_sections = self.agent_service.generate_outline(
            grant,
            payload.profile.to_agent_profile(),
            template_type=payload.templateType,
            custom_instructions=payload.customInstructions,
            attachments=attachments,
        )
        sections = [OutlineSection.model_validate(s) for s in raw_sections]
        return GenerateOutlineResponse(
            grantId=str(grant.get("id") or grant.get("identifier") or ""),
            grantTitle=str(grant.get("title") or ""),
            sourceUrl=str(grant.get("sourceUrl") or grant.get("url") or "") or None,
            programme=str(grant.get("programme") or "") or None,
            sections=sections,
        )

    def start_application(self, payload: StartApplicationRequest, user_id: str | None = None) -> ApplicationDocument:
        logger.info("Starting application drafting (user_id=%s)", user_id)
        grant = _grant_to_dict(payload.grant)
        attachments = self._conversation_attachments(payload.conversationId, user_id)
        custom_sections = [s.model_dump(exclude_none=True) for s in payload.sections] if payload.sections else None

        start_kwargs: dict[str, Any] = {
            "custom_instructions": payload.customInstructions,
            "template_type": payload.templateType,
            "attachments": attachments,
        }
        if custom_sections is not None:
            start_kwargs["custom_sections"] = custom_sections

        try:
            document = self.agent_service.start_application(
                grant,
                payload.profile.to_agent_profile(),
                **start_kwargs,
            )
        except TypeError:
            document = self.agent_service.start_application(
                grant,
                payload.profile.to_agent_profile(),
                custom_instructions=payload.customInstructions,
                template_type=payload.templateType,
                attachments=attachments,
            )

        application_document = ApplicationDocument.model_validate(document)
        self.application_store.save_application(
            application_document,
            grant=grant,
            profile=payload.profile.model_dump(exclude_none=True),
            user_id=user_id,
            custom_instructions=payload.customInstructions,
            template_type=payload.templateType,
        )
        return application_document

    def start_application_stream(self, payload: StartApplicationRequest, user_id: str | None = None) -> Iterator[dict[str, Any]]:
        grant = _grant_to_dict(payload.grant)
        attachments = self._conversation_attachments(payload.conversationId, user_id)
        custom_sections = [s.model_dump(exclude_none=True) for s in payload.sections] if payload.sections else None

        stream_kwargs: dict[str, Any] = {
            "custom_instructions": payload.customInstructions,
            "template_type": payload.templateType,
            "attachments": attachments,
        }
        if custom_sections is not None:
            stream_kwargs["custom_sections"] = custom_sections

        try:
            stream_gen = self.agent_service.start_application_stream(
                grant,
                payload.profile.to_agent_profile(),
                **stream_kwargs,
            )
        except TypeError:
            stream_gen = self.agent_service.start_application_stream(
                grant,
                payload.profile.to_agent_profile(),
                custom_instructions=payload.customInstructions,
                template_type=payload.templateType,
                attachments=attachments,
            )

        for event in stream_gen:
            if event.get("event") == "result" and "document" in event.get("data", {}):
                document = event["data"]["document"]
                if not document.get("error"):
                    app_doc = ApplicationDocument.model_validate(document)
                    self.application_store.save_application(
                        app_doc,
                        grant=grant,
                        profile=payload.profile.model_dump(exclude_none=True),
                        user_id=user_id,
                        custom_instructions=payload.customInstructions,
                        template_type=payload.templateType,
                    )
                    event = {
                        **event,
                        "data": {"document": app_doc.model_dump(exclude_none=True)},
                    }
            yield event

    def list_applications(
        self,
        *,
        status: ApplicationStatus | None,
        limit: int,
        offset: int,
        user_id: str | None = None,
    ) -> ApplicationListResponse:
        applications, total = self.application_store.list_applications(
            status=status,
            limit=limit,
            offset=offset,
            user_id=user_id,
        )
        return ApplicationListResponse(
            applications=[ApplicationSummary.model_validate(application) for application in applications],
            total=total,
            limit=limit,
            offset=offset,
        )

    def get_application(self, application_id: str, user_id: str | None = None) -> StoredApplication:
        application = self.application_store.get_application(application_id, user_id)
        if application is None:
            raise ApplicationNotFoundError(f"Application '{application_id}' does not exist.")
        return StoredApplication.model_validate(application)

    def get_latest_application_for_grant(self, grant_id: str, user_id: str | None = None) -> StoredApplication:
        application = self.application_store.get_latest_application_for_grant(grant_id, user_id)
        if application is None:
            raise ApplicationNotFoundError(f"Grant '{grant_id}' does not have a saved application.")
        return StoredApplication.model_validate(application)

    def update_application_status(
        self,
        application_id: str,
        status: ApplicationStatus,
        user_id: str | None = None,
    ) -> StoredApplication:
        application = self.application_store.update_status(application_id, status, user_id)
        if application is None:
            raise ApplicationNotFoundError(f"Application '{application_id}' does not exist.")
        return StoredApplication.model_validate(application)

    def delete_application(self, application_id: str, user_id: str | None = None) -> None:
        self.application_store.delete_application(application_id, user_id)

    def update_application_section(
        self,
        application_id: str,
        section_id: str,
        content: str,
        user_id: str | None = None,
        base_revision: int | None = None,
    ) -> StoredApplication:
        try:
            application = self.application_store.update_section(
                application_id,
                section_id,
                content,
                user_id,
                base_revision,
            )
        except StoredApplicationSectionNotFoundError as exc:
            raise ApplicationSectionNotFoundError(str(exc)) from exc
        except StoredApplicationRevisionConflictError as exc:
            raise ApplicationRevisionConflictError(str(exc)) from exc
        if application is None:
            raise ApplicationNotFoundError(f"Application '{application_id}' does not exist.")
        return StoredApplication.model_validate(application)

    def rewrite_section(
        self,
        document_id: str,
        section_id: str,
        payload: RewriteSectionRequest,
        user_id: str | None = None,
    ) -> RewriteSectionResponse:
        self._ensure_rewrite_revision(document_id, section_id, payload, user_id)
        grant = _grant_to_dict(payload.grant)
        content = self.agent_service.rewrite_section(
            payload.sectionTitle,
            payload.currentContent,
            payload.profile.to_agent_profile(),
            grant=grant,
            instruction=payload.instruction,
        )
        saved_revision: int | None = None
        if payload.persist and self.application_store.get_application(document_id, user_id) is not None:
            try:
                application = self.application_store.update_section(
                    document_id,
                    section_id,
                    content,
                    user_id,
                    payload.baseRevision,
                )
                if application is not None:
                    matching = next((section for section in application["sections"] if section["id"] == section_id), None)
                    saved_revision = matching.get("revision") if matching else None
            except StoredApplicationSectionNotFoundError as exc:
                raise ApplicationSectionNotFoundError(str(exc)) from exc
            except StoredApplicationRevisionConflictError as exc:
                raise ApplicationRevisionConflictError(str(exc)) from exc
        return RewriteSectionResponse(
            sectionId=section_id,
            title=payload.sectionTitle,
            content=content,
            revision=saved_revision,
            baseRevision=payload.baseRevision,
        )

    def rewrite_section_stream(
        self,
        document_id: str,
        section_id: str,
        payload: RewriteSectionRequest,
        user_id: str | None = None,
    ) -> Iterator[dict[str, Any]]:
        self._ensure_rewrite_revision(document_id, section_id, payload, user_id)
        grant = _grant_to_dict(payload.grant)
        for event in self.agent_service.rewrite_section_stream(
            payload.sectionTitle,
            payload.currentContent,
            payload.profile.to_agent_profile(),
            grant=grant,
            instruction=payload.instruction,
        ):
            if event.get("event") == "result" and "content" in event.get("data", {}):
                content = event["data"]["content"]
                saved_revision: int | None = None
                if payload.persist and self.application_store.get_application(document_id, user_id) is not None:
                    try:
                        application = self.application_store.update_section(
                            document_id,
                            section_id,
                            content,
                            user_id,
                            payload.baseRevision,
                        )
                        if application is not None:
                            matching = next((section for section in application["sections"] if section["id"] == section_id), None)
                            saved_revision = matching.get("revision") if matching else None
                    except StoredApplicationSectionNotFoundError as exc:
                        raise ApplicationSectionNotFoundError(str(exc)) from exc
                    except StoredApplicationRevisionConflictError as exc:
                        raise ApplicationRevisionConflictError(str(exc)) from exc
                response = RewriteSectionResponse(
                    sectionId=section_id,
                    title=payload.sectionTitle,
                    content=content,
                    revision=saved_revision,
                    baseRevision=payload.baseRevision,
                )
                event = {
                    **event,
                    "data": response.model_dump(exclude_none=True),
                }
            yield event

    def _ensure_rewrite_revision(
        self,
        document_id: str,
        section_id: str,
        payload: RewriteSectionRequest,
        user_id: str | None,
    ) -> None:
        if not payload.persist or payload.baseRevision is None:
            return
        application = self.application_store.get_application(document_id, user_id)
        if application is None:
            return
        matching = next((section for section in application["sections"] if section["id"] == section_id), None)
        if matching is None:
            raise ApplicationSectionNotFoundError(f"Section '{section_id}' does not exist in application '{document_id}'.")
        current_revision = int(matching.get("revision") or 1)
        if current_revision != payload.baseRevision:
            raise ApplicationRevisionConflictError(f"Section '{section_id}' changed since this edit started. Current revision is {current_revision}; edit was based on {payload.baseRevision}.")

    def _resolve_qa_context(
        self,
        document_id: str,
        payload: DocumentQARequest,
        user_id: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any] | None, dict[str, Any] | None, str]:
        """Extract or resolve document, grant, profile context and attachment background for Q&A."""
        stored_app: dict[str, Any] | None = None
        if document_id and document_id != "active-document":
            stored_app = self.application_store.get_application(document_id, user_id)

        document: dict[str, Any]
        if payload.document is not None:
            document = payload.document.model_dump(exclude_none=True) if hasattr(payload.document, "model_dump") else payload.document
        elif stored_app is not None:
            document = {
                "id": stored_app.get("id", document_id),
                "grantId": stored_app.get("grantId", ""),
                "grantTitle": stored_app.get("grantTitle", ""),
                "sections": stored_app.get("sections", []),
            }
        else:
            raise ApplicationNotFoundError(f"Application document '{document_id}' could not be resolved.")

        grant = _grant_to_dict(payload.grant) or (stored_app.get("grant") if stored_app else None)
        profile = _profile_to_dict(payload.profile) or (stored_app.get("profile") if stored_app else None)
        attachments = self._application_attachments(document_id, user_id) if stored_app is not None else ""

        return document, grant, profile, attachments

    def _conversation_attachments(self, conversation_id: str | None, user_id: str | None) -> str:
        """Build the attachment background block for uploads linked to a chat conversation."""
        if not conversation_id:
            return ""
        return self._attachments_block(self.application_store.list_uploads_for_conversation(conversation_id, user_id))

    def _application_attachments(self, application_id: str, user_id: str | None) -> str:
        return self._attachments_block(self.application_store.list_uploads_for_application(application_id, user_id))

    @staticmethod
    def _attachments_block(uploads: list[dict[str, Any]]) -> str:
        if not uploads:
            return ""
        blocks = []
        for upload in uploads:
            excerpt = upload.get("extractedText") or upload.get("textSnippet") or ""
            blocks.append(f"ATTACHMENT '{upload['filename']}':\n{excerpt[:4000]}")
        return "\n\n".join(blocks)

    def document_qa(
        self,
        document_id: str,
        payload: DocumentQARequest,
        user_id: str | None = None,
    ) -> DocumentQAResponse:
        document, grant, profile, attachments = self._resolve_qa_context(document_id, payload, user_id)
        result = self.agent_service.document_qa(
            question=payload.question,
            document=document,
            grant=grant,
            profile=profile,
            section_id=payload.sectionId,
            attachments=attachments,
        )
        return DocumentQAResponse.model_validate(result)

    def document_qa_stream(
        self,
        document_id: str,
        payload: DocumentQARequest,
        user_id: str | None = None,
    ) -> Iterator[dict[str, Any]]:
        document, grant, profile, attachments = self._resolve_qa_context(document_id, payload, user_id)
        for event in self.agent_service.document_qa_stream(
            question=payload.question,
            document=document,
            grant=grant,
            profile=profile,
            section_id=payload.sectionId,
            attachments=attachments,
        ):
            if event.get("event") == "result" and "answer" in event.get("data", {}):
                validated = DocumentQAResponse.model_validate(event["data"])
                event = {
                    **event,
                    "data": validated.model_dump(exclude_none=True),
                }
            yield event

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
        return self.application_store.save_upload(
            filename=filename,
            content_type=content_type,
            extracted_text=extracted_text,
            user_id=user_id,
            application_id=application_id,
            conversation_id=conversation_id,
        )

    def list_uploads(self, application_id: str, user_id: str | None = None) -> list[dict]:
        return self.application_store.list_uploads_for_application(application_id, user_id)

    # ------------------------------------------------------------------
    # Structured sheets (work packages / budget / risks / consortium)
    # ------------------------------------------------------------------

    def _require_application(self, document_id: str, user_id: str | None) -> dict[str, Any]:
        application = self.application_store.get_application(document_id, user_id)
        if application is None:
            raise ApplicationNotFoundError(f"Application '{document_id}' does not exist.")
        return application

    def get_sheets(self, document_id: str, user_id: str | None = None) -> SheetsBundle:
        self._require_application(document_id, user_id)
        stored = self.application_store.get_sheets(document_id, user_id)
        if stored is None:
            return SheetsBundle()
        bundle = SheetsBundle.model_validate(stored)
        return recompute_bundle(bundle)

    def update_sheet_tab(self, document_id: str, tab_name: str, payload: UpdateSheetTabRequest, user_id: str | None = None) -> SheetsBundle:
        self._require_application(document_id, user_id)
        stored = self.application_store.get_sheets(document_id, user_id) or empty_sheets()
        try:
            bundle = validate_and_replace_tab(SheetsBundle.model_validate(stored), tab_name, payload.items)
        except ValueError as exc:
            raise ValueError(str(exc)) from exc
        if not self.application_store.save_sheets(document_id, bundle.model_dump(), user_id):
            raise ApplicationNotFoundError(f"Application '{document_id}' does not exist.")
        return bundle

    def generate_sheets(self, document_id: str, grant_limit: float | None = None, user_id: str | None = None) -> SheetsBundle:
        application = self._require_application(document_id, user_id)
        prompt = build_generation_prompt(
            application["grant"],
            application["profile"],
            grant_limit,
            application.get("customInstructions"),
        )
        raw = generate_sheets_via_bedrock(prompt)
        bundle = parse_generated_sheets(raw)
        if not self.application_store.save_sheets(document_id, bundle.model_dump(), user_id):
            raise ApplicationNotFoundError(f"Application '{document_id}' does not exist.")
        logger.info("Generated structured sheets for application '%s'", document_id)
        return bundle

    # ------------------------------------------------------------------
    # Continuous paper export
    # ------------------------------------------------------------------

    def export_document(self, document_id: str, fmt: str, user_id: str | None = None) -> tuple[str, str]:
        """Return (content, filename) for the requested export format."""
        application = self._require_application(document_id, user_id)
        sheets = self.application_store.get_sheets(document_id, user_id)
        content = build_export(application, sheets, fmt)
        extension = {"html": "html", "markdown": "md", "text": "txt"}[fmt]
        filename = f"{document_id}-proposal.{extension}"
        return content, filename
