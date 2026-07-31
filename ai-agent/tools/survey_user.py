# tools/survey_user.py
# The survey_user tool: the agent calls this when it wants to ask the user
# a question and get their answer back.
#
# In the real product, some answers come from form widgets in the chat.
# Locally, we simulate the user by reading what they type in the terminal.

def survey_user(question):
    # Show the agent's question to the user.
    print(f"\n[AGENT ASKS]: {question}")

    # input() pauses the program and waits for the user to type an answer + Enter.
    # Whatever they type becomes this function's return value.
    answer = input("[YOUR ANSWER]: ")

    # Return the answer. The loop will feed this back as a tool_result,
    # exactly like get_weather's return value was fed back.
    return answer