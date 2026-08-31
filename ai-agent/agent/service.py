# agent/service.py
# Thin backend adapter. It does NOT orchestrate the workflow — it hands the
# request to the Claude Agent SDK agent (run_agent), which decides everything.

import asyncio
import logging
import os
import traceback
from typing import Any

os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

from tools.document_qa import document_qa as _document_qa
from tools.document_qa import document_qa_stream as _document_qa_stream
from tools.generate_outline import generate_outline as _generate_outline
from tools.rewrite_section import rewrite_section as _rewrite_section
from tools.start_application import start_application as _start_application

from agent.sdk_agent import run_agent
from agent.stream_agent import run_agent_stream

logger = logging.getLogger(__name__)


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


def search_grants(profile, user_request=None, conversation_history=None, max_grants=3, excluded_grant_ids=None):
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

    # If stream runner exists, use it to get excluded_grant_ids support synchronously
    try:
        events = list(run_agent_stream(profile, max_grants=max_grants, excluded_grant_ids=excluded_grant_ids))
        for event in reversed(events):
            if event.get("event") == "result" and "grants" in event.get("data", {}):
                return event["data"]["grants"]
    except Exception as e:
        logger.warning("Stream agent run failed in search_grants (%s), attempting sdk_agent fallback", e)

    # Default instruction if the user gave none.
    message = user_request or f"Find the best matching EU grants (up to {max_grants})."

    try:
        result = _run(
            run_agent(
                profile=profile,
                user_message=message,
                conversation_history=conversation_history,
            )
        )
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
        return _run(
            run_agent(
                profile=profile or {},
                user_message=user_message,
                session_id=session_id,
            )
        )
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
        return _run(
            run_agent(
                profile=profile,
                user_message=user_message,
                conversation_history=conversation_history,
            )
        )
    except Exception as e:
        print(f"[service] agent run failed: {e}")
        return {"final_grants": [], "reply": f"Error: {e}"}


def search_grants_stream(profile, max_grants=3, excluded_grant_ids=None):
    """
    Generator streaming events through the multi-agent system:
    keywords -> live search -> evaluation & selection -> result
    """
    yield from run_agent_stream(profile, max_grants=max_grants, excluded_grant_ids=excluded_grant_ids)


def generate_outline(grant, profile, template_type=None, custom_instructions=None, attachments=""):
    """generateOutline(grant, profile) -> OutlineSection[]"""
    try:
        return _generate_outline(
            grant,
            profile,
            template_type=template_type,
            custom_instructions=custom_instructions,
            attachments=attachments,
        )
    except Exception as e:
        logger.error("[service] generate_outline failed: %s", e)
        from tools.generate_outline import DEFAULT_CORE_OUTLINE

        return [dict(s) for s in DEFAULT_CORE_OUTLINE]


def start_application(grant, profile, custom_instructions=None, template_type=None, attachments="", custom_sections=None):
    """startApplication(grant, profile) -> ApplicationDocument"""
    try:
        return _start_application(
            grant,
            profile,
            custom_instructions=custom_instructions,
            template_type=template_type,
            attachments=attachments,
            custom_sections=custom_sections,
        )
    except Exception as e:
        logger.error("[service] start_application failed: %s", e)
        source_url = str(grant.get("sourceUrl") or grant.get("url") or "") if isinstance(grant, dict) else ""
        programme = str(grant.get("programme") or "") if isinstance(grant, dict) else ""
        return {
            "id": "error",
            "grantId": str(grant.get("id") or grant.get("identifier") or "") if isinstance(grant, dict) else "",
            "grantTitle": str(grant.get("title") or "") if isinstance(grant, dict) else "",
            "sourceUrl": source_url if source_url else None,
            "programme": programme if programme else None,
            "sections": [],
            "updatedAt": "",
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


def start_application_stream(grant, profile, custom_instructions=None, template_type=None, attachments="", custom_sections=None):
    """Generator streaming real-time events & token chunks for drafting a full application document."""
    import time

    from tools.start_application import SECTIONS, draft_single_section_stream

    active_sections = []
    if custom_sections:
        for s in custom_sections:
            if isinstance(s, (list, tuple)) and len(s) >= 2:
                active_sections.append((str(s[0]), str(s[1])))
            elif isinstance(s, dict) and s.get("id") and s.get("title"):
                active_sections.append((str(s["id"]), str(s["title"])))
    if not active_sections:
        active_sections = list(SECTIONS)

    total = len(active_sections)
    doc_id = f"doc-{grant.get('id', 'unknown')}-{int(time.time())}"
    sections = []

    org_name = profile.get("organisationName", "Applicant Organisation")
    grant_title = grant.get("title", "Grant Opportunity")
    source_url = str(grant.get("sourceUrl") or grant.get("url") or "")
    programme = str(grant.get("programme") or "")
    has_call_text = bool((grant.get("summary") or "").strip())
    focus_line = "Extracting call objectives, scope, and funder priorities from the official call text..." if has_call_text else "Extracting eligibility rules and funder priorities from the grant programme context..."

    yield {
        "event": "thinking",
        "stage": "draft",
        "message": f"Analyzing Grant Requirements & Priorities for '{grant_title}' ({total} sections)...",
        "data": {
            "thought": focus_line,
            "section_index": 0,
            "total_sections": total,
            "progress_percent": 0,
        },
    }

    try:
        for i, (section_id, section_title) in enumerate(active_sections, 1):
            percent = int(((i - 1) / total) * 100)

            # Emit a rich sub-phase thought before drafting the section
            yield {
                "event": "thinking",
                "stage": "draft",
                "message": f"Formulating Section {i}/{total}: {section_title}...",
                "data": {
                    "thought": f"Aligning {org_name} capabilities with {section_title} requirements...",
                    "section_id": section_id,
                    "section_title": section_title,
                    "section_index": i,
                    "total_sections": total,
                    "progress_percent": percent,
                },
            }

            accumulated = ""
            for chunk in draft_single_section_stream(
                grant,
                profile,
                section_title,
                custom_instructions=custom_instructions,
                template_type=template_type,
                attachments=attachments,
            ):
                accumulated += chunk
                words = len(accumulated.split())
                yield {
                    "event": "section_chunk",
                    "stage": "draft",
                    "message": f"Drafting Section {i}/{total}: {section_title}...",
                    "data": {
                        "section_id": section_id,
                        "section_title": section_title,
                        "chunk": chunk,
                        "accumulated_content": accumulated,
                        "section_index": i,
                        "total_sections": total,
                        "progress_percent": percent,
                        "word_count": words,
                        "thought": f"Writing {section_title} ({words} words)...",
                    },
                }

            section_obj = {"id": section_id, "title": section_title, "content": accumulated}
            sections.append(section_obj)

            percent = int((i / total) * 100)
            current_doc = {
                "id": doc_id,
                "grantId": str(grant.get("id") or grant.get("identifier") or ""),
                "grantTitle": grant_title,
                "sourceUrl": source_url if source_url else None,
                "programme": programme if programme else None,
                "sections": list(sections),
                "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }

            yield {
                "event": "progress",
                "stage": "draft",
                "message": f"Completed Section {i}/{total}: {section_title} ({percent}% complete)",
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
            "grantId": str(grant.get("id") or grant.get("identifier") or ""),
            "grantTitle": str(grant.get("title") or ""),
            "sourceUrl": source_url if source_url else None,
            "programme": programme if programme else None,
            "sections": sections,
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        # Surface silent degradation: sections drafted as placeholder text
        # because the Bedrock call failed for them.
        placeholder_prefix = "Draft content for"
        failed = [s["title"] for s in sections if s.get("content", "").startswith(placeholder_prefix)]
        if failed:
            logger.error(
                "DEGRADED MODE [draft] — %d/%d sections contain placeholder text (Bedrock unavailable): %s",
                len(failed),
                len(sections),
                ", ".join(failed),
            )
        if failed:
            yield {
                "event": "warning",
                "stage": "draft",
                "message": f"⚠️ {len(failed)}/{len(sections)} sections contain placeholder text — AI drafting was unavailable (check AWS credentials).",
                "data": {"failed_sections": failed},
            }
            result_message = f"Draft completed with {len(failed)}/{len(sections)} placeholder sections (AI unavailable)"
        else:
            result_message = f"Successfully drafted all {len(sections)} application sections"

        yield {
            "event": "result",
            "stage": "draft",
            "message": result_message,
            "data": {"document": doc, "degraded": bool(failed)},
        }
    except Exception as e:
        logger.error("start_application_stream failed: %s", e)
        error_doc: dict[str, Any] = {
            "id": "error",
            "grantId": str(grant.get("id") or grant.get("identifier") or "") if isinstance(grant, dict) else "",
            "grantTitle": str(grant.get("title") or "") if isinstance(grant, dict) else "",
            "sourceUrl": source_url if source_url else None,
            "programme": programme if programme else None,
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
    """
    Generator streaming events for rewriting a single application section.

    Emits real token-by-token section_chunk events as Bedrock streams the
    rewrite, followed by a single result event with the fully accumulated
    content — the same event schema used by start_application_stream.
    """
    from tools.rewrite_section import rewrite_section_stream as _tool_stream

    yield {
        "event": "thinking",
        "stage": "rewrite",
        "message": f"Analyzing section '{section_title}' and preparing rewrite instructions...",
    }
    yield {
        "event": "tool_call",
        "stage": "rewrite",
        "message": f"Streaming rewrite of '{section_title}' via Bedrock converse_stream...",
    }

    accumulated = ""
    try:
        for chunk in _tool_stream(
            section_title=section_title,
            current_content=current_content,
            profile=profile,
            grant=grant,
            instruction=instruction,
        ):
            accumulated += chunk
            words = len(accumulated.split())
            yield {
                "event": "section_chunk",
                "stage": "rewrite",
                "message": f"Rewriting '{section_title}'...",
                "data": {
                    "section_title": section_title,
                    "chunk": chunk,
                    "accumulated_content": accumulated,
                    "word_count": words,
                },
            }
    except Exception as e:
        print(f"[service] rewrite_section_stream failed: {e}")
        # Fall back: emit the current_content so the frontend always gets a result
        accumulated = current_content

    yield {
        "event": "result",
        "stage": "rewrite",
        "message": f"Rewrote section '{section_title}' successfully",
        "data": {"content": accumulated},
    }


def document_qa(question, document, grant=None, profile=None, section_id=None, attachments=""):
    """
    document_qa(question, document, grant, profile, section_id) -> dict
    Returns: {"answer": str, "section_id": str | None, "suggestions": list[str]}
    """
    try:
        return _document_qa(
            question=question,
            document=document,
            grant=grant,
            profile=profile,
            section_id=section_id,
            attachments=attachments,
        )
    except Exception as e:
        logger.error("document_qa failed: %s", e)
        return {
            "answer": f"Unable to consult on this document right now ({e}). Please try again.",
            "section_id": section_id,
            "suggestions": [],
        }


def document_qa_stream(question, document, grant=None, profile=None, section_id=None, attachments=""):
    """
    document_qa_stream(question, document, grant, profile, section_id) -> Iterator[dict]
    Yields thinking, token_delta, and result events.
    """
    try:
        yield from _document_qa_stream(
            question=question,
            document=document,
            grant=grant,
            profile=profile,
            section_id=section_id,
            attachments=attachments,
        )
    except Exception as e:
        logger.error("document_qa_stream failed: %s", e)
        yield {
            "event": "result",
            "stage": "qa",
            "data": {
                "answer": f"Unable to consult on this document right now ({e}). Please try again.",
                "section_id": section_id,
                "suggestions": [],
            },
        }
