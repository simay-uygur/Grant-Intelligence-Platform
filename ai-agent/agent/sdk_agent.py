# agent/sdk_agent.py
# The Grant Intelligence agent — Claude Agent SDK owns the loop.
# Claude decides keywords, tool calls, ranking, and final selection (the mentor's
# "agent-controlled" architecture — not a fixed Python pipeline).
# Captures finalized grants AND the full candidate pool from the tool output
# messages so the frontend gets top-3 + all_candidates + EU/Web source tags,
# matching stream_agent's output shape.

import asyncio
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
import json
import os
from contextvars import ContextVar
from typing import Any

os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

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

from agent.system_prompt import GRANT_AGENT_SYSTEM_PROMPT
from tools.config import get_model_id

MODEL_ID = get_model_id()

# Per-task result holder for finalized grants.
_result_holder_var: ContextVar[list[Any] | None] = ContextVar("_result_holder_var", default=None)

from datetime import date


@tool(
    "web_search_grants",
    "Search the wider internet for funding opportunities, national/regional grants, foundations, or international programmes in parallel with EU database searches. Provide a search query. Returns real web results with titles and source URLs.",
    {"query": str},
)
async def web_search_grants(args: dict[str, Any]) -> dict[str, Any]:
    results = _web_search(args["query"], max_results=5)
    return {"content": [{"type": "text", "text": json.dumps({"web_candidates": results}, indent=2)}]}


# --- Tool: search EU grants (deterministic, no LLM, no auto-select) ---
@tool(
    "search_eu_grants",
    "Search the real EU grants database. Provide one or more keywords (comma-separated). Returns deduplicated candidate grants (id, title, deadline, programme, url). Does NOT select final grants and does NOT invent data.",
    {"keywords": str},
)
async def search_eu_grants(args: dict[str, Any]) -> dict[str, Any]:
    keywords = [k.strip() for k in args["keywords"].split(",") if k.strip()]
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
                    pool[key] = g
        except Exception as e:
            errors.append(f"{kw}: {e}")
    candidates = list(pool.values())
    if not candidates:
        msg = "No grants found." + (" Errors: " + "; ".join(errors) if errors else "")
        return {"content": [{"type": "text", "text": msg}]}
    payload = {"count": len(candidates), "eu_candidates": candidates}
    if errors:
        payload["errors"] = errors
    return {"content": [{"type": "text", "text": json.dumps(payload, indent=2)}]}


# --- Tool: evaluate candidates (deterministic evidence only) ---
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
    return {"content": [{"type": "text", "text": json.dumps({"today": today, "evidence": evidence}, indent=2)}]}


# --- Tool: finalize (validates + returns the top selection) ---
@tool(
    "finalize_grant_recommendations",
    "Submit your FINAL chosen grants as a JSON array in the frontend Grant shape "
    "(id, programme, title, matchPercentage, fundingAmount, deadline, eligibleCountries, "
    "organisationEligibility, fundingType, description, whyItMatches, matchReasons, "
    "requirements, tags, sourceUrl, source). Set source='EU Horizon' or 'Web Search'. "
    "Rejects closed grants and those without a source URL. Call this once after searching, "
    "evaluating, and choosing.",
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
        if not g.get("source"):
            g["source"] = "EU Horizon" if "horizon" in str(g.get("programme", "")).lower() else "Web Search"
        valid.append(g)
    _result_holder_var.set(valid)
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


def _build_prompt(profile, user_message, conversation_history=None, excluded_grant_ids=None):
    parts = ["ORGANISATION PROFILE:\n" + json.dumps(profile, indent=2)]
    if conversation_history:
        parts.append("RELEVANT PRIOR CONTEXT:\n" + str(conversation_history))
    if excluded_grant_ids:
        parts.append(
            "EXCLUDE these grant IDs (already shown, user wants different ones):\n"
            + json.dumps(list(excluded_grant_ids))
        )
    parts.append("USER REQUEST:\n" + (user_message or "Find the best matching grants for this organisation."))
    return "\n\n".join(parts)


async def run_agent(
    profile: dict[str, Any],
    user_message: str | None = None,
    conversation_history: Any | None = None,
    session_id: str | None = None,
    max_turns: int = 20,
    excluded_grant_ids: list[str] | None = None,
) -> dict[str, Any]:
    """
    Run the agent for one turn.
    - If session_id is None: starts a NEW conversation, returns a new session_id.
    - If session_id is given: RESUMES that conversation.
    - excluded_grant_ids: grants to skip (for "find different grants" re-search).

    Returns: {
        "final_grants": [top 3 recommendations],
        "all_candidates": [full pool of everything found, tagged with source],
        "reply": "agent's answer",
        "session_id": "..."
    }
    """
    _result_holder_var.set(None)

    if not HAS_CLAUDE_AGENT_SDK or query is None or ClaudeAgentOptions is None:
        return {
            "final_grants": [],
            "all_candidates": [],
            "reply": "Claude Agent SDK not available.",
            "session_id": session_id,
        }

    if session_id:
        prompt = user_message or "Continue."
    else:
        prompt = _build_prompt(profile, user_message, conversation_history, excluded_grant_ids)

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
    captured_grants: list[Any] | None = None
    all_candidates: list[dict[str, Any]] = []
    seen_titles: set[str] = set()

    def _pool_add(items, source_label):
        for it in items:
            if not isinstance(it, dict):
                continue
            title = it.get("title")
            if not title or title in seen_titles:
                continue
            seen_titles.add(title)
            all_candidates.append({**it, "source": source_label})

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

        # Parse every tool result block: capture finalGrants + candidate pools.
        for block in (getattr(message, "content", None) or []):
            block_content = getattr(block, "content", None)
            if not block_content:
                continue
            for item in (block_content if isinstance(block_content, list) else [block_content]):
                text = getattr(item, "text", None) if not isinstance(item, dict) else item.get("text")
                if not text:
                    continue
                try:
                    parsed = json.loads(text)
                except Exception:
                    continue
                if not isinstance(parsed, dict):
                    continue
                if "finalGrants" in parsed:
                    captured_grants = parsed["finalGrants"]
                if "eu_candidates" in parsed and isinstance(parsed["eu_candidates"], list):
                    _pool_add(parsed["eu_candidates"], "EU Horizon")
                if "web_candidates" in parsed and isinstance(parsed["web_candidates"], list):
                    _pool_add(parsed["web_candidates"], "Web Search")

    # If excluded_grant_ids was given, filter them out defensively.
    if excluded_grant_ids:
        excluded_set = set(excluded_grant_ids)
        all_candidates = [c for c in all_candidates if str(c.get("id") or c.get("identifier") or c.get("title")) not in excluded_set]
        if captured_grants:
            captured_grants = [g for g in captured_grants if str(g.get("id") or g.get("title")) not in excluded_set]

    return {
        "final_grants": captured_grants if captured_grants is not None else (_result_holder_var.get() or []),
        "all_candidates": all_candidates,
        "reply": reply_text,
        "session_id": captured_session_id,
    }


# --- Multi-turn session (#7) ---
class GrantAgentSession:
    """A multi-turn conversation with the grant agent."""

    def __init__(self, profile, max_turns=20):
        self.profile = profile
        self.max_turns = max_turns
        self._client = None

    async def start(self):
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

    async def send(self, user_message):
        _result_holder_var.set(None)
        reply_text = ""
        if self._client is None or not hasattr(self._client, "query"):
            return {"final_grants": [], "all_candidates": [], "reply": "Client not initialized."}
        await self._client.query(user_message)
        captured_grants: list[Any] | None = None
        all_candidates: list[dict[str, Any]] = []
        seen_titles: set[str] = set()

        def _pool_add(items, source_label):
            for it in items:
                if not isinstance(it, dict):
                    continue
                title = it.get("title")
                if not title or title in seen_titles:
                    continue
                seen_titles.add(title)
                all_candidates.append({**it, "source": source_label})

        async for message in self._client.receive_response():
            if hasattr(message, "result") and message.result:
                reply_text = message.result
            for block in (getattr(message, "content", None) or []):
                block_content = getattr(block, "content", None)
                if not block_content:
                    continue
                for item in (block_content if isinstance(block_content, list) else [block_content]):
                    text = getattr(item, "text", None) if not isinstance(item, dict) else item.get("text")
                    if not text:
                        continue
                    try:
                        parsed = json.loads(text)
                    except Exception:
                        continue
                    if not isinstance(parsed, dict):
                        continue
                    if "finalGrants" in parsed:
                        captured_grants = parsed["finalGrants"]
                    if "eu_candidates" in parsed and isinstance(parsed["eu_candidates"], list):
                        _pool_add(parsed["eu_candidates"], "EU Horizon")
                    if "web_candidates" in parsed and isinstance(parsed["web_candidates"], list):
                        _pool_add(parsed["web_candidates"], "Web Search")

        return {
            "final_grants": captured_grants if captured_grants is not None else (_result_holder_var.get() or []),
            "all_candidates": all_candidates,
            "reply": reply_text,
        }

    async def close(self):
        if self._client:
            await self._client.__aexit__(None, None, None)
            self._client = None


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
        sid = r1["session_id"]
        print("session_id:", sid)
        print("grants found:", len(r1["final_grants"]))
        print("all candidates found:", len(r1["all_candidates"]))
        eu = sum(1 for c in r1["all_candidates"] if c.get("source") == "EU Horizon")
        web = sum(1 for c in r1["all_candidates"] if c.get("source") == "Web Search")
        print(f"  EU Horizon: {eu} | Web Search: {web}")

        print("\n===== TURN 2 (resumed by session_id) =====")
        r2 = await run_agent(test_profile, "Of those, which is the single best fit? Don't search again.", session_id=sid)
        print("resumed session_id:", r2["session_id"])
        print("reply:", r2["reply"][:400])

    asyncio.run(_demo())