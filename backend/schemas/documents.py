from pydantic import BaseModel, Field

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

