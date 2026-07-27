from pydantic import BaseModel, Field


class FrontendEndpointInfo(BaseModel):
    name: str = Field(description="Stable endpoint identifier for frontend usage.")
    method: str = Field(description="HTTP method used to call the endpoint.")
    path: str = Field(description="Relative API path exposed by the backend.")
    purpose: str = Field(description="Human-readable explanation of the endpoint purpose.")


class FrontendConfigResponse(BaseModel):
    app_name: str = Field(description="Display name of the backend application.")
    api_prefix: str = Field(description="Shared API prefix used by all backend routes.")
    version: str = Field(description="Current backend version string.")
    cors_origins: list[str] = Field(default_factory=list)
    endpoints: list[FrontendEndpointInfo] = Field(default_factory=list)

    model_config = {
        "json_schema_extra": {
            "example": {
                "app_name": "Grant Intelligence Backend",
                "api_prefix": "/api/v1",
                "version": "0.1.0",
                "cors_origins": ["http://localhost:3000", "http://localhost:5173"],
                "endpoints": [
                    {
                        "name": "health",
                        "method": "GET",
                        "path": "/api/v1/health",
                        "purpose": "Backend health check for app boot and connectivity.",
                    }
                ],
            }
        }
    }


class ToolInfo(BaseModel):
    name: str = Field(description="Stable backend tool name.")
    description: str = Field(description="Short explanation of what the tool does.")
    status: str = Field(description="Implementation state such as live, mock, or planned.")
    handler: str = Field(description="Backend service or function responsible for the tool.")
    input_model: str = Field(description="Schema model expected as input, if applicable.")
    output_model: str = Field(description="Schema model returned by the tool, if applicable.")
    input_schema: dict = Field(
        default_factory=dict,
        description="Model-facing JSON-schema-like input contract for tool calling.",
    )
    example_input: dict = Field(
        default_factory=dict,
        description="Example JSON payload for calling the tool.",
    )
    notes: str | None = Field(
        default=None,
        description="Optional implementation note such as whether the tool is live, mocked, or local-only.",
    )


class ToolsListResponse(BaseModel):
    tools: list[ToolInfo] = Field(default_factory=list, description="Currently available backend tools.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "tools": [
                    {
                        "name": "searchGrants",
                        "description": "Search EU Horizon grant opportunities and return normalized results.",
                        "status": "live",
                        "handler": "GrantTools.search_grants",
                        "input_model": "GrantSearchRequest",
                        "output_model": "GrantSearchResponse",
                        "input_schema": {
                            "type": "object",
                            "properties": {
                                "query": {"type": "string"},
                                "limit": {"type": "integer"}
                            }
                        },
                        "example_input": {
                            "query": "AI",
                            "limit": 3
                        },
                        "notes": "Uses the live EU Horizon search endpoint and backend-side normalization.",
                    }
                ]
            }
        }
    }
