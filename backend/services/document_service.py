from backend.core.config import settings
from backend.schemas.documents import (
    ApplicationDocument,
    ApplicationListResponse,
    ApplicationStatus,
    RewriteSectionRequest,
    RewriteSectionResponse,
    StartApplicationRequest,
    StoredApplication,
)
from backend.services.agent_service import AgentService
from backend.services.application_store import (
    ApplicationStore,
    StoredApplicationSectionNotFoundError,
)


class ApplicationNotFoundError(ValueError):
    pass


class ApplicationSectionNotFoundError(ValueError):
    pass


class DocumentService:
    def __init__(self, database_path: str | None = None) -> None:
        self.agent_service = AgentService()
        self.application_store = ApplicationStore(
            database_path=database_path or settings.sqlite_db_path
        )

    def start_application(self, payload: StartApplicationRequest) -> ApplicationDocument:
        grant = (
            payload.grant.model_dump(exclude_none=True, exclude_defaults=True)
            if hasattr(payload.grant, "model_dump")
            else payload.grant
        )
        document = self.agent_service.start_application(
            grant,
            payload.profile.to_agent_profile(),
        )
        application_document = ApplicationDocument.model_validate(document)
        self.application_store.save_application(
            application_document,
            grant=grant,
            profile=payload.profile.model_dump(exclude_none=True),
        )
        return application_document

    def list_applications(
        self,
        *,
        status: ApplicationStatus | None,
        limit: int,
        offset: int,
    ) -> ApplicationListResponse:
        applications, total = self.application_store.list_applications(
            status=status,
            limit=limit,
            offset=offset,
        )
        return ApplicationListResponse(
            applications=applications,
            total=total,
            limit=limit,
            offset=offset,
        )

    def get_application(self, application_id: str) -> StoredApplication:
        application = self.application_store.get_application(application_id)
        if application is None:
            raise ApplicationNotFoundError(
                f"Application '{application_id}' does not exist."
            )
        return StoredApplication.model_validate(application)

    def get_latest_application_for_grant(self, grant_id: str) -> StoredApplication:
        application = self.application_store.get_latest_application_for_grant(grant_id)
        if application is None:
            raise ApplicationNotFoundError(
                f"Grant '{grant_id}' does not have a saved application."
            )
        return StoredApplication.model_validate(application)

    def update_application_status(
        self,
        application_id: str,
        status: ApplicationStatus,
    ) -> StoredApplication:
        application = self.application_store.update_status(application_id, status)
        if application is None:
            raise ApplicationNotFoundError(
                f"Application '{application_id}' does not exist."
            )
        return StoredApplication.model_validate(application)

    def update_application_section(
        self,
        application_id: str,
        section_id: str,
        content: str,
    ) -> StoredApplication:
        try:
            application = self.application_store.update_section(
                application_id,
                section_id,
                content,
            )
        except StoredApplicationSectionNotFoundError as exc:
            raise ApplicationSectionNotFoundError(str(exc)) from exc
        if application is None:
            raise ApplicationNotFoundError(
                f"Application '{application_id}' does not exist."
            )
        return StoredApplication.model_validate(application)

    def rewrite_section(
        self,
        document_id: str,
        section_id: str,
        payload: RewriteSectionRequest,
    ) -> RewriteSectionResponse:
        grant = (
            payload.grant.model_dump(exclude_none=True, exclude_defaults=True)
            if hasattr(payload.grant, "model_dump")
            else payload.grant
        )
        content = self.agent_service.rewrite_section(
            payload.sectionTitle,
            payload.currentContent,
            payload.profile.to_agent_profile(),
            grant=grant,
            instruction=payload.instruction,
        )
        if self.application_store.get_application(document_id) is not None:
            try:
                self.application_store.update_section(document_id, section_id, content)
            except StoredApplicationSectionNotFoundError as exc:
                raise ApplicationSectionNotFoundError(str(exc)) from exc
        return RewriteSectionResponse(
            sectionId=section_id,
            title=payload.sectionTitle,
            content=content,
        )
