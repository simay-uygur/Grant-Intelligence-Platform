# agent/sdk_hello.py
# SDK agent pinned to Sonnet 4.6 via Bedrock.

import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions


async def main():
    async for message in query(
        prompt="Say hello and tell me in one sentence what you can help with.",
        options=ClaudeAgentOptions(
            model="us.anthropic.claude-sonnet-4-6",   # pin the model explicitly
            allowed_tools=[],
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)


asyncio.run(main())