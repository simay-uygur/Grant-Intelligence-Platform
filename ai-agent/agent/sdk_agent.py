# agent/sdk_agent.py
# The Grant Intelligence agent — Claude Agent SDK owns the loop.
# Claude decides keywords, tool calls, ranking, and final selection.
# The finalize tool writes the result to a shared holder so we capture it reliably.

import asyncio
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
import json
import os
from typing import Any

os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

from claude_agent_sdk import (
    tool,
    create_sdk_mcp_server,
    query,
    ClaudeAgentOptions,
)

from claude_agent_sdk import (
    tool,
    create_sdk_mcp_server,
    query,
    ClaudeAgentOptions,
    ClaudeSDKClient,
)

from tools.eu_horizon_api import eu_horizon_api
from tools.start_application import start_application as _start_application
from tools.rewrite_section import rewrite_section as _rewrite_section
from agent.system_prompt import GRANT_AGENT_SYSTEM_PROMPT

MODEL_ID = "us.anthropic.claude-sonnet-4-6"

# A simple holder the finalize tool writes into, so we don't depend on
# parsing the SDK's internal message objects.
_RESULT_HOLDER: dict[str, Any] = {"final_grants": None}

from datetime import date


# --- Tool: search EU grants (deterministic, no LLM, no auto-select) ---
@tool(
    "search_eu_grants",
    "Search the real EU grants database. Provide one or more keywords (comma-separated). "
    "Returns deduplicated candidate grants (id, title, deadline, programme, url). "
    "Does NOT select final grants and does NOT invent data.",
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
    payload = {"count": len(candidates), "candidates": candidates}
    if errors:
        payload["errors"] = errors
    return {"content": [{"type": "text", "text": json.dumps(payload, indent=2)}]}


# --- Tool: evaluate candidates (deterministic evidence only) ---
@tool(
    "evaluate_grant_candidates",
    "Run deterministic checks on candidate grants (JSON array). Returns evidence per grant "
    "(deadline open/closed, missing fields). Does NOT rank or pick.",
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
        evidence.append({
            "id": g.get("id") or g.get("identifier") or g.get("title"),
            "title": g.get("title"),
            "deadline": dl,
            "deadline_open": (dl is None) or (dl >= today),
            "has_url": bool(g.get("url") or g.get("sourceUrl")),
        })
    return {"content": [{"type": "text", "text": json.dumps({"today": today, "evidence": evidence}, indent=2)}]}


# --- Tool: finalize (validates + WRITES result to the holder) ---
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
    # Write to the holder so the service captures it reliably.
    _RESULT_HOLDER["final_grants"] = valid
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
    "Rewrite one application section. Provide section_title, current_content, profile (JSON), "
    "optionally instruction. Returns improved text.",
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
    ],
)

ALLOWED_TOOLS = [
    "mcp__grants__search_eu_grants",
    "mcp__grants__evaluate_grant_candidates",
    "mcp__grants__finalize_grant_recommendations",
    "mcp__grants__draft_application",
    "mcp__grants__rewrite_application_section",
    "WebSearch",
]


def _build_prompt(profile, user_message, conversation_history=None):
    parts = ["ORGANISATION PROFILE:\n" + json.dumps(profile, indent=2)]
    if conversation_history:
        parts.append("RELEVANT PRIOR CONTEXT:\n" + str(conversation_history))
    parts.append("USER REQUEST:\n" + (user_message or "Find the best matching EU grants for this organisation."))
    return "\n\n".join(parts)


async def run_agent(profile, user_message=None, conversation_history=None,
                    session_id=None, max_turns=20):
    """
    Run the agent for one turn.
    - If session_id is None: starts a NEW conversation, returns a new session_id.
    - If session_id is given: RESUMES that conversation (survives restarts).
    Returns: {"final_grants": [...], "reply": "...", "session_id": "..."}.
    The backend stores the session_id (per user) and passes it back next turn.
    """
    _RESULT_HOLDER["final_grants"] = None

    # On the first turn, include the profile. On resumed turns, just the message.
    if session_id:
        prompt = user_message or "Continue."
    else:
        prompt = _build_prompt(profile, user_message, conversation_history)

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
        # Capture the session_id from the init message or the result message.
        if hasattr(message, "subtype") and getattr(message, "subtype", None) == "init":
            data = getattr(message, "data", {}) or {}
            captured_session_id = data.get("session_id", captured_session_id)
        if hasattr(message, "session_id") and getattr(message, "session_id"):
            captured_session_id = message.session_id
        if hasattr(message, "result") and message.result:
            reply_text = message.result

    return {
        "final_grants": _RESULT_HOLDER["final_grants"] or [],
        "reply": reply_text,
        "session_id": captured_session_id,
    }
# --- Multi-turn session (#7) ---
# Keeps one conversation alive so the agent remembers context across turns.
# The same MCP tools and system prompt are available every turn.

class GrantAgentSession:
    """
    A multi-turn conversation with the grant agent.
    Usage:
        session = GrantAgentSession(profile)
        await session.start()
        result1 = await session.send("Find me AI grants")
        result2 = await session.send("Only ones open after 2027")  # remembers context
        await session.close()
    """

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
        # Give the agent the profile once, at the start of the conversation.
        intro = "ORGANISATION PROFILE:\n" + json.dumps(self.profile, indent=2) + \
                "\n\nRemember this profile for the whole conversation."
        await self._client.query(intro)
        async for _ in self._client.receive_response():
            pass  # consume the acknowledgement

    async def send(self, user_message):
        """Send one user turn; returns {'final_grants': [...], 'reply': '...'}."""
        # Reset the grants holder for this turn.
        _RESULT_HOLDER["final_grants"] = None
        reply_text = ""
        await self._client.query(user_message)
        async for message in self._client.receive_response():
            if hasattr(message, "result") and message.result:
                reply_text = message.result
        return {
            "final_grants": _RESULT_HOLDER["final_grants"] or [],
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
        # Turn 1 — new session
        print("===== TURN 1 (new session) =====")
        r1 = await run_agent(test_profile, "Find the best matching EU grants.")
        sid = r1["session_id"]
        print("session_id:", sid)
        print("grants found:", len(r1["final_grants"]))

        # Turn 2 — RESUME by session_id (simulates backend passing stored ID)
        print("\n===== TURN 2 (resumed by session_id) =====")
        r2 = await run_agent(test_profile,
                             "Of those, which is the single best fit? Don't search again.",
                             session_id=sid)
        print("resumed session_id:", r2["session_id"])
        print("reply:", r2["reply"][:400])

    asyncio.run(_demo())