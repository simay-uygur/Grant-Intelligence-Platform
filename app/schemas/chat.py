from pydantic import BaseModel, Field


class ChatContext(BaseModel):
    organization_type: str | None = Field(
        default=None,
        description="Organization category used to refine grant matching.",
        examples=["SME"],
    )
    country: str | None = Field(
        default=None,
        description="Country or region associated with the applicant.",
        examples=["Turkey"],
    )
    budget_range: str | None = Field(
        default=None,
        description="Human-readable budget estimate from the user.",
        examples=["50k-150k EUR"],
    )
    project_goal: str | None = Field(
        default=None,
        description="Short description of the user's project intent.",
        examples=["AI-based education platform for rural schools"],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "organization_type": "SME",
                "country": "Turkey",
                "budget_range": "50k-150k EUR",
                "project_goal": "AI-based education platform for rural schools",
            }
        }
    }


class ChatMessageRequest(BaseModel):
    conversation_id: str | None = Field(
        default=None,
        description="Optional backend conversation identifier. If omitted, a new conversation is created.",
        examples=["4e159520-aeb5-440d-a390-0adf9df02a60"],
    )
    session_id: str | None = Field(
        default=None,
        description="Optional frontend session identifier for grouping a conversation.",
        examples=["session-001"],
    )
    user_message: str = Field(
        min_length=1,
        description="Free-text user message sent from the frontend chat UI.",
        examples=["We are looking for EU grants for an education technology project."],
    )
    context: ChatContext | None = Field(
        default=None,
        description="Optional structured context already collected from the user.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "conversation_id": "4e159520-aeb5-440d-a390-0adf9df02a60",
                "session_id": "session-001",
                "user_message": "We are looking for EU grants for an education technology project.",
                "context": {
                    "organization_type": "SME",
                    "country": "Turkey",
                    "budget_range": "50k-150k EUR",
                    "project_goal": "AI-based education platform for rural schools",
                },
            }
        }
    }


class ChatMessageResponse(BaseModel):
    conversation_id: str = Field(
        description="Backend conversation identifier that the frontend should reuse on later messages.",
        examples=["4e159520-aeb5-440d-a390-0adf9df02a60"],
    )
    assistant_message: str = Field(
        description="Primary assistant reply returned to the frontend.",
        examples=["I can help narrow down suitable Horizon calls for your project."],
    )
    next_step: str = Field(
        description="Suggested next action for the frontend or user.",
        examples=["collect_requirements"],
    )
    follow_up_questions: list[str] = Field(
        default_factory=list,
        description="Clarifying questions that the frontend can present next.",
    )
    tool_results: list[dict] = Field(
        default_factory=list,
        description="Structured results returned from any backend tools used during the response.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "conversation_id": "4e159520-aeb5-440d-a390-0adf9df02a60",
                "assistant_message": "I can help narrow down suitable Horizon calls for your project.",
                "next_step": "collect_requirements",
                "follow_up_questions": [
                    "What type of organization are you applying as?",
                    "What is your estimated project budget?",
                ],
                "tool_results": [],
            }
        }
    }


class ConversationResponse(BaseModel):
    conversation_id: str = Field(
        description="Stable conversation identifier returned by the backend.",
        examples=["4e159520-aeb5-440d-a390-0adf9df02a60"],
    )
    created_at: str = Field(description="Conversation creation timestamp in ISO-8601 format.")
    updated_at: str = Field(description="Conversation last update timestamp in ISO-8601 format.")


class StoredChatMessage(BaseModel):
    message_id: int = Field(description="Database message identifier.", examples=[1])
    conversation_id: str = Field(description="Conversation identifier owning the message.")
    role: str = Field(description="Message role such as user or assistant.", examples=["user"])
    content: str = Field(description="Persisted message content.")
    created_at: str = Field(description="Message creation timestamp in ISO-8601 format.")


class ConversationMessagesResponse(BaseModel):
    conversation_id: str = Field(description="Conversation identifier used for this lookup.")
    messages: list[StoredChatMessage] = Field(default_factory=list)


class ToolDefinitionPreview(BaseModel):
    name: str = Field(description="Tool name exposed to the model.", examples=["searchGrants"])
    description: str = Field(
        description="Short explanation of what the tool does for model selection.",
        examples=["Search EU Horizon grant opportunities with normalized filters."],
    )
    input_fields: list[str] = Field(
        default_factory=list,
        description="Input fields the backend expects for this tool.",
    )


class ChatLoopPreviewResponse(BaseModel):
    entrypoint: str = Field(
        description="Current API entrypoint that would start the loop.",
        examples=["/api/v1/chat/message"],
    )
    orchestration_owner: str = Field(
        description="Component responsible for driving the request/response loop.",
        examples=["backend"],
    )
    model_role: str = Field(
        description="What the model is responsible for in this architecture.",
        examples=["Decides whether to call tools and how to use their results."],
    )
    backend_role: str = Field(
        description="What the backend is responsible for in this architecture.",
        examples=["Provides tool definitions, executes requested tools, and returns tool results back to the model."],
    )
    loop_steps: list[str] = Field(
        default_factory=list,
        description="High-level steps of the future Bedrock tool-calling loop.",
    )
    sample_tools: list[ToolDefinitionPreview] = Field(
        default_factory=list,
        description="Example tools that would be exposed to the model.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "entrypoint": "/api/v1/chat/message",
                "orchestration_owner": "backend",
                "model_role": "Decides whether to call tools and how to use their results.",
                "backend_role": "Provides tool definitions, executes requested tools, and returns tool results back to the model.",
                "loop_steps": [
                    "Frontend sends a message to the backend.",
                    "Backend sends the prompt and tool definitions to Bedrock.",
                    "Bedrock decides whether a tool should be called.",
                    "Backend executes the selected tool.",
                    "Backend sends the tool result back to Bedrock.",
                    "Bedrock returns the final answer."
                ],
                "sample_tools": [
                    {
                        "name": "searchGrants",
                        "description": "Search EU Horizon grant opportunities with normalized filters.",
                        "input_fields": ["query", "keywords", "country", "limit"]
                    }
                ]
            }
        }
    }
