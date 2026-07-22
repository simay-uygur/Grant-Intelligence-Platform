from fastapi import APIRouter

from app.schemas.chat import ChatLoopPreviewResponse, ChatMessageRequest, ChatMessageResponse
from app.services.chat_service import ChatService

router = APIRouter()
chat_service = ChatService()


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
    return chat_service.handle_message(payload)


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
