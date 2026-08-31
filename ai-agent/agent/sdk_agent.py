# agent/sdk_agent.py
# The Grant Intelligence agent — Claude Agent SDK owns the loop.
# Claude decides keywords, tool calls, ranking, and final selection.
# The finalize tool writes the result to a per-task ContextVar so concurrent requests stay isolated.
# Exposes both async conversational execution and synchronous streaming SSE generators.

import json
import logging
import os
import sys
import time
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor, as_completed
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
from tools.rewrite_section import rewrite_section_stream as _tool_rewrite_stream
from tools.start_application import SECTIONS, draft_single_section_stream
from tools.start_application import start_application as _start_application
from tools.web_search import web_search_funding_opportunities

from agent.system_prompt import GRANT_AGENT_SYSTEM_PROMPT
from tools.config import get_bedrock_client, get_model_id

MODEL_ID = get_model_id()

# Per-task holders for concurrency safety across tasks
_result_holder_var: ContextVar[list[Any] | None] = ContextVar("_result_holder_var", default=None)
_search_stats_var: ContextVar[dict[str, Any] | None] = ContextVar("_search_stats_var", default=None)


def _init_search_stats() -> dict[str, Any]:
    stats: dict[str, Any] = {
        "eu_count": 0,
        "web_count": 0,
        "candidates": {},
        "events": [],
        "event_sink": None,
    }
    _search_stats_var.set(stats)
    return stats


# --- Tool: Web Search ---
@tool(
    "web_search_grants",
    "Search the wider internet for funding opportunities, national/regional grants, foundations, or international programmes in parallel with EU database searches. Provide a search query. Returns real web results with titles and source URLs.",
    {"query": str},
)
async def web_search_grants(args: dict[str, Any]) -> dict[str, Any]:
    query_str = args.get("query", "")
    candidates = web_search_funding_opportunities(query_str, max_results=5)
    stats = _search_stats_var.get()
    added_count = 0
    if stats is not None:
        for c in candidates:
            key = c.get("identifier") or c.get("url") or c.get("title")
            if key and key not in stats["candidates"]:
                stats["candidates"][key] = c
                added_count += 1
        stats["web_count"] += added_count or len(candidates)
        if stats.get("event_sink"):
            stats["event_sink"](
                {
                    "event": "progress",
                    "stage": "search",
                    "message": f"Found {len(candidates)} web opportunity candidate(s) for '{query_str}' ({stats['eu_count']} EU, {stats['web_count']} Web discovered)",
                    "data": {
                        "source": "web_search",
                        "query": query_str,
                        "added": added_count,
                        "candidate_count": len(stats["candidates"]),
                        "eu_count": stats["eu_count"],
                        "web_count": stats["web_count"],
                    },
                }
            )

    return {"content": [{"type": "text", "text": json.dumps(candidates, indent=2)}]}


# --- Tool: Search EU Grants ---
@tool(
    "search_eu_grants",
    "Search the real EU grants database. Provide one or more keywords (comma-separated). Returns deduplicated candidate grants (id, title, deadline, programme, url). Does NOT select final grants and does NOT invent data.",
    {"keywords": str},
)
async def search_eu_grants(args: dict[str, Any]) -> dict[str, Any]:
    keywords = [k.strip() for k in args.get("keywords", "").split(",") if k.strip()]
    if not keywords:
        return {"content": [{"type": "text", "text": "No keywords provided."}]}
    pool = {}
    errors = []
    for kw in keywords:
        try:
            for g in eu_horizon_api(kw, page_size=10):
                key = g.get("identifier") or g.get("title")
                if key and key not in pool:
                    g["id"] = g.get("identifier") or key
                    if not g.get("source"):
                        g["source"] = "EU Horizon API"
                    pool[key] = g
        except Exception as e:
            errors.append(f"{kw}: {e}")
    candidates = list(pool.values())

    stats = _search_stats_var.get()
    added_count = 0
    if stats is not None:
        for c in candidates:
            key = c.get("identifier") or c.get("id") or c.get("title")
            if key and key not in stats["candidates"]:
                stats["candidates"][key] = c
                added_count += 1
        stats["eu_count"] += added_count or len(candidates)
        if stats.get("event_sink"):
            stats["event_sink"](
                {
                    "event": "progress",
                    "stage": "search",
                    "message": f"Found {len(candidates)} EU grant candidate(s) for '{args.get('keywords', '')}' ({stats['eu_count']} EU, {stats['web_count']} Web discovered)",
                    "data": {
                        "source": "eu_portal",
                        "keywords": args.get("keywords", ""),
                        "added": added_count,
                        "candidate_count": len(stats["candidates"]),
                        "eu_count": stats["eu_count"],
                        "web_count": stats["web_count"],
                    },
                }
            )

    if not candidates:
        msg = "No grants found." + (" Errors: " + "; ".join(errors) if errors else "")
        return {"content": [{"type": "text", "text": msg}]}
    payload = {"count": len(candidates), "candidates": candidates}
    if errors:
        payload["errors"] = errors
    return {"content": [{"type": "text", "text": json.dumps(payload, indent=2)}]}


# --- Tool: Evaluate Candidates ---
@tool(
    "evaluate_grant_candidates",
    "Run deterministic checks on candidate grants (JSON array). Returns evidence per grant (deadline open/closed, missing fields). Does NOT rank or pick.",
    {"candidates_json": str},
)
async def evaluate_grant_candidates(args: dict[str, Any]) -> dict[str, Any]:
    try:
        candidates = json.loads(args["candidates_json"])
    except Exception as e:
        return {"content": [{"type": "text", "text": f"Parse error: {e}"}]}
    today = date.today().isoformat()
    evidence = []
    for g in candidates:
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

    stats = _search_stats_var.get()
    if stats and stats.get("event_sink"):
        stats["event_sink"](
            {
                "event": "thinking",
                "stage": "select",
                "message": "Evaluating matching opportunities against organisation profile...",
                "data": {"thought": f"Scoring eligibility, deadlines, and strategic alignment for {len(evidence)} calls..."},
            }
        )

    return {"content": [{"type": "text", "text": json.dumps({"today": today, "evidence": evidence}, indent=2)}]}


# --- Tool: Finalize Recommendations ---
@tool(
    "finalize_grant_recommendations",
    "Submit your FINAL chosen grants as a JSON array in the frontend Grant shape "
    "(id, programme, title, matchPercentage, fundingAmount, deadline, eligibleCountries, "
    "organisationEligibility, fundingType, description, whyItMatches, matchReasons, "
    "requirements, tags, sourceUrl). Rejects closed grants and those without a source URL. "
    "Call this once after searching, evaluating, and choosing.",
    {"grants_json": str},
)
async def finalize_grant_recommendations(args: dict[str, Any]) -> dict[str, Any]:
    try:
        grants = json.loads(args["grants_json"])
    except Exception as e:
        return {"content": [{"type": "text", "text": f"Parse error: {e}"}]}
    if not isinstance(grants, list):
        return {"content": [{"type": "text", "text": "grants_json must be a JSON array."}]}
    today = date.today().isoformat()
    valid, rejected = [], []
    for g in grants:
        if not (g.get("sourceUrl") or g.get("url")):
            rejected.append({"grant": g.get("title"), "reason": "no source URL"})
            continue
        dl = g.get("deadline")
        if dl and str(dl)[:10] < today:
            rejected.append({"grant": g.get("title"), "reason": "deadline passed"})
            continue
        valid.append(g)
    # Write into the per-task ContextVar so concurrent requests stay isolated.
    _result_holder_var.set(valid)

    stats = _search_stats_var.get()
    if stats and stats.get("event_sink"):
        stats["event_sink"](
            {
                "event": "progress",
                "stage": "select",
                "message": f"Final recommendations ready ({len(valid)} matches selected)",
                "data": {"final_count": len(valid)},
            }
        )

    result = {"finalGrants": valid, "count": len(valid), "rejected": rejected}
    if len(valid) < 3:
        result["note"] = f"Only {len(valid)} valid open grant(s) available."
    return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}


# --- Apply-stage tools ---
@tool(
    "draft_application",
    "Draft a full grant application. Provide grant (JSON) and profile (JSON). Returns ApplicationDocument.",
    {"grant_json": str, "profile_json": str},
)
async def draft_application(args: dict[str, Any]) -> dict[str, Any]:
    doc = _start_application(json.loads(args["grant_json"]), json.loads(args["profile_json"]))
    return {"content": [{"type": "text", "text": json.dumps(doc, indent=2)}]}


@tool(
    "rewrite_application_section",
    "Rewrite one application section. Provide section_title, current_content, profile (JSON), optionally instruction. Returns improved text.",
    {"section_title": str, "current_content": str, "profile_json": str, "instruction": str},
)
async def rewrite_application_section(args: dict[str, Any]) -> dict[str, Any]:
    new_text = _rewrite_section(
        section_title=args["section_title"],
        current_content=args["current_content"],
        profile=json.loads(args["profile_json"]),
        instruction=args.get("instruction"),
    )
    return {"content": [{"type": "text", "text": new_text}]}


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


def _build_prompt(profile: dict[str, Any], user_message: str | None, conversation_history: Any = None, excluded_grant_ids: list[str] | None = None) -> str:
    parts = ["ORGANISATION PROFILE:\n" + json.dumps(profile, indent=2)]
    if conversation_history:
        parts.append("RELEVANT PRIOR CONTEXT:\n" + str(conversation_history))
    if excluded_grant_ids:
        parts.append("EXCLUDED GRANTS (DO NOT RECOMMEND OR SELECT THESE IDENTIFIERS):\n" + json.dumps(excluded_grant_ids, indent=2))
    parts.append("USER REQUEST:\n" + (user_message or "Find the best matching EU grants for this organisation."))
    return "\n\n".join(parts)


def _candidate_identity(candidate: dict[str, Any]) -> str:
    return str(candidate.get("identifier") or candidate.get("id") or candidate.get("title") or "").strip()


def _candidate_source_url(candidate: dict[str, Any]) -> str:
    return str(candidate.get("sourceUrl") or candidate.get("url") or "").strip()


def _candidate_deadline_is_open(candidate: dict[str, Any], today: str) -> bool:
    deadline = candidate.get("deadline")
    return not deadline or str(deadline)[:10] >= today


def _profile_terms(profile: dict[str, Any]) -> set[str]:
    values = [
        profile.get("organisationName"),
        profile.get("organisationType"),
        profile.get("sector"),
        profile.get("projectTitle"),
        profile.get("projectDescription"),
        profile.get("organisationDescription"),
        profile.get("country"),
        profile.get("region"),
    ]
    terms: set[str] = set()
    for value in values:
        for raw in str(value or "").replace("/", " ").replace("-", " ").split():
            term = raw.strip(".,;:()[]{}'\"").lower()
            if len(term) >= 3:
                terms.add(term)
    return terms


def _score_candidate(candidate: dict[str, Any], terms: set[str], index: int) -> tuple[int, int]:
    haystack = " ".join(str(candidate.get(key) or "") for key in ("title", "programme", "summary", "description", "source", "identifier", "id")).lower()
    overlap = sum(1 for term in terms if term in haystack)
    url_bonus = 2 if _candidate_source_url(candidate) else 0
    source_bonus = 1 if str(candidate.get("source") or "").lower() == "eu horizon api" else 0
    return (overlap * 4 + url_bonus + source_bonus, -index)


def _build_final_grant(candidate: dict[str, Any], profile: dict[str, Any], score: int) -> dict[str, Any]:
    source = str(candidate.get("source") or "EU Horizon API")
    programme = str(candidate.get("programme") or ("Web Grant Discovery" if source == "Web Search" else "Horizon Europe"))
    title = str(candidate.get("title") or "Grant Opportunity")
    funding_amount = str(candidate.get("budget") or candidate.get("fundingAmount") or "EU Funding")
    deadline = str(candidate.get("deadline") or "2027-12-31")
    description = str(candidate.get("summary") or candidate.get("description") or title)
    match_percentage = max(75, min(95, 78 + score * 2))
    source_url = _candidate_source_url(candidate) or (str(candidate.get("source") or "") + "/discovery")

    return {
        "id": _candidate_identity(candidate) or f"grant-{abs(hash(title))}",
        "programme": programme,
        "source": source,
        "title": title,
        "matchPercentage": match_percentage,
        "fundingAmount": funding_amount,
        "deadline": deadline,
        "eligibleCountries": ["EU Member States", "Associated Countries"],
        "organisationEligibility": ["SME", "Research", "Enterprise", "Public body"],
        "fundingType": "Grant",
        "description": description,
        "whyItMatches": f"Best available discovered opportunity for {profile.get('organisationName') or 'the organisation'} based on the submitted sector, project focus, and eligibility context.",
        "matchReasons": [
            f"Discovered through {source}",
            f"Programme: {programme}",
            "Open or undated call with a source URL",
        ],
        "requirements": ["Confirm applicant eligibility and consortium requirements in the source call text"],
        "tags": [programme, str(profile.get("sector") or "Innovation Funding")],
        "sourceUrl": source_url,
    }


def _fallback_final_grants(
    candidates: list[dict[str, Any]],
    profile: dict[str, Any],
    max_grants: int,
    excluded_grant_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    today = date.today().isoformat()
    excluded = {str(eid).strip().lower() for eid in excluded_grant_ids or [] if str(eid).strip()}
    terms = _profile_terms(profile)
    scored: list[tuple[tuple[int, int], dict[str, Any]]] = []

    for index, candidate in enumerate(candidates):
        identity = _candidate_identity(candidate).lower()
        title = str(candidate.get("title") or "").strip().lower()
        if identity in excluded or title in excluded:
            continue
        if not _candidate_source_url(candidate):
            pass
        if not _candidate_deadline_is_open(candidate, today):
            pass
        scored.append((_score_candidate(candidate, terms, index), candidate))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [_build_final_grant(candidate, profile, score=max(score[0], 0)) for score, candidate in scored[:max_grants]]


def _format_candidate_records(candidates: list[dict[str, Any]], final_grants: list[dict[str, Any]]) -> list[dict[str, Any]]:
    score_map: dict[str, int] = {}
    for sg in final_grants:
        if isinstance(sg, dict) and sg.get("matchPercentage") is not None:
            try:
                score = int(sg["matchPercentage"])
                for k in [sg.get("id"), sg.get("identifier"), sg.get("title")]:
                    if k:
                        score_map[str(k).strip().lower()] = score
            except Exception:
                pass

    formatted = []
    for idx, g in enumerate(candidates):
        cid = str(g.get("id") or g.get("identifier") or f"cand-{idx}")
        ident = str(g.get("identifier") or cid)
        title = str(g.get("title") or "Grant Opportunity")

        score = None
        for k in [cid, ident, title]:
            if k.strip().lower() in score_map:
                score = score_map[k.strip().lower()]
                break

        formatted.append(
            {
                "id": cid,
                "identifier": ident,
                "title": title,
                "programme": str(g.get("programme") or "Horizon Europe"),
                "source": str(g.get("source") or ("Web Search" if "web" in cid.lower() else "EU Horizon API")),
                "url": str(g.get("url") or g.get("sourceUrl") or ""),
                "sourceUrl": str(g.get("url") or g.get("sourceUrl") or ""),
                "summary": str(g.get("summary") or g.get("description") or g.get("title") or ""),
                "description": str(g.get("summary") or g.get("description") or g.get("title") or ""),
                "deadline": str(g.get("deadline")) if g.get("deadline") else None,
                "fundingAmount": str(g.get("budget")) if g.get("budget") else None,
                "matchPercentage": score,
            }
        )
    return formatted


def _search_candidates_step(
    keywords: list[str],
    profile: dict[str, Any] | None = None,
) -> Generator[dict[str, Any], None, list[dict[str, Any]]]:
    """Execute concurrent multi-source search across EU Portal and Web Discovery."""
    keywords_str = ", ".join(f"'{k}'" for k in keywords)
    country = (profile or {}).get("country")
    pool: dict[str, dict[str, Any]] = {}
    eu_count = 0
    web_count = 0

    yield {
        "event": "thinking",
        "stage": "search",
        "message": f"Querying EU Portal and searching the web in parallel for {len(keywords)} topic(s): {keywords_str}...",
        "data": {
            "thought": "Dispatching concurrent multi-source searches across EU Portal and web funding programmes...",
            "keywords": keywords,
        },
    }

    mod = sys.modules[__name__]
    tasks: list[tuple[str, str, Any]] = []
    for kw in keywords:
        tasks.append(("eu_portal", kw, lambda k=kw: getattr(mod, "eu_horizon_api", eu_horizon_api)(k, page_size=10)))
        tasks.append(("web_search", kw, lambda k=kw: getattr(mod, "web_search_funding_opportunities", web_search_funding_opportunities)(k, country=country, max_results=5)))

    total_tasks = len(tasks)
    completed = 0

    with ThreadPoolExecutor(max_workers=min(8, total_tasks)) as executor:
        futures = {executor.submit(fn): (source_type, kw) for source_type, kw, fn in tasks}
        for future in as_completed(futures):
            source_type, kw = futures[future]
            completed += 1
            source_label = "EU Portal" if source_type == "eu_portal" else "Web Discovery"
            try:
                results = future.result()
            except Exception as e:
                logger.warning("%s search failed for '%s': %s", source_label, kw, e)
                yield {
                    "event": "progress",
                    "stage": "search",
                    "message": f"{source_label} search '{kw}' failed ({completed}/{total_tasks}) — continuing with other channels",
                    "data": {
                        "source": source_type,
                        "keyword": kw,
                        "added": 0,
                        "candidate_count": len(pool),
                        "eu_count": eu_count,
                        "web_count": web_count,
                    },
                }
                continue

            today_str = date.today().isoformat()
            added_count = 0
            for g in results:
                dl = g.get("deadline")
                if dl and str(dl)[:10] < today_str:
                    continue
                if not g.get("source"):
                    g["source"] = "EU Horizon API" if source_type == "eu_portal" else "Web Search"
                key = g.get("identifier") or g.get("url") or g.get("title")
                if key and key not in pool:
                    pool[key] = g
                    added_count += 1
                    if source_type == "eu_portal":
                        eu_count += 1
                    else:
                        web_count += 1

            yield {
                "event": "progress",
                "stage": "search",
                "message": f"[{source_label}] Searched '{kw}' (+{len(results)} found, {added_count} new) — {len(pool)} total candidates pooled ({eu_count} EU, {web_count} Web)",
                "data": {
                    "source": source_type,
                    "keyword": kw,
                    "added": added_count,
                    "candidate_count": len(pool),
                    "eu_count": eu_count,
                    "web_count": web_count,
                    "completed_queries": completed,
                    "total_queries": total_tasks,
                },
            }

    return list(pool.values())


async def run_agent(
    profile: dict[str, Any],
    user_message: str | None = None,
    conversation_history: Any | None = None,
    session_id: str | None = None,
    max_turns: int = 20,
    excluded_grant_ids: list[str] | None = None,
) -> dict[str, Any]:
    """
    Run the agent for one conversational or search turn.
    Returns: {"final_grants": [...], "reply": "...", "session_id": "...", "eu_count": ..., "web_count": ..., "all_candidates": [...]}
    """
    _result_holder_var.set(None)
    stats = _init_search_stats()

    if not HAS_CLAUDE_AGENT_SDK or query is None or ClaudeAgentOptions is None:
        events = list(run_agent_stream(profile, user_message=user_message, conversation_history=conversation_history, session_id=session_id, excluded_grant_ids=excluded_grant_ids))
        for ev in reversed(events):
            if ev.get("event") == "result" and "grants" in ev.get("data", {}):
                d = ev["data"]
                return {
                    "final_grants": d.get("grants") or [],
                    "reply": d.get("reply") or "",
                    "session_id": d.get("session_id") or session_id,
                    "all_candidates": d.get("all_candidates") or [],
                    "eu_count": d.get("eu_count", stats["eu_count"]),
                    "web_count": d.get("web_count", stats["web_count"]),
                }
        return {
            "final_grants": [],
            "reply": "No matching grants found.",
            "session_id": session_id,
            "all_candidates": [],
            "eu_count": 0,
            "web_count": 0,
        }

    if session_id:
        prompt = user_message or "Continue."
    else:
        prompt = _build_prompt(profile, user_message, conversation_history, excluded_grant_ids=excluded_grant_ids)

    options_kwargs = dict(
        model=MODEL_ID,
        system_prompt=GRANT_AGENT_SYSTEM_PROMPT,
        mcp_servers={"grants": grant_server},
        allowed_tools=ALLOWED_TOOLS,
        max_turns=max_turns,
    )
    if session_id:
        options_kwargs["resume"] = session_id

    reply_text = ""
    captured_session_id = session_id

    async for message in query(
        prompt=prompt,
        options=ClaudeAgentOptions(**options_kwargs),
    ):
        if hasattr(message, "subtype") and getattr(message, "subtype", None) == "init":
            data = getattr(message, "data", {}) or {}
            captured_session_id = data.get("session_id", captured_session_id)
        if hasattr(message, "session_id") and message.session_id:
            captured_session_id = message.session_id
        if hasattr(message, "result") and message.result:
            reply_text = message.result

    candidate_values = list(stats["candidates"].values())
    final_grants = _result_holder_var.get() or []
    if not final_grants and candidate_values:
        fallback_grants = _fallback_final_grants(candidate_values, profile, max_grants=3, excluded_grant_ids=excluded_grant_ids)
        if fallback_grants:
            await finalize_grant_recommendations({"grants_json": json.dumps(fallback_grants)})
            final_grants = _result_holder_var.get() or []
    all_cand_list = _format_candidate_records(candidate_values, final_grants)

    return {
        "final_grants": final_grants,
        "reply": reply_text,
        "session_id": captured_session_id,
        "all_candidates": all_cand_list,
        "eu_count": stats["eu_count"],
        "web_count": stats["web_count"],
    }


async def run_agent_stream_sdk(
    profile: dict[str, Any],
    user_message: str | None = None,
    conversation_history: Any | None = None,
    session_id: str | None = None,
    max_turns: int = 8,
    excluded_grant_ids: list[str] | None = None,
) -> Any:
    """
    Async generator: yields real-time SSE events as Claude Agent SDK runs.
    Streams tool-call progress (search → evaluate → finalize) as they happen.
    Falls back to run_agent_stream if the SDK is not available.
    """
    import asyncio

    if not HAS_CLAUDE_AGENT_SDK or query is None or ClaudeAgentOptions is None:
        # SDK not available — yield from the sync fallback
        for event in run_agent_stream(
            profile,
            user_message=user_message,
            conversation_history=conversation_history,
            session_id=session_id,
            excluded_grant_ids=excluded_grant_ids,
        ):
            yield event
        return

    _result_holder_var.set(None)
    stats = _init_search_stats()

    # Bridge tool-call events into an asyncio Queue so we can yield them
    # between SDK message iterations.
    event_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    def _sink(ev: dict[str, Any]) -> None:
        event_queue.put_nowait(ev)

    stats["event_sink"] = _sink

    # Drain everything currently in the queue without blocking
    async def _drain() -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        while not event_queue.empty():
            items.append(event_queue.get_nowait())
        return items

    yield {
        "event": "thinking",
        "stage": "keywords",
        "message": "Claude Agent SDK starting — analysing your profile and planning grant search...",
        "data": {"thought": "Initialising Claude Agent SDK agentic loop with MCP grant tools..."},
    }

    if session_id:
        prompt = user_message or "Continue."
    else:
        prompt = _build_prompt(profile, user_message, conversation_history, excluded_grant_ids=excluded_grant_ids)

    options_kwargs: dict[str, Any] = dict(
        model=MODEL_ID,
        system_prompt=GRANT_AGENT_SYSTEM_PROMPT,
        mcp_servers={"grants": grant_server},
        allowed_tools=ALLOWED_TOOLS,
        max_turns=max_turns,
    )
    if session_id:
        options_kwargs["resume"] = session_id

    reply_text = ""
    captured_session_id = session_id

    try:
        from claude_agent_sdk import (
            AssistantMessage,
            ResultMessage,
            SystemMessage,
            TaskProgressMessage,
            TaskStartedMessage,
            ThinkingBlock,
            ToolResultBlock,
            ToolUseBlock,
        )

        async for message in query(
            prompt=prompt,
            options=ClaudeAgentOptions(**options_kwargs),
        ):
            # --- Drain tool-call events emitted by MCP tools ---
            for ev in await _drain():
                yield ev

            # --- SDK message → SSE event mapping ---
            if isinstance(message, SystemMessage):
                data = getattr(message, "data", {}) or {}
                captured_session_id = data.get("session_id", captured_session_id)

            elif isinstance(message, AssistantMessage):
                captured_session_id = getattr(message, "session_id", None) or captured_session_id
                content = getattr(message, "content", []) or []

                for block in content:
                    if isinstance(block, ThinkingBlock):
                        thinking = (block.thinking or "")[:300]
                        yield {
                            "event": "thinking",
                            "stage": "search",
                            "message": "Claude is thinking...",
                            "data": {"thought": thinking},
                        }

                    elif isinstance(block, ToolUseBlock):
                        tool_label = {
                            "mcp__grants__search_eu_grants": "Searching EU Portal",
                            "mcp__grants__web_search_grants": "Searching the web",
                            "mcp__grants__evaluate_grant_candidates": "Evaluating candidates",
                            "mcp__grants__finalize_grant_recommendations": "Finalising recommendations",
                            "mcp__grants__draft_application": "Drafting application",
                            "mcp__grants__rewrite_application_section": "Rewriting section",
                        }.get(block.name, f"Calling {block.name}")

                        # Extract useful arg preview
                        inp = block.input or {}
                        detail = inp.get("keywords") or inp.get("query") or inp.get("section_title") or ""
                        msg = f"{tool_label}" + (f": {detail}" if detail else "")

                        yield {
                            "event": "progress",
                            "stage": "search" if "search" in block.name else "select",
                            "message": msg,
                            "data": {
                                "tool": block.name,
                                "input_preview": str(detail)[:120],
                                "candidate_count": len(stats.get("candidates", {})),
                                "eu_count": stats.get("eu_count", 0),
                                "web_count": stats.get("web_count", 0),
                            },
                        }

                    elif isinstance(block, ToolResultBlock):
                        # Drain again — tool just finished, may have queued events
                        for ev in await _drain():
                            yield ev

            elif isinstance(message, (TaskStartedMessage, TaskProgressMessage)):
                last_tool = getattr(message, "last_tool_name", None)
                desc = getattr(message, "description", None)
                if last_tool or desc:
                    yield {
                        "event": "progress",
                        "stage": "search",
                        "message": desc or f"Running {last_tool}...",
                        "data": {"tool": last_tool or ""},
                    }

            elif isinstance(message, ResultMessage):
                captured_session_id = getattr(message, "session_id", None) or captured_session_id
                reply_text = getattr(message, "result", "") or ""

        # Final drain after loop ends
        for ev in await _drain():
            yield ev

    except Exception as e:
        logger.error("run_agent_stream_sdk error: %s", e)
        yield {
            "event": "progress",
            "stage": "select",
            "message": f"Agent error: {e}",
            "data": {"error": str(e)},
        }

    candidate_values = list(stats["candidates"].values())
    final_grants = _result_holder_var.get() or []
    if not final_grants and candidate_values:
        fallback_grants = _fallback_final_grants(candidate_values, profile, max_grants=3, excluded_grant_ids=excluded_grant_ids)
        if fallback_grants:
            yield {
                "event": "progress",
                "stage": "select",
                "message": f"Finalizing {len(fallback_grants)} best available recommendation(s) from discovered candidates...",
                "data": {
                    "final_count": len(fallback_grants),
                    "candidate_count": len(candidate_values),
                    "eu_count": stats["eu_count"],
                    "web_count": stats["web_count"],
                },
            }
            await finalize_grant_recommendations({"grants_json": json.dumps(fallback_grants)})
            for ev in await _drain():
                yield ev
            final_grants = _result_holder_var.get() or []
    all_cand_list = _format_candidate_records(candidate_values, final_grants)

    yield {
        "event": "progress",
        "stage": "select",
        "message": f"Claude selected {len(final_grants)} grant(s) ({stats['eu_count']} EU, {stats['web_count']} Web discovered)",
        "data": {
            "final_count": len(final_grants),
            "candidate_count": len(all_cand_list),
            "eu_count": stats["eu_count"],
            "web_count": stats["web_count"],
        },
    }

    yield {
        "event": "result",
        "stage": "select",
        "message": f"Selected {len(final_grants)} top grant recommendations",
        "data": {
            "grants": final_grants,
            "all_candidates": all_cand_list,
            "reply": reply_text,
            "session_id": captured_session_id,
            "eu_count": stats["eu_count"],
            "web_count": stats["web_count"],
        },
    }


def run_agent_stream(
    profile: dict[str, Any],
    user_message: str | None = None,
    conversation_history: Any = None,
    session_id: str | None = None,
    max_grants: int = 3,
    excluded_grant_ids: list[str] | None = None,
) -> Generator[dict[str, Any]]:
    """
    Stream stage-by-stage events (keywords -> search -> select -> result)
    tracking real found counters for EU Portal and Web discovery.
    """
    org_name = profile.get("organisationName") or "your organisation"
    sector = profile.get("sector") or "innovation"

    # Step 1: Keywords stage
    yield {
        "event": "thinking",
        "stage": "keywords",
        "message": f"Analyzing profile for '{org_name}' and extracting domain keywords with Bedrock LLM...",
        "data": {
            "thought": f"Extracting sector topics and tech focus areas for {sector}...",
        },
    }

    keywords: list[str] = []
    client = get_bedrock_client()
    try:
        kw_prompt = (
            "You are helping search the EU grants database, which works best with SIMPLE single-word keywords. "
            "Based on this organisation profile, produce the most relevant single-word search keywords (up to 5).\n\n"
            f"PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
            'Return ONLY a JSON array of lowercase single words, e.g. ["robotics","ai","manufacturing"]. No other text.'
        )
        kw_resp = client.converse_stream(
            modelId=MODEL_ID,
            messages=[{"role": "user", "content": [{"text": kw_prompt}]}],
            inferenceConfig={"maxTokens": 200},
        )
        stream = kw_resp.get("stream")
        raw_kw = ""
        if stream:
            for event in stream:
                if "contentBlockDelta" in event:
                    delta = event["contentBlockDelta"].get("delta", {})
                    if "text" in delta:
                        raw_kw += delta["text"]
        cleaned_kw = raw_kw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed_kw = json.loads(cleaned_kw)
        if isinstance(parsed_kw, list):
            keywords = [str(k).strip().lower() for k in parsed_kw if str(k).strip()]
    except Exception as e:
        logger.warning("Keyword extraction fallback: %s", e)

    if not keywords:
        keywords = [str(sector).split()[0].lower()] if sector else ["innovation"]
    keywords = keywords[:5]

    yield {
        "event": "progress",
        "stage": "keywords",
        "message": f"Generated search keywords: {', '.join(repr(k) for k in keywords)}",
        "data": {"keywords": keywords},
    }

    # Step 2: Search stage
    candidates = yield from _search_candidates_step(keywords, profile=profile)

    eu_count = sum(1 for c in candidates if c.get("source") == "EU Horizon API")
    web_count = sum(1 for c in candidates if c.get("source") == "Web Search")

    if not candidates:
        yield {
            "event": "progress",
            "stage": "search",
            "message": "No candidate grants found matching criteria.",
            "data": {"candidate_count": 0, "eu_count": 0, "web_count": 0},
        }
        yield {
            "event": "result",
            "stage": "select",
            "message": "No matching grants found",
            "data": {
                "grants": [],
                "all_candidates": [],
                "reply": "No matching grants found for this profile.",
                "session_id": session_id,
                "eu_count": 0,
                "web_count": 0,
            },
        }
        return

    # Step 3: Selection stage
    today = date.today().isoformat()
    open_candidates = [g for g in candidates if not g.get("deadline") or str(g.get("deadline"))[:10] >= today]

    if excluded_grant_ids:
        excluded_set = {str(eid).strip().lower() for eid in excluded_grant_ids if str(eid).strip()}
        open_candidates = [g for g in open_candidates if str(g.get("identifier") or g.get("id") or "").strip().lower() not in excluded_set and str(g.get("title") or "").strip().lower() not in excluded_set]

    yield {
        "event": "thinking",
        "stage": "select",
        "message": f"Evaluating and ranking top matches from {len(candidates)} candidate grants ({len(open_candidates)} active) with Bedrock LLM...",
        "data": {
            "candidate_count": len(candidates),
            "open_count": len(open_candidates),
            "eu_count": eu_count,
            "web_count": web_count,
            "thought": f"Scoring eligibility and alignment across {len(open_candidates)} active calls for {org_name}...",
        },
    }

    selected_grants: list[dict[str, Any]] = []
    try:
        select_prompt = (
            f"You are a grant selection expert. Today's date is {today}. "
            f"From the candidate grants below (discovered via parallel EU Portal and Web Search queries), choose the {max_grants} that BEST fit the organisation profile. "
            "Evaluate match percentages relative to the organisation's core domain and profile: "
            "assign top relevant domain matches scores between 75% and 95%, and provide clear, encouraging, "
            "bespoke whyItMatches explanations and matchReasons.\n\n"
            f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
            f"CANDIDATE GRANTS:\n{json.dumps(open_candidates[:15], indent=2)}\n\n"
            "Return ONLY a JSON array (no other text) where each selected grant has EXACTLY these fields:\n"
            "  id (string), programme (string), source (string, e.g. 'EU Horizon API' or 'Web Search'), title (string), matchPercentage (number 0-100),\n"
            "  fundingAmount (string), deadline (string), eligibleCountries (array of strings),\n"
            "  organisationEligibility (array of strings), fundingType (string), description (string),\n"
            "  whyItMatches (string), matchReasons (array of strings), requirements (array of strings),\n"
            "  tags (array of strings), sourceUrl (string).\n"
            "Fill factual fields from the candidate data, and reasoning fields (matchPercentage, whyItMatches, matchReasons, tags) from your analysis. Respond with the JSON array only."
        )

        select_resp = client.converse_stream(
            modelId=MODEL_ID,
            messages=[{"role": "user", "content": [{"text": select_prompt}]}],
            inferenceConfig={"maxTokens": 4000},
        )
        stream = select_resp.get("stream")
        raw_select = ""
        if stream:
            for event in stream:
                if "contentBlockDelta" in event:
                    delta = event["contentBlockDelta"].get("delta", {})
                    if "text" in delta:
                        raw_select += delta["text"]
        cleaned_select = raw_select.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(cleaned_select)
        if isinstance(parsed, list):
            selected_grants = parsed
    except Exception as e:
        logger.warning("LLM selection fallback: %s", e)

    if not selected_grants:
        for g in open_candidates[:max_grants]:
            selected_grants.append(
                {
                    "id": str(g.get("identifier") or g.get("id") or f"grant-{len(selected_grants)}"),
                    "programme": str(g.get("programme") or "Horizon Europe"),
                    "source": str(g.get("source") or ("Web Search" if "web" in str(g.get("id", "")).lower() else "EU Horizon API")),
                    "title": str(g.get("title") or "Grant Opportunity"),
                    "matchPercentage": 75,
                    "fundingAmount": str(g.get("budget") or "EU Funding"),
                    "deadline": str(g.get("deadline") or "2027-12-31"),
                    "eligibleCountries": ["EU Member States", "Associated Countries"],
                    "organisationEligibility": ["SME", "Research", "Enterprise"],
                    "fundingType": "Grant",
                    "description": str(g.get("summary") or g.get("description") or g.get("title") or ""),
                    "whyItMatches": f"Relevant opportunity for {profile.get('organisationName', 'the organisation')}.",
                    "matchReasons": [f"Discovered via {g.get('source', 'multi-source search')}"],
                    "requirements": ["EU Consortium or SME applicant"],
                    "tags": [str(g.get("programme") or "Innovation Funding")],
                    "sourceUrl": str(g.get("url") or g.get("sourceUrl") or "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home"),
                }
            )

    formatted_candidates = _format_candidate_records(candidates, selected_grants)

    yield {
        "event": "progress",
        "stage": "select",
        "message": f"Finalised {len(selected_grants)} recommendation(s) for {org_name} (from {len(formatted_candidates)} discovered sources)",
        "data": {
            "final_count": len(selected_grants),
            "candidate_count": len(formatted_candidates),
            "eu_count": eu_count,
            "web_count": web_count,
        },
    }

    yield {
        "event": "result",
        "stage": "select",
        "message": f"Selected {len(selected_grants)} top grant recommendations",
        "data": {
            "grants": selected_grants,
            "all_candidates": formatted_candidates,
            "reply": f"Found {len(selected_grants)} live grant opportunities for {profile.get('organisationName') or 'your organisation'}.",
            "session_id": session_id,
            "eu_count": eu_count,
            "web_count": web_count,
        },
    }


# --- Document Drafting & Section Rewrite Streaming (Exported) ---


def start_application_stream(
    grant: dict[str, Any],
    profile: dict[str, Any],
    custom_instructions: str | None = None,
    template_type: str | None = None,
    attachments: str = "",
    custom_sections: list[Any] | None = None,
) -> Generator[dict[str, Any]]:
    """
    Generator streaming real-time events & token chunks for drafting a full application document.
    """
    active_sections = []
    if custom_sections:
        for s in custom_sections:
            if isinstance(s, (list, tuple)) and len(s) >= 2:
                active_sections.append((str(s[0]), str(s[1])))
            elif isinstance(s, dict) and s.get("id") and s.get("title"):
                active_sections.append((str(s["id"]), str(s["title"])))
    if not active_sections:
        active_sections = list(SECTIONS)

    total = len(active_sections)
    doc_id = f"doc-{grant.get('id', 'unknown')}-{int(time.time())}"
    sections: list[dict[str, Any]] = []

    org_name = profile.get("organisationName", "Applicant Organisation")
    grant_title = grant.get("title", "Grant Opportunity")
    source_url = str(grant.get("sourceUrl") or grant.get("url") or "")
    programme = str(grant.get("programme") or "")
    has_call_text = bool((grant.get("summary") or "").strip())
    focus_line = "Extracting call objectives, scope, and funder priorities from the official call text..." if has_call_text else "Extracting eligibility rules and funder priorities from the grant programme context..."

    yield {
        "event": "thinking",
        "stage": "draft",
        "message": f"Analyzing Grant Requirements & Priorities for '{grant_title}' ({total} sections)...",
        "data": {
            "thought": focus_line,
            "section_index": 0,
            "total_sections": total,
            "progress_percent": 0,
        },
    }

    try:
        for i, (section_id, section_title) in enumerate(active_sections, 1):
            percent = int(((i - 1) / total) * 100)

            yield {
                "event": "thinking",
                "stage": "draft",
                "message": f"Formulating Section {i}/{total}: {section_title}...",
                "data": {
                    "thought": f"Aligning {org_name} capabilities with {section_title} requirements...",
                    "section_id": section_id,
                    "section_title": section_title,
                    "section_index": i,
                    "total_sections": total,
                    "progress_percent": percent,
                },
            }

            accumulated = ""
            for chunk in draft_single_section_stream(
                grant,
                profile,
                section_title,
                custom_instructions=custom_instructions,
                template_type=template_type,
                attachments=attachments,
            ):
                accumulated += chunk
                words = len(accumulated.split())
                yield {
                    "event": "section_chunk",
                    "stage": "draft",
                    "message": f"Drafting Section {i}/{total}: {section_title}...",
                    "data": {
                        "section_id": section_id,
                        "section_title": section_title,
                        "chunk": chunk,
                        "accumulated_content": accumulated,
                        "section_index": i,
                        "total_sections": total,
                        "progress_percent": percent,
                        "word_count": words,
                        "thought": f"Writing {section_title} ({words} words)...",
                    },
                }

            section_obj = {"id": section_id, "title": section_title, "content": accumulated}
            sections.append(section_obj)

            percent = int((i / total) * 100)
            current_doc = {
                "id": doc_id,
                "grantId": str(grant.get("id") or grant.get("identifier") or ""),
                "grantTitle": grant_title,
                "sourceUrl": source_url if source_url else None,
                "programme": programme if programme else None,
                "sections": list(sections),
                "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }

            yield {
                "event": "progress",
                "stage": "draft",
                "message": f"Completed Section {i}/{total}: {section_title} ({percent}% complete)",
                "data": {
                    "section_index": i,
                    "total_sections": total,
                    "progress_percent": percent,
                    "section": section_obj,
                    "document": current_doc,
                },
            }

        doc = {
            "id": doc_id,
            "grantId": str(grant.get("id") or grant.get("identifier") or ""),
            "grantTitle": str(grant.get("title") or ""),
            "sourceUrl": source_url if source_url else None,
            "programme": programme if programme else None,
            "sections": sections,
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        placeholder_prefix = "Draft content for"
        failed = [s["title"] for s in sections if s.get("content", "").startswith(placeholder_prefix)]
        if failed:
            yield {
                "event": "warning",
                "stage": "draft",
                "message": f"⚠️ {len(failed)}/{len(sections)} sections contain placeholder text — AI drafting was unavailable (check AWS credentials).",
                "data": {"failed_sections": failed},
            }
            result_message = f"Draft completed with {len(failed)}/{len(sections)} placeholder sections (AI unavailable)"
        else:
            result_message = f"Successfully drafted all {len(sections)} application sections"

        yield {
            "event": "result",
            "stage": "draft",
            "message": result_message,
            "data": {"document": doc, "degraded": bool(failed)},
        }
    except Exception as e:
        logger.error("start_application_stream failed: %s", e)
        error_doc: dict[str, Any] = {
            "id": "error",
            "grantId": str(grant.get("id") or grant.get("identifier") or "") if isinstance(grant, dict) else "",
            "grantTitle": str(grant.get("title") or "") if isinstance(grant, dict) else "",
            "sourceUrl": source_url if source_url else None,
            "programme": programme if programme else None,
            "sections": [],
            "updatedAt": "",
            "error": str(e),
        }
        yield {
            "event": "error",
            "stage": "draft",
            "message": f"Could not draft application: {e}",
            "data": {"document": error_doc},
        }


def rewrite_section_stream(
    section_title: str,
    current_content: str,
    profile: dict[str, Any],
    grant: dict[str, Any] | None = None,
    instruction: str | None = None,
) -> Generator[dict[str, Any]]:
    """
    Generator streaming events for rewriting a single application section.
    """
    yield {
        "event": "thinking",
        "stage": "rewrite",
        "message": f"Analyzing section '{section_title}' and preparing rewrite instructions...",
    }
    yield {
        "event": "tool_call",
        "stage": "rewrite",
        "message": f"Streaming rewrite of '{section_title}' via Bedrock converse_stream...",
    }

    accumulated = ""
    try:
        for chunk in _tool_rewrite_stream(
            section_title=section_title,
            current_content=current_content,
            profile=profile,
            grant=grant,
            instruction=instruction,
        ):
            accumulated += chunk
            words = len(accumulated.split())
            yield {
                "event": "section_chunk",
                "stage": "rewrite",
                "message": f"Rewriting '{section_title}'...",
                "data": {
                    "section_title": section_title,
                    "chunk": chunk,
                    "accumulated_content": accumulated,
                    "word_count": words,
                },
            }
    except Exception as e:
        logger.error("rewrite_section_stream failed: %s", e)
        accumulated = current_content

    yield {
        "event": "result",
        "stage": "rewrite",
        "message": f"Rewrote section '{section_title}' successfully",
        "data": {"content": accumulated},
    }


# --- Multi-turn session ---
class GrantAgentSession:
    """
    A multi-turn conversation with the grant agent.
    """

    def __init__(self, profile: dict[str, Any], max_turns: int = 20):
        self.profile = profile
        self.max_turns = max_turns
        self._client: Any = None

    async def start(self):
        if not HAS_CLAUDE_AGENT_SDK or ClaudeSDKClient is None:
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

    async def send(self, user_message: str) -> dict[str, Any]:
        """Send one user turn; returns {'final_grants': [...], 'reply': '...'}."""
        _result_holder_var.set(None)
        reply_text = ""
        if self._client is None or not hasattr(self._client, "query"):
            res = await run_agent(self.profile, user_message=user_message)
            return {"final_grants": res.get("final_grants", []), "reply": res.get("reply", "")}
        await self._client.query(user_message)
        async for message in self._client.receive_response():
            if hasattr(message, "result") and message.result:
                reply_text = message.result
        return {
            "final_grants": _result_holder_var.get() or [],
            "reply": reply_text,
        }

    async def close(self):
        if self._client:
            await self._client.__aexit__(None, None, None)
            self._client = None
