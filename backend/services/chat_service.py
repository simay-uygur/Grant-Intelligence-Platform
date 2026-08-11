from backend.schemas.chat import (
    ChatLoopPreviewResponse,
    ConversationMessagesResponse,
    ConversationResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    StoredChatMessage,
    ToolDefinitionPreview,
)
from backend.core.config import settings
from backend.services.bedrock_service import BedrockService
from backend.services.conversation_store import ConversationStore
from backend.services.grant_tools import GrantTools


class ChatService:
    def __init__(self, database_path: str | None = None) -> None:
        self.bedrock_service = BedrockService(use_mock=settings.use_mock_bedrock)
        self.grant_tools = GrantTools()
        self.conversation_store = ConversationStore(
            database_path=database_path or settings.sqlite_db_path
        )

    def handle_message(self, payload: ChatMessageRequest, user_id: str | None = None) -> ChatMessageResponse:
        tool_definitions = [
            {
                "name": "searchGrants",
                "description": "Search EU Horizon grant opportunities with normalized filters.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "limit": {"type": "integer"},
                    },
                    "required": ["query"],
                },
            }
        ]
        conversation = self._resolve_conversation(payload.conversation_id, user_id)
        self.conversation_store.append_message(
            conversation["conversation_id"],
            "user",
            payload.user_message,
            user_id,
        )
        messages = self.conversation_store.get_recent_model_messages(
            conversation["conversation_id"],
            settings.chat_history_window,
            user_id,
        )

        first_response = self.bedrock_service.converse(messages, tool_definitions)
        if first_response.stop_reason == "tool_use" and first_response.tool_use is not None:
            tool_call = first_response.tool_use
            search_response = self.grant_tools.search_grants(tool_call["input"])
            tool_results = [
                {
                    "tool_name": tool_call["name"],
                    "status": "success",
                    "result_count": len(search_response.grants),
                }
            ]
            messages.append(
                {
                    "role": "tool",
                    "content": {
                        "toolUseId": tool_call["toolUseId"],
                        "grants": [grant.model_dump() for grant in search_response.grants],
                    },
                }
            )
            final_response = self.bedrock_service.converse(messages, tool_definitions)
            assistant_message = (
                final_response.assistant_text
                or "The mock Bedrock loop completed without a final message."
            )
            self.conversation_store.append_message(
                conversation["conversation_id"],
                "assistant",
                assistant_message,
                user_id,
            )
            return ChatMessageResponse(
                conversation_id=conversation["conversation_id"],
                assistant_message=assistant_message,
                next_step="show_results" if search_response.grants else "refine_query",
                follow_up_questions=[] if search_response.grants else ["Can you try a broader keyword such as AI or Horizon EIC?"],
                tool_results=tool_results,
            )

        assistant_message = (
            first_response.assistant_text
            or "I can help collect your grant requirements before running search tools."
        )
        self.conversation_store.append_message(
            conversation["conversation_id"],
            "assistant",
            assistant_message,
            user_id,
        )
        return ChatMessageResponse(
            conversation_id=conversation["conversation_id"],
            assistant_message=assistant_message,
            next_step="collect_information",
            follow_up_questions=[
                "What type of organization are you?",
                "Which country is your organization based in?",
            ],
            tool_results=[],
        )

    def get_loop_preview(self) -> ChatLoopPreviewResponse:
        return ChatLoopPreviewResponse(
            entrypoint="/api/v1/chat/message",
            orchestration_owner="backend",
            model_role="Decides whether to call tools and how to use their results.",
            backend_role=(
                "Provides tool definitions, executes requested tools, and returns "
                "tool results back to the model."
            ),
            loop_steps=[
                "Frontend sends a message to the backend.",
                "Backend sends the prompt and tool definitions to Bedrock.",
                "Bedrock decides whether a tool should be called.",
                "Backend executes the selected tool.",
                "Backend sends the tool result back to Bedrock.",
                "Bedrock returns the final answer.",
            ],
            sample_tools=[
                ToolDefinitionPreview(
                    name="searchGrants",
                    description="Search EU Horizon grant opportunities with normalized filters.",
                    input_fields=["query", "keywords", "country", "limit"],
                ),
                ToolDefinitionPreview(
                    name="getGrantDetails",
                    description="Fetch normalized details for a single grant or topic identifier.",
                    input_fields=["grant_id"],
                ),
            ],
        )

    def create_conversation(self, user_id: str | None = None) -> ConversationResponse:
        conversation = self.conversation_store.create_conversation(user_id)
        return ConversationResponse(**conversation)

    def get_messages(self, conversation_id: str, user_id: str | None = None) -> ConversationMessagesResponse:
        messages = self.conversation_store.list_messages(conversation_id, user_id)
        return ConversationMessagesResponse(
            conversation_id=conversation_id,
            messages=[StoredChatMessage(**message) for message in messages],
        )

    def _resolve_conversation(self, conversation_id: str | None, user_id: str | None = None) -> dict[str, str]:
        if conversation_id is None:
            return self.conversation_store.create_conversation(user_id)

        conversation = self.conversation_store.get_conversation(conversation_id, user_id)
        if conversation is None:
            raise ValueError(f"Conversation '{conversation_id}' does not exist.")
        return conversation
