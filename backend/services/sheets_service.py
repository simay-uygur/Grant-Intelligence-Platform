"""Structured grant spreadsheet tabs: work packages, budget, risks, consortium.

Derived values (25% indirect overhead, totals, person-month sums) are always
recomputed server-side so client edits can never corrupt them.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from backend.schemas.sheets import (
    INDIRECT_COST_RATE,
    BudgetItem,
    ConsortiumMember,
    RiskEntry,
    SheetsBundle,
    WorkPackage,
)

logger = logging.getLogger("services.sheets")

SHEET_TAB_NAMES = ("work_packages", "budget", "risks", "consortium")

SHEETS_PROMPT_GUIDANCE = (
    "Produce a realistic, internally consistent set of tables for an EU Horizon-style proposal. "
    "Work packages must have non-overlapping sensible month ranges within 36 months; person-months "
    "must be plausible for the duration. The budget must stay within the funding limit and use only "
    "the allowed categories. Include 4-6 risks with mitigations and 2-5 consortium partners."
)


def empty_sheets() -> dict[str, Any]:
    return SheetsBundle().model_dump()


def _recompute_budget(bundle: SheetsBundle) -> None:
    total_direct = round(sum(item.directCost for item in bundle.budget.items), 2)
    total_indirect = round(total_direct * INDIRECT_COST_RATE, 2)
    bundle.budget.totalDirectCosts = total_direct
    bundle.budget.totalIndirectCosts = total_indirect
    bundle.budget.totalRequestedGrant = round(total_direct + total_indirect, 2)


def recompute_bundle(bundle: SheetsBundle) -> SheetsBundle:
    """Recompute all derived values (currently the budget table's overhead math)."""
    _recompute_budget(bundle)
    return bundle


def validate_and_replace_tab(bundle: SheetsBundle, tab_name: str, raw_items: list[dict]) -> SheetsBundle:
    """Replace one tab's rows with validated payloads and recompute derived values."""
    if tab_name == "budget":
        bundle.budget.items = [BudgetItem.model_validate(item) for item in raw_items]
    elif tab_name == "work_packages":
        bundle.workPackages = [WorkPackage.model_validate(item) for item in raw_items]
    elif tab_name == "risks":
        bundle.risks = [RiskEntry.model_validate(item) for item in raw_items]
    elif tab_name == "consortium":
        bundle.consortium = [ConsortiumMember.model_validate(item) for item in raw_items]
    else:
        raise ValueError(f"Unknown sheet tab '{tab_name}'.")
    return recompute_bundle(bundle)


def build_generation_prompt(grant: dict[str, Any], profile: dict[str, Any], grant_limit: float | None, custom_instructions: str | None) -> str:
    limit_block = f"TOTAL FUNDING LIMIT: EUR {grant_limit:,.0f}. Keep the sum of direct costs below this figure.\n" if grant_limit else ""
    instructions_block = f"\nUSER CUSTOM INSTRUCTIONS:\n{custom_instructions.strip()}\n" if custom_instructions and custom_instructions.strip() else ""
    return (
        "You are preparing the structured spreadsheet tables for a real EU grant application.\n\n"
        f"GRANT:\n{json.dumps(grant, indent=2)}\n\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
        f"{limit_block}{instructions_block}\n"
        f"{SHEETS_PROMPT_GUIDANCE}\n\n"
        "Respond ONLY with JSON (no markdown fences, no commentary) in this exact shape:\n"
        "{\n"
        '  "workPackages": [{"number": "WP1", "title": "...", "lead": "...", "personMonths": 12, '
        '"startMonth": 1, "endMonth": 6, "deliverables": ["D1.1 ..."]}],\n'
        '  "budget": {"items": [{"category": "Personnel", "description": "...", "personMonths": 24, '
        '"directCost": 100000}]},\n'
        '  "risks": [{"id": "R1", "description": "...", "workPackage": "WP1", "likelihood": "medium", '
        '"severity": "high", "mitigation": "..."}],\n'
        '  "consortium": [{"name": "...", "country": "...", "type": "SME", "keyTasks": "...", '
        '"allocatedBudget": 150000}]\n'
        "}\n"
        "Indirect costs are computed automatically at a flat 25% — do not include them."
    )


def parse_generated_sheets(raw_text: str) -> SheetsBundle:
    """Parse the model's JSON response defensively; each tab falls back to empty on failure."""
    cleaned = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("Sheets generation response was not a JSON object.")

    bundle = SheetsBundle()
    try:
        bundle.workPackages = [WorkPackage.model_validate(item) for item in data.get("workPackages", [])]
    except Exception:
        logger.warning("Failed to parse generated work packages; leaving tab empty.")
    try:
        bundle.budget.items = [BudgetItem.model_validate(item) for item in data.get("budget", {}).get("items", [])]
    except Exception:
        logger.warning("Failed to parse generated budget items; leaving tab empty.")
    try:
        bundle.risks = [RiskEntry.model_validate(item) for item in data.get("risks", [])]
    except Exception:
        logger.warning("Failed to parse generated risks; leaving tab empty.")
    try:
        bundle.consortium = [ConsortiumMember.model_validate(item) for item in data.get("consortium", [])]
    except Exception:
        logger.warning("Failed to parse generated consortium; leaving tab empty.")
    return recompute_bundle(bundle)


def generate_sheets_via_bedrock(prompt: str) -> str:
    """Call Bedrock directly. Kept as a module-level function so tests can monkeypatch it."""
    import boto3

    from backend.core.config import settings

    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    response = client.converse(
        modelId=settings.bedrock_model_id,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 4000},
    )
    text = ""
    for block in response["output"]["message"]["content"]:
        if "text" in block:
            text += block["text"]
    return text
