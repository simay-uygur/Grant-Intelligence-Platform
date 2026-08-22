"""Draft a complete application with Claude on Amazon Bedrock."""

from __future__ import annotations

import json
import time
from typing import Any

from tools.config import get_bedrock_client, get_model_id

SECTIONS = [
    ("organisation-overview", "Organisation Overview"),
    ("project-summary", "Project Summary"),
    ("problem-statement", "Problem Statement"),
    ("proposed-solution", "Proposed Solution"),
    ("innovation", "Innovation"),
    ("objectives", "Objectives"),
    ("expected-impact", "Expected Impact"),
    ("sustainability", "Sustainability"),
    ("implementation-plan", "Implementation Plan"),
    ("timeline", "Timeline"),
    ("budget-overview", "Budget Overview"),
    ("risk-management", "Risk Management"),
]


def start_application(grant: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    section_titles = [title for _, title in SECTIONS]
    prompt = (
        "You are writing a real EU grant application. Draft substantive, specific, "
        "professional prose for every section below, tailored to the organisation and grant.\n\n"
        f"GRANT:\n{json.dumps(grant, indent=2)}\n\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
        f"SECTIONS, in this exact order:\n{json.dumps(section_titles, indent=2)}\n\n"
        "Write roughly 80-150 words per section and respond ONLY with a JSON array in the "
        "form [{\"title\": \"...\", \"content\": \"...\"}]."
    )
    client = get_bedrock_client()
    response = client.converse(
        modelId=get_model_id(),
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 8000},
    )
    text = "".join(
        block["text"]
        for block in response["output"]["message"]["content"]
        if "text" in block
    ).strip()
    cleaned = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    drafted = json.loads(cleaned)
    sections = []
    for section_id, title in SECTIONS:
        content = next(
            (item.get("content", "") for item in drafted if item.get("title", "").strip().lower() == title.lower()),
            "",
        )
        sections.append({"id": section_id, "title": title, "content": content})
    return {
        "id": f"doc-{grant.get('id', 'unknown')}-{int(time.time())}",
        "grantId": grant.get("id", ""),
        "grantTitle": grant.get("title", ""),
        "sections": sections,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
