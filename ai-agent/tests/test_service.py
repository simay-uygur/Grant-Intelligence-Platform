# tests/test_service.py
# Tests the service layer end to end: search -> draft -> rewrite.

import json

from agent import service

profile = {
    "organisationName": "VisionWorks Robotics",
    "organisationType": "SME",
    "sector": "robotics",
    "projectDescription": "AI-driven quality inspection across 3 EU factories.",
    "fundingAmount": "500,000 - 1,000,000 EUR",
}

# 1. Search grants
print("===== 1. SEARCH GRANTS =====")
grants = service.search_grants(profile, max_grants=3)
print(f"Got {len(grants)} structured grants. First one:")
print(json.dumps(grants[0], indent=2))

# 2. Draft an application for the first grant
print("\n===== 2. START APPLICATION =====")
doc = service.start_application(grants[0], profile)
print(f"Drafted document with {len(doc['sections'])} sections for '{doc['grantTitle']}'")
print("First section:", doc["sections"][0]["title"])

# 3. Rewrite a section
print("\n===== 3. REWRITE SECTION =====")
new_text = service.rewrite_section(
    section_title="Innovation",
    current_content="Our project uses AI to help factories.",
    profile=profile,
    instruction="Make it more specific and technical.",
)
print(new_text[:300], "...")
