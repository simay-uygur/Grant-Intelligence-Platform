from backend.schemas.grants import GrantSearchRequest, GrantSearchResponse
from backend.services.agent_service import AgentService


class GrantSearchService:
    def __init__(self) -> None:
        self.agent_service = AgentService()

    def search(self, payload: GrantSearchRequest) -> GrantSearchResponse:
        grants = self.agent_service.search_grants(
            payload.to_agent_profile(),
            max_grants=payload.limit,
        )
        return GrantSearchResponse(
            grants=grants,
            source_summary=(
                "Results come from the live EU Funding & Tenders Portal and are ranked "
                "against your profile by the Bedrock-backed grant agent."
            ),
            normalized_filters_applied=payload.to_agent_profile() | {"limit": payload.limit},
        )
