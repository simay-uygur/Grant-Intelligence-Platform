# tests/test_conversation.py
# Tests the multi-turn service interface: start -> continue (resume by session_id).

from agent import service

profile = {
    "organisationName": "VisionWorks Robotics",
    "organisationType": "SME",
    "sector": "Digital & AI",
    "projectDescription": "AI-driven quality inspection across three EU factories.",
    "fundingAmount": "500,000 - 1,000,000 EUR",
    "country": "Germany",
}

print("===== START CONVERSATION =====")
r1 = service.start_conversation(profile, "Find the best matching EU grants.")
sid = r1["session_id"]
print("session_id:", sid)
print("grants found:", len(r1["final_grants"]))

print("\n===== CONTINUE CONVERSATION (resume) =====")
r2 = service.continue_conversation(sid, "Which single one is the best fit? Don't search again.")
print("resumed session_id:", r2["session_id"])
print("reply:", r2["reply"][:300])
