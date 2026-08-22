# agent/service.py
# Thin backend adapter. It does NOT orchestrate the workflow — it hands the
# request to the Claude Agent SDK agent (run_agent), which decides everything.

import asyncio
import os
import traceback

os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

from agent.sdk_agent import run_agent, run_agent_stream
from tools.start_application import start_application as _start_application
from tools.rewrite_section import rewrite_section as _rewrite_section


def _run(coro):
    """Run an async coroutine from sync backend code safely."""
    try:
        return asyncio.run(coro)
    except RuntimeError:
        # If an event loop is already running (e.g. inside async FastAPI),
        # create a new loop in a fresh thread.
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(lambda: asyncio.run(coro)).result()


def search_grants(profile, user_request=None, conversation_history=None, max_grants=3):
    """
    searchGrants(profile) -> Grant[]

    Backward compatible: the backend can still call search_grants(profile).
    Optional user_request lets the user steer the search in natural language
    (e.g. "only SMEs", "later deadlines", "search robotics and manufacturing").
    conversation_history is optional prior context.

    The agent (not this function) decides keywords, tool calls, ranking, and selection.
    """
    if not isinstance(profile, dict):
        return []

    # Default instruction if the user gave none.
    message = user_request or f"Find the best matching EU grants (up to {max_grants})."

    try:
        result = _run(run_agent(
            profile=profile,
            user_message=message,
            conversation_history=conversation_history,
        ))
    except Exception as e:
        print(f"[service] agent run failed: {e}")
        traceback.print_exc()
        return []

    return result.get("final_grants") or []


def start_conversation(profile, user_message=None):
    """
    Start a NEW multi-turn conversation.
    Returns {"final_grants": [...], "reply": "...", "session_id": "..."}.
    The backend should store the returned session_id against the user,
    then pass it to continue_conversation() on the next turn.
    """
    if not isinstance(profile, dict):
        return {"final_grants": [], "reply": "Invalid profile.", "session_id": None}
    message = user_message or "Find the best matching EU grants for this organisation."
    try:
        return _run(run_agent(profile=profile, user_message=message))
    except Exception as e:
        print(f"[service] start_conversation failed: {e}")
        return {"final_grants": [], "reply": f"Error: {e}", "session_id": None}


def continue_conversation(session_id, user_message, profile=None):
    """
    Continue an EXISTING conversation by its session_id (survives restarts).
    The backend looks up the user's stored session_id and passes it here.
    Returns {"final_grants": [...], "reply": "...", "session_id": "..."}.
    """
    if not session_id:
        return {"final_grants": [], "reply": "Missing session_id.", "session_id": None}
    try:
        return _run(run_agent(
            profile=profile or {},
            user_message=user_message,
            session_id=session_id,
        ))
    except Exception as e:
        print(f"[service] continue_conversation failed: {e}")
        return {"final_grants": [], "reply": f"Error: {e}", "session_id": session_id}

def process_agent_message(profile, user_message, conversation_history=None):
    """
    General entry point for a conversational turn. Returns both the structured
    grants (if any) and the agent's natural-language reply, so the backend can
    support multi-turn steering.
    """
    if not isinstance(profile, dict):
        return {"final_grants": [], "reply": "Invalid profile."}
    try:
        return _run(run_agent(
            profile=profile,
            user_message=user_message,
            conversation_history=conversation_history,
        ))
    except Exception as e:
        print(f"[service] agent run failed: {e}")
        return {"final_grants": [], "reply": f"Error: {e}"}


def search_grants_stream(profile, max_grants=3):
    """
    Generator streaming events through the multi-agent system:
    keywords -> live search -> evaluation & selection -> result
    """
    yield from run_agent_stream(profile, max_grants=max_grants)


def start_application(grant, profile):
    """startApplication(grant, profile) -> ApplicationDocument"""
    try:
        return _start_application(grant, profile)
    except Exception as e:
        print(f"[service] start_application failed: {e}")
        return {
            "id": "error", "grantId": grant.get("id", "") if isinstance(grant, dict) else "",
            "grantTitle": grant.get("title", "") if isinstance(grant, dict) else "",
            "sections": [], "updatedAt": "",
            "error": "Could not draft the application. Please try again.",
        }


SECTIONS_LIST = [
    "Organisation Overview",
    "Project Summary",
    "Problem Statement",
    "Proposed Solution",
    "Innovation",
    "Objectives",
    "Expected Impact",
    "Sustainability",
    "Implementation Plan",
    "Timeline",
    "Budget Overview",
    "Risk Management",
]


def start_application_stream(grant, profile):
    """Generator streaming real-time events for drafting a full application document."""
    from tools.start_application import SECTIONS, draft_single_section
    import time

    total = len(SECTIONS)
    doc_id = f"doc-{grant.get('id', 'unknown')}-{int(time.time())}"
    sections = []

    yield {
        "event": "thinking",
        "stage": "draft",
        "message": f"Analyzing requirements for grant '{grant.get('title', '')}' ({total} sections)...",
    }

    try:
        for i, (section_id, section_title) in enumerate(SECTIONS, 1):
            percent = int((i / total) * 100)
            yield {
                "event": "progress",
                "stage": "draft",
                "message": f"Drafting Section {i}/{total}: {section_title} ({percent}% complete)...",
                "data": {
                    "section_index": i,
                    "total_sections": total,
                    "progress_percent": percent,
                },
            }

            content = draft_single_section(grant, profile, section_title)
            section_obj = {"id": section_id, "title": section_title, "content": content}
            sections.append(section_obj)

            percent = int((i / total) * 100)
            current_doc = {
                "id": doc_id,
                "grantId": grant.get("id", ""),
                "grantTitle": grant.get("title", ""),
                "sections": list(sections),
                "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            yield {
                "event": "progress",
                "stage": "draft",
                "message": f"Drafted Section {i}/{total}: {section_title} ({percent}% complete)...",
                "data": {
                    "section_index": i,
                    "total_sections": total,
                    "progress_percent": percent,
                    "section": section_obj,
                    "document": current_doc,
                },
            }

        doc = {
            "id": doc_id,
            "grantId": grant.get("id", ""),
            "grantTitle": grant.get("title", ""),
            "sections": sections,
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        yield {
            "event": "result",
            "stage": "draft",
            "message": f"Successfully drafted all {len(sections)} application sections",
            "data": {"document": doc},
        }
    except Exception as e:
        print(f"[service] start_application_stream failed: {e}")
        error_doc = {
            "id": "error",
            "grantId": grant.get("id", "") if isinstance(grant, dict) else "",
            "grantTitle": grant.get("title", "") if isinstance(grant, dict) else "",
            "sections": [],
            "updatedAt": "",
            "error": str(e),
        }
        yield {
            "event": "error",
            "stage": "draft",
            "message": f"Could not draft application: {e}",
            "data": {"document": error_doc},
        }


def rewrite_section(section_title, current_content, profile, grant=None, instruction=None):
    """rewriteSection(...) -> string"""
    try:
        return _rewrite_section(
            section_title=section_title, current_content=current_content,
            profile=profile, grant=grant, instruction=instruction,
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