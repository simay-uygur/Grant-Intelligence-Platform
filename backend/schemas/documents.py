from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from backend.schemas.grants import AgentProfile, GrantResult


class DocumentSection(BaseModel):
    id: str = Field(description="Stable section identifier.")
    title: str = Field(description="Human-readable section title.")
    content: str = Field(description="Generated section body.")


class ApplicationDocument(BaseModel):
    id: str = Field(description="Generated document identifier.")
    grantId: str = Field(description="Grant identifier used to draft the application.")
    grantTitle: str = Field(description="Grant title used to draft the application.")
    sections: list[DocumentSection] = Field(default_factory=list)
    updatedAt: str = Field(description="Last update timestamp returned by the agent.")


ApplicationStatus = Literal[
    "drafting",
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "archived",
]


class ApplicationSummary(BaseModel):
    id: str = Field(description="Stored application identifier.")
    grantId: str = Field(description="Grant identifier associated with the application.")
    grantTitle: str = Field(description="Grant title shown in application lists.")
    grantOrganisation: str = Field(description="Funder, programme, or source shown on pipeline cards.")
    applicantOrganisation: str = Field(description="Applicant organisation shown on pipeline cards.")
    status: ApplicationStatus = Field(description="Current application lifecycle status.")
    fundingAmount: str = Field(description="Funding amount shown on pipeline cards.")
    deadline: str = Field(description="Grant deadline shown on pipeline cards.")
    sectionCount: int = Field(ge=0, description="Number of stored output sections.")
    createdAt: str = Field(description="Application creation timestamp in ISO-8601 format.")
    updatedAt: str = Field(description="Application last update timestamp in ISO-8601 format.")


class StoredApplication(ApplicationDocument):
    status: ApplicationStatus = Field(description="Current application lifecycle status.")
    grant: dict = Field(description="Grant input used to generate the application.")
    profile: dict = Field(description="Organisation profile used for generation.")
    createdAt: str = Field(description="Application creation timestamp in ISO-8601 format.")


class ApplicationListResponse(BaseModel):
    applications: list[ApplicationSummary] = Field(default_factory=list)
    total: int = Field(ge=0, description="Total matching applications before pagination.")
    limit: int = Field(ge=1, description="Maximum number of applications returned.")
    offset: int = Field(ge=0, description="Number of matching applications skipped.")


class UpdateApplicationStatusRequest(BaseModel):
    status: ApplicationStatus = Field(description="New application lifecycle status.")


class UpdateApplicationSectionRequest(BaseModel):
    content: str = Field(description="Complete replacement content for the stored section.")


class StartApplicationRequest(BaseModel):
    grant: GrantResult | dict = Field(description="Grant selected by the frontend.")
    profile: AgentProfile = Field(description="Organization profile collected by the frontend.")


class RewriteSectionRequest(BaseModel):
    sectionTitle: str = Field(description="Title of the section being rewritten.")
    currentContent: str = Field(description="Current section content.")
    profile: AgentProfile = Field(description="Organization profile collected by the frontend.")
    grant: GrantResult | dict | None = Field(default=None)
    instruction: str | None = Field(default=None, description="Optional rewrite instruction.")


class RewriteSectionResponse(BaseModel):
    sectionId: str = Field(description="Path section identifier.")
    title: str = Field(description="Section title used for the rewrite.")
    content: str = Field(description="Rewritten section content.")


class DocumentQARequest(BaseModel):
    question: str = Field(description="User question, critique request, or compliance query regarding the document.")
    sectionId: str | None = Field(
        default=None,
        validation_alias=AliasChoices("sectionId", "section_id"),
        description="Optional target section identifier if asking about a specific section.",
    )
    document: ApplicationDocument | dict | None = Field(default=None, description="Optional document payload if not loaded from store.")
    grant: GrantResult | dict | None = Field(default=None, description="Optional grant context.")
    profile: AgentProfile | dict | None = Field(default=None, description="Optional applicant organization profile.")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class DocumentQAResponse(BaseModel):
    answer: str = Field(description="AI consultant answer, critique, or guidance.")
    sectionId: str | None = Field(
        default=None,
        validation_alias=AliasChoices("sectionId", "section_id"),
        serialization_alias="sectionId",
        description="Associated section ID if specific.",
    )
    suggestions: list[str] = Field(default_factory=list, description="Actionable recommendations or suggested improvements.")

    model_config = ConfigDict(populate_by_name=True)
