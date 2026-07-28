from fastapi import APIRouter, HTTPException

from backend.schemas.chat import (
    ChatLoopPreviewResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    ConversationMessagesResponse,
    ConversationResponse,
)
from backend.services.chat_service import ChatService

router = APIRouter()
chat_service = ChatService()


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    summary="Create a conversation",
    description="Create an anonymous backend conversation and return its identifier.",
    response_description="Created conversation metadata.",
)
def create_conversation() -> ConversationResponse:
    return chat_service.create_conversation()


@router.post(
    "/message",
    response_model=ChatMessageResponse,
    summary="Send a chat message",
    description=(
        "Accept a user message from the frontend, preserve optional structured "
        "context, and return the next assistant step plus any tool results."
    ),
    response_description="Assistant response with next-step guidance and tool output.",
)
def send_message(payload: ChatMessageRequest) -> ChatMessageResponse:
    try:
        return chat_service.handle_message(payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationMessagesResponse,
    summary="List conversation messages",
    description="Return the persisted user and assistant messages for one conversation.",
    response_description="Stored messages for the requested conversation.",
)
def get_conversation_messages(conversation_id: str) -> ConversationMessagesResponse:
    try:
        return chat_service.get_messages(conversation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get(
    "/loop-preview",
    response_model=ChatLoopPreviewResponse,
    summary="Preview the future Bedrock tool loop",
    description=(
        "Return a lightweight description of the planned model-decides-tool-call "
        "architecture for the chat flow."
    ),
    response_description="Preview of the planned Bedrock tool-calling loop.",
)
def get_loop_preview() -> ChatLoopPreviewResponse:
    return chat_service.get_loop_preview()
