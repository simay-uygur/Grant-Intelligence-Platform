# tests/test_application.py
# Tests start_application by drafting a document for a sample grant + profile.

import json

from tools.start_application import start_application

# A sample grant (like what final_grants returns).
grant = {
    "id": "HORIZON-CL4-2027-01-MAT-PROD-03",
    "title": "Factory processes and automation for de- and re-manufacturing (RIA)",
    "programme": "Horizon Europe",
    "deadline": "2027-02-02",
}

# A sample profile (like what Stage 1 collects).
profile = {
    "organisationName": "VisionWorks Robotics",
    "organisationType": "SME",
    "organisationDescription": "A 22-person robotics SME specializing in AI-driven quality inspection for European manufacturers.",
    "country": "Kosovo",
    "sector": "Manufacturing / AI",
    "projectTitle": "Explainable Computer Vision for Factory Quality Control",
    "projectDescription": "Pilot deployment of an explainable computer vision platform across 3 EU factories to reduce defect rates and energy waste.",
    "fundingAmount": "500,000 - 1,000,000 EUR",
    "projectDuration": "24 months",
}

doc = start_application(grant, profile)

print("\n===== APPLICATION DOCUMENT (frontend-ready) =====")
print(json.dumps(doc, indent=2)[:3000])  # print first part so it's readable
