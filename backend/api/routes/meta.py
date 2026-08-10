from fastapi import APIRouter

from backend.core.config import settings
from backend.schemas.meta import FrontendConfigResponse, FrontendEndpointInfo, ToolInfo, ToolsListResponse

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
                purpose="Backend health check for backend boot and connectivity.",
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
                purpose="Search live EU grant calls by passing an organization profile to the grant agent.",
            ),
            FrontendEndpointInfo(
                name="start_application",
                method="POST",
                path=f"{settings.api_prefix}/grants/{{grant_id}}/start-application",
                purpose="Draft and persist a full application for one selected grant and profile.",
            ),
            FrontendEndpointInfo(
                name="latest_grant_application",
                method="GET",
                path=(
                    f"{settings.api_prefix}/grants/{{grant_id}}"
                    "/applications/latest"
                ),
                purpose="Reopen the latest non-archived saved application for a grant.",
            ),
            FrontendEndpointInfo(
                name="list_applications",
                method="GET",
                path=f"{settings.api_prefix}/applications",
                purpose="List stored application summaries for the application dashboard.",
            ),
            FrontendEndpointInfo(
                name="get_application",
                method="GET",
                path=f"{settings.api_prefix}/applications/{{application_id}}",
                purpose="Read one stored application output and its generation context.",
            ),
            FrontendEndpointInfo(
                name="update_application_status",
                method="PATCH",
                path=f"{settings.api_prefix}/applications/{{application_id}}",
                purpose="Change a stored application's draft, completed, or archived status.",
            ),
            FrontendEndpointInfo(
                name="save_application_section",
                method="PUT",
                path=(
                    f"{settings.api_prefix}/applications/{{application_id}}"
                    "/sections/{section_id}"
                ),
                purpose="Persist manual edits to one application section.",
            ),
            FrontendEndpointInfo(
                name="rewrite_section",
                method="PATCH",
                path=f"{settings.api_prefix}/documents/{{document_id}}/sections/{{section_id}}",
                purpose="Rewrite one generated application section with an optional instruction.",
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
                description="Search live EU grant opportunities and rank them against an organisation profile.",
                status="live",
                handler="agent.service.search_grants",
                input_model="GrantSearchRequest",
                output_model="GrantSearchResponse",
                input_schema={
                    "type": "object",
                    "properties": {
                        "organisationName": {"type": "string"},
                        "organisationType": {"type": "string"},
                        "organisationDescription": {"type": "string"},
                        "sector": {"type": "string"},
                        "country": {"type": "string"},
                        "region": {"type": "string"},
                        "projectTitle": {"type": "string"},
                        "projectDescription": {"type": "string"},
                        "fundingAmount": {"type": "string"},
                        "projectStartDate": {"type": "string"},
                        "projectDuration": {"type": "string"},
                        "eligibilityConstraints": {"type": "string"},
                        "limit": {"type": "integer"},
                    },
                },
                example_input={
                    "organisationName": "VisionWorks Robotics",
                    "organisationType": "SME",
                    "sector": "robotics",
                    "country": "Kosovo",
                    "projectTitle": "AI Quality Inspection",
                    "projectDescription": "AI-driven quality inspection across 3 EU factories.",
                    "fundingAmount": "500,000 - 1,000,000 EUR",
                    "projectDuration": "24 months",
                    "limit": 3,
                },
                notes="Searches the public EU Funding & Tenders Portal and uses Bedrock to structure and rank results.",
            ),
            ToolInfo(
                name="startApplication",
                description="Draft a full application document for a selected grant.",
                status="live",
                handler="agent.service.start_application",
                input_model="StartApplicationRequest",
                output_model="ApplicationDocument",
                input_schema={
                    "type": "object",
                    "properties": {
                        "grant": {"type": "object"},
                        "profile": {"type": "object"},
                    },
                    "required": ["grant", "profile"],
                },
                example_input={},
                notes="Exposed as POST /api/v1/grants/{grant_id}/start-application.",
            ),
            ToolInfo(
                name="rewriteSection",
                description="Rewrite a single generated application section.",
                status="live",
                handler="agent.service.rewrite_section",
                input_model="RewriteSectionRequest",
                output_model="RewriteSectionResponse",
                input_schema={
                    "type": "object",
                    "properties": {
                        "sectionTitle": {"type": "string"},
                        "currentContent": {"type": "string"},
                        "profile": {"type": "object"},
                        "grant": {"type": "object"},
                        "instruction": {"type": "string"},
                    },
                    "required": ["sectionTitle", "currentContent", "profile"],
                },
                example_input={},
                notes="Exposed as PATCH /api/v1/documents/{document_id}/sections/{section_id}.",
            ),
            ToolInfo(
                name="searchInternet",
                description="Search the web for broader grant-related context outside the Horizon source.",
                status="planned",
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
                notes="Useful as a future companion tool for broader research; not connected yet.",
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
