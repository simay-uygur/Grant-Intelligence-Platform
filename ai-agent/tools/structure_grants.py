# tools/structure_grants.py
# Takes raw EU grants + the user's profile and returns guaranteed structured Grant[] JSON
# in the exact shape the frontend expects. One focused Claude call — no tool-choice ambiguity.

import json
import boto3

client = boto3.client("bedrock-runtime", region_name="us-east-1")
MODEL_ID = "us.anthropic.claude-sonnet-4-6"


def structure_grants(raw_grants, profile, max_grants=3):
    """
    raw_grants: list of grant dicts from eu_horizon_api (title, deadline, programme, url, ...)
    profile:    dict describing the user's organisation/project
    max_grants: how many to return (default 3)

    Returns a list of Grant objects matching the frontend's Grant type.
    """
    prompt = (
        "You are matching EU grants to an organisation. Given the raw grants and the "
        "organisation profile below, select the best matches (up to "
        f"{max_grants}) and return them as structured data.\n\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
        f"RAW GRANTS:\n{json.dumps(raw_grants, indent=2)}\n\n"
        "Return ONLY a JSON array (no other text) where each grant has EXACTLY these fields:\n"
        "  id (string), programme (string), title (string), matchPercentage (number 0-100),\n"
        "  fundingAmount (string), deadline (string), eligibleCountries (array of strings),\n"
        "  organisationEligibility (array of strings), fundingType (string), description (string),\n"
        "  whyItMatches (string), matchReasons (array of strings), requirements (array of strings),\n"
        "  tags (array of strings), sourceUrl (string).\n"
        "Fill factual fields (title, deadline, programme, sourceUrl) from the raw grants, and "
        "reasoning fields (matchPercentage, whyItMatches, matchReasons, tags) from your analysis. "
        "Only include grants that genuinely fit. Respond with the JSON array only."
    )

    response = client.converse(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 4000},
    )

    # Join text blocks.
    text = " ".join(
        b["text"] for b in response["output"]["message"]["content"] if "text" in b
    ).strip()

    # Strip code fences if present.
    cleaned = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        grants = json.loads(cleaned)
    except json.JSONDecodeError:
        print("[structure_grants] Could not parse JSON. Raw response:")
        print(text[:500])
        raise

    print(f"[structure_grants] Structured {len(grants)} grants.")
    return grants