from fastapi import APIRouter

from app.core.config import settings
from app.schemas.meta import FrontendConfigResponse, FrontendEndpointInfo, ToolInfo, ToolsListResponse

router = APIRouter()


@router.get(
    "/frontend-config",
    response_model=FrontendConfigResponse,
    summary="Get frontend bootstrap config",
    description=(
        "Return the frontend-facing configuration values and endpoint metadata "
        "needed to connect a local UI to this backend."
    ),
    response_description="Frontend bootstrap configuration and endpoint list.",
)
def frontend_config() -> FrontendConfigResponse:
    return FrontendConfigResponse(
        app_name=settings.app_name,
        api_prefix=settings.api_prefix,
        version=settings.app_version,
        cors_origins=settings.frontend_cors_origins,
        endpoints=[
            FrontendEndpointInfo(
                name="health",
                method="GET",
                path=f"{settings.api_prefix}/health",
                purpose="Backend health check for app boot and connectivity.",
            ),
            FrontendEndpointInfo(
                name="chat_create_conversation",
                method="POST",
                path=f"{settings.api_prefix}/chat/conversations",
                purpose="Create an anonymous conversation and receive the conversation_id for future chat requests.",
            ),
            FrontendEndpointInfo(
                name="chat_message",
                method="POST",
                path=f"{settings.api_prefix}/chat/message",
                purpose="Send user chat input and receive assistant guidance plus tool results.",
            ),
            FrontendEndpointInfo(
                name="chat_messages",
                method="GET",
                path=f"{settings.api_prefix}/chat/conversations/{'{conversation_id}'}/messages",
                purpose="Read stored user and assistant messages for one conversation.",
            ),
            FrontendEndpointInfo(
                name="grant_search",
                method="POST",
                path=f"{settings.api_prefix}/grants/search",
                purpose="Search Horizon opportunities using normalized backend results.",
            ),
            FrontendEndpointInfo(
                name="frontend_config",
                method="GET",
                path=f"{settings.api_prefix}/meta/frontend-config",
                purpose="Bootstrap endpoint metadata for a future frontend.",
            ),
            FrontendEndpointInfo(
                name="tools_list",
                method="GET",
                path=f"{settings.api_prefix}/meta/tools-list",
                purpose="List currently exposed backend tools and their input/output contracts.",
            ),
        ],
    )


@router.get(
    "/tools-list",
    response_model=ToolsListResponse,
    summary="List backend tools",
    description=(
        "Return the currently exposed backend tools together with their handlers "
        "and input/output schema contracts."
    ),
    response_description="List of backend tools and their contracts.",
)
def tools_list() -> ToolsListResponse:
    return ToolsListResponse(
        tools=[
            ToolInfo(
                name="searchGrants",
                description="Search EU Horizon grant opportunities and return normalized results.",
                status="live",
                handler="GrantTools.search_grants",
                input_model="GrantSearchRequest",
                output_model="GrantSearchResponse",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Simple Horizon search text."},
                        "keywords": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Optional keywords if query is omitted.",
                        },
                        "country": {"type": "string"},
                        "budget_min": {"type": "integer"},
                        "budget_max": {"type": "integer"},
                        "organization_type": {"type": "string"},
                        "programme_period": {"type": "string"},
                        "action_type": {"type": "string"},
                        "only_open": {"type": "boolean"},
                        "limit": {"type": "integer"},
                    },
                },
                example_input={
                    "query": "AI",
                    "limit": 3,
                },
                notes="Uses the live EU Horizon search endpoint and backend-side normalization.",
            ),
            ToolInfo(
                name="searchInternet",
                description="Search the web for broader grant-related context outside the Horizon source.",
                status="mock",
                handler="Not implemented yet",
                input_model="PlannedSearchInternetRequest",
                output_model="PlannedSearchInternetResponse",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "limit": {"type": "integer"},
                    },
                    "required": ["query"],
                },
                example_input={
                    "query": "European AI education grants",
                    "limit": 5,
                },
                notes="Useful as a future companion tool for broader research, but currently only planned as a mock/tool-registry entry.",
            ),
            ToolInfo(
                name="getGrantDetails",
                description="Fetch normalized details for a specific grant or topic identifier.",
                status="planned",
                handler="Planned future GrantTools.get_grant_details",
                input_model="PlannedGrantDetailsRequest",
                output_model="PlannedGrantDetailsResponse",
                input_schema={
                    "type": "object",
                    "properties": {
                        "grant_id": {"type": "string"},
                    },
                    "required": ["grant_id"],
                },
                example_input={
                    "grant_id": "HORIZON-CL4-2025-04-DATA-03",
                },
                notes="Planned follow-up tool for retrieving one grant in more detail after search.",
            )
        ]
    )
