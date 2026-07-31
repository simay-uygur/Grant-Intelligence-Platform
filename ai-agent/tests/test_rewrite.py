# tests/test_rewrite.py
# Tests rewrite_section on a sample section.

from tools.rewrite_section import rewrite_section

profile = {
    "organisationName": "VisionWorks Robotics",
    "organisationType": "SME",
    "sector": "Manufacturing / AI",
    "projectTitle": "Explainable Computer Vision for Factory Quality Control",
    "projectDescription": "Pilot deployment of an explainable computer vision platform across 3 EU factories.",
}

grant = {
    "id": "HORIZON-CL4-2027-01-MAT-PROD-03",
    "title": "Factory processes and automation for de- and re-manufacturing (RIA)",
    "programme": "Horizon Europe",
}

current = (
    "Our project is innovative because it uses AI. This is new technology that "
    "will help factories work better and improve things."
)

print("----- BEFORE -----")
print(current)

new_text = rewrite_section(
    section_title="Innovation",
    current_content=current,
    profile=profile,
    grant=grant,
    instruction="Make it much more specific and technical.",
)

print("\n----- AFTER -----")
print(new_text)