import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from backend.api.dependencies import get_current_user
from backend.core.sse import sse_generator_bridge
from backend.schemas.grants import (
    GrantSearchRequest,
    GrantSearchResponse,
    SavedGrantItem,
    SavedGrantsListResponse,
    SaveGrantRequest,
)
from backend.services.agent_service import AgentUnavailableError
from backend.services.document_service import DocumentService
from backend.services.grant_search import GrantSearchService

router = APIRouter()
grant_search_service = GrantSearchService()
document_service = DocumentService()


@router.post(
    "/search",
    response_model=GrantSearchResponse,
    summary="Search grants",
    description=("Search grant opportunities by passing the organization profile to the local agent layer."),
    response_description="Agent-shaped grant search results for frontend rendering.",
)
async def search_grants(payload: GrantSearchRequest, _current_user: dict[str, str] | None = Depends(get_current_user)) -> GrantSearchResponse:
    try:
        return await asyncio.to_thread(grant_search_service.search, payload)
    except AgentUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post(
    "/search/stream",
    summary="Stream grant search thinking events and results",
    description=("Stream real-time thinking events and final grant search results as Server-Sent Events (SSE)."),
    response_class=StreamingResponse,
)
async def search_grants_stream(
    payload: GrantSearchRequest,
    _current_user: dict[str, str] | None = Depends(get_current_user),
) -> StreamingResponse:
    return StreamingResponse(
        sse_generator_bridge(grant_search_service.search_stream, payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/saved",
    response_model=SavedGrantsListResponse,
    summary="List saved grants",
    description="Return all bookmarked grants saved in SQLite database with match scores.",
    response_description="Array of bookmarked grant records with match telemetry.",
)
def list_saved_grants(current_user: dict[str, str] | None = Depends(get_current_user)) -> SavedGrantsListResponse:
    store = document_service.application_store
    saved_grants = [SavedGrantItem.model_validate(item) for item in store.list_saved_grants(current_user["id"] if current_user else None)]
    return SavedGrantsListResponse(savedGrants=saved_grants)


@router.post(
    "/saved",
    response_model=SavedGrantItem,
    summary="Save a grant",
    description="Bookmark a grant opportunity to SQLite database with full match percentage and reasoning.",
    response_description="The saved grant record as stored in the database.",
)
def save_grant(
    grant: SaveGrantRequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> SavedGrantItem:
    store = document_service.application_store
    saved = store.save_grant(grant.model_dump(exclude_none=False), current_user["id"] if current_user else None)
    return SavedGrantItem.model_validate(saved)


@router.delete(
    "/saved/{grant_id}",
    status_code=204,
    summary="Delete a saved grant",
    description="Remove a bookmarked grant from SQLite database.",
)
def delete_saved_grant(grant_id: str, current_user: dict[str, str] | None = Depends(get_current_user)) -> None:
    store = document_service.application_store
    deleted = store.delete_saved_grant(grant_id, current_user["id"] if current_user else None)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Saved grant '{grant_id}' not found.")
