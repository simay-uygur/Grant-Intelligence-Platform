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

    def search_stream(self, payload: GrantSearchRequest):
        for event in self.agent_service.search_grants_stream(
            payload.to_agent_profile(),
            max_grants=payload.limit,
        ):
            if event.get("event") == "result" and "grants" in event.get("data", {}):
                response = GrantSearchResponse(
                    grants=event["data"]["grants"],
                    source_summary=(
                        "Results come from the live EU Funding & Tenders Portal and are ranked "
                        "against your profile by the Bedrock-backed grant agent."
                    ),
                    normalized_filters_applied=payload.to_agent_profile() | {"limit": payload.limit},
                )
                event = {
                    **event,
                    "data": response.model_dump(exclude_none=True),
                }
            yield event

