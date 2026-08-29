# tools/start_application.py
# Stage 3: drafts a grant application document.
# Takes the chosen grant + the user's profile, asks Claude to write each section,
# and returns the exact ApplicationDocument shape the frontend expects.

import json
import logging
import time

from tools.config import get_bedrock_client, get_model_id

logger = logging.getLogger(__name__)

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


# Call-tailored guidance templates. All templates keep the same 12 canonical
# sections — only the writing emphasis changes.
TEMPLATE_GUIDANCE = {
    "HORIZON_STANDARD": (
        "TEMPLATE: Horizon Europe RIA/IA standard.\n"
        "Structure the argumentation around the three official evaluation criteria:\n"
        "- Excellence: soundness, credibility, interdisciplinarity, and how the approach goes beyond the state of the art.\n"
        "- Impact: pathways toward the expected outcomes, dissemination, exploitation, and communication plans.\n"
        "- Quality and efficiency of implementation: work package logic, risk management, and consortium complementarity.\n"
        "Use evaluator-friendly language that maps explicitly onto these criteria."
    ),
    "EIC_ACCELERATOR": (
        "TEMPLATE: EIC Accelerator.\n"
        "Emphasise deep-tech breakthrough innovation, quantified market opportunity (TAM/SAM/SOM), "
        "the uniqueness and defensibility of the innovation (IP, know-how), and a credible scale-up plan. "
        "Highlight why EU support is needed to reach market and how the company's team can execute "
        "high-risk, high-impact development."
    ),
}

DEFAULT_TEMPLATE = "DEFAULT_COMPREHENSIVE"


def _guidance_block(template_type=None, custom_instructions=None, attachments=None):
    """Build extra prompt guidance from the selected template, user instructions, and attachments."""
    blocks = []
    if template_type and template_type in TEMPLATE_GUIDANCE:
        blocks.append(TEMPLATE_GUIDANCE[template_type])
    if custom_instructions and custom_instructions.strip():
        blocks.append(f"USER CUSTOM INSTRUCTIONS (follow these strictly):\n{custom_instructions.strip()}\n")
    if attachments and attachments.strip():
        blocks.append(f"APPLICANT BACKGROUND MATERIAL (extracted text from documents the applicant uploaded — use these real facts, figures, and track-record details throughout every section):\n{attachments.strip()[:12000]}\n")
    if not blocks:
        return ""
    return "\n" + "\n".join(blocks) + "\n"


def _grant_context_block(grant: dict) -> str:
    """Build the grant context for prompts, highlighting call-text priorities when available."""
    summary = (grant.get("summary") or "").strip()
    if summary:
        return f"GRANT:\n{json.dumps(grant, indent=2)}\n\nGRANT CALL TEXT (official objectives & scope — tailor every section to these priorities):\n{summary}\n"
    return f"GRANT:\n{json.dumps(grant, indent=2)}\n\n(No detailed call text available — align with the grant programme and title.)\n"


def draft_single_section(grant, profile, section_title, custom_instructions=None, template_type=None, attachments=None):
    """Draft one application section via Bedrock."""
    prompt = (
        f"You are writing a real EU grant application section: '{section_title}'.\n\n"
        f"{_grant_context_block(grant)}\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n"
        f"{_guidance_block(template_type, custom_instructions, attachments)}\n"
        "Write substantive, specific, professional prose for the "
        f"'{section_title}' section (roughly 100-150 words). "
        "Use the organisation's real details, not placeholders. Explicitly connect the "
        "organisation's capabilities to this specific call's objectives and priorities. "
        "Do NOT use markdown bold syntax (such as **bold** or asterisks) or bullet asterisks. Write clean, continuous, formal grant prose directly. "
        "Return ONLY the section text prose directly, with no extra headers or JSON formatting."
    )
    try:
        client = get_bedrock_client()
        response = client.converse(
            modelId=get_model_id(),
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 1200},
        )
        text = ""
        for block in response["output"]["message"]["content"]:
            if "text" in block:
                text += block["text"]
        return text.strip()
    except Exception as e:
        logger.error("Failed to draft section '%s': %s", section_title, e)
        return f"Draft content for {section_title} based on {grant.get('title', 'grant')} priorities."


def draft_single_section_stream(grant, profile, section_title, custom_instructions=None, template_type=None, attachments=None):
    """Draft one section via Bedrock converse_stream, yielding partial text chunks."""
    prompt = (
        f"You are writing a real EU grant application section: '{section_title}'.\n\n"
        f"{_grant_context_block(grant)}\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n"
        f"{_guidance_block(template_type, custom_instructions, attachments)}\n"
        "Write substantive, specific, professional prose for the "
        f"'{section_title}' section (roughly 100-150 words). "
        "Use the organisation's real details, not placeholders. Explicitly connect the "
        "organisation's capabilities to this specific call's objectives and priorities. "
        "Do NOT use markdown bold syntax (such as **bold** or asterisks) or bullet asterisks. Write clean, continuous, formal grant prose directly. "
        "Return ONLY the section text prose directly, with no extra headers or JSON formatting."
    )
    try:
        client = get_bedrock_client()
        response = client.converse_stream(
            modelId=get_model_id(),
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 1200},
        )
        stream = response.get("stream")
        if stream:
            for event in stream:
                if "contentBlockDelta" in event:
                    delta = event["contentBlockDelta"].get("delta", {})
                    if "text" in delta:
                        yield delta["text"]
    except Exception as e:
        logger.error("Stream failed for '%s': %s", section_title, e)
        yield f"Draft content for {section_title} based on {grant.get('title', 'grant')} priorities."


def start_application(grant, profile, custom_instructions=None, template_type=None, attachments=None, custom_sections=None):
    """
    Draft a grant application document.

    grant:   dict of the selected grant (the Grant shape from final_grants)
    profile: dict of the user's OrganisationProfile
    custom_instructions: optional free-form user guidelines for the prompts
    template_type: optional call-tailored template (HORIZON_STANDARD, EIC_ACCELERATOR)
    attachments: optional extracted text from the applicant's uploaded documents
    custom_sections: optional list of (id, title) tuples or {"id": str, "title": str} dicts

    Returns an ApplicationDocument dict:
      { id, grantId, grantTitle, sourceUrl, programme, sections: [{id, title, content}], updatedAt }
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

    # Build the list of section titles for the prompt.
    section_titles = [title for _, title in active_sections]

    prompt = (
        "You are writing a real EU grant application. Draft the content for EACH section listed below, "
        "tailored specifically to this organisation's profile and this grant's priorities.\n\n"
        f"{_grant_context_block(grant)}\n"
        f"ORGANISATION PROFILE:\n{json.dumps(profile, indent=2)}\n"
        f"{_guidance_block(template_type, custom_instructions, attachments)}\n"
        f"SECTIONS TO WRITE (in this exact order):\n{json.dumps(section_titles, indent=2)}\n\n"
        "Write substantive, specific, professional prose for each section (roughly 80-150 words each). "
        "Use the organisation's real details, not placeholders. In every section, explicitly connect "
        "the organisation's capabilities to this specific call's objectives, scope, and priorities "
        "rather than producing generic company text. "
        "Do NOT use markdown bold syntax (such as **bold** or asterisks) inside section bodies. "
        "Write clean, formal prose paragraphs directly.\n\n"
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
        logger.error("Could not parse JSON selection response. Raw: %s", text[:500])
        raise

    # Match Claude's drafted sections back to our canonical ids.
    sections = []
    for section_id, title in active_sections:
        # Find the drafted section with this title.
        content = ""
        for item in drafted:
            if item.get("title", "").strip().lower() == title.lower():
                content = item.get("content", "")
                break
        sections.append({"id": section_id, "title": title, "content": content})

    source_url = str(grant.get("sourceUrl") or grant.get("url") or "")
    programme = str(grant.get("programme") or "")

    document = {
        "id": f"doc-{grant.get('id', 'unknown')}-{int(time.time())}",
        "grantId": str(grant.get("id") or grant.get("identifier") or ""),
        "grantTitle": str(grant.get("title") or ""),
        "sourceUrl": source_url if source_url else None,
        "programme": programme if programme else None,
        "sections": sections,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    logger.info("Drafted %d sections for '%s'", len(sections), document["grantTitle"])
    return document
