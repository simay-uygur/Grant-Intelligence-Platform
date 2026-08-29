# tools/generate_outline.py
# Analyzes a grant opportunity and generates a tailored section outline for the application.

import json
import logging
import re
from typing import Any

from tools.config import get_bedrock_client, get_model_id

logger = logging.getLogger(__name__)

# Canonical Fallback Sections (used when AI generation is unavailable or call text is minimal)
DEFAULT_CORE_OUTLINE = [
    {
        "id": "project-objectives-excellence",
        "title": "Project Objectives & Excellence",
        "description": "Clear explanation of project goals, scientific/technical excellence, and advancing beyond state-of-the-art.",
        "targetWords": 150,
    },
    {
        "id": "proposed-solution-innovation",
        "title": "Proposed Solution & Innovation",
        "description": "Detailed description of the innovative technology, approach, novelty, and competitive advantage.",
        "targetWords": 150,
    },
    {
        "id": "expected-impact",
        "title": "Expected Impact & Exploitation",
        "description": "Quantified outcomes, target beneficiaries, dissemination plans, and long-term societal/economic impact.",
        "targetWords": 150,
    },
    {
        "id": "work-plan-implementation",
        "title": "Work Plan & Implementation",
        "description": "Work packages, milestones, deliverables, methodology, and consortium/team execution capability.",
        "targetWords": 150,
    },
    {
        "id": "budget-resources",
        "title": "Budget & Resource Allocation",
        "description": "Financial justification, cost breakdowns (personnel, equipment, subcontracting), and resource efficiency.",
        "targetWords": 120,
    },
    {
        "id": "risk-management-timeline",
        "title": "Risk Management & Timeline",
        "description": "Identification of critical technical and operational risks, mitigation measures, and delivery schedule.",
        "targetWords": 120,
    },
]

HORIZON_RIA_OUTLINE = [
    {
        "id": "excellence",
        "title": "Excellence & Beyond State-of-the-Art",
        "description": "Clarity and pertinence of objectives, soundness of methodology, and innovative nature of the proposed work.",
        "targetWords": 180,
    },
    {
        "id": "impact",
        "title": "Expected Impact & Pathways",
        "description": "Scale and significance of contributions towards expected outcomes, dissemination, and exploitation.",
        "targetWords": 180,
    },
    {
        "id": "implementation",
        "title": "Quality & Efficiency of Implementation",
        "description": "Work plan quality, allocation of resources, partner roles, risk mitigation, and milestone schedule.",
        "targetWords": 180,
    },
    {
        "id": "budget-financials",
        "title": "Budget Overview & Resource Allocation",
        "description": "Justification of requested EU contribution, person-months distribution, and direct costs.",
        "targetWords": 120,
    },
]

EIC_ACCELERATOR_OUTLINE = [
    {
        "id": "breakthrough-innovation",
        "title": "Breakthrough Innovation & Technology Readiness",
        "description": "Deep-tech novelty, current TRL level, IP position, and defensibility of the innovation.",
        "targetWords": 180,
    },
    {
        "id": "market-scaleup",
        "title": "Market Opportunity & Commercialisation",
        "description": "TAM/SAM/SOM market sizing, customer validation, value proposition, and international scale-up plan.",
        "targetWords": 180,
    },
    {
        "id": "company-team",
        "title": "Company & Team Track Record",
        "description": "Founder and team competencies, execution track record, ownership structure, and key hires.",
        "targetWords": 150,
    },
    {
        "id": "financing-needs",
        "title": "Financing Needs & Risk Mitigation",
        "description": "Milestones for requested grant/blended finance, co-investment readiness, and de-risking roadmap.",
        "targetWords": 150,
    },
]


def _slugify(text: str) -> str:
    clean = re.sub(r"^\s*\d+[\.\)\-:]\s*", "", text).strip()
    slug = re.sub(r"[^a-zA-Z0-9\s-]", "", clean).strip().lower()
    return re.sub(r"[\s_-]+", "-", slug)[:50] or "custom-section"


def generate_outline(
    grant: dict[str, Any],
    profile: dict[str, Any],
    template_type: str | None = None,
    custom_instructions: str | None = None,
    attachments: str | None = None,
) -> list[dict[str, Any]]:
    """
    Analyzes the grant opportunity, call objectives, and applicant profile
    to generate an adaptive list of proposal sections.
    """
    programme = str(grant.get("programme") or "").lower()
    grant_title = str(grant.get("title") or "").lower()
    summary = str(grant.get("summary") or grant.get("description") or "").strip()

    # 1. If explicit template explicitly requested by caller
    if template_type == "HORIZON_STANDARD":
        return [dict(s) for s in HORIZON_RIA_OUTLINE]
    if template_type == "EIC_ACCELERATOR":
        return [dict(s) for s in EIC_ACCELERATOR_OUTLINE]

    # 2. Prioritize dynamic AI outline tailored to the specific real call objectives and scope
    if summary and len(summary) > 40:
        try:
            client = get_bedrock_client()
            prompt = (
                "You are an expert grant proposal strategist for European and international funding programs. "
                "Analyze the grant call requirements and the applicant profile below. "
                "Determine the optimal proposal outline (between 4 and 8 tailored, substantive sections) "
                "specifically tailored to address this call's unique scope, objectives, evaluation criteria, and pilot expectations.\n\n"
                f"GRANT TITLE: {grant.get('title', 'Grant Call')}\n"
                f"PROGRAMME: {grant.get('programme', 'Innovation')}\n"
                f"SOURCE URL: {grant.get('sourceUrl') or grant.get('url') or 'N/A'}\n"
                f"CALL OBJECTIVES, SCOPE & TOPICS:\n{summary[:4000]}\n\n"
                f"APPLICANT PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
                "Return ONLY a JSON array of section objects. Each object MUST have:\n"
                '  - "id": short slug string (e.g. "factory-pilot-deployment")\n'
                '  - "title": clear descriptive title without numbering (e.g. "Pilot Deployment & Factory Validation")\n'
                '  - "description": 1-2 sentence guidance outlining what key points and evidence to cover in this section\n'
                '  - "targetWords": recommended word count number between 100 and 250\n\n'
                "Output JSON array ONLY without code blocks or conversational text."
            )

            response = client.converse(
                modelId=get_model_id(),
                messages=[{"role": "user", "content": [{"text": prompt}]}],
                inferenceConfig={"maxTokens": 2000},
            )

            raw_text = ""
            for block in response["output"]["message"]["content"]:
                if "text" in block:
                    raw_text += block["text"]

            cleaned = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            parsed = json.loads(cleaned)
            if isinstance(parsed, list) and len(parsed) >= 3:
                valid_sections = []
                for item in parsed:
                    if isinstance(item, dict) and item.get("title"):
                        raw_title = str(item["title"]).strip()
                        s_title = re.sub(r"^\s*\d+[.)\-:]\s*", "", raw_title).strip() or raw_title
                        s_id = str(item.get("id") or _slugify(s_title))
                        s_desc = str(item.get("description") or f"Coverage of {s_title} for this grant.")
                        s_words = int(item.get("targetWords") or 150)
                        valid_sections.append(
                            {
                                "id": s_id,
                                "title": s_title,
                                "description": s_desc,
                                "targetWords": s_words,
                            }
                        )
                if valid_sections:
                    logger.info("Generated %d AI-tailored sections for '%s'", len(valid_sections), grant.get("title"))
                    return valid_sections
        except Exception as e:
            logger.warning("Bedrock outline generation failed (%s); using intelligent fallback", e)

    # 3. Intelligent Fallback (when call text is absent or Bedrock is unavailable)
    if "eic" in programme or "accelerator" in grant_title:
        return [dict(s) for s in EIC_ACCELERATOR_OUTLINE]
    if "horizon" in programme or "european" in programme or "ria" in grant_title:
        return [dict(s) for s in HORIZON_RIA_OUTLINE]

    return [dict(s) for s in DEFAULT_CORE_OUTLINE]
