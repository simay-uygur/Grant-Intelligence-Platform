# agent/loop.py
# Agent loop, now driving the survey_user tool for Stage 1 (Collect).
# Still a MOCKED model (no AWS, no cost) so we learn the Stage 1 flow first.

# Import our real tool from the tools folder.
from tools.survey_user import survey_user

# --- 1. TOOL REGISTRY ---
# Maps tool NAME (string) -> real function. get_weather is gone; survey_user is in.
TOOLS = {
    "survey_user": survey_user,
}


# --- 2. THE MOCK MODEL ---
# Fakes Claude for now. It runs a fixed Stage 1 script:
# ask 3 questions one at a time, then give a final summary.
# It decides what to do by COUNTING how many answers it has collected so far.
def mock_model(messages):
    # Count how many tool_results we have = how many questions already answered.
    answers = [m for m in messages if m["role"] == "tool_result"]
    num_answered = len(answers)

    # The Stage 1 question script.
    questions = [
        "What does your business or organization do?",
        "What is your project goal?",
        "What is your estimated budget in euros?",
        "Where is your organization located?",
    ]

    # If there are still unanswered questions, ask the next one.
    if num_answered < len(questions):
        return {
            "type": "tool_call",
            "tool_name": "survey_user",
            "tool_input": {"question": questions[num_answered]},
        }

    # All questions answered -> summarize what we collected and finish.
    collected = [a["content"] for a in answers]
    summary = f"Thanks! Here's what I collected:\n- Business: {collected[0]}\n- Goal: {collected[1]}\n- Budget: {collected[2]}\n- Location: {collected[3]}"
    return {"type": "final", "content": summary}


# --- 3. THE LOOP (unchanged engine) ---
def run_agent(user_message):
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = mock_model(messages)

        if response["type"] == "tool_call":
            tool_name = response["tool_name"]
            tool_input = response["tool_input"]
            tool_function = TOOLS[tool_name]
            result = tool_function(**tool_input)
            messages.append({"role": "tool_result", "content": result})

        elif response["type"] == "final":
            return response["content"]


# --- 4. RUN IT ---
if __name__ == "__main__":
    answer = run_agent("I want to find a grant.")
    print("\n" + answer)
