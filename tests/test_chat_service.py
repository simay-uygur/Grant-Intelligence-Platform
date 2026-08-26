"""Direct unit tests for ChatService."""

from pathlib import Path

import pytest

from backend.schemas.chat import ChatContext, ChatMessageRequest
from backend.schemas.grants import GrantResult, GrantSearchResponse
from backend.services.chat_service import ChatService


@pytest.fixture
def chat_service(tmp_path: Path) -> ChatService:
    db_path = str(tmp_path / "test_chat_service.db")
    service = ChatService(database_path=db_path)
    service.grant_tools.search_grants = lambda tool_input: GrantSearchResponse(
        grants=[
            GrantResult(
                id="HORIZON-TEST-001",
                title="Test AI Grant",
                source="eu_horizon",
                summary="Mock result for unit test.",
                amount="EUR 100,000",
                deadline="2026-12-31",
            )
        ],
        source_summary="1 mock grant returned.",
        normalized_filters_applied={},
    )
    return service


def test_create_conversation_returns_metadata(chat_service: ChatService) -> None:
    conv = chat_service.create_conversation(user_id="user-123")
    assert conv.conversation_id
    assert conv.created_at
    assert conv.updated_at


def test_handle_message_creates_conversation_when_none_given(chat_service: ChatService) -> None:
    req = ChatMessageRequest(user_message="Hello, I need grant advice.")
    response = chat_service.handle_message(req)
    assert response.conversation_id
    assert response.next_step == "collect_information"
    assert len(response.follow_up_questions) > 0


def test_handle_message_with_context_triggers_search(chat_service: ChatService) -> None:
    conv = chat_service.create_conversation()
    req = ChatMessageRequest(
        conversation_id=conv.conversation_id,
        user_message="Find AI grants for robotics",
        context=ChatContext(
            organization_type="SME",
            country="Kosovo",
            project_goal="Robotics automation",
        ),
    )
    response = chat_service.handle_message(req)
    assert response.conversation_id == conv.conversation_id
    assert response.next_step == "show_results"
    assert len(response.tool_results) == 1
    assert response.tool_results[0]["tool_name"] == "searchGrants"
    assert response.tool_results[0]["result_count"] == 1


def test_handle_message_raises_on_missing_conversation(chat_service: ChatService) -> None:
    req = ChatMessageRequest(
        conversation_id="non-existent-id",
        user_message="Hello",
    )
    with pytest.raises(ValueError, match="does not exist"):
        chat_service.handle_message(req)


def test_freeform_reply_uses_llm_and_uploaded_documents(chat_service: ChatService, monkeypatch: pytest.MonkeyPatch) -> None:

    captured: dict = {}

    def fake_generate(user_message: str, history: list[dict[str, str]], attachments_block: str = "") -> str:
        captured["user_message"] = user_message
        captured["history_length"] = len(history)
        captured["attachments"] = attachments_block
        return "Based on your drone inspection track record, EIC Accelerator fits well."

    monkeypatch.setattr("backend.services.chat_service.generate_chat_reply", fake_generate)

    conv = chat_service.create_conversation()
    chat_service.application_store.save_upload(
        filename="track-record.txt",
        content_type="text/plain",
        extracted_text="We delivered 40 drone inspection pilots across EU ports.",
        conversation_id=conv.conversation_id,
    )

    response = chat_service.handle_message(ChatMessageRequest(conversation_id=conv.conversation_id, user_message="Which grant fits us?"))

    assert response.assistant_message.startswith("Based on your drone inspection")
    assert "40 drone inspection pilots" in captured["attachments"]
    assert captured["user_message"] == "Which grant fits us?"


def test_freeform_reply_falls_back_when_llm_fails(chat_service: ChatService, monkeypatch: pytest.MonkeyPatch) -> None:
    def broken_generate(user_message: str, history: list[dict[str, str]], attachments_block: str = "") -> str:
        raise RuntimeError("bedrock down")

    monkeypatch.setattr("backend.services.chat_service.generate_chat_reply", broken_generate)

    response = chat_service.handle_message(ChatMessageRequest(user_message="Hello"))
    assert response.assistant_message == "Great — to match you to the strongest calls, please complete the profile form."
    assert response.next_step == "collect_information"


def test_get_messages_returns_persisted_history(chat_service: ChatService) -> None:
    conv = chat_service.create_conversation()
    cid = conv.conversation_id

    req = ChatMessageRequest(
        conversation_id=cid,
        user_message="Message 1",
    )
    chat_service.handle_message(req)

    history = chat_service.get_messages(cid)
    assert history.conversation_id == cid
    assert len(history.messages) == 2
    assert history.messages[0].role == "user"
    assert history.messages[0].content == "Message 1"
    assert history.messages[1].role == "assistant"
