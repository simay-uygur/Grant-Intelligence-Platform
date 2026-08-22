"""Rewrite one application section with Claude on Amazon Bedrock."""

from __future__ import annotations

import json
from typing import Any

from tools.config import get_bedrock_client, get_model_id


def rewrite_section(
    section_title: str,
    current_content: str,
    profile: dict[str, Any],
    grant: dict[str, Any] | None = None,
    instruction: str | None = None,
) -> str:
    grant_context = json.dumps(grant, indent=2) if grant else "No specific grant selected."
    instruction_line = (
        f"The user specifically asks: {instruction}"
        if instruction
        else "Improve this section: make it more specific, concrete, and persuasive."
    )
    prompt = (
        "You are revising one section of an EU grant application. Respond ONLY with the "
        "rewritten section text, with no preamble, headings, or quotes.\n\n"
        f"SECTION: {section_title}\n\nCURRENT CONTENT:\n{current_content}\n\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
        f"GRANT:\n{grant_context}\n\n{instruction_line}\n\n"
        "Keep it roughly the same length, use the organisation's real details, and align it "
        "with the grant's programme priorities."
    )
    client = get_bedrock_client()
    response = client.converse(
        modelId=get_model_id(),
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 1000},
    )
    return " ".join(
        block["text"]
        for block in response["output"]["message"]["content"]
        if "text" in block
    ).strip()
