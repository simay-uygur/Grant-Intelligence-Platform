# tests/test_structure.py
# Tests structure_grants: fetch real grants, then structure them into Grant[] JSON.

import json
from tools.eu_horizon_api import eu_horizon_api
from tools.structure_grants import structure_grants

# Get real grants.
raw = eu_horizon_api("robotics", page_size=10)

# Sample profile.
profile = {
    "organisationName": "VisionWorks Robotics",
    "organisationType": "SME",
    "sector": "Manufacturing / AI",
    "projectDescription": "AI-driven quality inspection across 3 EU factories.",
    "fundingAmount": "500,000 - 1,000,000 EUR",
}

grants = structure_grants(raw, profile, max_grants=3)

print("\n===== STRUCTURED GRANTS (frontend-ready) =====")
print(json.dumps(grants, indent=2))