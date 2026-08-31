# agent/service.py
# Thin backend adapter. It does NOT orchestrate the workflow — it hands the
# request to the Claude Agent SDK agent (sdk_agent), which owns the discovery,
# reasoning, streaming, and tool execution.

import asyncio
import logging
import os
import traceback

os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

from tools.document_qa import document_qa as _document_qa
from tools.document_qa import document_qa_stream as _document_qa_stream
from tools.generate_outline import generate_outline as _generate_outline
from tools.rewrite_section import rewrite_section as _rewrite_section
from tools.rewrite_section import rewrite_section_stream as _rewrite_section_stream
from tools.start_application import start_application as _start_application
from tools.start_application import start_application_stream as _start_application_stream

from agent.sdk_agent import run_agent, run_agent_stream

logger = logging.getLogger(__name__)


def _run(coro):
    try:
        return asyncio.run(coro)
    except RuntimeError:
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(lambda: asyncio.run(coro)).result()


def search_grants(profile, user_request=None, conversation_history=None, max_grants=3, excluded_grant_ids=None):
    if not isinstance(profile, dict):
        return []

    message = user_request or "Find the best matching EU grants."
    try:
        result = _run(
            run_agent(
                profile=profile,
                user_message=message,
                conversation_history=conversation_history,
                excluded_grant_ids=excluded_grant_ids,
            )
        )
        return result.get("final_grants") or []
    except Exception as e:
        logger.error("[service] search_grants failed: %s", e)
        traceback.print_exc()
        return []


def search_grants_stream(profile, user_request=None, conversation_history=None, max_grants=3, excluded_grant_ids=None):
    if not isinstance(profile, dict):
        yield {"event": "result", "stage": "select", "message": "Agent error", "data": {"grants": [], "all_candidates": [], "reply": "Invalid profile.", "eu_count": 0, "web_count": 0}}
        return

    message = user_request or "Find the best matching EU grants."
    try:

        async def _collect():
            events = []
            async for ev in run_agent_stream(
                profile=profile,
                user_message=message,
                conversation_history=conversation_history,
                excluded_grant_ids=excluded_grant_ids,
            ):
                events.append(ev)
            return events

        events = _run(_collect())
        yield from events
    except Exception as e:
        logger.error("[service] search_grants_stream failed: %s", e)
        traceback.print_exc()
        yield {"event": "result", "stage": "select", "message": "Agent error", "data": {"grants": [], "all_candidates": [], "reply": f"Error: {e}", "eu_count": 0, "web_count": 0}}


def start_conversation(profile, user_message=None):
    if not isinstance(profile, dict):
        return {"final_grants": [], "reply": "Invalid profile.", "session_id": None}
    message = user_message or "Find the best matching EU grants for this organisation."
    try:
        return _run(run_agent(profile=profile, user_message=message))
    except Exception as e:
        logger.error("[service] start_conversation failed: %s", e)
        return {"final_grants": [], "reply": f"Error: {e}", "session_id": None}


def continue_conversation(session_id, user_message, profile=None):
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


def generate_outline(grant, profile, template_type=None, custom_instructions=None, attachments=""):
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


def start_application_stream(grant, profile, custom_instructions=None, template_type=None, attachments="", custom_sections=None):
    try:
        yield from _start_application_stream(
            grant=grant,
            profile=profile,
            custom_instructions=custom_instructions,
            template_type=template_type,
            attachments=attachments,
            custom_sections=custom_sections,
        )
    except Exception as e:
        logger.error("[service] start_application_stream failed: %s", e)
        yield {"event": "result", "stage": "draft", "message": "Error", "data": {"document": {"id": "error", "error": str(e)}}}


def rewrite_section(section_title, current_content, profile, grant=None, instruction=None):
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


def rewrite_section_stream(section_title, current_content, profile, grant=None, instruction=None):
    try:
        yield from _rewrite_section_stream(
            section_title=section_title,
            current_content=current_content,
            profile=profile,
            grant=grant,
            instruction=instruction,
        )
    except Exception as e:
        logger.error("[service] rewrite_section_stream failed: %s", e)
        yield {"event": "result", "stage": "rewrite", "message": "Error", "data": {"content": str(e)}}


def document_qa(question, document, grant=None, profile=None, section_id=None, attachments=""):
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
