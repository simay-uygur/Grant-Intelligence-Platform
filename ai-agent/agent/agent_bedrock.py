# agent/agent_bedrock.py
# Real agent loop using Claude via Bedrock's Converse API with tool-calling.
# Claude decides which tool to call; our code executes it and feeds results back.

from typing import Any

from tools.eu_horizon_api import eu_horizon_api
from tools.survey_user import survey_user

from tools.config import get_bedrock_client, get_model_id

# --- 1. TOOL REGISTRY: maps tool name -> real Python function ---
TOOLS: dict[str, Any] = {
    "survey_user": survey_user,
    "eu_horizon_api": eu_horizon_api,
    "final_grants": lambda grants: grants,  # structured-output tool: passes grants through
}

# --- 2. TOOL DEFINITIONS: describe each tool to Claude ---
# This is how Claude knows the tool exists, what it does, and what inputs it needs.
TOOL_CONFIG = {
    "tools": [
        {
            "toolSpec": {
                "name": "survey_user",
                "description": ("Ask the user a single question and get their typed answer. Use this to collect information from the user one question at a time."),
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {
                            "question": {
                                "type": "string",
                                "description": "The question to ask the user.",
                            }
                        },
                        "required": ["question"],
                    }
                },
            }
        },
        {
            "toolSpec": {
                "name": "eu_horizon_api",
                "description": ("Search real EU grant calls from the EU Funding & Tenders Portal by keyword. Returns a list of grants with title, deadline, programme, and URL. Use this after collecting the user's project info to find matching grants."),
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {
                            "keyword": {
                                "type": "string",
                                "description": "Search term based on the user's project, e.g. 'robotics' or 'health'.",
                            }
                        },
                        "required": ["keyword"],
                    }
                },
            }
        },
        {
            "toolSpec": {
                "name": "final_grants",
                "description": (
                    "Submit your final selection of the best matching grants (ideally 3). "
                    "Call this ONCE at the end, after searching and reasoning. "
                    "Each grant must follow the exact structure required by the frontend. "
                    "Fill factual fields (title, deadline, programme, sourceUrl) from the search results, "
                    "and reasoning fields (matchPercentage, whyItMatches, matchReasons, tags) from your own analysis."
                ),
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {
                            "grants": {
                                "type": "array",
                                "description": "The list of recommended grants (aim for 3).",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "id": {
                                            "type": "string",
                                            "description": "A short unique id, e.g. the grant identifier.",
                                        },
                                        "programme": {
                                            "type": "string",
                                            "description": "Programme name, e.g. 'Horizon Europe'.",
                                        },
                                        "title": {"type": "string"},
                                        "matchPercentage": {
                                            "type": "number",
                                            "description": "0-100, how well it fits the user's project.",
                                        },
                                        "fundingAmount": {
                                            "type": "string",
                                            "description": "Funding amount if known, else 'See call details'.",
                                        },
                                        "deadline": {
                                            "type": "string",
                                            "description": "Deadline date, e.g. '2027-09-22'.",
                                        },
                                        "eligibleCountries": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "description": "e.g. ['EU Member States'].",
                                        },
                                        "organisationEligibility": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "description": "e.g. ['SMEs', 'NGOs'].",
                                        },
                                        "fundingType": {"type": "string", "description": "e.g. 'Grant'."},
                                        "description": {
                                            "type": "string",
                                            "description": "1-2 sentence plain-language summary of the grant.",
                                        },
                                        "whyItMatches": {
                                            "type": "string",
                                            "description": "Plain-language explanation of why this fits the user's project.",
                                        },
                                        "matchReasons": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "description": "2-4 short bullet reasons it matches.",
                                        },
                                        "requirements": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "description": "Key eligibility/application requirements if known.",
                                        },
                                        "tags": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "description": "2-5 topical tags, e.g. ['AI', 'manufacturing'].",
                                        },
                                        "sourceUrl": {
                                            "type": "string",
                                            "description": "The grant's URL from the search result.",
                                        },
                                    },
                                    "required": [
                                        "id",
                                        "programme",
                                        "title",
                                        "matchPercentage",
                                        "deadline",
                                        "whyItMatches",
                                        "sourceUrl",
                                    ],
                                },
                            }
                        },
                        "required": ["grants"],
                    }
                },
            }
        },
    ]
}

# System prompt: tells Claude its job.
SYSTEM_PROMPT = [
    {
        "text": (
            "You are a grant assistant. First, collect the user's organization, project goal, and budget "
            "by asking questions ONE at a time using survey_user. "
            "Then use eu_horizon_api to search real EU grants — use SIMPLE single-word keywords "
            "(e.g. 'robotics', 'health', 'energy'); try a few if needed. "
            "Reason about which grants genuinely fit the user's project. "
            "Finally, call final_grants ONCE with your best matches (aim for 3), filling factual fields "
            "(title, deadline, programme, sourceUrl) from the search results and reasoning fields "
            "(matchPercentage, whyItMatches, matchReasons, tags) from your analysis. "
            "Only include grants that genuinely match. Do not invent grants."
        )
    }
]


def run_agent():
    # The conversation history, in Converse API format.
    messages = [{"role": "user", "content": [{"text": "Hi, I want help finding a grant."}]}]

    while True:
        client = get_bedrock_client()
        response = client.converse(
            modelId=get_model_id(),
            messages=messages,
            system=SYSTEM_PROMPT,
            toolConfig=TOOL_CONFIG,
        )

        # Claude's reply (its message) — add it to history.
        output_message = response["output"]["message"]
        messages.append(output_message)

        stop_reason = response["stopReason"]

        # CASE A: Claude wants to use a tool.
        if stop_reason == "tool_use":
            # There may be a tool_use block in the content; find it.
            tool_results = []
            for block in output_message["content"]:
                if "toolUse" in block:
                    tool = block["toolUse"]
                    tool_name = tool["name"]
                    tool_input = tool["input"]
                    tool_use_id = tool["toolUseId"]

                    print(f"\n[loop] Claude is calling: {tool_name}")

                    # Run the real function.
                    result = TOOLS[tool_name](**tool_input)

                    # If this is the final structured output, capture & show it, then stop.
                    if tool_name == "final_grants":
                        import json

                        print("\n===== FINAL STRUCTURED GRANTS (frontend-ready) =====")
                        print(json.dumps(result, indent=2))
                        return result

                    # Package the result to send back to Claude.
                    tool_results.append(
                        {
                            "toolResult": {
                                "toolUseId": tool_use_id,
                                "content": [{"text": str(result)}],
                            }
                        }
                    )

            # Send the tool result(s) back as a user message.
            messages.append({"role": "user", "content": tool_results})
            # Loop repeats -> Claude decides again.

        # CASE B: Claude gave a final answer.
        else:
            # Print Claude's final text.
            for block in output_message["content"]:
                if "text" in block:
                    print("\n[Claude]:", block["text"])
            break


if __name__ == "__main__":
    run_agent()
