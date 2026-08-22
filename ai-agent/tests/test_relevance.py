# tests/test_relevance.py
# Runs the agent's search_grants against the frontend's REAL sample profiles
# and checks whether the recommended grants are relevant to each org's field.

import json
from agent.service import search_grants

# The actual sample profiles the frontend ships with (copied from sampleProfiles.ts).
PROFILES = [
    {
        "label": "VisionWorks Robotics (Digital & AI)",
        "profile": {
            "organisationName": "VisionWorks Robotics",
            "organisationType": "SME",
            "organisationDescription": "AI-assisted quality inspection systems for manufacturing.",
            "country": "Germany", "region": "Berlin",
            "projectTitle": "AI Quality Inspection",
            "projectDescription": "AI-driven visual quality inspection across three European factory pilots.",
            "fundingAmount": "€500,000 – €1,000,000",
            "projectStartDate": "2026-10-01", "projectDuration": "24 months",
            "sector": "Digital & AI",
            "eligibilityConstraints": "Open to consortium-based calls and SME innovation grants.",
        },
        # words we'd expect to see in relevant grants
        "expect": ["ai", "robot", "digital", "manufactur", "inspection", "automation"],
    },
    {
        "label": "GreenTech Solutions (Innovation/Energy)",
        "profile": {
            "organisationName": "GreenTech Solutions",
            "organisationType": "SME",
            "organisationDescription": "Technologies to reduce energy use and waste for manufacturers.",
            "country": "Germany", "region": "Bavaria",
            "projectTitle": "Circular Energy Innovation",
            "projectDescription": "Energy-efficient circular manufacturing technology for European SMEs.",
            "fundingAmount": "€500,000 – €1,000,000",
            "projectStartDate": "2027-01-01", "projectDuration": "24 months",
            "sector": "Innovation",
            "eligibilityConstraints": "SME-led project with European pilot partners.",
        },
        "expect": ["energy", "circular", "waste", "manufactur", "green", "efficien", "sustainab"],
    },
    {
        "label": "University Energy Lab (Clean energy)",
        "profile": {
            "organisationName": "University Energy Lab",
            "organisationType": "University",
            "organisationDescription": "University research group on affordable, resilient energy systems.",
            "country": "Netherlands", "region": "Eindhoven",
            "projectTitle": "Community Energy Storage",
            "projectDescription": "Demonstration of interoperable renewable-energy storage for communities and small industrial sites.",
            "fundingAmount": "€1,000,000 – €2,500,000",
            "projectStartDate": "2027-03-01", "projectDuration": "36 months",
            "sector": "Clean energy",
            "eligibilityConstraints": "Research and public-sector partners available for a consortium.",
        },
        "expect": ["energy", "storage", "renewable", "grid", "clean", "power"],
    },
]


def check(profile_case):
    label = profile_case["label"]
    print(f"\n{'='*70}\n TESTING: {label}\n{'='*70}")

    grants = search_grants(profile_case["profile"], max_grants=3)
    expect = profile_case["expect"]

    if not grants:
        print("  ⚠️  No grants returned.")
        return

    for i, g in enumerate(grants, 1):
        title = g.get("title", "")
        match = g.get("matchPercentage", "?")
        deadline = g.get("deadline", "?")
        # crude relevance check: does the title/tags contain any expected word?
        haystack = (title + " " + " ".join(g.get("tags", []))).lower()
        hits = [w for w in expect if w in haystack]
        relevant = "✅ relevant" if hits else "❓ check manually"
        print(f"\n  {i}. {title}")
        print(f"     match: {match}% | deadline: {deadline} | {relevant}")
        if hits:
            print(f"     matched terms: {hits}")
        print(f"     why: {g.get('whyItMatches','')[:160]}...")


if __name__ == "__main__":
    for case in PROFILES:
        check(case)
    print(f"\n{'='*70}\nDone. Review each: are the grants genuinely relevant to that org's field?\n{'='*70}")