from fastapi import APIRouter

from backend.schemas.grants import GrantSearchRequest, GrantSearchResponse
from backend.services.grant_search import GrantSearchService

router = APIRouter()
grant_search_service = GrantSearchService()


@router.post(
    "/search",
    response_model=GrantSearchResponse,
    summary="Search grants",
    description=(
        "Search grant opportunities using normalized filters such as country, "
        "budget range, keywords, and organization type."
    ),
    response_description="Normalized grant search results for frontend rendering.",
)
def search_grants(payload: GrantSearchRequest) -> GrantSearchResponse:
    return grant_search_service.search(payload)
