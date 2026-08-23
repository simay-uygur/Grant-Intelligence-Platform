from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AgentProfile(BaseModel):
    organisationName: str | None = Field(default=None, examples=["VisionWorks Robotics"])
    organisationType: str | None = Field(default=None, examples=["SME"])
    organisationDescription: str | None = Field(default=None)
    sector: str | None = Field(default=None, examples=["robotics"])
    country: str | None = Field(default=None, examples=["Kosovo"])
    region: str | None = Field(default=None)
    projectTitle: str | None = Field(default=None, examples=["AI Quality Inspection"])
    projectDescription: str | None = Field(
        default=None,
        examples=["AI-driven quality inspection across 3 EU factories."],
    )
    fundingAmount: str | None = Field(default=None, examples=["500,000 - 1,000,000 EUR"])
    projectStartDate: str | None = Field(default=None)
    projectDuration: str | None = Field(default=None, examples=["24 months"])
    eligibilityConstraints: str | None = Field(default=None)

    model_config = ConfigDict(extra="allow")

    def to_agent_profile(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True)


class GrantSearchRequest(AgentProfile):
    query: str | None = Field(
        default=None,
        description=(
            "Legacy free-text query. If agent profile fields are omitted, this is "
            "passed as the project description."
        ),
        examples=["AI"],
    )
    country: str | None = Field(
        default=None,
        description=(
            "Country associated with the applicant profile."
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
            "Legacy keyword list. If profile fields are omitted, these are passed as "
            "the sector or project description."
        ),
        examples=[["education", "ai", "inclusion"]],
    )
    organization_type: str | None = Field(
        default=None,
        description=(
            "Legacy spelling mapped to `organisationType` for the agent."
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
        default=3,
        ge=1,
        le=25,
        description=(
            "Maximum number of grants requested from the agent."
        ),
        examples=[10],
    )

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "example": {
                "organisationName": "VisionWorks Robotics",
                "organisationType": "SME",
                "sector": "robotics",
                "country": "Kosovo",
                "projectTitle": "AI Quality Inspection",
                "projectDescription": "AI-driven quality inspection across 3 EU factories.",
                "fundingAmount": "500,000 - 1,000,000 EUR",
                "projectDuration": "24 months",
                "limit": 3,
            }
        },
    )

    def to_agent_profile(self) -> dict[str, Any]:
        profile = super().to_agent_profile()

        if self.organization_type and "organisationType" not in profile:
            profile["organisationType"] = self.organization_type
        if self.budget_min is not None or self.budget_max is not None:
            profile.setdefault("fundingAmount", self._format_budget_range())
        if self.keywords and "sector" not in profile:
            profile["sector"] = ", ".join(self.keywords)
        if self.query and "projectDescription" not in profile:
            profile["projectDescription"] = self.query

        for backend_only_key in (
            "query",
            "keywords",
            "budget_min",
            "budget_max",
            "organization_type",
            "programme_period",
            "action_type",
            "only_open",
            "limit",
        ):
            profile.pop(backend_only_key, None)

        return profile

    def _format_budget_range(self) -> str:
        if self.budget_min is not None and self.budget_max is not None:
            return f"{self.budget_min} - {self.budget_max} EUR"
        if self.budget_min is not None:
            return f"At least {self.budget_min} EUR"
        return f"Up to {self.budget_max} EUR"


class GrantResult(BaseModel):
    id: str = Field(description="Stable grant identifier.")
    programme: str | None = Field(default=None, description="Grant programme name.")
    title: str = Field(description="Normalized grant or call title shown to the user.")
    matchPercentage: int | None = Field(default=None, description="Agent match score from 0 to 100.")
    fundingAmount: str | None = Field(default=None, description="Agent-provided funding range.")
    eligibleCountries: list[str] = Field(default_factory=list)
    organisationEligibility: str | list[str] | None = Field(default=None)
    fundingType: str | None = Field(default=None)
    description: str | None = Field(default=None)
    whyItMatches: str | None = Field(default=None)
    matchReasons: list[str] = Field(default_factory=list)
    requirements: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    sourceUrl: str | None = Field(default=None)

    source: str | None = Field(default=None, description="Legacy source system field.")
    summary: str | None = Field(
        default=None,
        description="Legacy short summary field retained for current chat tests.",
    )
    amount: str | None = Field(
        default=None,
        description="Legacy funding amount field.",
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
        description="Legacy source URL field.",
    )

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "example": {
                "id": "HORIZON-CL2-2026-EDU-01",
                "programme": "Horizon Europe",
                "title": "Digital education innovation for inclusive learning",
                "matchPercentage": 88,
                "fundingAmount": "Up to EUR 150,000",
                "deadline": "2026-11-15",
                "eligibleCountries": ["Turkey"],
                "organisationEligibility": "SMEs are eligible.",
                "fundingType": "Grant",
                "description": "Supports education technology initiatives.",
                "whyItMatches": "Matches education, AI, and inclusion keywords.",
                "matchReasons": ["AI focus", "SME eligibility"],
                "requirements": ["Consortium required"],
                "tags": ["AI", "education"],
                "sourceUrl": "https://example.org/grants/HORIZON-CL2-2026-EDU-01",
            }
        },
    )


class GrantSearchResponse(BaseModel):
    grants: list[GrantResult] = Field(
        description=(
            "Agent-ranked grant results."
        )
    )
    source_summary: str = Field(
        description="Human-readable explanation of which source or adapter was used."
    )
    normalized_filters_applied: dict[str, Any] = Field(
        description="Final profile values sent to the agent."
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


class SaveGrantRequest(BaseModel):
    id: str = Field(description="Unique grant identifier.", min_length=1)
    title: str = Field(description="Grant title.", min_length=1)
    programme: str | None = Field(default=None, description="Grant programme or funder name.")
    fundingAmount: str | None = Field(default=None, description="Funding range or amount.")
    deadline: str | None = Field(default=None, description="Application deadline date string.")
    sourceUrl: str | None = Field(default=None, description="Original call or portal URL.")
    matchPercentage: int | None = Field(default=None, ge=0, le=100, description="Match score percentage (0-100).")
    whyItMatches: str | None = Field(default=None, description="Rationale for why this grant matches.")
    description: str | None = Field(default=None, description="Full description of the grant.")
    eligibleCountries: list[str] = Field(default_factory=list, description="List of eligible countries.")
    organisationEligibility: str | list[str] | None = Field(default=None, description="Organisation eligibility criteria.")
    fundingType: str | None = Field(default=None, description="Type of funding (e.g., Grant, Lump Sum).")
    matchReasons: list[str] = Field(default_factory=list, description="Key match bullet points.")
    requirements: list[str] = Field(default_factory=list, description="Key grant requirements.")
    tags: list[str] = Field(default_factory=list, description="Categorization tags.")

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "example": {
                "id": "HORIZON-CL2-2026-HERITAGE-01",
                "title": "Preserving cultural heritage through digital workflows",
                "programme": "Horizon Europe",
                "fundingAmount": "EUR 2,000,000",
                "deadline": "2026-09-20",
                "sourceUrl": "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/horizon-cl2-2026-heritage-01",
                "matchPercentage": 92,
                "whyItMatches": "High relevance to digital twin and heritage preservation technologies.",
            }
        },
    )


class SavedGrantItem(BaseModel):
    id: str = Field(description="Unique grant identifier.")
    title: str = Field(description="Grant title.")
    programme: str | None = Field(default=None, description="Grant programme name.")
    fundingAmount: str | None = Field(default=None, description="Funding amount or range.")
    deadline: str | None = Field(default=None, description="Application deadline.")
    sourceUrl: str | None = Field(default=None, description="Canonical source URL.")
    matchPercentage: int | None = Field(default=None, description="Match score percentage.")
    whyItMatches: str | None = Field(default=None, description="Explanation of fit.")
    savedAt: str | None = Field(default=None, description="ISO timestamp when the grant was bookmarked.")
    grant: dict[str, Any] | None = Field(default=None, description="Full original grant payload.")

    model_config = ConfigDict(extra="allow")


class SavedGrantsListResponse(BaseModel):
    savedGrants: list[SavedGrantItem] = Field(
        default_factory=list,
        description="List of all saved/bookmarked grants with their match scores.",
    )
