# tests/profiles.py
# Three different organisation profiles for testing the agent across domains.
# These mirror the shape the frontend form produces.

ROBOTICS = {
    "organisationName": "VisionWorks Robotics",
    "organisationType": "SME",
    "organisationDescription": "AI-assisted quality inspection systems for manufacturing.",
    "country": "Germany", "region": "Berlin",
    "projectTitle": "AI Quality Inspection",
    "projectDescription": "AI-driven visual quality inspection across three European factory pilots.",
    "fundingAmount": "500,000 - 1,000,000 EUR",
    "projectStartDate": "2026-10-01", "projectDuration": "24 months",
    "sector": "Digital & AI",
    "eligibilityConstraints": "Open to consortium-based calls and SME innovation grants.",
}

CLEAN_ENERGY = {
    "organisationName": "University Energy Lab",
    "organisationType": "University",
    "organisationDescription": "University research group on affordable, resilient energy systems.",
    "country": "Netherlands", "region": "Eindhoven",
    "projectTitle": "Community Energy Storage",
    "projectDescription": "Demonstration of interoperable renewable-energy storage for communities and small industrial sites.",
    "fundingAmount": "1,000,000 - 2,500,000 EUR",
    "projectStartDate": "2027-03-01", "projectDuration": "36 months",
    "sector": "Clean energy",
    "eligibilityConstraints": "Research and public-sector partners available for a consortium.",
}

GREENTECH = {
    "organisationName": "GreenTech Solutions",
    "organisationType": "SME",
    "organisationDescription": "Technologies to reduce energy use and waste for manufacturers.",
    "country": "Germany", "region": "Bavaria",
    "projectTitle": "Circular Energy Innovation",
    "projectDescription": "Energy-efficient circular manufacturing technology for European SMEs.",
    "fundingAmount": "500,000 - 1,000,000 EUR",
    "projectStartDate": "2027-01-01", "projectDuration": "24 months",
    "sector": "Innovation",
    "eligibilityConstraints": "SME-led project with European pilot partners.",
}

ALL_PROFILES = [
    ("Robotics / AI SME", ROBOTICS),
    ("Clean Energy University Lab", CLEAN_ENERGY),
    ("GreenTech / Circular SME", GREENTECH),
]