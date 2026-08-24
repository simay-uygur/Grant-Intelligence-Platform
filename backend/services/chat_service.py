from backend.core.config import settings
from backend.core.logging import get_logger
from backend.schemas.chat import (
    ChatContext,
    ChatLoopPreviewResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    ConversationMessagesResponse,
    ConversationResponse,
    StoredChatMessage,
    ToolDefinitionPreview,
)
from backend.services.conversation_store import ConversationStore
from backend.services.grant_tools import GrantTools

logger = get_logger("services.chat")


class ChatService:
    def __init__(self, database_path: str | None = None) -> None:
        self.grant_tools = GrantTools()
        self.conversation_store = ConversationStore(database_path=database_path or settings.sqlite_db_path)

    def handle_message(self, payload: ChatMessageRequest, user_id: str | None = None) -> ChatMessageResponse:
        conversation = self._resolve_conversation(payload.conversation_id, user_id)
        logger.info("Handling chat message for conversation '%s' (user_id=%s)", conversation["conversation_id"], user_id)
        self.conversation_store.append_message(
            conversation["conversation_id"],
            "user",
            payload.user_message,
            user_id,
        )

        if self._has_search_context(payload.context):
            tool_input = self._context_to_search_input(payload.context, payload.user_message)
            logger.info(
                "Search context detected for conversation '%s', invoking searchGrants tool",
                conversation["conversation_id"],
            )
            search_response = self.grant_tools.search_grants(tool_input)
            result_count = len(search_response.grants)
            logger.info("Found %d grant results for conversation '%s'", result_count, conversation["conversation_id"])
            assistant_message = f"I searched live grant opportunities using your profile context and found {result_count} {'match' if result_count == 1 else 'matches'}." if result_count else "I searched live grant opportunities using your profile context but did not find strong matches yet."
            self.conversation_store.append_message(
                conversation["conversation_id"],
                "assistant",
                assistant_message,
                user_id,
            )
            return ChatMessageResponse(
                conversation_id=conversation["conversation_id"],
                assistant_message=assistant_message,
                next_step="show_results" if result_count else "refine_query",
                follow_up_questions=[] if result_count else ["Can you broaden the project goal or sector?"],
                tool_results=[
                    {
                        "tool_name": "searchGrants",
                        "status": "success",
                        "result_count": result_count,
                    }
                ],
            )

        logger.info("No search context found for conversation '%s', asking for profile info", conversation["conversation_id"])

        assistant_message = "Great — to match you to the strongest calls, please complete the profile form."
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
                "What is the project goal and approximate budget?",
            ],
            tool_results=[],
        )

    def get_loop_preview(self) -> ChatLoopPreviewResponse:
        return ChatLoopPreviewResponse(
            entrypoint="/api/v1/chat/message",
            orchestration_owner="backend",
            model_role="Not used by this guide-aligned chat endpoint.",
            backend_role=("Collects structured context, calls the backend grant-search service when enough context exists, and keeps conversation state."),
            loop_steps=[
                "Frontend sends a message to the backend.",
                "Backend asks for structured profile context if it is missing.",
                "Frontend submits the structured profile.",
                "Backend grant-search endpoint calls agent.service.search_grants(profile).",
                "Backend returns normalized grant results to the frontend.",
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
            messages=[StoredChatMessage.model_validate(message) for message in messages],
        )

    def _resolve_conversation(self, conversation_id: str | None, user_id: str | None = None) -> dict[str, str]:
        if conversation_id is None:
            return self.conversation_store.create_conversation(user_id)

        conversation = self.conversation_store.get_conversation(conversation_id, user_id)
        if conversation is None:
            raise ValueError(f"Conversation '{conversation_id}' does not exist.")
        return conversation

    def _has_search_context(self, context: ChatContext | None) -> bool:
        return bool(context and (context.project_goal or context.organization_type or context.country or context.budget_range))

    def _context_to_search_input(self, context: ChatContext | None, user_message: str) -> dict:
        if context is None:
            return {"query": user_message, "limit": 3}

        return {
            "query": context.project_goal or user_message,
            "country": context.country,
            "organization_type": context.organization_type,
            "keywords": [context.project_goal] if context.project_goal else [],
            "limit": 3,
        }
