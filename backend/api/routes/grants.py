import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from backend.api.dependencies import get_current_user
from backend.core.sse import sse_generator_bridge
from backend.schemas.grants import GrantSearchRequest, GrantSearchResponse
from backend.services.agent_service import AgentUnavailableError
from backend.services.grant_search import GrantSearchService

router = APIRouter()
grant_search_service = GrantSearchService()


@router.post(
    "/search",
    response_model=GrantSearchResponse,
    summary="Search grants",
    description=(
        "Search grant opportunities by passing the organization profile to the "
        "local agent layer."
    ),
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
    description=(
        "Stream real-time thinking events and final grant search results as Server-Sent Events (SSE)."
    ),
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

