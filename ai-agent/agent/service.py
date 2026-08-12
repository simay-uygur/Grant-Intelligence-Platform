# agent/service.py
# The service layer the backend calls. Maps to the frontend's methods.
# Now with error handling so failures return safe values instead of crashing.

import os
os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

from tools.keyword_agent import generate_keywords
from tools.grant_searcher import search_all
from tools.grant_selector import select_grants
from tools.start_application import start_application as _start_application
from tools.rewrite_section import rewrite_section as _rewrite_section


def search_grants(profile, max_grants=3):
    """
    searchGrants(profile) -> Grant[]
    Pipeline: keywords -> broad search -> select best. Returns [] on failure.
    """
    try:
        keywords = generate_keywords(profile, max_keywords=5)
    except Exception as e:
        print(f"[service] keyword generation failed: {e}")
        fallback = str(profile.get("sector") or "innovation").split()[0].lower()
        keywords = [fallback]

    try:
        candidates = search_all(keywords, page_size=10)
    except Exception as e:
        print(f"[service] grant search failed: {e}")
        return []

    if not candidates:
        print("[service] no candidate grants found.")
        return []

    try:
        grants = select_grants(candidates, profile, max_grants=max_grants)
    except Exception as e:
        print(f"[service] grant selection failed: {e}")
        return []

    return grants or []


def start_application(grant, profile):
    """
    startApplication(grant, profile) -> ApplicationDocument
    Returns a minimal error document on failure rather than crashing.
    """
    try:
        return _start_application(grant, profile)
    except Exception as e:
        print(f"[service] start_application failed: {e}")
        return {
            "id": "error",
            "grantId": grant.get("id", "") if isinstance(grant, dict) else "",
            "grantTitle": grant.get("title", "") if isinstance(grant, dict) else "",
            "sections": [],
            "updatedAt": "",
            "error": "Could not draft the application. Please try again.",
        }


def rewrite_section(section_title, current_content, profile, grant=None, instruction=None):
    """
    rewriteSection(...) -> string
    Returns the original content unchanged if the rewrite fails.
    """
    try:
        return _rewrite_section(
            section_title=section_title,
            current_content=current_content,
            profile=profile,
            grant=grant,
            instruction=instruction,
        )
    except Exception as e:
        print(f"[service] rewrite_section failed: {e}")
        return current_content