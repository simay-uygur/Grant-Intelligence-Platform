# tests/test_research.py
# Tests re-search: ask for grants, then ask for DIFFERENT ones.
import asyncio
from agent.service import start_conversation, continue_conversation

profile = {
    "organisationName": "GreenTech Solutions",
    "organisationType": "SME",
    "sector": "Clean energy",
    "projectDescription": "Energy-efficient circular manufacturing technology for European SMEs.",
    "country": "Germany",
    "fundingAmount": "500,000 - 1,000,000 EUR",
}

print("===== TURN 1: find grants =====")
r1 = start_conversation(profile, "Find me EU grants.")
sid = r1["session_id"]
print("session:", sid, "| grants:", len(r1["final_grants"]))
for g in r1["final_grants"]:
    print("  -", g.get("title"))

print("\n===== TURN 2: ask for DIFFERENT grants =====")
r2 = continue_conversation(sid, "These don't fit us. Find me different grants, not the same ones.")
print("grants:", len(r2["final_grants"]))
for g in r2["final_grants"]:
    print("  -", g.get("title"))
print("\nreply snippet:", r2["reply"][:200])