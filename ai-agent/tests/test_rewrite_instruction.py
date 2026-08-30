# tests/test_rewrite_instruction.py
# Tests rewriting a section with a user instruction (the "Rewrite with AI" feature).
from agent.service import rewrite_section

profile = {
    "organisationName": "GreenTech Solutions",
    "organisationType": "SME",
    "sector": "Clean energy",
    "country": "Germany",
}

current = ("GreenTech Solutions GmbH is a Berlin-based SME specialising in digital and AI-driven "
           "technologies that enable businesses to monitor energy consumption, reduce operational "
           "costs, and achieve measurable sustainability outcomes.")

print("===== ORIGINAL =====")
print(current)

print("\n===== REWRITE: user asks to make it shorter and more impactful =====")
new_text = rewrite_section(
    section_title="Organisation Overview",
    current_content=current,
    profile=profile,
    grant=None,
    instruction="Make it shorter and more punchy, focus on our AI expertise.",
)
print(new_text)