# agent/multiturn_demo.py
# EXPLORATION ONLY (#7 groundwork) — demonstrates multi-turn with ClaudeSDKClient.
# Not wired into the service yet. Shows the agent remembering context across turns.

import asyncio
import os

os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient


async def main():
    options = ClaudeAgentOptions(
        model="us.anthropic.claude-sonnet-4-6",
        system_prompt="You are a helpful assistant. Keep answers short.",
    )

    # One client = one ongoing conversation. Context carries across queries.
    async with ClaudeSDKClient(options=options) as client:
        # Turn 1
        print("USER: My company is a robotics SME in Germany.")
        await client.query("My company is a robotics SME in Germany. Remember this.")
        async for msg in client.receive_response():
            if hasattr(msg, "result") and msg.result:
                print("AGENT:", msg.result)

        # Turn 2 — refers back to turn 1 WITHOUT repeating it.
        print("\nUSER: What country did I say we're based in?")
        await client.query("What country did I say we're based in?")
        async for msg in client.receive_response():
            if hasattr(msg, "result") and msg.result:
                print("AGENT:", msg.result)


if __name__ == "__main__":
    asyncio.run(main())
