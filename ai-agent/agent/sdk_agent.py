# agent/sdk_agent.py
# SDK-based agent with all grant tools as in-process MCP tools.
# Single-shot flow: user describes project, agent searches / drafts / rewrites.

import asyncio
import json
from typing import Any
import os
os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1" 

from claude_agent_sdk import (
    tool,
    create_sdk_mcp_server,
    query,
    ClaudeAgentOptions,
)

from tools.eu_horizon_api import eu_horizon_api
from tools.start_application import start_application
from tools.rewrite_section import rewrite_section


# --- Tool 1: search EU grants ---
@tool(
    "search_eu_grants",
    "Search real EU grant calls by keyword. Returns grants with title, deadline, programme, URL.",
    {"keyword": str},
)
async def search_eu_grants(args: dict[str, Any]) -> dict[str, Any]:
    grants = eu_horizon_api(args["keyword"], page_size=10)
    if not grants:
        text = f"No grants found for keyword '{args['keyword']}'."
    else:
        lines = [f"Found {len(grants)} grants for '{args['keyword']}':"]
        for g in grants:
            lines.append(f"- {g['title']} | deadline: {g['deadline']} | programme: {g['programme']} | {g['url']}")
        text = "\n".join(lines)
    return {"content": [{"type": "text", "text": text}]}

# --- Tool: submit final structured grants (frontend-ready output) ---
@tool(
    "submit_final_grants",
    "Submit your final grant recommendations (aim for 3) in the exact structured format "
    "the frontend needs. Call this ONCE after searching and reasoning. Fill factual fields "
    "from search results and reasoning fields (matchPercentage, whyItMatches, matchReasons, tags) "
    "from your analysis.",
    {"grants_json": str},
)
async def submit_final_grants(args: dict[str, Any]) -> dict[str, Any]:
    # Claude passes the structured grants as a JSON string; parse and echo back.
    grants = json.loads(args["grants_json"])
    return {"content": [{"type": "text", "text": json.dumps(grants, indent=2)}]}

# --- Tool 2: draft a full application ---
@tool(
    "draft_application",
    "Draft a full grant application with all sections. Provide the grant (as JSON) and the "
    "organisation profile (as JSON). Returns a structured application document.",
    {"grant_json": str, "profile_json": str},
)
async def draft_application(args: dict[str, Any]) -> dict[str, Any]:
    grant = json.loads(args["grant_json"])
    profile = json.loads(args["profile_json"])
    document = start_application(grant, profile)
    return {"content": [{"type": "text", "text": json.dumps(document, indent=2)}]}


# --- Tool 3: rewrite one section ---
@tool(
    "rewrite_application_section",
    "Rewrite one section of a grant application. Provide the section title, its current content, "
    "the organisation profile (JSON), and optionally an instruction. Returns the improved text.",
    {"section_title": str, "current_content": str, "profile_json": str, "instruction": str},
)
async def rewrite_application_section(args: dict[str, Any]) -> dict[str, Any]:
    profile = json.loads(args["profile_json"])
    new_text = rewrite_section(
        section_title=args["section_title"],
        current_content=args["current_content"],
        profile=profile,
        instruction=args.get("instruction"),
    )
    return {"content": [{"type": "text", "text": new_text}]}


# --- Bundle all tools into one in-process MCP server ---
grant_server = create_sdk_mcp_server(
    name="grant-tools",
    version="1.0.0",
    tools=[search_eu_grants, submit_final_grants, draft_application, rewrite_application_section],
)


SYSTEM_PROMPT = (
    "You are a grant assistant. When the user asks to FIND grants, follow this process exactly:\n"
    "1. Use search_eu_grants with SIMPLE single-word keywords (e.g. 'robotics', 'health', 'energy'). "
    "Try a few keywords.\n"
    "2. Reason about which grants genuinely fit and are still open (today is 2026).\n"
    "3. You MUST end by calling submit_final_grants with your best 3 matches. "
    "Do NOT write the grants as prose or markdown — the ONLY acceptable way to return grant "
    "recommendations is by calling submit_final_grants. Do not skip this step.\n\n"
    "Each grant in submit_final_grants must have these fields: id, programme, title, "
    "matchPercentage (0-100), fundingAmount, deadline, eligibleCountries (array), "
    "organisationEligibility (array), fundingType, description, whyItMatches, "
    "matchReasons (array), requirements (array), tags (array), sourceUrl. "
    "Fill factual fields from search results and reasoning fields from your analysis.\n\n"
    "For drafting applications use draft_application. For improving a section use rewrite_application_section."
)


async def run(user_message: str):
    final_grants = None

    async for message in query(
        prompt=user_message,
        options=ClaudeAgentOptions(
            model="us.anthropic.claude-sonnet-4-6",
            system_prompt=SYSTEM_PROMPT,
            mcp_servers={"grants": grant_server},
            allowed_tools=[
                "mcp__grants__search_eu_grants",
                "mcp__grants__submit_final_grants",
                "mcp__grants__draft_application",
                "mcp__grants__rewrite_application_section",
            ],
        ),
    ):
        # Capture the structured output from submit_final_grants tool calls.
        for block in getattr(message, "content", []) or []:
            # Tool result blocks carry the structured JSON we returned.
            block_type = getattr(block, "type", None)
            if block_type == "tool_result":
                text = ""
                for c in getattr(block, "content", []) or []:
                    if getattr(c, "type", None) == "text":
                        text += c.text
                # Try to parse it as our grants JSON.
                try:
                    parsed = json.loads(text)
                    if isinstance(parsed, list):
                        final_grants = parsed
                except Exception:
                    pass

        if hasattr(message, "result"):
            print("\n===== AGENT PROSE REPLY =====")
            print(message.result)

    # Show the captured structured grants (what the frontend would consume).
    if final_grants:
        print("\n===== STRUCTURED GRANTS (frontend-ready) =====")
        print(json.dumps(final_grants, indent=2))
    else:
        print("\n[note] No structured grants captured this run.")


if __name__ == "__main__":
    # Test message — a project description.
    test_message = (
        "We're a 22-person robotics SME building AI-driven quality inspection for "
        "European factories, budget 500k-1M EUR. Find us the best matching EU grants."
    )
    asyncio.run(run(test_message))