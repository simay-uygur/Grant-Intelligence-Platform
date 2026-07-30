# tests/test_bedrock.py
# First real call to Claude via Amazon Bedrock.
# NOTE: this costs a tiny amount (fractions of a cent).

import json
import boto3

# The Bedrock runtime client — this is what sends model requests.
# region_name must match where you have access (us-east-1).
client = boto3.client("bedrock-runtime", region_name="us-east-1")

# Sonnet 4.6 requires the "us." inference-profile prefix (not the bare model ID).
MODEL_ID = "us.anthropic.claude-sonnet-4-6"

# Send one message using the Bedrock request format for Anthropic models.
response = client.invoke_model(
    modelId=MODEL_ID,
    body=json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 100,
        "messages": [
            {"role": "user", "content": "Say hello in one short sentence."}
        ],
    }),
)

# The response body is JSON bytes — parse it and pull out the text.
result = json.loads(response["body"].read())
print(result["content"][0]["text"])