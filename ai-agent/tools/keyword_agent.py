# tools/keyword_agent.py
# Part 1 of the grant selection pipeline.
# Looks at the organisation profile and generates several SIMPLE search keywords
# for the EU grants API (which works best with single words).

import json
from tools.config import get_bedrock_client, get_model_id


def generate_keywords(profile, max_keywords=5):
    """
    Takes the profile, returns a list of simple single-word search keywords.
    e.g. a robotics quality-inspection SME -> ['robotics','ai','manufacturing','automation','inspection']
    """
    prompt = (
        "You are helping search the EU grants database, which works best with SIMPLE "
        "single-word keywords. Based on this organisation profile, produce the most relevant "
        f"single-word search keywords (up to {max_keywords}).\n\n"
        f"PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
        "Return ONLY a JSON array of lowercase single words, e.g. "
        '["robotics","ai","manufacturing"]. No other text.'
    )

    client = get_bedrock_client()
    response = client.converse(
        modelId=get_model_id(),
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 200},
    )

    text = " ".join(
        b["text"] for b in response["output"]["message"]["content"] if "text" in b
    ).strip()
    cleaned = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        keywords = json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback: if parsing fails, use the sector or a default.
        fallback = str(profile.get("sector", "innovation")).split()[0].lower()
        keywords = [fallback]

    print(f"[keyword_agent] Generated keywords: {keywords}")
    return keywords