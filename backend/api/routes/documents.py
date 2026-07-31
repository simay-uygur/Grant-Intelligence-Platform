import asyncio

from fastapi import APIRouter, HTTPException

from backend.schemas.documents import (
    ApplicationDocument,
    RewriteSectionRequest,
    RewriteSectionResponse,
    StartApplicationRequest,
)
from backend.services.agent_service import AgentUnavailableError
from backend.services.document_service import DocumentService

router = APIRouter()
document_service = DocumentService()


@router.post(
    "/grants/{grant_id}/start-application",
    response_model=ApplicationDocument,
    summary="Draft an application",
    description="Draft a full application document for one selected grant and profile.",
)
async def start_application(
    grant_id: str,
    payload: StartApplicationRequest,
) -> ApplicationDocument:
    del grant_id
    try:
        return await asyncio.to_thread(document_service.start_application, payload)
    except AgentUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.patch(
    "/documents/{document_id}/sections/{section_id}",
    response_model=RewriteSectionResponse,
    summary="Rewrite an application section",
    description="Rewrite one generated application section using an optional instruction.",
)
async def rewrite_section(
    document_id: str,
    section_id: str,
    payload: RewriteSectionRequest,
) -> RewriteSectionResponse:
    try:
        return await asyncio.to_thread(
            document_service.rewrite_section,
            document_id,
            section_id,
            payload,
        )
    except AgentUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

