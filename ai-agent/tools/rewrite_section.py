# tools/rewrite_section.py
# Stage 3: rewrites a single section of a grant application on request.
# Matches the frontend's rewriteSection(sectionTitle, currentContent, profile, grant) -> string

import json
import boto3

client = boto3.client("bedrock-runtime", region_name="us-east-1")
MODEL_ID = "us.anthropic.claude-sonnet-4-6"


def rewrite_section(section_title, current_content, profile, grant=None, instruction=None):
    """
    Rewrite one section of a grant application.

    section_title:   e.g. "Innovation"
    current_content: the existing text for that section
    profile:         dict of the organisation's profile
    grant:           dict of the selected grant (optional)
    instruction:     optional user request, e.g. "make it more specific about our tech"

    Returns the rewritten section text as a plain string.
    """
    grant_context = json.dumps(grant, indent=2) if grant else "No specific grant selected."

    # If the user gave a specific instruction, honour it; otherwise just improve the section.
    instruction_line = (
        f"The user specifically asks: {instruction}\n\n"
        if instruction
        else "Improve this section: make it more specific, concrete, and persuasive.\n\n"
    )

    prompt = (
        f"You are revising one section of an EU grant application.\n\n"
        f"SECTION: {section_title}\n\n"
        f"CURRENT CONTENT:\n{current_content}\n\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
        f"GRANT:\n{grant_context}\n\n"
        f"{instruction_line}"
        "Keep it roughly the same length (80-150 words). Use the organisation's real details. "
        "Align with the grant's programme priorities. Write professional application prose.\n\n"
        "Respond ONLY with the rewritten section text. No preamble, no headings, no quotes."
    )

    response = client.converse(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 1000},
    )

    # Join the text blocks with a space to avoid words running together.
    parts = [b["text"] for b in response["output"]["message"]["content"] if "text" in b]
    new_content = " ".join(parts).strip()

    print(f"[rewrite_section] Rewrote section '{section_title}'")
    return new_content