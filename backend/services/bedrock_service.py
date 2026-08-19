from dataclasses import dataclass
from typing import Any

from backend.core.logging import get_logger

logger = get_logger("services.bedrock")


@dataclass
class MockBedrockResponse:
    stop_reason: str
    assistant_text: str | None = None
    tool_use: dict[str, Any] | None = None


class BedrockService:
    def __init__(self, use_mock: bool = True) -> None:
        self.use_mock = use_mock

    def converse(self, messages: list[dict[str, Any]], tool_definitions: list[dict[str, Any]]) -> MockBedrockResponse:
        logger.info("Bedrock converse requested (use_mock=%s, messages_count=%d)", self.use_mock, len(messages))
        if self.use_mock:
            return self._mock_converse(messages, tool_definitions)
        raise NotImplementedError("Real Bedrock runtime integration is not implemented yet.")

    def _mock_converse(
        self,
        messages: list[dict[str, Any]],
        tool_definitions: list[dict[str, Any]],
    ) -> MockBedrockResponse:
        last_message = messages[-1]
        if last_message["role"] == "tool":
            grants = last_message["content"].get("grants", [])
            if grants:
                titles = ", ".join(grant["title"] for grant in grants[:2])
                return MockBedrockResponse(
                    stop_reason="end_turn",
                    assistant_text=(
                        f"I found {len(grants)} Horizon results. "
                        f"Top matches include {titles}."
                    ),
                )
            return MockBedrockResponse(
                stop_reason="end_turn",
                assistant_text=(
                    "I searched the Horizon source but did not find matching normalized results. "
                    "Try a broader query like 'AI' or 'HORIZON-EIC'."
                ),
            )

        user_message = last_message["content"].lower()
        if any(keyword in user_message for keyword in ("grant", "horizon", "fund", "search", "ai")):
            query = self._extract_query(last_message["content"])
            return MockBedrockResponse(
                stop_reason="tool_use",
                tool_use={
                    "toolUseId": "mock-search-1",
                    "name": "searchGrants",
                    "input": {
                        "query": query,
                        "limit": 3,
                    },
                },
            )

        return MockBedrockResponse(
            stop_reason="end_turn",
            assistant_text=(
                "I can collect your grant requirements first, then use grant-search tools once needed."
            ),
        )

    def _extract_query(self, user_message: str) -> str:
        lowered = user_message.lower()
        if "ai" in lowered:
            return "AI"
        if "eic" in lowered:
            return "HORIZON-EIC"
        return "AI"
