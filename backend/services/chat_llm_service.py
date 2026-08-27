"""LLM-backed replies for the main chat pipeline.

The chat endpoint stays a backend-orchestrated pipeline, but free-form turns
(without structured search context) are now answered by Bedrock using the
conversation history and any applicant documents uploaded during the chat.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("services.chat_llm")

CHAT_SYSTEM_PROMPT = (
    "You are the Grant Intelligence assistant, an expert EU funding advisor.\n"
    "You help organisations (especially SMEs) find and win European grants such as Horizon Europe "
    "and EIC Accelerator calls.\n\n"
    "Guidelines:\n"
    "- Be concise, concrete, and professional; use short paragraphs or bullet lists.\n"
    "- When the user shares facts about their organisation, project, or documents, remember and "
    "reference them in later answers.\n"
    "- If key matching details are missing (organisation type, country, sector, project goal, "
    "approximate budget), warmly invite the user to complete the profile form below without listing redundant questions in text.\n"
    "- Do not invent specific grant call IDs, deadlines, or amounts; describe programme-level "
    "options instead and note that live search runs once their profile is complete."
)


def build_attachments_block(uploads: list[dict[str, Any]]) -> str:
    """Render uploaded document extracts as prompt background."""
    blocks = []
    for upload in uploads:
        excerpt = upload.get("extractedText") or upload.get("textSnippet") or ""
        if not excerpt.strip():
            continue
        blocks.append(f"DOCUMENT '{upload['filename']}':\n{excerpt[:4000]}")
    return "\n\n".join(blocks)


def build_chat_prompt(user_message: str, history: list[dict[str, str]], attachments_block: str) -> str:
    parts = []
    if history:
        transcript = "\n".join(f"{entry['role'].upper()}: {entry['content']}" for entry in history)
        parts.append(f"CONVERSATION SO FAR:\n{transcript}\n")
    if attachments_block:
        parts.append(f"APPLICANT DOCUMENTS UPLOADED IN THIS CHAT (extracted text you may rely on):\n{attachments_block[:12000]}\n")
    parts.append(f"USER MESSAGE:\n{user_message}")
    return "\n\n".join(parts)


def generate_chat_reply(user_message: str, history: list[dict[str, str]], attachments_block: str = "") -> str:
    """Call Bedrock with the conversation so far. Raises on any failure so the
    caller can fall back to the scripted pipeline message."""
    import boto3

    from backend.core.config import settings

    prompt = build_chat_prompt(user_message, history, attachments_block)
    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    response = client.converse(
        modelId=settings.bedrock_model_id,
        system=[{"text": CHAT_SYSTEM_PROMPT}],
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 1000, "temperature": 0.4},
    )
    text = ""
    for block in response["output"]["message"]["content"]:
        if "text" in block:
            text += block["text"]
    reply = text.strip()
    if not reply:
        raise ValueError("Bedrock returned an empty chat reply.")
    logger.info("Generated LLM chat reply (%d chars)", len(reply))
    return reply
