import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, PlainTextResponse, Response, StreamingResponse

from backend.api.dependencies import get_current_user
from backend.core.sse import sse_generator_bridge
from backend.schemas.documents import (
    ApplicationDocument,
    ApplicationListResponse,
    ApplicationStatus,
    DocumentQARequest,
    DocumentQAResponse,
    GenerateOutlineRequest,
    GenerateOutlineResponse,
    RewriteSectionRequest,
    RewriteSectionResponse,
    StartApplicationRequest,
    StoredApplication,
    UpdateApplicationSectionRequest,
    UpdateApplicationStatusRequest,
)
from backend.schemas.sheets import GenerateSheetsRequest, SheetsBundle, SheetTabName, UpdateSheetTabRequest
from backend.services.agent_service import AgentUnavailableError
from backend.services.document_service import (
    ApplicationNotFoundError,
    ApplicationSectionNotFoundError,
    DocumentService,
)

router = APIRouter()
document_service = DocumentService()


@router.get(
    "/grants/{grant_id}/applications/latest",
    response_model=StoredApplication,
    summary="Get a grant's latest application",
    description=("Return the most recently updated non-archived application associated with a grant so the chat can reopen it instead of generating a duplicate."),
    response_description="Latest saved application for the grant.",
)
def get_latest_application_for_grant(grant_id: str, current_user: dict[str, str] | None = Depends(get_current_user)) -> StoredApplication:
    try:
        return document_service.get_latest_application_for_grant(grant_id, current_user["id"] if current_user else None)
    except ApplicationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get(
    "/applications",
    response_model=ApplicationListResponse,
    summary="List stored applications",
    description=("Return application summaries ordered by most recent update for the application dashboard. Results can be filtered by lifecycle status."),
    response_description="Paginated application summaries.",
)
def list_applications(
    status: ApplicationStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> ApplicationListResponse:
    return document_service.list_applications(
        status=status,
        limit=limit,
        offset=offset,
        user_id=current_user["id"] if current_user else None,
    )


@router.get(
    "/applications/{application_id}",
    response_model=StoredApplication,
    summary="Get a stored application",
    description=("Return one application with its generated sections and the grant/profile inputs needed to reopen it."),
    response_description="Stored application output and generation context.",
)
def get_application(application_id: str, current_user: dict[str, str] | None = Depends(get_current_user)) -> StoredApplication:
    try:
        return document_service.get_application(application_id, current_user["id"] if current_user else None)
    except ApplicationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch(
    "/applications/{application_id}",
    response_model=StoredApplication,
    summary="Update an application status",
    description="Change a stored application's lifecycle status.",
    response_description="Updated stored application.",
)
def update_application_status(
    application_id: str,
    payload: UpdateApplicationStatusRequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> StoredApplication:
    try:
        return document_service.update_application_status(application_id, payload.status, current_user["id"] if current_user else None)
    except ApplicationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete(
    "/applications/{application_id}",
    status_code=204,
    summary="Delete an application",
    description="Delete a stored application and its draft sections.",
)
def delete_application(
    application_id: str,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> None:
    document_service.delete_application(application_id, current_user["id"] if current_user else None)


@router.put(
    "/applications/{application_id}/sections/{section_id}",
    response_model=StoredApplication,
    summary="Save an application section",
    description="Replace one section's content and return the complete stored application.",
    response_description="Stored application with the updated section.",
)
def update_application_section(
    application_id: str,
    section_id: str,
    payload: UpdateApplicationSectionRequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> StoredApplication:
    try:
        return document_service.update_application_section(
            application_id,
            section_id,
            payload.content,
            current_user["id"] if current_user else None,
        )
    except (ApplicationNotFoundError, ApplicationSectionNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/grants/{grant_id}/outline",
    response_model=GenerateOutlineResponse,
    summary="Generate adaptive application outline",
    description="Generate tailored proposal sections for a selected grant and applicant profile.",
)
async def generate_outline(
    grant_id: str,
    payload: GenerateOutlineRequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> GenerateOutlineResponse:
    payload_grant_id = payload.grant.id if hasattr(payload.grant, "id") else payload.grant.get("id")
    if payload_grant_id and payload_grant_id != grant_id:
        raise HTTPException(
            status_code=400,
            detail=(f"Path grant '{grant_id}' does not match payload grant '{payload_grant_id}'."),
        )
    try:
        return await asyncio.to_thread(document_service.generate_outline, payload, current_user["id"] if current_user else None)
    except AgentUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post(
    "/grants/{grant_id}/start-application",
    response_model=ApplicationDocument,
    summary="Draft an application",
    description="Draft a full application document for one selected grant and profile.",
)
async def start_application(
    grant_id: str,
    payload: StartApplicationRequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> ApplicationDocument:
    payload_grant_id = payload.grant.id if hasattr(payload.grant, "id") else payload.grant.get("id")
    if payload_grant_id != grant_id:
        raise HTTPException(
            status_code=400,
            detail=(f"Path grant '{grant_id}' does not match payload grant '{payload_grant_id}'."),
        )
    try:
        return await asyncio.to_thread(document_service.start_application, payload, current_user["id"] if current_user else None)
    except AgentUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post(
    "/grants/{grant_id}/start-application/stream",
    summary="Stream application drafting thinking events and result",
    description="Stream real-time thinking events while drafting an application document as Server-Sent Events (SSE).",
    response_class=StreamingResponse,
)
async def start_application_stream(
    grant_id: str,
    payload: StartApplicationRequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> StreamingResponse:
    payload_grant_id = payload.grant.id if hasattr(payload.grant, "id") else payload.grant.get("id")
    if payload_grant_id != grant_id:
        raise HTTPException(
            status_code=400,
            detail=(f"Path grant '{grant_id}' does not match payload grant '{payload_grant_id}'."),
        )
    return StreamingResponse(
        sse_generator_bridge(
            document_service.start_application_stream,
            payload,
            current_user["id"] if current_user else None,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> RewriteSectionResponse:
    try:
        return await asyncio.to_thread(
            document_service.rewrite_section,
            document_id,
            section_id,
            payload,
            current_user["id"] if current_user else None,
        )
    except AgentUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ApplicationSectionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch(
    "/documents/{document_id}/sections/{section_id}/stream",
    summary="Stream section rewriting thinking events and result",
    description="Stream real-time thinking events while rewriting an application section as Server-Sent Events (SSE).",
    response_class=StreamingResponse,
)
async def rewrite_section_stream(
    document_id: str,
    section_id: str,
    payload: RewriteSectionRequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> StreamingResponse:
    return StreamingResponse(
        sse_generator_bridge(
            document_service.rewrite_section_stream,
            document_id,
            section_id,
            payload,
            current_user["id"] if current_user else None,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/documents/{document_id}/qa",
    response_model=DocumentQAResponse,
    summary="Consult AI on application document",
    description="Ask questions, request section critiques, or evaluate compliance against EU Horizon call criteria for an application document.",
    response_description="AI evaluation, critique, and actionable recommendations.",
)
async def document_qa(
    document_id: str,
    payload: DocumentQARequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> DocumentQAResponse:
    try:
        return await asyncio.to_thread(
            document_service.document_qa,
            document_id,
            payload,
            current_user["id"] if current_user else None,
        )
    except ApplicationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AgentUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post(
    "/documents/{document_id}/qa/stream",
    summary="Stream AI consultation on application document",
    description="Stream real-time thinking events, token deltas, and actionable recommendations for an application document as Server-Sent Events (SSE).",
    response_class=StreamingResponse,
)
async def document_qa_stream(
    document_id: str,
    payload: DocumentQARequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> StreamingResponse:
    return StreamingResponse(
        sse_generator_bridge(
            document_service.document_qa_stream,
            document_id,
            payload,
            current_user["id"] if current_user else None,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/documents/{document_id}/sheets",
    response_model=SheetsBundle,
    summary="Get structured spreadsheet tabs",
    description="Return the work packages, budget, risks, and consortium tabs for an application (empty defaults if never generated).",
)
def get_sheets(document_id: str, current_user: dict[str, str] | None = Depends(get_current_user)) -> SheetsBundle:
    try:
        return document_service.get_sheets(document_id, current_user["id"] if current_user else None)
    except ApplicationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put(
    "/documents/{document_id}/sheets/{tab_name}",
    response_model=SheetsBundle,
    summary="Save one spreadsheet tab",
    description="Replace the rows of one tab; derived values (25% overhead, totals) are recomputed server-side.",
)
def update_sheet_tab(
    document_id: str,
    tab_name: SheetTabName,
    payload: UpdateSheetTabRequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> SheetsBundle:
    try:
        return document_service.update_sheet_tab(document_id, tab_name, payload, current_user["id"] if current_user else None)
    except ApplicationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/documents/{document_id}/sheets/generate",
    response_model=SheetsBundle,
    summary="Generate all spreadsheet tabs with AI",
    description="AI generates work packages, budget, risks, and consortium tables from the grant call and applicant profile.",
)
async def generate_sheets(
    document_id: str,
    payload: GenerateSheetsRequest | None = None,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> SheetsBundle:
    grant_limit = payload.grantLimit if payload else None
    try:
        return await asyncio.to_thread(
            document_service.generate_sheets,
            document_id,
            grant_limit,
            current_user["id"] if current_user else None,
        )
    except ApplicationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"AI sheet generation returned an invalid response: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Sheet generation is unavailable: {exc}") from exc


@router.get(
    "/documents/{document_id}/export",
    summary="Export the full proposal as a continuous document",
    description="Format all 12 sections plus the structured sheets as a continuous HTML, Markdown, or plain-text paper ready to paste into Google Docs or Word.",
)
def export_document(
    document_id: str,
    format: Literal["html", "markdown", "text"] = Query(default="markdown"),
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> Response:
    try:
        content, filename = document_service.export_document(document_id, format, current_user["id"] if current_user else None)
    except ApplicationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    media_types = {"html": "text/html", "markdown": "text/markdown", "text": "text/plain"}
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    if format == "html":
        return HTMLResponse(content=content, headers=headers)
    return PlainTextResponse(content=content, media_type=media_types[format], headers=headers)
