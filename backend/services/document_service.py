from backend.schemas.documents import (
    ApplicationDocument,
    RewriteSectionRequest,
    RewriteSectionResponse,
    StartApplicationRequest,
)
from backend.services.agent_service import AgentService


class DocumentService:
    def __init__(self) -> None:
        self.agent_service = AgentService()

    def start_application(self, payload: StartApplicationRequest) -> ApplicationDocument:
        grant = payload.grant.model_dump() if hasattr(payload.grant, "model_dump") else payload.grant
        document = self.agent_service.start_application(
            grant,
            payload.profile.to_agent_profile(),
        )
        return ApplicationDocument.model_validate(document)

    def rewrite_section(
        self,
        document_id: str,
        section_id: str,
        payload: RewriteSectionRequest,
    ) -> RewriteSectionResponse:
        del document_id
        grant = payload.grant.model_dump() if hasattr(payload.grant, "model_dump") else payload.grant
        content = self.agent_service.rewrite_section(
            payload.sectionTitle,
            payload.currentContent,
            payload.profile.to_agent_profile(),
            grant=grant,
            instruction=payload.instruction,
        )
        return RewriteSectionResponse(
            sectionId=section_id,
            title=payload.sectionTitle,
            content=content,
        )
