import asyncio

from fastapi import APIRouter, HTTPException

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
async def search_grants(payload: GrantSearchRequest) -> GrantSearchResponse:
    try:
        return await asyncio.to_thread(grant_search_service.search, payload)
    except AgentUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
