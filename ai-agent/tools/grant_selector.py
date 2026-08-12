# tools/grant_selector.py
# Part 3 of the pipeline: the Selector Agent.
# Takes the full candidate pool + profile, filters out closed grants,
# scores the rest against the project, and returns the best matches
# in the frontend's exact Grant shape.

import json
from datetime import date
import boto3

client = boto3.client("bedrock-runtime", region_name="us-east-1")
MODEL_ID = "us.anthropic.claude-sonnet-4-6"


def _drop_closed(candidates):
    """Remove grants whose deadline has already passed."""
    today = date.today().isoformat()  # e.g. '2026-08-06'
    open_grants = []
    for g in candidates:
        dl = g.get("deadline")
        # Keep it if there's no deadline info, or the deadline is today or later.
        if not dl or str(dl)[:10] >= today:
            open_grants.append(g)
    dropped = len(candidates) - len(open_grants)
    print(f"[grant_selector] Dropped {dropped} closed grant(s); {len(open_grants)} still open.")
    return open_grants


def select_grants(candidates, profile, max_grants=3):
    """
    candidates: pooled grant dicts from the searcher
    profile:    the organisation profile
    Returns the best `max_grants` as structured Grant objects (frontend shape).
    """
    # 1. Filter out anything already closed — never recommend a dead grant.
    open_candidates = _drop_closed(candidates)

    if not open_candidates:
        print("[grant_selector] No open grants to select from.")
        return []

    today = date.today().isoformat()

    # 2. Ask the model to score and pick the best, from OPEN grants only.
    prompt = (
        "You are a grant selection expert. Today's date is "
        f"{today}. From the candidate grants below, choose the {max_grants} that BEST fit "
        "the organisation. Rank by genuine fit — do not inflate scores, and only pick grants "
        "that are truly relevant and still open.\n\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
        f"CANDIDATE GRANTS:\n{json.dumps(open_candidates, indent=2)}\n\n"
        "Return ONLY a JSON array (no other text) where each selected grant has EXACTLY "
        "these fields:\n"
        "  id (string), programme (string), title (string), matchPercentage (number 0-100),\n"
        "  fundingAmount (string), deadline (string), eligibleCountries (array of strings),\n"
        "  organisationEligibility (array of strings), fundingType (string), description (string),\n"
        "  whyItMatches (string), matchReasons (array of strings), requirements (array of strings),\n"
        "  tags (array of strings), sourceUrl (string).\n"
        "Fill factual fields (title, deadline, programme, sourceUrl) from the candidate data, and "
        "reasoning fields (matchPercentage, whyItMatches, matchReasons, tags) from your analysis. "
        "Respond with the JSON array only."
    )

    response = client.converse(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 4000},
    )

    text = " ".join(
        b["text"] for b in response["output"]["message"]["content"] if "text" in b
    ).strip()
    cleaned = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        grants = json.loads(cleaned)
    except json.JSONDecodeError:
        print("[grant_selector] Could not parse JSON. Raw response:")
        print(text[:500])
        raise

    print(f"[grant_selector] Selected {len(grants)} grants.")
    return grants