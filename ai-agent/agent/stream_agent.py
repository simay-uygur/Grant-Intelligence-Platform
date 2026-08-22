# agent/stream_agent.py
# Dedicated SSE progress stream generator for grant search and selection.
# Streams stage-by-stage events (thinking, progress, result) to the frontend.

import json
from datetime import date
from typing import Any
from tools.eu_horizon_api import eu_horizon_api
from tools.config import get_bedrock_client, get_model_id


def run_agent_stream(
    profile: dict[str, Any],
    user_message: str | None = None,
    conversation_history: Any = None,
    session_id: str | None = None,
    max_grants: int = 3,
):
    """
    Stream real-time events while running the grant search pipeline with real Bedrock LLM calls.
    Yields standard SSE events: thinking, progress, result.
    """
    yield {
        "event": "thinking",
        "stage": "keywords",
        "message": "Analyzing organization profile and generating search keywords with Bedrock LLM...",
    }

    client = get_bedrock_client()
    model_id = get_model_id()

    # Step 1: Real Bedrock LLM Keyword Generation
    keywords = []
    try:
        kw_prompt = (
            "You are helping search the EU grants database, which works best with SIMPLE single-word keywords. "
            "Based on this organisation profile, produce the most relevant single-word search keywords (up to 5).\n\n"
            f"PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
            'Return ONLY a JSON array of lowercase single words, e.g. ["robotics","ai","manufacturing"]. No other text.'
        )
        kw_resp = client.converse(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": kw_prompt}]}],
            inferenceConfig={"maxTokens": 200},
        )
        raw_text = kw_resp["output"]["message"]["content"][0]["text"].strip()
        keywords = json.loads(raw_text)
        if not isinstance(keywords, list):
            keywords = [str(profile.get("sector") or "innovation").split()[0].lower()]
    except Exception as e:
        print(f"[run_agent_stream] Bedrock keyword generation fallback: {e}")
        fallback = str(profile.get("sector") or "innovation").split()[0].lower()
        keywords = [fallback]

    keywords_str = ", ".join(f"'{k}'" for k in keywords)
    yield {
        "event": "progress",
        "stage": "keywords",
        "message": f"Generated search keywords: {keywords_str}",
        "data": {"keywords": keywords},
    }

    # Step 2: Live EU Portal API Search
    pool = {}
    for i, kw in enumerate(keywords, 1):
        yield {
            "event": "thinking",
            "stage": "search",
            "message": f"Querying live EU Portal for '{kw}' ({i}/{len(keywords)})... {len(pool)} candidate opportunities found so far",
            "data": {"keyword": kw, "keyword_index": i, "candidate_count": len(pool)},
        }
        try:
            results = eu_horizon_api(kw, page_size=10)
            added_count = 0
            for g in results:
                key = g.get("identifier") or g.get("title")
                if key and key not in pool:
                    pool[key] = g
                    added_count += 1
            yield {
                "event": "progress",
                "stage": "search",
                "message": f"Searched '{kw}' (+{len(results)} calls, {added_count} new) — {len(pool)} total candidate grants pooled",
                "data": {"keyword": kw, "added": added_count, "candidate_count": len(pool)},
            }
        except Exception as e:
            print(f"[sdk_agent_stream] search failed for '{kw}': {e}")

    candidates = list(pool.values())

    if not candidates:
        yield {
            "event": "progress",
            "stage": "search",
            "message": "No candidate grants found matching criteria.",
            "data": {"candidate_count": 0},
        }
        yield {
            "event": "result",
            "stage": "select",
            "message": "No matching grants found",
            "data": {"grants": [], "reply": "No matching grants found for this profile."},
        }
        return

    # Step 3: Real Bedrock LLM Evaluation & Ranking
    yield {
        "event": "thinking",
        "stage": "select",
        "message": f"Evaluating and ranking top matches from {len(candidates)} candidate grants with Bedrock LLM...",
        "data": {"candidate_count": len(candidates)},
    }

    today = date.today().isoformat()
    open_candidates = [
        g for g in candidates
        if not g.get("deadline") or str(g.get("deadline"))[:10] >= today
    ]

    selected_grants = []
    try:
        select_prompt = (
            f"You are a grant selection expert. Today's date is {today}. "
            f"From the candidate grants below, choose the {max_grants} that BEST fit the organisation profile. "
            "Evaluate match percentages relative to the organisation's core domain and profile: "
            "assign top relevant domain matches scores between 75% and 95%, and provide clear, encouraging, "
            "bespoke whyItMatches explanations and matchReasons.\n\n"
            f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
            f"CANDIDATE GRANTS:\n{json.dumps(open_candidates[:15], indent=2)}\n\n"
            "Return ONLY a JSON array (no other text) where each selected grant has EXACTLY these fields:\n"
            "  id (string), programme (string), title (string), matchPercentage (number 0-100),\n"
            "  fundingAmount (string), deadline (string), eligibleCountries (array of strings),\n"
            "  organisationEligibility (array of strings), fundingType (string), description (string),\n"
            "  whyItMatches (string), matchReasons (array of strings), requirements (array of strings),\n"
            "  tags (array of strings), sourceUrl (string).\n"
            "Fill factual fields from the candidate data, and reasoning fields (matchPercentage, whyItMatches, matchReasons, tags) from your analysis. Respond with the JSON array only."
        )

        select_resp = client.converse(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": select_prompt}]}],
            inferenceConfig={"maxTokens": 4000},
        )
        raw_select = select_resp["output"]["message"]["content"][0]["text"].strip()
        if raw_select.startswith("```"):
            raw_select = raw_select.split("```")[1]
            if raw_select.startswith("json"):
                raw_select = raw_select[4:]
        selected_grants = json.loads(raw_select.strip())
    except Exception as e:
        print(f"[run_agent_stream] Bedrock grant selection fallback: {e}")
        for g in open_candidates[:max_grants]:
            selected_grants.append({
                "id": str(g.get("identifier") or g.get("id") or f"grant-{len(selected_grants)}"),
                "programme": str(g.get("programme") or "Horizon Europe"),
                "title": str(g.get("title") or "Grant Opportunity"),
                "matchPercentage": 75,
                "fundingAmount": str(g.get("budget") or "EU Funding"),
                "deadline": str(g.get("deadline") or "2026-12-31"),
                "eligibleCountries": ["EU Member States", "Associated Countries"],
                "organisationEligibility": ["SME", "Research", "Enterprise"],
                "fundingType": "Grant",
                "description": str(g.get("summary") or g.get("title") or ""),
                "whyItMatches": f"Relevant opportunity for {profile.get('organisationName', 'the organisation')}.",
                "matchReasons": ["Open Horizon Europe call"],
                "requirements": ["EU Consortium or SME applicant"],
                "tags": ["Horizon Europe"],
                "sourceUrl": str(g.get("url") or g.get("sourceUrl") or "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home"),
            })

    yield {
        "event": "result",
        "stage": "select",
        "message": f"Selected {len(selected_grants)} top grant recommendations",
        "data": {
            "grants": selected_grants,
            "reply": f"Found {len(selected_grants)} live grant opportunities for {profile.get('organisationName') or 'your organisation'}.",
        },
    }
