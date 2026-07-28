from pydantic import BaseModel, Field


class GrantSearchRequest(BaseModel):
    query: str | None = Field(
        default=None,
        description=(
            "Optional free-text query sent to the Horizon search endpoint as the "
            "`text` parameter. Use this for the simplest working search."
        ),
        examples=["AI"],
    )
    country: str | None = Field(
        default=None,
        description=(
            "Optional backend-side filter or prioritization hint. This is not currently "
            "sent to the Horizon API as a native server-side filter."
        ),
        examples=["Turkey"],
    )
    budget_min: int | None = Field(
        default=None,
        description=(
            "Optional backend-side minimum budget filter in euros. Applied after "
            "normalization when the source provides enough budget information."
        ),
        examples=[50000],
    )
    budget_max: int | None = Field(
        default=None,
        description=(
            "Optional backend-side maximum budget filter in euros. Applied after "
            "normalization when the source provides enough budget information."
        ),
        examples=[150000],
    )
    keywords: list[str] = Field(
        default_factory=list,
        description=(
            "Optional keyword list. If `query` is omitted, keywords are joined into a "
            "single search text string for the Horizon API request."
        ),
        examples=[["education", "ai", "inclusion"]],
    )
    organization_type: str | None = Field(
        default=None,
        description=(
            "Optional organization type for later ranking/filtering logic. It is not "
            "currently used as a native Horizon API filter."
        ),
        examples=["SME"],
    )
    programme_period: str | None = Field(
        default=None,
        description=(
            "Optional backend-side filter matched against normalized metadata such as "
            "`programmePeriod` when available."
        ),
        examples=["2025-2027"],
    )
    action_type: str | None = Field(
        default=None,
        description=(
            "Optional backend-side filter for Horizon action type such as `RIA` or "
            "`IA`. Applied after the API response is normalized."
        ),
        examples=["RIA"],
    )
    only_open: bool = Field(
        default=False,
        description=(
            "Optional backend-side filter. When true, the backend keeps only records "
            "that appear open based on source metadata."
        ),
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=25,
        description=(
            "Maximum number of normalized results to return. This is an upper bound, "
            "not a guarantee, because some raw Horizon records are discarded during "
            "normalization and filtering."
        ),
        examples=[10],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "AI",
                "limit": 3,
            }
        }
    }


class GrantResult(BaseModel):
    id: str = Field(description="Stable normalized identifier for the kept Horizon topic result.")
    title: str = Field(description="Normalized grant or call title shown to the user.")
    source: str = Field(description="Source system from which the normalized result was collected.")
    summary: str = Field(description="Short normalized summary extracted from the source metadata.")
    amount: str | None = Field(
        default=None,
        description="Optional funding amount or range when the source metadata contains it.",
    )
    deadline: str | None = Field(
        default=None,
        description="Optional application deadline when it can be extracted from the source metadata.",
    )
    match_explanation: str | None = Field(
        default=None,
        description="Optional explanation of why the normalized record was kept and how it matched.",
    )
    url: str | None = Field(
        default=None,
        description="Optional direct link to the kept Horizon opportunity page.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "HORIZON-CL2-2026-EDU-01",
                "title": "Digital education innovation for inclusive learning",
                "source": "eu_horizon",
                "summary": "Supports education technology initiatives with measurable inclusion goals.",
                "amount": "Up to EUR 150,000",
                "deadline": "2026-11-15",
                "match_explanation": "Matches education, AI, and inclusion keywords.",
                "url": "https://example.org/grants/HORIZON-CL2-2026-EDU-01",
            }
        }
    }


class GrantSearchResponse(BaseModel):
    grants: list[GrantResult] = Field(
        description=(
            "Normalized grant results returned by the search service after raw Horizon "
            "records are filtered, normalized, deduplicated, and limited."
        )
    )
    source_summary: str = Field(
        description="Human-readable explanation of which sources or filters were used."
    )
    normalized_filters_applied: dict[str, str | int | bool | list[str] | None] = Field(
        description=(
            "Final normalized filter values the backend applied. Optional fields may be "
            "null or empty when they were not supplied."
        )
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "grants": [
                    {
                        "id": "HORIZON-CL2-2026-EDU-01",
                        "title": "Digital education innovation for inclusive learning",
                        "source": "eu_horizon",
                        "summary": "Supports education technology initiatives with measurable inclusion goals.",
                        "amount": "Up to EUR 150,000",
                        "deadline": "2026-11-15",
                        "match_explanation": "Matches education, AI, and inclusion keywords.",
                        "url": "https://example.org/grants/HORIZON-CL2-2026-EDU-01",
                    }
                ],
                "source_summary": "3 results returned from the EU Horizon source.",
                "normalized_filters_applied": {
                    "query": "AI",
                    "country": None,
                    "budget_min": None,
                    "budget_max": None,
                    "keywords": [],
                    "organization_type": None,
                    "programme_period": None,
                    "action_type": None,
                    "only_open": False,
                    "limit": 3,
                },
            }
        }
    }
