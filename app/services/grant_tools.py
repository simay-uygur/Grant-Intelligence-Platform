from app.schemas.grants import GrantSearchRequest, GrantSearchResponse
from app.services.grant_search import GrantSearchService


class GrantTools:
    def __init__(self) -> None:
        self.grant_search_service = GrantSearchService()

    def search_grants(self, tool_input: dict) -> GrantSearchResponse:
        payload = GrantSearchRequest(
            query=tool_input.get("query"),
            country=tool_input.get("country"),
            budget_min=tool_input.get("budget_min"),
            budget_max=tool_input.get("budget_max"),
            keywords=tool_input.get("keywords", []),
            organization_type=tool_input.get("organization_type"),
            programme_period=tool_input.get("programme_period"),
            action_type=tool_input.get("action_type"),
            only_open=tool_input.get("only_open", False),
            limit=tool_input.get("limit", 3),
        )
        return self.grant_search_service.search(payload)
