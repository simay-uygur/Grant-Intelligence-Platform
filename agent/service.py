"""Backend adapter for the real Bedrock-backed grant agent."""

from __future__ import annotations

import os
from typing import Any

os.environ.setdefault("CLAUDE_CODE_USE_BEDROCK", "1")
os.environ.setdefault("AWS_REGION", "us-east-1")

from tools.eu_horizon_api import eu_horizon_api
from tools.rewrite_section import rewrite_section as _rewrite_section
from tools.start_application import start_application as _start_application
from tools.structure_grants import structure_grants


def search_grants(profile: dict[str, Any], max_grants: int = 3) -> list[dict[str, Any]]:
    """Search live EU calls and rank them against the submitted profile."""
    keyword = (
        profile.get("sector")
        or profile.get("projectTitle")
        or profile.get("organisationType")
        or "innovation"
    )
    keyword = str(keyword).split()[0].lower()
    raw_grants = eu_horizon_api(keyword, page_size=15)
    return structure_grants(raw_grants, profile, max_grants=max_grants)


def start_application(grant: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    """Draft a complete application with the Bedrock-backed agent."""
    return _start_application(grant, profile)


def rewrite_section(
    section_title: str,
    current_content: str,
    profile: dict[str, Any],
    grant: dict[str, Any] | None = None,
    instruction: str | None = None,
) -> str:
    """Rewrite one application section with the Bedrock-backed agent."""
    return _rewrite_section(
        section_title=section_title,
        current_content=current_content,
        profile=profile,
        grant=grant,
        instruction=instruction,
    )
