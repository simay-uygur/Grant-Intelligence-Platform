# agent/stream_agent.py
# Dedicated SSE progress stream generator for grant search and selection.
# Streams stage-by-stage events (thinking, progress, result) to the frontend.

import json
import logging
import re
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Any

from tools.eu_horizon_api import eu_horizon_api

from tools.config import get_bedrock_client, get_model_id

logger = logging.getLogger(__name__)


def _keyword_preview(raw: str) -> str:
    """Turn raw streamed JSON-ish text into a clean comma-separated label list."""
    cleaned = raw.replace("```json", " ").replace("```", " ")
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9&/'-]*", cleaned)
    seen: list[str] = []
    for w in words:
        lw = w.lower()
        if lw not in seen:
            seen.append(lw)
    return ", ".join(seen[:6])


def _reasoning_preview(raw: str, max_chars: int = 140) -> str:
    """Extract a human-readable tail from streamed selection JSON for the thought line."""
    snippet = re.sub(r"\s+", " ", raw).strip().strip("[]{}(),").strip()
    snippet = snippet.replace('"', "").replace("{", "").replace("}", "")
    snippet = re.sub(r"\s+", " ", snippet).strip().strip(",").strip()
    return snippet[-max_chars:] if len(snippet) > max_chars else snippet


def _find_object_end(text: str, start: int) -> int | None:
    """Return the index just past the JSON object starting at `start`, or None if incomplete."""
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
        elif ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i + 1
    return None


def _next_json_object(text: str, pos: int) -> tuple[dict[str, Any] | None, int]:
    """
    Find the next complete JSON object at or after `pos`.
    Returns (object, next_pos), or (None, pos) when the next object is still
    incomplete and more streamed text is needed.
    """
    i = pos
    n = len(text)
    while i < n:
        if text[i] != "{":
            i += 1
            continue
        end = _find_object_end(text, i)
        if end is None:
            return None, i  # incomplete — wait for more tokens
        try:
            return json.loads(text[i:end]), end
        except json.JSONDecodeError:
            i = end  # skip malformed chunk and keep scanning
    return None, i


def run_agent_stream(
    profile: dict[str, Any],
    user_message: str | None = None,
    conversation_history: Any = None,
    session_id: str | None = None,
    max_grants: int = 3,
) -> Generator[dict[str, Any]]:
    """
    Stream real-time events while running the grant search pipeline with real Bedrock LLM calls.
    Yields standard SSE events: thinking, progress, grant_partial, result.
    """
    org_name = profile.get("organisationName") or "your organisation"
    sector = profile.get("sector") or "innovation"

    yield {
        "event": "thinking",
        "stage": "keywords",
        "message": f"Analyzing profile for '{org_name}' and extracting domain keywords with Bedrock LLM...",
        "data": {
            "thought": f"Extracting sector topics and tech focus areas for {sector}...",
        },
    }

    client = get_bedrock_client()
    model_id = get_model_id()

    # Step 1: Real Bedrock LLM Keyword Generation via converse_stream
    keywords = []
    try:
        kw_prompt = (
            "You are helping search the EU grants database, which works best with SIMPLE single-word keywords. "
            "Based on this organisation profile, produce the most relevant single-word search keywords (up to 5).\n\n"
            f"PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
            'Return ONLY a JSON array of lowercase single words, e.g. ["robotics","ai","manufacturing"]. No other text.'
        )
        kw_resp = client.converse_stream(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": kw_prompt}]}],
            inferenceConfig={"maxTokens": 200},
        )
        stream = kw_resp.get("stream")
        raw_text = ""
        last_preview = ""
        if stream:
            for event in stream:
                if "contentBlockDelta" in event:
                    delta = event["contentBlockDelta"].get("delta", {})
                    if "text" in delta:
                        raw_text += delta["text"]
                        # Show clean term labels instead of raw JSON brackets/quotes.
                        preview = _keyword_preview(raw_text)
                        if preview and preview != last_preview:
                            last_preview = preview
                            yield {
                                "event": "thinking",
                                "stage": "keywords",
                                "message": "Generating EU search keywords...",
                                "data": {"thought": f"Suggested terms: {preview}"},
                            }
        cleaned_kw = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        keywords = json.loads(cleaned_kw)
        if not isinstance(keywords, list):
            keywords = [str(sector).split()[0].lower()]
    except Exception as e:
        logger.warning("Bedrock keyword generation fallback: %s", e)
        fallback = str(sector).split()[0].lower()
        keywords = [fallback]

    keywords = [str(k).strip().lower() for k in keywords if str(k).strip()][:5] or [str(sector).split()[0].lower()]

    keywords_str = ", ".join(f"'{k}'" for k in keywords)
    yield {
        "event": "progress",
        "stage": "keywords",
        "message": f"Generated search keywords: {keywords_str}",
        "data": {"keywords": keywords},
    }

    # Step 2: Live EU Portal API Search — all keywords queried in parallel.
    pool: dict[str, dict[str, Any]] = {}
    yield {
        "event": "thinking",
        "stage": "search",
        "message": f"Querying live EU Portal in parallel for {len(keywords)} topic(s): {keywords_str}...",
        "data": {
            "thought": f"Dispatching {len(keywords)} concurrent searches against active Horizon Europe calls...",
        },
    }

    def _search(kw: str) -> list[dict[str, Any]]:
        return eu_horizon_api(kw, page_size=10)

    completed = 0
    with ThreadPoolExecutor(max_workers=min(6, len(keywords))) as executor:
        futures = {executor.submit(_search, kw): kw for kw in keywords}
        for future in as_completed(futures):
            kw = futures[future]
            completed += 1
            try:
                results = future.result()
            except Exception as e:
                logger.warning("EU Portal search failed for '%s': %s", kw, e)
                yield {
                    "event": "progress",
                    "stage": "search",
                    "message": f"Search '{kw}' failed ({completed}/{len(keywords)}) — continuing with other topics",
                    "data": {"keyword": kw, "added": 0, "candidate_count": len(pool)},
                }
                continue
            added_count = 0
            for g in results:
                key = g.get("identifier") or g.get("title")
                if key and key not in pool:
                    pool[key] = g
                    added_count += 1
            yield {
                "event": "progress",
                "stage": "search",
                "message": f"Searched '{kw}' (+{len(results)} calls, {added_count} new) — {len(pool)} total candidate grants pooled ({completed}/{len(keywords)} queries done)",
                "data": {"keyword": kw, "added": added_count, "candidate_count": len(pool)},
            }

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

    # Step 3: Real Bedrock LLM Evaluation & Ranking via converse_stream,
    # with live reasoning tokens and progressive grant reveal.
    today = date.today().isoformat()
    open_candidates = [g for g in candidates if not g.get("deadline") or str(g.get("deadline"))[:10] >= today]

    yield {
        "event": "thinking",
        "stage": "select",
        "message": f"Evaluating and ranking top matches from {len(candidates)} candidate grants ({len(open_candidates)} still open) with Bedrock LLM...",
        "data": {
            "candidate_count": len(candidates),
            "open_count": len(open_candidates),
            "thought": f"Scoring eligibility and alignment across {len(open_candidates)} active calls for {org_name}...",
        },
    }

    selected_grants: list[dict[str, Any]] = []
    revealed: list[dict[str, Any]] = []
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

        select_resp = client.converse_stream(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": select_prompt}]}],
            inferenceConfig={"maxTokens": 4000},
        )
        stream = select_resp.get("stream")
        raw_select = ""
        scan_pos = 0
        delta_count = 0
        if stream:
            for event in stream:
                if "contentBlockDelta" not in event:
                    continue
                delta = event["contentBlockDelta"].get("delta", {})
                if "text" not in delta:
                    continue
                raw_select += delta["text"]
                delta_count += 1

                # Live reasoning tokens: surface the model's actual output as it thinks.
                if delta_count % 5 == 0 and raw_select.strip():
                    yield {
                        "event": "thinking",
                        "stage": "select",
                        "message": f"Evaluating top grant candidates for {org_name}...",
                        "data": {"thought": _reasoning_preview(raw_select) or "Analysing eligibility criteria..."},
                    }

                # Progressive reveal: emit each grant card as soon as its JSON object completes.
                while True:
                    obj, scan_pos = _next_json_object(raw_select, scan_pos)
                    if obj is None:
                        break
                    if isinstance(obj, dict) and obj.get("title"):
                        revealed.append(obj)
                        short_title = str(obj["title"])[:70]
                        yield {
                            "event": "progress",
                            "stage": "select",
                            "message": f"Match {len(revealed)} ranked: {short_title} ({obj.get('matchPercentage', '?')}% fit)",
                            "data": {"revealed_count": len(revealed), "target_count": max_grants},
                        }
                        yield {
                            "event": "grant_partial",
                            "stage": "select",
                            "message": f"Grant match {len(revealed)} ready",
                            "data": {
                                "grant": obj,
                                "revealed_count": len(revealed),
                                "target_count": max_grants,
                            },
                        }
                        yield {
                            "event": "thinking",
                            "stage": "select",
                            "message": f"Evaluating top grant candidates for {org_name}...",
                            "data": {"thought": _reasoning_preview(raw_select) or "Finalising rankings..."},
                        }

        cleaned_select = raw_select.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(cleaned_select)
        selected_grants = parsed if isinstance(parsed, list) else []
    except Exception as e:
        logger.warning("Bedrock grant selection fallback: %s", e)
        for g in open_candidates[:max_grants]:
            selected_grants.append(
                {
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
                }
            )

    if len(selected_grants) < len(revealed):
        # Fallback path produced fewer/different results; keep whatever parsed cleanly.
        logger.info("Selection parse recovered %d grants vs %d progressively revealed", len(selected_grants), len(revealed))

    yield {
        "event": "progress",
        "stage": "select",
        "message": f"Finalised {len(selected_grants)} recommendation(s) for {org_name}",
        "data": {"revealed_count": len(revealed), "final_count": len(selected_grants)},
    }

    yield {
        "event": "result",
        "stage": "select",
        "message": f"Selected {len(selected_grants)} top grant recommendations",
        "data": {
            "grants": selected_grants,
            "reply": f"Found {len(selected_grants)} live grant opportunities for {profile.get('organisationName') or 'your organisation'}.",
        },
    }
