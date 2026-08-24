# tests/test_all_parts.py
# Runs the full pipeline (search -> draft -> rewrite) for each profile.
# Read-only: only calls the existing service functions.

from agent.service import rewrite_section, search_grants, start_application
from tests.profiles import ALL_PROFILES


def run_profile(label, profile):
    print(f"\n{'#' * 72}\n# {label}\n{'#' * 72}")

    # --- 1. SEARCH ---
    print("\n----- SEARCH -----")
    grants = search_grants(profile, max_grants=3)
    if not grants:
        print("  No grants found — skipping draft/rewrite for this profile.")
        return
    for i, g in enumerate(grants, 1):
        print(f"  {i}. [{g.get('matchPercentage', '?')}%] {g.get('title', '')}  (deadline {g.get('deadline', '?')})")

    top = grants[0]

    # --- 2. DRAFT (for the top grant) ---
    print("\n----- DRAFT APPLICATION (top grant) -----")
    doc = start_application(top, profile)
    print(f"  Drafted {len(doc.get('sections', []))} sections for '{doc.get('grantTitle', '')}'")
    if doc.get("sections"):
        first = doc["sections"][0]
        print(f"  First section '{first['title']}': {first['content'][:160]}...")

    # --- 3. REWRITE (one section) ---
    print("\n----- REWRITE SECTION -----")
    weak = "Our project is innovative because it uses new technology to improve things."
    new_text = rewrite_section(
        section_title="Innovation",
        current_content=weak,
        profile=profile,
        grant=top,
        instruction="Make it specific and technical.",
    )
    print(f"  Rewritten: {new_text[:200]}...")


if __name__ == "__main__":
    for label, profile in ALL_PROFILES:
        run_profile(label, profile)
    print(f"\n{'=' * 72}\nDone. Check: does each org get grants relevant to ITS field?\n{'=' * 72}")
