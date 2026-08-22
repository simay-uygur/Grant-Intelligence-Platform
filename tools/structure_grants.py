"""Use Bedrock to rank raw EU calls into the frontend Grant contract."""

from __future__ import annotations

import json
from typing import Any

from tools.config import get_bedrock_client, get_model_id


def structure_grants(
    raw_grants: list[dict[str, Any]],
    profile: dict[str, Any],
    max_grants: int = 3,
) -> list[dict[str, Any]]:
    """Select and describe the best live calls for an organisation profile."""
    if not raw_grants:
        return []

    prompt = (
        "You are matching EU grants to an organisation. Given the raw grants and the "
        f"organisation profile below, select the best matches (up to {max_grants}).\n\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
        f"RAW GRANTS:\n{json.dumps(raw_grants, indent=2)}\n\n"
        "Return ONLY a JSON array. Each grant must have exactly these fields: id, programme, "
        "title, matchPercentage, fundingAmount, deadline, eligibleCountries, "
        "organisationEligibility, fundingType, description, whyItMatches, matchReasons, "
        "requirements, tags, sourceUrl. Fill factual fields from the raw grants and do not "
        "invent grant calls or source URLs."
    )
    client = get_bedrock_client()
    response = client.converse(
        modelId=get_model_id(),
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 4000},
    )
    text = " ".join(
        block["text"]
        for block in response["output"]["message"]["content"]
        if "text" in block
    ).strip()
    cleaned = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    grants = json.loads(cleaned)
    if not isinstance(grants, list):
        raise ValueError("The grant agent returned a non-list result.")
    return grants[:max_grants]
