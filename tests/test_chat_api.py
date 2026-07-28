from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.schemas.grants import GrantResult, GrantSearchResponse
from backend.services.chat_service import ChatService


def _build_client(database_path: Path) -> TestClient:
    app = create_app()
    chat_route_module = __import__("backend.api.routes.chat", fromlist=["chat_service"])
    chat_service = ChatService(database_path=str(database_path))
    chat_service.grant_tools.search_grants = lambda tool_input: GrantSearchResponse(
        grants=[
            GrantResult(
                id="HORIZON-MOCK-001",
                title="Mock AI Grant",
                source="eu_horizon",
                summary="Mock result for chat API testing.",
                amount="Up to EUR 100,000",
                deadline="2026-12-31",
                match_explanation=f"Matched query {tool_input.get('query', 'AI')}.",
                url="https://example.org/mock-grant",
            )
        ],
        source_summary="1 mocked result returned for testing.",
        normalized_filters_applied={
            "query": tool_input.get("query"),
            "country": tool_input.get("country"),
            "budget_min": tool_input.get("budget_min"),
            "budget_max": tool_input.get("budget_max"),
            "keywords": tool_input.get("keywords", []),
            "organization_type": tool_input.get("organization_type"),
            "programme_period": tool_input.get("programme_period"),
            "action_type": tool_input.get("action_type"),
            "only_open": tool_input.get("only_open", False),
            "limit": tool_input.get("limit", 3),
        },
    )
    chat_route_module.chat_service = chat_service
    return TestClient(app)


def test_create_conversation_and_persist_messages(tmp_path: Path) -> None:
    client = _build_client(tmp_path / "test_chat.db")

    create_response = client.post("/api/v1/chat/conversations")
    assert create_response.status_code == 200
    conversation = create_response.json()
    conversation_id = conversation["conversation_id"]

    message_response = client.post(
        "/api/v1/chat/message",
        json={
            "conversation_id": conversation_id,
            "user_message": "We need an AI grant for our project.",
        },
    )
    assert message_response.status_code == 200
    payload = message_response.json()
    assert payload["conversation_id"] == conversation_id
    assert payload["tool_results"][0]["tool_name"] == "searchGrants"

    history_response = client.get(f"/api/v1/chat/conversations/{conversation_id}/messages")
    assert history_response.status_code == 200
    history = history_response.json()
    assert history["conversation_id"] == conversation_id
    assert [message["role"] for message in history["messages"]] == ["user", "assistant"]
    assert history["messages"][0]["content"] == "We need an AI grant for our project."


def test_send_message_without_conversation_id_creates_anonymous_conversation(tmp_path: Path) -> None:
    client = _build_client(tmp_path / "test_auto_create.db")

    message_response = client.post(
        "/api/v1/chat/message",
        json={
            "user_message": "Hello there",
        },
    )
    assert message_response.status_code == 200
    payload = message_response.json()
    assert payload["conversation_id"]
    assert payload["next_step"] == "collect_information"


def test_missing_conversation_returns_404(tmp_path: Path) -> None:
    client = _build_client(tmp_path / "test_missing.db")

    message_response = client.post(
        "/api/v1/chat/message",
        json={
            "conversation_id": "missing-conversation",
            "user_message": "Test message",
        },
    )
    assert message_response.status_code == 404

    history_response = client.get("/api/v1/chat/conversations/missing-conversation/messages")
    assert history_response.status_code == 404
