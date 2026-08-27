# tools/document_qa.py
# Stage 4: Interactive Q&A and consultation for grant application proposals.
# Allows users to ask questions, review sections, and check compliance against EU Horizon call criteria.

import json
import logging
import re
from collections.abc import Generator
from typing import Any

from tools.config import get_bedrock_client, get_model_id

logger = logging.getLogger(__name__)


def _format_document_context(document: dict[str, Any], target_section_id: str | None = None) -> str:
    """Format full document or target section into context text."""
    sections = document.get("sections") or []
    if not isinstance(sections, list):
        return str(document)

    if target_section_id:
        for sec in sections:
            if isinstance(sec, dict) and sec.get("id") == target_section_id:
                return f"TARGET SECTION: {sec.get('title', target_section_id)}\n{sec.get('content', '')}"

    lines = []
    for i, sec in enumerate(sections, 1):
        if isinstance(sec, dict):
            title = sec.get("title") or f"Section {i}"
            content = sec.get("content") or ""
            lines.append(f"### {title}\n{content}\n")
    return "\n".join(lines)


def _build_qa_prompt(
    question: str,
    document: dict[str, Any],
    grant: dict[str, Any] | None = None,
    profile: dict[str, Any] | None = None,
    section_id: str | None = None,
    attachments: str = "",
) -> str:
    doc_context = _format_document_context(document, target_section_id=section_id)
    grant_summary = (grant.get("summary") or grant.get("description") or "") if isinstance(grant, dict) else ""
    grant_context = json.dumps(grant, indent=2) if grant else "No specific grant context provided."
    profile_context = json.dumps(profile, indent=2) if profile else "No profile provided."

    target_note = f"\nTARGET FOCUS: The user is specifically asking about section '{section_id}'." if section_id else ""
    attachment_block = ""
    if attachments and attachments.strip():
        attachment_block = f"\nAPPLICANT BACKGROUND MATERIAL (extracted from documents the applicant uploaded — ground your advice in these real facts):\n{attachments.strip()[:12000]}\n"

    return (
        "You are an expert European Commission Grant Consultant and Proposal Evaluator.\n"
        "Your role is to advise the applicant, critique their drafted proposal, ensure alignment "
        "with EU Horizon call criteria, and suggest specific, high-impact improvements.\n\n"
        f"OFFICIAL GRANT CALL DETAILS:\n{grant_context}\n\n"
        f"CALL OBJECTIVES & PRIORITIES:\n{grant_summary or '(Refer to grant details)'}\n\n"
        f"APPLICANT PROFILE:\n{profile_context}\n{attachment_block}\n"
        f"DRAFTED APPLICATION DOCUMENT:\n{doc_context}\n{target_note}\n\n"
        f"USER QUESTION / CONSULTATION REQUEST:\n{question}\n\n"
        "Provide a clear, authoritative, and actionable response. Specifically:\n"
        "1. Directly answer the user's question or critique the relevant section.\n"
        "2. Evaluate compliance against Horizon Europe / EU funding standards (e.g. excellence, impact, implementation, consortium feasibility).\n"
        "3. Provide 2-4 concrete bullet points with actionable improvements or revisions.\n\n"
        "Structure your response cleanly with markdown."
    )


def _extract_suggestions(text: str) -> list[str]:
    """Extract bullet point recommendations from output text."""
    suggestions: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if re.match(r"^[-*•\d+.]\s+", line):
            cleaned = re.sub(r"^[-*•\d+.]\s+", "", line).strip()
            if len(cleaned) > 10 and not cleaned.endswith(":"):
                suggestions.append(cleaned)
    return suggestions[:5]


def document_qa(
    question: str,
    document: dict[str, Any],
    grant: dict[str, Any] | None = None,
    profile: dict[str, Any] | None = None,
    section_id: str | None = None,
    attachments: str = "",
) -> dict[str, Any]:
    """
    Synchronous document Q&A consultation.
    Returns: {"answer": str, "section_id": str | None, "suggestions": list[str]}
    """
    prompt = _build_qa_prompt(question, document, grant, profile, section_id=section_id, attachments=attachments)
    client = get_bedrock_client()
    response = client.converse(
        modelId=get_model_id(),
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 2000},
    )

    parts = [b["text"] for b in response["output"]["message"]["content"] if "text" in b]
    answer = " ".join(parts).strip()
    suggestions = _extract_suggestions(answer)

    logger.info("Executed document Q&A for section '%s'", section_id)
    return {
        "answer": answer,
        "section_id": section_id,
        "suggestions": suggestions,
    }


def document_qa_stream(
    question: str,
    document: dict[str, Any],
    grant: dict[str, Any] | None = None,
    profile: dict[str, Any] | None = None,
    section_id: str | None = None,
    attachments: str = "",
) -> Generator[dict[str, Any]]:
    """
    Streaming document Q&A consultation via Bedrock converse_stream.
    Yields thinking events, token_deltas, and final result.
    """
    target_label = f"section '{section_id}'" if section_id else "the application document"
    yield {
        "event": "thinking",
        "stage": "qa",
        "message": f"Consulting grant evaluator agent regarding {target_label}...",
        "data": {
            "thought": "Reviewing proposal text against EU call objectives and evaluation standards...",
            "section_id": section_id,
        },
    }

    prompt = _build_qa_prompt(question, document, grant, profile, section_id=section_id, attachments=attachments)
    client = get_bedrock_client()
    model_id = get_model_id()

    response = client.converse_stream(
        modelId=model_id,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 2500},
    )

    stream = response.get("stream")
    accumulated = ""
    if stream:
        for event in stream:
            if "contentBlockDelta" in event:
                delta = event["contentBlockDelta"].get("delta", {})
                if "text" in delta:
                    chunk = delta["text"]
                    accumulated += chunk
                    yield {
                        "event": "token_delta",
                        "stage": "qa",
                        "data": {
                            "delta": chunk,
                            "accumulated": accumulated,
                            "section_id": section_id,
                        },
                    }

    suggestions = _extract_suggestions(accumulated)
    yield {
        "event": "result",
        "stage": "qa",
        "data": {
            "answer": accumulated.strip(),
            "section_id": section_id,
            "suggestions": suggestions,
        },
    }
