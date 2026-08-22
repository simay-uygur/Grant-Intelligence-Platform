# tools/start_application.py
# Stage 3: drafts a grant application document.
# Takes the chosen grant + the user's profile, asks Claude to write each section,
# and returns the exact ApplicationDocument shape the frontend expects.

import json
import time
from tools.config import get_bedrock_client, get_model_id

# The section list the frontend expects (id + title), in order.
SECTIONS = [
    ("organisation-overview", "Organisation Overview"),
    ("project-summary", "Project Summary"),
    ("problem-statement", "Problem Statement"),
    ("proposed-solution", "Proposed Solution"),
    ("innovation", "Innovation"),
    ("objectives", "Objectives"),
    ("expected-impact", "Expected Impact"),
    ("sustainability", "Sustainability"),
    ("implementation-plan", "Implementation Plan"),
    ("timeline", "Timeline"),
    ("budget-overview", "Budget Overview"),
    ("risk-management", "Risk Management"),
]


def start_application(grant, profile):
    """
    Draft a grant application document.

    grant:   dict of the selected grant (the Grant shape from final_grants)
    profile: dict of the user's OrganisationProfile

    Returns an ApplicationDocument dict:
      { id, grantId, grantTitle, sections: [{id, title, content}], updatedAt }
    """
    # Build the list of section titles for the prompt.
    section_titles = [title for _, title in SECTIONS]

    prompt = (
        "You are writing a real EU grant application. Draft the content for EACH section listed below, "
        "tailored specifically to this organisation's profile and this grant's priorities.\n\n"
        f"GRANT:\n{json.dumps(grant, indent=2)}\n\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
        f"SECTIONS TO WRITE (in this exact order):\n{json.dumps(section_titles, indent=2)}\n\n"
        "Write substantive, specific, professional prose for each section (roughly 80-150 words each). "
        "Use the organisation's real details, not placeholders. Align the language with the grant's "
        "programme and stated priorities.\n\n"
        "Respond ONLY with a JSON array, no other text, in this exact format:\n"
        '[{"title": "Organisation Overview", "content": "..."}, ...]'
    )

    client = get_bedrock_client()
    response = client.converse(
        modelId=get_model_id(),
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 8000},
    )

    # Pull out the text Claude returned.
    text = ""
    for block in response["output"]["message"]["content"]:
        if "text" in block:
            text += block["text"]

    # Claude sometimes wraps JSON in ```json fences — strip them.
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        drafted = json.loads(cleaned)
    except json.JSONDecodeError:
        print("[start_application] Could not parse JSON. Raw response:")
        print(text[:500])
        raise

    # Match Claude's drafted sections back to our canonical ids.
    sections = []
    for section_id, title in SECTIONS:
        # Find the drafted section with this title.
        content = ""
        for item in drafted:
            if item.get("title", "").strip().lower() == title.lower():
                content = item.get("content", "")
                break
        sections.append({"id": section_id, "title": title, "content": content})

    document = {
        "id": f"doc-{grant.get('id', 'unknown')}-{int(time.time())}",
        "grantId": grant.get("id", ""),
        "grantTitle": grant.get("title", ""),
        "sections": sections,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    print(f"[start_application] Drafted {len(sections)} sections for '{document['grantTitle']}'")
    return document