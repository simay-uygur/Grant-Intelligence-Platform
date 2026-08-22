# agent/sdk_agent.py
# The Grant Intelligence agent — Claude Agent SDK owns the loop.
# Claude decides keywords, tool calls, ranking, and final selection.
# The finalize tool writes the result to a shared holder so we capture it reliably.

import asyncio
import json
import os
from typing import Any

os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

try:
    from claude_agent_sdk import (
        tool,
        create_sdk_mcp_server,
        query,
        ClaudeAgentOptions,
        ClaudeSDKClient,
    )
    HAS_CLAUDE_AGENT_SDK = True
except ImportError:
    HAS_CLAUDE_AGENT_SDK = False

    def tool(name: str, description: str, schema: Any = None):
        def decorator(fn: Any):
            return fn
        return decorator

    def create_sdk_mcp_server(*args: Any, **kwargs: Any) -> Any:
        return None

    query = None
    ClaudeAgentOptions = None
    ClaudeSDKClient = None

from tools.eu_horizon_api import eu_horizon_api
from tools.start_application import start_application as _start_application
from tools.rewrite_section import rewrite_section as _rewrite_section
from tools.config import get_bedrock_client, get_model_id
from agent.system_prompt import GRANT_AGENT_SYSTEM_PROMPT

MODEL_ID = get_model_id()

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

    if not HAS_CLAUDE_AGENT_SDK:
        return {
            "final_grants": [],
            "reply": "Claude Agent SDK is not installed in the python environment.",
            "session_id": session_id,
        }

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


def run_agent_stream(
    profile: dict[str, Any],
    user_message: str | None = None,
    conversation_history: Any = None,
    session_id: str | None = None,
    max_grants: int = 3,
):
    """
    Stream real-time events while running the grant agent.
    Yields standard SSE events: thinking, progress, tool_call, result.
    """
    yield {
        "event": "thinking",
        "stage": "keywords",
        "message": "Analyzing organization profile and initializing Grant Intelligence agent...",
    }

    org_name = str(profile.get("organisationName") or "").strip()
    sector = str(profile.get("sector") or "").strip()
    desc = str(profile.get("projectDescription") or "").strip()

def run_agent_stream(
    profile: dict[str, Any],
    user_message: str | None = None,
    conversation_history: Any = None,
    session_id: str | None = None,
    max_grants: int = 3,
):
    """
    Stream real-time events while running the grant agent with REAL Bedrock LLM calls.
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
            f"From the candidate grants below, choose the {max_grants} that BEST fit the organisation. "
            "Rank by genuine fit — do not inflate scores, and only pick grants that are truly relevant and still open.\n\n"
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