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
    RewriteSectionRequest,
    RewriteSectionResponse,
    StartApplicationRequest,
    StoredApplication,
)
from backend.schemas.grants import GrantResult
from backend.services.agent_service import AgentService
from backend.services.application_store import (
    ApplicationStore,
    StoredApplicationSectionNotFoundError,
)

logger = get_logger("services.document")


class ApplicationNotFoundError(ValueError):
    pass


class ApplicationSectionNotFoundError(ValueError):
    pass


def _grant_to_dict(grant: GrantResult | dict[str, Any] | None) -> dict[str, Any]:
    """Normalize the grant payload (Pydantic model, raw dict, or absent) to a plain dict."""
    if isinstance(grant, GrantResult):
        return grant.model_dump(exclude_none=True, exclude_defaults=True)
    if grant is None:
        return {}
    return grant


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

    def start_application(self, payload: StartApplicationRequest, user_id: str | None = None) -> ApplicationDocument:
        logger.info("Starting application drafting (user_id=%s)", user_id)
        grant = _grant_to_dict(payload.grant)
        document = self.agent_service.start_application(
            grant,
            payload.profile.to_agent_profile(),
        )
        application_document = ApplicationDocument.model_validate(document)
        self.application_store.save_application(
            application_document,
            grant=grant,
            profile=payload.profile.model_dump(exclude_none=True),
            user_id=user_id,
        )
        return application_document

    def start_application_stream(self, payload: StartApplicationRequest, user_id: str | None = None) -> Iterator[dict[str, Any]]:
        grant = _grant_to_dict(payload.grant)
        for event in self.agent_service.start_application_stream(
            grant,
            payload.profile.to_agent_profile(),
        ):
            if event.get("event") == "result" and "document" in event.get("data", {}):
                document = event["data"]["document"]
                if not document.get("error"):
                    app_doc = ApplicationDocument.model_validate(document)
                    self.application_store.save_application(
                        app_doc,
                        grant=grant,
                        profile=payload.profile.model_dump(exclude_none=True),
                        user_id=user_id,
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
    ) -> StoredApplication:
        try:
            application = self.application_store.update_section(
                application_id,
                section_id,
                content,
                user_id,
            )
        except StoredApplicationSectionNotFoundError as exc:
            raise ApplicationSectionNotFoundError(str(exc)) from exc
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
        grant = _grant_to_dict(payload.grant)
        content = self.agent_service.rewrite_section(
            payload.sectionTitle,
            payload.currentContent,
            payload.profile.to_agent_profile(),
            grant=grant,
            instruction=payload.instruction,
        )
        if self.application_store.get_application(document_id, user_id) is not None:
            try:
                self.application_store.update_section(document_id, section_id, content, user_id)
            except StoredApplicationSectionNotFoundError as exc:
                raise ApplicationSectionNotFoundError(str(exc)) from exc
        return RewriteSectionResponse(
            sectionId=section_id,
            title=payload.sectionTitle,
            content=content,
        )

    def rewrite_section_stream(
        self,
        document_id: str,
        section_id: str,
        payload: RewriteSectionRequest,
        user_id: str | None = None,
    ) -> Iterator[dict[str, Any]]:
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
                if self.application_store.get_application(document_id, user_id) is not None:
                    try:
                        self.application_store.update_section(document_id, section_id, content, user_id)
                    except StoredApplicationSectionNotFoundError as exc:
                        raise ApplicationSectionNotFoundError(str(exc)) from exc
                response = RewriteSectionResponse(
                    sectionId=section_id,
                    title=payload.sectionTitle,
                    content=content,
                )
                event = {
                    **event,
                    "data": response.model_dump(exclude_none=True),
                }
            yield event

    def _resolve_qa_context(
        self,
        document_id: str,
        payload: DocumentQARequest,
        user_id: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any] | None, dict[str, Any] | None]:
        """Extract or resolve document, grant, and profile context for Q&A."""
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

        return document, grant, profile

    def document_qa(
        self,
        document_id: str,
        payload: DocumentQARequest,
        user_id: str | None = None,
    ) -> DocumentQAResponse:
        document, grant, profile = self._resolve_qa_context(document_id, payload, user_id)
        result = self.agent_service.document_qa(
            question=payload.question,
            document=document,
            grant=grant,
            profile=profile,
            section_id=payload.sectionId,
        )
        return DocumentQAResponse.model_validate(result)

    def document_qa_stream(
        self,
        document_id: str,
        payload: DocumentQARequest,
        user_id: str | None = None,
    ) -> Iterator[dict[str, Any]]:
        document, grant, profile = self._resolve_qa_context(document_id, payload, user_id)
        for event in self.agent_service.document_qa_stream(
            question=payload.question,
            document=document,
            grant=grant,
            profile=profile,
            section_id=payload.sectionId,
        ):
            if event.get("event") == "result" and "answer" in event.get("data", {}):
                validated = DocumentQAResponse.model_validate(event["data"])
                event = {
                    **event,
                    "data": validated.model_dump(exclude_none=True),
                }
            yield event
