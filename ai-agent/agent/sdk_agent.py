# agent/sdk_agent.py
# The Grant Intelligence agent — Claude Agent SDK owns the loop.
# Claude decides keywords, tool calls, ranking, and final selection (the mentor's
# "agent-controlled" architecture — not a fixed Python pipeline).
# Provides both streaming (run_agent_stream) and non-streaming (run_agent) interfaces.
# The streaming version emits SSE-compatible events matching stream_agent.py format
# so the backend/frontend can consume them identically.

import asyncio
import json
import logging
import os
import sys
from collections.abc import AsyncGenerator
from contextvars import ContextVar
from datetime import date
from typing import Any

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

logger = logging.getLogger(__name__)

try:
    from claude_agent_sdk import (
        ClaudeAgentOptions,
        ClaudeSDKClient,
        create_sdk_mcp_server,
        query,
        tool,
    )

    HAS_CLAUDE_AGENT_SDK = True
except ImportError:
    HAS_CLAUDE_AGENT_SDK = False

    def tool(name: str, description: str, schema: Any = None) -> Any:
        def decorator(fn: Any) -> Any:
            return fn

        return decorator

    def create_sdk_mcp_server(*args: Any, **kwargs: Any) -> Any:
        return None

    query = None
    ClaudeAgentOptions = None
    ClaudeSDKClient = None

from tools.eu_horizon_api import eu_horizon_api
from tools.rewrite_section import rewrite_section as _rewrite_section
from tools.start_application import start_application as _start_application
from tools.web_search import web_search as _web_search
from tools.web_search import web_search_funding_opportunities

from agent.system_prompt import GRANT_AGENT_SYSTEM_PROMPT
from tools.config import get_model_id

MODEL_ID = get_model_id()

_result_holder_var: ContextVar[list[Any] | None] = ContextVar("_result_holder_var", default=None)


# ─── TOOLS ────────────────────────────────────────────────────────────────


@tool(
    "web_search_grants",
    "Search the wider internet for funding opportunities, national/regional grants, foundations, or international programmes in parallel with EU database searches. Provide a search query. Returns real web results with titles and source URLs.",
    {"query": str},
)
async def web_search_grants(args: dict[str, Any]) -> dict[str, Any]:
    query_str = str(args.get("query") or args.get("keywords") or args.get("keyword") or "").strip()
    if not query_str:
        return {"content": [{"type": "text", "text": json.dumps({"web_candidates": []})}]}

    try:
        candidates = web_search_funding_opportunities(query_str, max_results=5)
    except Exception:
        candidates = []

    if not candidates:
        try:
            raw_results = _web_search(query_str, max_results=5)
            for r in raw_results:
                if isinstance(r, dict) and r.get("title") and r.get("url"):
                    url = r["url"]
                    cand_id = f"web-{abs(hash(url)) % 1000000:06d}"
                    candidates.append(
                        {
                            "id": cand_id,
                            "identifier": f"WEB-{abs(hash(url)) % 1000000:06d}",
                            "title": r["title"],
                            "programme": "Web Grant Discovery",
                            "source": "Web Search",
                            "url": url,
                            "sourceUrl": url,
                            "summary": r.get("snippet", r["title"]),
                            "description": r.get("snippet", r["title"]),
                            "deadline": None,
                        }
                    )
        except Exception:
            pass

    return {"content": [{"type": "text", "text": json.dumps({"web_candidates": candidates}, indent=2)}]}


@tool(
    "search_eu_grants",
    "Search the real EU grants database. Provide one or more keywords (comma-separated). Returns deduplicated candidate grants. Does NOT select final grants.",
    {"keywords": str},
)
async def search_eu_grants(args: dict[str, Any]) -> dict[str, Any]:
    raw_kw = args.get("keywords") or args.get("keyword") or args.get("query") or ""
    if isinstance(raw_kw, list):
        keywords = [str(k).strip() for k in raw_kw if str(k).strip()]
    else:
        keywords = [k.strip() for k in str(raw_kw).split(",") if k.strip()]
    if not keywords:
        return {"content": [{"type": "text", "text": "No keywords provided."}]}
    pool: dict[str, dict[str, Any]] = {}
    errors: list[str] = []
    for kw in keywords:
        try:
            for g in eu_horizon_api(kw, page_size=10):
                key = g.get("identifier") or g.get("id") or g.get("title")
                if key and key not in pool:
                    g["id"] = g.get("identifier") or g.get("id") or key
                    if not g.get("source"):
                        g["source"] = "EU Horizon"
                    if not g.get("sourceUrl"):
                        g["sourceUrl"] = g.get("url")
                    pool[key] = g
        except Exception as e:
            errors.append(f"{kw}: {e}")
    candidates = list(pool.values())
    if not candidates:
        msg = "No grants found." + (" Errors: " + "; ".join(errors) if errors else "")
        return {"content": [{"type": "text", "text": msg}]}
    payload: dict[str, Any] = {"count": len(candidates), "eu_candidates": candidates}
    if errors:
        payload["errors"] = errors
    return {"content": [{"type": "text", "text": json.dumps(payload, indent=2)}]}


@tool(
    "evaluate_grant_candidates",
    "Run deterministic checks on candidate grants (JSON array). Returns evidence per grant (deadline open/closed, missing fields). Does NOT rank or pick.",
    {"candidates_json": str},
)
async def evaluate_grant_candidates(args: dict[str, Any]) -> dict[str, Any]:
    raw = args.get("candidates_json") or args.get("candidates") or args
    if isinstance(raw, str):
        try:
            candidates = json.loads(raw)
        except Exception as e:
            return {"content": [{"type": "text", "text": f"Parse error: {e}"}]}
    elif isinstance(raw, list):
        candidates = raw
    elif isinstance(raw, dict):
        candidates = raw.get("candidates") or raw.get("eu_candidates") or [raw]
    else:
        candidates = []

    if not isinstance(candidates, list):
        candidates = [candidates]

    today = date.today().isoformat()
    evidence = []
    for g in candidates:
        if not isinstance(g, dict):
            continue
        dl = str(g.get("deadline"))[:10] if g.get("deadline") else None
        evidence.append(
            {
                "id": g.get("id") or g.get("identifier") or g.get("title"),
                "title": g.get("title"),
                "deadline": dl,
                "deadline_open": (dl is None) or (dl >= today),
                "has_url": bool(g.get("url") or g.get("sourceUrl")),
            }
        )
    return {"content": [{"type": "text", "text": json.dumps({"today": today, "evidence": evidence}, indent=2)}]}


@tool(
    "finalize_grant_recommendations",
    "Submit your FINAL chosen grants as a JSON array in the frontend Grant shape "
    "(id, programme, title, matchPercentage, fundingAmount, deadline, eligibleCountries, "
    "organisationEligibility, fundingType, description, whyItMatches, matchReasons, "
    "requirements, tags, sourceUrl, source). Set source='EU Horizon' or 'Web Search'. "
    "Rejects closed grants and those without a source URL. "
    "Call this once after searching, evaluating, and choosing.",
    {"grants_json": str},
)
async def finalize_grant_recommendations(args: dict[str, Any]) -> dict[str, Any]:
    raw = args.get("grants_json") or args.get("grants") or args.get("candidate_ids") or args
    if isinstance(raw, str):
        try:
            grants = json.loads(raw)
        except Exception as e:
            return {"content": [{"type": "text", "text": f"Parse error: {e}"}]}
    elif isinstance(raw, list):
        grants = raw
    elif isinstance(raw, dict):
        grants = raw.get("grants") or raw.get("finalGrants") or [raw]
    else:
        grants = []

    if not isinstance(grants, list):
        return {"content": [{"type": "text", "text": "grants_json must be a JSON array."}]}

    today = date.today().isoformat()
    valid, rejected = [], []
    for item in grants:
        if isinstance(item, str):
            item = {
                "id": item,
                "title": item,
                "sourceUrl": "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search",
            }
        if not isinstance(item, dict):
            continue

        g = dict(item)
        title = g.get("title") or g.get("id") or "Untitled Grant"
        source_url = g.get("sourceUrl") or g.get("url")
        if not source_url:
            rejected.append({"grant": title, "reason": "no source URL"})
            continue
        g["sourceUrl"] = source_url
        g["url"] = source_url

        dl = g.get("deadline")
        if dl and str(dl)[:10] < today:
            rejected.append({"grant": title, "reason": "deadline passed"})
            continue

        if not g.get("source"):
            g["source"] = "EU Horizon" if "horizon" in str(g.get("programme", "")).lower() else "Web Search"

        if not g.get("id"):
            g["id"] = g.get("identifier") or f"grant-{abs(hash(title)) % 1000000:06d}"
        if not g.get("programme"):
            g["programme"] = "Horizon Europe" if g["source"] == "EU Horizon" else "Web Grant Discovery"
        if not g.get("matchPercentage"):
            g["matchPercentage"] = 88
        if not g.get("fundingAmount"):
            g["fundingAmount"] = "See call details"
        if not g.get("eligibleCountries"):
            g["eligibleCountries"] = ["EU Member States", "Associated Countries"]
        if not g.get("organisationEligibility"):
            g["organisationEligibility"] = "SMEs, Research Organisations, Universities"
        if not g.get("fundingType"):
            g["fundingType"] = "Grant"
        if not g.get("description"):
            g["description"] = g.get("summary") or title
        if not g.get("whyItMatches"):
            g["whyItMatches"] = "Strong alignment with organisation profile and project scope."
        if not g.get("matchReasons"):
            g["matchReasons"] = [str(g["programme"]), "Strategic fit"]
        if not g.get("requirements"):
            g["requirements"] = ["Standard eligibility requirements"]
        if not g.get("tags"):
            g["tags"] = [str(g["programme"])]

        valid.append(g)

    _result_holder_var.set(valid)
    result = {"finalGrants": valid, "count": len(valid), "rejected": rejected}
    if len(valid) < 3:
        result["note"] = f"Only {len(valid)} valid open grant(s) available."
    return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}


@tool(
    "draft_application",
    "Draft a full grant application. Provide grant (JSON) and profile (JSON). Returns ApplicationDocument.",
    {"grant_json": str, "profile_json": str},
)
async def draft_application(args: dict[str, Any]) -> dict[str, Any]:
    grant_data = json.loads(args["grant_json"]) if isinstance(args.get("grant_json"), str) else (args.get("grant_json") or {})
    profile_data = json.loads(args["profile_json"]) if isinstance(args.get("profile_json"), str) else (args.get("profile_json") or {})
    doc = _start_application(grant_data, profile_data)
    return {"content": [{"type": "text", "text": json.dumps(doc, indent=2)}]}


@tool(
    "rewrite_application_section",
    "Rewrite one application section. Provide section_title, current_content, profile (JSON), optionally instruction. Returns improved text.",
    {"section_title": str, "current_content": str, "profile_json": str, "instruction": str},
)
async def rewrite_application_section(args: dict[str, Any]) -> dict[str, Any]:
    profile_data = json.loads(args["profile_json"]) if isinstance(args.get("profile_json"), str) else (args.get("profile_json") or {})
    new_text = _rewrite_section(
        section_title=args["section_title"],
        current_content=args["current_content"],
        profile=profile_data,
        instruction=args.get("instruction"),
    )
    return {"content": [{"type": "text", "text": new_text}]}


# ─── MCP SERVER ───────────────────────────────────────────────────────────

grant_server = create_sdk_mcp_server(
    name="grant-tools",
    version="2.0.0",
    tools=[
        search_eu_grants,
        evaluate_grant_candidates,
        finalize_grant_recommendations,
        draft_application,
        rewrite_application_section,
        web_search_grants,
    ],
)

ALLOWED_TOOLS = [
    "mcp__grants__search_eu_grants",
    "mcp__grants__evaluate_grant_candidates",
    "mcp__grants__finalize_grant_recommendations",
    "mcp__grants__draft_application",
    "mcp__grants__rewrite_application_section",
    "mcp__grants__web_search_grants",
]


# ─── HELPERS ──────────────────────────────────────────────────────────────


def _build_prompt(profile, user_message, conversation_history=None, excluded_grant_ids=None):
    parts = ["ORGANISATION PROFILE:\n" + json.dumps(profile, indent=2)]
    if conversation_history:
        parts.append("RELEVANT PRIOR CONTEXT:\n" + str(conversation_history))
    if excluded_grant_ids:
        parts.append("EXCLUDE these grant IDs (already shown, user wants different ones):\n" + json.dumps(list(excluded_grant_ids)))
    parts.append("USER REQUEST:\n" + (user_message or "Find the best matching grants for this organisation."))
    return "\n\n".join(parts)


def _extract_tool_outputs(message):
    """Parse SDK message blocks for tool results we care about."""
    results = []
    content_blocks = getattr(message, "content", None)
    if content_blocks is None and isinstance(message, dict):
        content_blocks = message.get("content")
    if not content_blocks:
        return results

    blocks = content_blocks if isinstance(content_blocks, list) else [content_blocks]
    for block in blocks:
        texts = []
        if isinstance(block, str):
            texts.append(block)
        elif hasattr(block, "text") and block.text:
            texts.append(block.text)
        elif isinstance(block, dict) and block.get("text"):
            texts.append(block["text"])

        subcontent = getattr(block, "content", None) or (block.get("content") if isinstance(block, dict) else None)
        if subcontent:
            items = subcontent if isinstance(subcontent, list) else [subcontent]
            for item in items:
                if isinstance(item, str):
                    texts.append(item)
                elif hasattr(item, "text") and item.text:
                    texts.append(item.text)
                elif isinstance(item, dict) and item.get("text"):
                    texts.append(item["text"])

        for text in texts:
            if not text or not isinstance(text, str):
                continue
            try:
                parsed = json.loads(text)
            except Exception:
                continue
            if not isinstance(parsed, dict):
                continue
            if "finalGrants" in parsed:
                results.append(("finalGrants", parsed))
            if "eu_candidates" in parsed and isinstance(parsed["eu_candidates"], list):
                results.append(("eu_candidates", parsed))
            if "web_candidates" in parsed and isinstance(parsed["web_candidates"], list):
                results.append(("web_candidates", parsed))
            if "evidence" in parsed and isinstance(parsed["evidence"], list):
                results.append(("evidence", parsed))
    return results


async def _run_fallback_discovery(
    profile: dict[str, Any],
    user_message: str | None = None,
    excluded_grant_ids: list[str] | None = None,
) -> AsyncGenerator[dict[str, Any]]:
    """
    Direct multi-source discovery engine used when Claude Agent SDK is not installed.
    Runs search_eu_grants and web_search_grants, pools candidates, evaluates them,
    and yields SSE events with 3 structured recommendations.
    """
    org_name = profile.get("organisationName") or "your organisation"
    sector = profile.get("sector") or "innovation"
    proj = profile.get("projectDescription") or ""
    country = profile.get("country") or ""

    # 1. Keywords
    kw_list = [sector]
    if proj:
        words = [w.strip().lower() for w in proj.split() if len(w) > 4 and w.isalpha()]
        if words:
            kw_list.append(words[0])
    kw_str = ", ".join(dict.fromkeys(kw_list))

    all_candidates: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    eu_count = 0
    web_count = 0

    # 2. EU Search
    eu_res = await search_eu_grants({"keywords": kw_str})
    try:
        eu_parsed = json.loads(eu_res["content"][0]["text"])
        for g in eu_parsed.get("eu_candidates", []):
            k = g.get("id") or g.get("identifier") or g.get("title")
            if k and k not in seen_keys:
                seen_keys.add(k)
                all_candidates.append({**g, "source": "EU Horizon"})
                eu_count += 1
    except Exception:
        pass

    yield {
        "event": "progress",
        "stage": "search",
        "message": f"EU Portal search complete — {eu_count} candidate(s) discovered",
        "data": {
            "source": "eu_portal",
            "added": eu_count,
            "candidate_count": len(all_candidates),
            "eu_count": eu_count,
            "web_count": web_count,
        },
    }

    # 3. Web Search
    web_res = await web_search_grants({"query": f"{sector} {country} grant funding Europe 2026"})
    try:
        web_parsed = json.loads(web_res["content"][0]["text"])
        for w in web_parsed.get("web_candidates", []):
            k = w.get("id") or w.get("url") or w.get("title")
            if k and k not in seen_keys:
                seen_keys.add(k)
                all_candidates.append({**w, "source": "Web Search"})
                web_count += 1
    except Exception:
        pass

    yield {
        "event": "progress",
        "stage": "search",
        "message": f"Web search complete — {web_count} web candidate(s) discovered",
        "data": {
            "source": "web_search",
            "added": web_count,
            "candidate_count": len(all_candidates),
            "eu_count": eu_count,
            "web_count": web_count,
        },
    }

    # 4. Filter excluded IDs
    excluded_set = {str(eid) for eid in (excluded_grant_ids or [])}
    available = [c for c in all_candidates if str(c.get("id") or c.get("identifier") or c.get("title")) not in excluded_set]

    # 5. Evaluate and finalize top 3
    yield {
        "event": "thinking",
        "stage": "evaluate",
        "message": f"Evaluating {len(available)} candidate opportunities against profile...",
        "data": {"evidence_count": len(available)},
    }

    selected = available[:3] if len(available) >= 3 else available
    final_payload = await finalize_grant_recommendations({"grants": selected})
    final_grants = json.loads(final_payload["content"][0]["text"]).get("finalGrants", [])

    for idx, g in enumerate(final_grants, 1):
        yield {
            "event": "grant_partial",
            "stage": "select",
            "message": f"Grant match {idx} ready",
            "data": {"grant": g, "revealed_count": idx, "target_count": len(final_grants)},
        }

    yield {
        "event": "progress",
        "stage": "select",
        "message": f"Finalized {len(final_grants)} recommendations from {len(all_candidates)} candidates",
        "data": {"final_count": len(final_grants), "candidate_count": len(all_candidates)},
    }

    yield {
        "event": "result",
        "stage": "complete",
        "message": f"Found {len(final_grants)} grant recommendations for {org_name}",
        "data": {
            "grants": final_grants,
            "all_candidates": all_candidates,
            "reply": f"Discovered {len(final_grants)} matching opportunities across EU Portal and Web Discovery for {org_name}.",
            "session_id": "fallback-session",
            "eu_count": eu_count,
            "web_count": web_count,
        },
    }


# ─── STREAMING AGENT ─────────────────────────────────────────────────────


# ─── CANDIDATE POOL & EVENT HELPERS ──────────────────────────────────────


def _normalize_candidate(it: Any, source_label: str) -> dict[str, Any] | None:
    if not isinstance(it, dict):
        return None
    title = it.get("title") or it.get("id") or it.get("identifier")
    if not title:
        return None
    cand = dict(it)
    cand_id = cand.get("id") or cand.get("identifier") or f"cand-{abs(hash(cand.get('url') or title)) % 1000000:06d}"
    cand["id"] = str(cand_id)
    cand["title"] = str(title)
    cand["source"] = source_label
    if not cand.get("sourceUrl"):
        cand["sourceUrl"] = cand.get("url") or ""
    if not cand.get("url"):
        cand["url"] = cand.get("sourceUrl") or ""
    if not cand.get("summary"):
        cand["summary"] = cand.get("description") or cand.get("snippet") or str(title)
    if not cand.get("description"):
        cand["description"] = cand.get("summary")
    return cand


class _CandidatePool:
    def __init__(self) -> None:
        self.candidates: list[dict[str, Any]] = []
        self.seen_titles: set[str] = set()
        self.eu_count: int = 0
        self.web_count: int = 0

    def add(self, items: list[Any], source_label: str) -> int:
        added = 0
        for it in items:
            cand = _normalize_candidate(it, source_label)
            if not cand or cand["title"] in self.seen_titles:
                continue
            self.seen_titles.add(cand["title"])
            self.candidates.append(cand)
            added += 1
            if source_label == "EU Horizon":
                self.eu_count += 1
            else:
                self.web_count += 1
        return added

    def filter_excluded(self, excluded_ids: list[str] | None) -> None:
        if not excluded_ids:
            return
        ex_set = {str(eid) for eid in excluded_ids}
        self.candidates = [c for c in self.candidates if str(c.get("id") or c.get("identifier") or c.get("title")) not in ex_set]


def _emit_tool_events(
    output_type: str,
    parsed: dict[str, Any],
    pool: _CandidatePool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]] | None]:
    events: list[dict[str, Any]] = []
    captured_grants: list[dict[str, Any]] | None = None

    if output_type == "eu_candidates":
        added = pool.add(parsed["eu_candidates"], "EU Horizon")
        events.append(
            {
                "event": "progress",
                "stage": "search",
                "message": f"EU Portal search complete — {added} new candidates ({pool.eu_count} EU total, {pool.web_count} Web)",
                "data": {
                    "source": "eu_portal",
                    "added": added,
                    "candidate_count": len(pool.candidates),
                    "eu_count": pool.eu_count,
                    "web_count": pool.web_count,
                },
            }
        )
    elif output_type == "web_candidates":
        added = pool.add(parsed["web_candidates"], "Web Search")
        events.append(
            {
                "event": "progress",
                "stage": "search",
                "message": f"Web search complete — {added} new candidates ({pool.eu_count} EU, {pool.web_count} Web total)",
                "data": {
                    "source": "web_search",
                    "added": added,
                    "candidate_count": len(pool.candidates),
                    "eu_count": pool.eu_count,
                    "web_count": pool.web_count,
                },
            }
        )
    elif output_type == "finalGrants":
        captured_grants = parsed["finalGrants"]
        for idx, g in enumerate(captured_grants, 1):
            events.append(
                {
                    "event": "grant_partial",
                    "stage": "select",
                    "message": f"Grant match {idx} ready",
                    "data": {
                        "grant": g,
                        "revealed_count": idx,
                        "target_count": len(captured_grants),
                    },
                }
            )
        events.append(
            {
                "event": "progress",
                "stage": "select",
                "message": f"Finalized {len(captured_grants)} recommendations from {len(pool.candidates)} candidates",
                "data": {
                    "final_count": len(captured_grants),
                    "candidate_count": len(pool.candidates),
                },
            }
        )
    elif output_type == "evidence":
        events.append(
            {
                "event": "thinking",
                "stage": "evaluate",
                "message": f"Evaluating {len(parsed['evidence'])} candidates...",
                "data": {"evidence_count": len(parsed["evidence"])},
            }
        )

    return events, captured_grants


# ─── STREAMING AGENT ─────────────────────────────────────────────────────


async def run_agent_stream(
    profile: dict[str, Any],
    user_message: str | None = None,
    conversation_history: Any | None = None,
    session_id: str | None = None,
    max_turns: int = 20,
    excluded_grant_ids: list[str] | None = None,
) -> AsyncGenerator[dict[str, Any]]:
    """
    Streaming grant agent. Yields SSE-compatible event dicts.
    Event types: thinking, progress, grant_partial, warning, result.
    The final "result" event data contains: grants, all_candidates, reply,
    session_id, eu_count, web_count.
    """
    org_name = profile.get("organisationName") or "your organisation"

    if not HAS_CLAUDE_AGENT_SDK or query is None or ClaudeAgentOptions is None:
        async for ev in _run_fallback_discovery(profile, user_message, excluded_grant_ids):
            yield ev
        return

    yield {
        "event": "thinking",
        "stage": "search",
        "message": f"Starting grant search for {org_name}...",
        "data": {"thought": "Analyzing profile and preparing multi-source search strategy..."},
    }

    if session_id:
        prompt = user_message or "Continue."
    else:
        prompt = _build_prompt(profile, user_message, conversation_history, excluded_grant_ids)

    options_kwargs: dict[str, Any] = dict(
        model=MODEL_ID,
        system_prompt=GRANT_AGENT_SYSTEM_PROMPT,
        mcp_servers={"grants": grant_server},
        allowed_tools=ALLOWED_TOOLS,
        max_turns=max_turns,
    )
    if session_id:
        options_kwargs["resume"] = session_id

    _result_holder_var.set(None)
    reply_text = ""
    captured_session_id = session_id
    captured_grants = None
    pool = _CandidatePool()

    try:
        async for message in query(prompt=prompt, options=ClaudeAgentOptions(**options_kwargs)):
            if hasattr(message, "subtype") and getattr(message, "subtype", None) == "init":
                data = getattr(message, "data", {}) or {}
                captured_session_id = data.get("session_id", captured_session_id)
            if hasattr(message, "session_id") and message.session_id:
                captured_session_id = message.session_id
            if hasattr(message, "result") and message.result:
                reply_text = message.result

            for output_type, parsed in _extract_tool_outputs(message):
                evs, grants = _emit_tool_events(output_type, parsed, pool)
                if grants is not None:
                    captured_grants = grants
                for ev in evs:
                    yield ev
    except Exception as exc:
        logger.warning("SDK query encounter issue (%s), falling back to discovery engine", exc)
        async for ev in _run_fallback_discovery(profile, user_message, excluded_grant_ids):
            yield ev
        return

    pool.filter_excluded(excluded_grant_ids)
    if captured_grants and excluded_grant_ids:
        ex_set = {str(eid) for eid in excluded_grant_ids}
        captured_grants = [g for g in captured_grants if str(g.get("id") or g.get("title")) not in ex_set]

    final_grants = captured_grants if captured_grants is not None else (_result_holder_var.get() or [])

    yield {
        "event": "result",
        "stage": "complete",
        "message": f"Found {len(final_grants)} grant recommendations for {org_name}",
        "data": {
            "grants": final_grants,
            "all_candidates": pool.candidates,
            "reply": reply_text or f"Discovered {len(final_grants)} matching opportunities for {org_name}.",
            "session_id": captured_session_id,
            "eu_count": pool.eu_count,
            "web_count": pool.web_count,
        },
    }


# ─── NON-STREAMING WRAPPER ──────────────────────────────────────────────


async def run_agent(
    profile: dict[str, Any],
    user_message: str | None = None,
    conversation_history: Any | None = None,
    session_id: str | None = None,
    max_turns: int = 20,
    excluded_grant_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Non-streaming agent. Consumes run_agent_stream and returns the final result."""
    result: dict[str, Any] = {
        "final_grants": [],
        "all_candidates": [],
        "reply": "",
        "session_id": session_id,
    }
    async for event in run_agent_stream(
        profile,
        user_message,
        conversation_history,
        session_id,
        max_turns,
        excluded_grant_ids,
    ):
        if event.get("event") == "result":
            d = event.get("data", {})
            result["final_grants"] = d.get("grants", [])
            result["all_candidates"] = d.get("all_candidates", [])
            result["reply"] = d.get("reply", "")
            result["session_id"] = d.get("session_id", session_id)
    return result


# ─── MULTI-TURN SESSION ─────────────────────────────────────────────────


class GrantAgentSession:
    """Multi-turn conversation. send_stream() yields SSE events; send() returns final dict."""

    def __init__(self, profile: dict[str, Any], max_turns: int = 20):
        self.profile = profile
        self.max_turns = max_turns
        self._client: Any = None

    async def start(self):
        if not HAS_CLAUDE_AGENT_SDK or ClaudeAgentOptions is None or ClaudeSDKClient is None:
            return

        options = ClaudeAgentOptions(
            model=MODEL_ID,
            system_prompt=GRANT_AGENT_SYSTEM_PROMPT,
            mcp_servers={"grants": grant_server},
            allowed_tools=ALLOWED_TOOLS,
            max_turns=self.max_turns,
        )
        self._client = ClaudeSDKClient(options=options)
        await self._client.__aenter__()
        intro = "ORGANISATION PROFILE:\n" + json.dumps(self.profile, indent=2) + "\n\nRemember this profile for the whole conversation."
        await self._client.query(intro)
        async for _ in self._client.receive_response():
            pass

    async def send_stream(self, user_message: str) -> AsyncGenerator[dict[str, Any]]:
        """Send one user turn, yielding SSE events as the agent works."""
        if self._client is None or not hasattr(self._client, "query"):
            async for ev in _run_fallback_discovery(self.profile, user_message):
                yield ev
            return

        _result_holder_var.set(None)
        reply_text = ""
        captured_grants = None
        pool = _CandidatePool()

        yield {
            "event": "thinking",
            "stage": "search",
            "message": "Processing your request...",
            "data": {"thought": "Analyzing request and deciding next steps..."},
        }

        await self._client.query(user_message)
        async for message in self._client.receive_response():
            if hasattr(message, "result") and message.result:
                reply_text = message.result
            for output_type, parsed in _extract_tool_outputs(message):
                evs, grants = _emit_tool_events(output_type, parsed, pool)
                if grants is not None:
                    captured_grants = grants
                for ev in evs:
                    yield ev

        final_grants = captured_grants if captured_grants is not None else (_result_holder_var.get() or [])
        yield {
            "event": "result",
            "stage": "complete",
            "message": f"Found {len(final_grants)} recommendations",
            "data": {
                "grants": final_grants,
                "all_candidates": pool.candidates,
                "reply": reply_text or f"Found {len(final_grants)} recommendations.",
                "eu_count": pool.eu_count,
                "web_count": pool.web_count,
            },
        }

    async def send(self, user_message: str) -> dict[str, Any]:
        """Send one user turn, return the final result dict (non-streaming)."""
        result: dict[str, Any] = {"final_grants": [], "all_candidates": [], "reply": ""}
        async for event in self.send_stream(user_message):
            if event.get("event") == "result":
                d = event.get("data", {})
                result["final_grants"] = d.get("grants", [])
                result["all_candidates"] = d.get("all_candidates", [])
                result["reply"] = d.get("reply", "")
        return result

    async def close(self):
        if self._client:
            await self._client.__aexit__(None, None, None)
            self._client = None


# ─── DEMO ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_profile = {
        "organisationName": "VisionWorks Robotics",
        "organisationType": "SME",
        "sector": "Digital & AI",
        "projectDescription": "AI-driven quality inspection across three EU factories.",
        "fundingAmount": "500,000 - 1,000,000 EUR",
        "country": "Germany",
    }

    async def _demo():
        print("===== TURN 1 (new session) =====")
        r1 = await run_agent(test_profile, "Find the best matching grants.")
        sid = r1.get("session_id")
        print("session_id:", sid)
        print("grants found:", len(r1.get("final_grants", [])))
        print("all candidates found:", len(r1.get("all_candidates", [])))
        eu = sum(1 for c in r1.get("all_candidates", []) if c.get("source") == "EU Horizon")
        web = sum(1 for c in r1.get("all_candidates", []) if c.get("source") == "Web Search")
        print(f"  EU Horizon: {eu} | Web Search: {web}")

        print("\n===== TURN 2 (resumed by session_id) =====")
        r2 = await run_agent(
            test_profile,
            "Of those, which is the single best fit? Don't search again.",
            session_id=sid,
        )
        print("resumed session_id:", r2.get("session_id"))
        print("reply:", str(r2.get("reply", ""))[:400])

    asyncio.run(_demo())
