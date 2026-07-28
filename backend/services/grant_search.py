from backend.clients.sources.eu_horizon import EUHorizonClient
from backend.schemas.grants import GrantSearchRequest, GrantSearchResponse


class GrantSearchService:
    def __init__(self) -> None:
        self.eu_horizon_client = EUHorizonClient()

    def search(self, payload: GrantSearchRequest) -> GrantSearchResponse:
        grants = self.eu_horizon_client.search(payload)
        return GrantSearchResponse(
            grants=grants,
            source_summary=(
                "Results come from the live EU Funding & Tenders Horizon search and "
                "are normalized from topic detail records."
            ),
            normalized_filters_applied={
                "query": payload.query,
                "keywords": payload.keywords,
                "country": payload.country,
                "budget_min": payload.budget_min,
                "budget_max": payload.budget_max,
                "organization_type": payload.organization_type,
                "programme_period": payload.programme_period,
                "action_type": payload.action_type,
                "only_open": payload.only_open,
                "limit": payload.limit,
            },
        )
