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


def search_grants_stream(profile, max_grants=3):
    """
    Generator streaming events through each pipeline stage:
    keywords -> search -> select -> result
    """
    yield {
        "event": "thinking",
        "stage": "keywords",
        "message": "Analyzing organization profile and generating search keywords...",
    }

    keywords = []
    try:
        keywords = generate_keywords(profile, max_keywords=5)
        yield {
            "event": "progress",
            "stage": "keywords",
            "message": f"Generated {len(keywords)} search keywords",
            "data": {"keywords": keywords},
        }
    except Exception as e:
        print(f"[service] keyword generation failed: {e}")
        fallback = str(profile.get("sector") or "innovation").split()[0].lower()
        keywords = [fallback]
        yield {
            "event": "error",
            "stage": "keywords",
            "message": f"Keyword generation fallback used: {keywords}",
            "data": {"keywords": keywords, "error": str(e)},
        }

    yield {
        "event": "thinking",
        "stage": "search",
        "message": "Searching live EU Funding & Tenders Portal...",
    }

    candidates = []
    try:
        candidates = search_all(keywords, page_size=10)
        yield {
            "event": "progress",
            "stage": "search",
            "message": f"Retrieved {len(candidates)} candidate grants",
            "data": {"candidate_count": len(candidates)},
        }
    except Exception as e:
        print(f"[service] grant search failed: {e}")
        yield {
            "event": "error",
            "stage": "search",
            "message": f"Grant search failed: {e}",
            "data": {"error": str(e)},
        }
        yield {
            "event": "result",
            "stage": "select",
            "message": "Grant search completed with 0 results",
            "data": {"grants": []},
        }
        return

    if not candidates:
        yield {
            "event": "progress",
            "stage": "search",
            "message": "No candidate grants found matching search criteria.",
            "data": {"candidate_count": 0},
        }
        yield {
            "event": "result",
            "stage": "select",
            "message": "No matching grants found",
            "data": {"grants": []},
        }
        return

    yield {
        "event": "thinking",
        "stage": "select",
        "message": "Filtering open calls and ranking best matches...",
    }

    try:
        grants = select_grants(candidates, profile, max_grants=max_grants)
        yield {
            "event": "result",
            "stage": "select",
            "message": f"Selected {len(grants or [])} grant recommendations",
            "data": {"grants": grants or []},
        }
    except Exception as e:
        print(f"[service] grant selection failed: {e}")
        yield {
            "event": "error",
            "stage": "select",
            "message": f"Grant selection failed: {e}",
            "data": {"error": str(e)},
        }
        yield {
            "event": "result",
            "stage": "select",
            "message": "Grant selection failed",
            "data": {"grants": []},
        }


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


def start_application_stream(grant, profile):
    """Generator streaming events for drafting a full application document."""
    yield {
        "event": "thinking",
        "stage": "draft",
        "message": f"Analyzing requirements for grant '{grant.get('title', '')}'...",
    }
    yield {
        "event": "tool_call",
        "stage": "draft",
        "message": "Drafting application sections with Bedrock agent...",
    }

    doc = start_application(grant, profile)
    if doc.get("error"):
        yield {
            "event": "error",
            "stage": "draft",
            "message": doc["error"],
            "data": {"document": doc},
        }
    else:
        yield {
            "event": "result",
            "stage": "draft",
            "message": f"Successfully drafted {len(doc.get('sections', []))} application sections",
            "data": {"document": doc},
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


def rewrite_section_stream(section_title, current_content, profile, grant=None, instruction=None):
    """Generator streaming events for rewriting a single application section."""
    yield {
        "event": "thinking",
        "stage": "rewrite",
        "message": f"Analyzing section '{section_title}' and user instructions...",
    }
    yield {
        "event": "tool_call",
        "stage": "rewrite",
        "message": f"Rewriting section '{section_title}' with Bedrock agent...",
    }

    content = rewrite_section(
        section_title=section_title,
        current_content=current_content,
        profile=profile,
        grant=grant,
        instruction=instruction,
    )

    yield {
        "event": "result",
        "stage": "rewrite",
        "message": f"Rewrote section '{section_title}' successfully",
        "data": {"content": content},
    }