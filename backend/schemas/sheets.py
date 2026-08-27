from typing import Literal

from pydantic import BaseModel, Field

SheetTabName = Literal["work_packages", "budget", "risks", "consortium"]

ConsortiumMemberType = Literal["SME", "University", "Research Organisation", "Public Body", "Other"]
RiskLikelihood = Literal["low", "medium", "high"]
RiskSeverity = Literal["low", "medium", "high"]

# Standard EU Horizon flat rate for indirect costs (simplified SME option).
INDIRECT_COST_RATE = 0.25


class WorkPackage(BaseModel):
    number: str = Field(description="Work package identifier, e.g. 'WP1'.")
    title: str = Field(description="Work package title.")
    lead: str = Field(default="", description="Lead partner responsible for the work package.")
    personMonths: float = Field(default=0, ge=0, description="Total person-months allocated.")
    startMonth: int = Field(default=1, ge=1, description="Project month the work package starts, e.g. 1.")
    endMonth: int = Field(default=12, ge=1, description="Project month the work package ends, e.g. 12.")
    deliverables: list[str] = Field(default_factory=list, description="Deliverables produced by this work package.")


class BudgetItem(BaseModel):
    category: Literal[
        "Personnel",
        "Subcontracting",
        "Equipment",
        "Travel",
        "Consumables",
        "Other",
    ] = Field(description="EU budget category for the line item.")
    description: str = Field(default="", description="What the cost covers.")
    personMonths: float | None = Field(default=None, ge=0, description="Person-months for Personnel items.")
    directCost: float = Field(default=0, ge=0, description="Direct cost in EUR (overhead is added automatically).")


class BudgetTable(BaseModel):
    currency: str = Field(default="EUR", description="ISO currency code; EU grants are EUR.")
    items: list[BudgetItem] = Field(default_factory=list)
    totalDirectCosts: float = Field(default=0, ge=0, description="Sum of all direct costs.")
    totalIndirectCosts: float = Field(default=0, ge=0, description="Flat 25% indirect overhead on direct costs.")
    totalRequestedGrant: float = Field(default=0, ge=0, description="Direct + indirect costs requested from the call.")


class RiskEntry(BaseModel):
    id: str = Field(description="Risk identifier, e.g. 'R1'.")
    description: str = Field(description="What could go wrong.")
    workPackage: str = Field(default="", description="Related work package identifier.")
    likelihood: RiskLikelihood = Field(default="medium")
    severity: RiskSeverity = Field(default="medium")
    mitigation: str = Field(default="", description="Mitigation or contingency action.")


class ConsortiumMember(BaseModel):
    name: str = Field(description="Partner organisation name.")
    country: str = Field(default="", description="Partner country.")
    type: ConsortiumMemberType = Field(default="SME", description="Organisation type.")
    keyTasks: str = Field(default="", description="Main responsibilities within the project.")
    allocatedBudget: float = Field(default=0, ge=0, description="Budget share in EUR.")


class SheetsBundle(BaseModel):
    """All four structured spreadsheet tabs attached to one application."""

    workPackages: list[WorkPackage] = Field(default_factory=list)
    budget: BudgetTable = Field(default_factory=BudgetTable)
    risks: list[RiskEntry] = Field(default_factory=list)
    consortium: list[ConsortiumMember] = Field(default_factory=list)


class UpdateSheetTabRequest(BaseModel):
    """Replace the rows of one tab; derived values are recomputed server-side."""

    items: list[dict] = Field(default_factory=list, description="Rows replacing the current tab contents.")


class GenerateSheetsRequest(BaseModel):
    grantLimit: float | None = Field(default=None, ge=0, description="Optional maximum requested grant amount in EUR.")
