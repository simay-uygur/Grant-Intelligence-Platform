# tests/test_sonnet5.py
# Quick check: does Sonnet 5 respond via Bedrock?

import json
import boto3

client = boto3.client("bedrock-runtime", region_name="us-east-1")
MODEL_ID = "us.anthropic.claude-sonnet-5"

response = client.invoke_model(
    modelId=MODEL_ID,
    body=json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 50,
        "messages": [{"role": "user", "content": "Say hello in one sentence."}],
    }),
)
print(json.loads(response["body"].read())["content"][0]["text"])