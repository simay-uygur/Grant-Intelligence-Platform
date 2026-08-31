# agent/service.py
# Thin backend adapter. It does NOT orchestrate the workflow — it hands the
# request to the Claude Agent SDK agent (sdk_agent), which owns the discovery,
# reasoning, streaming, and tool execution.

import asyncio
import logging
import os
import traceback
from collections.abc import Iterator
from typing import Any

os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

from tools.document_qa import document_qa as _document_qa
from tools.document_qa import document_qa_stream as _document_qa_stream
from tools.generate_outline import generate_outline as _generate_outline
from tools.rewrite_section import rewrite_section as _rewrite_section
from tools.start_application import start_application as _start_application

from agent.sdk_agent import (
    rewrite_section_stream as _sdk_rewrite_section_stream,
)
from agent.sdk_agent import run_agent  # Real Claude Agent SDK path
from agent.sdk_agent import (
    start_application_stream as _sdk_start_application_stream,
)

logger = logging.getLogger(__name__)


def _run(coro):
    """Run an async coroutine from sync backend code safely."""
    try:
        return asyncio.run(coro)
    except RuntimeError:
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(lambda: asyncio.run(coro)).result()


def search_grants(profile, user_request=None, conversation_history=None, max_grants=3, excluded_grant_ids=None):
    """
    searchGrants(profile) -> Grant[]

    Uses the real Claude Agent SDK (run_agent) as the primary path.
    excluded_grant_ids prevents recommending already-offered grants.
    """
    if not isinstance(profile, dict):
        return []

    message = user_request or f"Find the best matching EU grants (up to {max_grants})."
    try:
        result = _run(
            run_agent(
                profile=profile,
                user_message=message,
                conversation_history=conversation_history,
                max_grants=max_grants,
                excluded_grant_ids=excluded_grant_ids,
            )
        )
        return result.get("final_grants") or []
    except Exception as e:
        logger.error("[service] search_grants failed: %s", e)
        traceback.print_exc()
        return []


def start_conversation(profile, user_message=None):
    """
    Start a NEW multi-turn conversation.
    Returns {"final_grants": [...], "reply": "...", "session_id": "..."}.
    """
    if not isinstance(profile, dict):
        return {"final_grants": [], "reply": "Invalid profile.", "session_id": None}
    message = user_message or "Find the best matching EU grants for this organisation."
    try:
        return _run(run_agent(profile=profile, user_message=message))
    except Exception as e:
        logger.error("[service] start_conversation failed: %s", e)
        return {"final_grants": [], "reply": f"Error: {e}", "session_id": None}


def continue_conversation(session_id, user_message, profile=None):
    """
    Continue an EXISTING conversation by its session_id (survives restarts).
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
        logger.error("[service] continue_conversation failed: %s", e)
        return {"final_grants": [], "reply": f"Error: {e}", "session_id": session_id}


def process_agent_message(profile, user_message, conversation_history=None):
    """
    General entry point for a conversational turn. Returns both structured grants
    and natural-language reply.
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
        logger.error("[service] agent run failed: %s", e)
        return {"final_grants": [], "reply": f"Error: {e}"}


def search_grants_stream(profile, max_grants=3, excluded_grant_ids=None) -> Iterator[dict[str, Any]]:
    """
    Streams real-time SSE events from the Claude Agent SDK agentic loop.
    Uses a thread+queue bridge so each event is yielded immediately as
    Claude calls MCP tools — true live streaming, no collect-then-dump.
    """
    import asyncio
    import queue
    import threading

    from agent.sdk_agent import run_agent_stream_sdk

    done_sentinel = object()
    event_queue: queue.Queue[dict[str, Any] | Exception | object] = queue.Queue()

    def _run_async() -> None:
        async def _consume() -> None:
            try:
                async for ev in run_agent_stream_sdk(
                    profile,
                    max_grants=max_grants,
                    excluded_grant_ids=excluded_grant_ids,
                ):
                    event_queue.put(ev)
            except Exception as exc:
                event_queue.put(exc)
            finally:
                event_queue.put(done_sentinel)

        asyncio.run(_consume())

    thread = threading.Thread(target=_run_async, daemon=True)
    thread.start()

    while True:
        item = event_queue.get()
        if item is done_sentinel:
            break
        if isinstance(item, Exception):
            logger.error("[service] search_grants_stream error: %s", item)
            yield {
                "event": "result",
                "stage": "select",
                "message": "Agent error",
                "data": {"grants": [], "all_candidates": [], "reply": f"Error: {item}", "eu_count": 0, "web_count": 0},
            }
            break
        yield item


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


def start_application_stream(grant, profile, custom_instructions=None, template_type=None, attachments="", custom_sections=None) -> Iterator[dict[str, Any]]:
    """Generator streaming real-time events & token chunks for drafting a full application document."""
    yield from _sdk_start_application_stream(
        grant=grant,
        profile=profile,
        custom_instructions=custom_instructions,
        template_type=template_type,
        attachments=attachments,
        custom_sections=custom_sections,
    )


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
        logger.error("[service] rewrite_section failed: %s", e)
        return current_content


def rewrite_section_stream(section_title, current_content, profile, grant=None, instruction=None) -> Iterator[dict[str, Any]]:
    """
    Generator streaming events for rewriting a single application section.
    """
    yield from _sdk_rewrite_section_stream(
        section_title=section_title,
        current_content=current_content,
        profile=profile,
        grant=grant,
        instruction=instruction,
    )


def document_qa(question, document, grant=None, profile=None, section_id=None, attachments=""):
    """
    document_qa(question, document, grant, profile, section_id) -> dict
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


def document_qa_stream(question, document, grant=None, profile=None, section_id=None, attachments="") -> Iterator[dict[str, Any]]:
    """
    document_qa_stream(question, document, grant, profile, section_id) -> Iterator[dict]
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
