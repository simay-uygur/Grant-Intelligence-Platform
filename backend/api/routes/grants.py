import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from backend.api.dependencies import get_current_user
from backend.core.sse import sse_generator_bridge
from backend.schemas.grants import (
    GrantSearchBatchesResponse,
    GrantSearchBatchItem,
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
    description=("Search grant opportunities by passing the organization profile to the local agent layer. Results are recorded in the database when linked to a conversation."),
    response_description="Agent-shaped grant search results for frontend rendering.",
)
async def search_grants(payload: GrantSearchRequest, current_user: dict[str, str] | None = Depends(get_current_user)) -> GrantSearchResponse:
    try:
        user_id = current_user["id"] if current_user else None
        return await asyncio.to_thread(grant_search_service.search, payload, user_id=user_id)
    except AgentUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post(
    "/search/stream",
    summary="Stream grant search thinking events and results",
    description=("Stream real-time thinking events and final grant search results as Server-Sent Events (SSE). Results are recorded in the database when linked to a conversation."),
    response_class=StreamingResponse,
)
async def search_grants_stream(
    payload: GrantSearchRequest,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> StreamingResponse:
    user_id = current_user["id"] if current_user else None
    return StreamingResponse(
        sse_generator_bridge(lambda p: grant_search_service.search_stream(p, user_id=user_id), payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/batches",
    response_model=GrantSearchBatchesResponse,
    summary="List grant search batches",
    description="Fetch recorded batches of offered grants, optionally filtered by conversation ID.",
    response_description="List of search batches with full offered grant structures.",
)
def list_search_batches(
    conversation_id: str | None = Query(default=None, description="Optional conversation ID to filter batches."),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> GrantSearchBatchesResponse:
    store = document_service.application_store
    user_id = current_user["id"] if current_user else None
    batches = store.list_search_batches(conversation_id=conversation_id, user_id=user_id, limit=limit, offset=offset)
    return GrantSearchBatchesResponse(batches=[GrantSearchBatchItem.model_validate(b) for b in batches])


@router.get(
    "/batches/{batch_id}",
    response_model=GrantSearchBatchItem,
    summary="Get a grant search batch",
    description="Retrieve one specific search batch and its offered grants by ID.",
    response_description="Full batch record including profile and offered grants.",
)
def get_search_batch(
    batch_id: str,
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> GrantSearchBatchItem:
    store = document_service.application_store
    user_id = current_user["id"] if current_user else None
    batch = store.get_search_batch(batch_id, user_id=user_id)
    if not batch:
        raise HTTPException(status_code=404, detail=f"Grant search batch '{batch_id}' not found.")
    return GrantSearchBatchItem.model_validate(batch)


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
