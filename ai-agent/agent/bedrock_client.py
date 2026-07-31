# agent/bedrock_client.py
# Real model call to Claude via Amazon Bedrock.
# This is what replaces the mock_model in loop.py.
# NOTE: each call costs a tiny amount, and new accounts may hit a daily token limit.

import json
import boto3

# Create the Bedrock runtime client once, when this module loads.
_client = boto3.client("bedrock-runtime", region_name="us-east-1")

# Sonnet 4.6 requires the "us." inference-profile prefix in us-east-1.
MODEL_ID = "us.anthropic.claude-sonnet-4-6"


def call_claude(messages, max_tokens=1024):
    """
    Send a conversation to Claude via Bedrock and return its text reply.

    `messages` is a list of {"role": ..., "content": ...} dicts,
    where role is "user" or "assistant" (Bedrock's expected format).
    Returns the model's text response as a string.
    """
    response = _client.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "messages": messages,
        }),
    )

    # The body comes back as JSON bytes; parse it.
    result = json.loads(response["body"].read())

    # Claude's reply is in content[0]["text"].
    return result["content"][0]["text"]