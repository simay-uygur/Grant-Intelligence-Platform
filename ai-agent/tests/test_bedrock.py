# tests/test_bedrock.py
# First real call to Claude via Amazon Bedrock.
# NOTE: this costs a tiny amount (fractions of a cent).

import json

from tools.config import get_bedrock_client, get_model_id

client = get_bedrock_client()
response = client.invoke_model(
    modelId=get_model_id(),
    body=json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 100,
            "messages": [{"role": "user", "content": "Say hello in one short sentence."}],
        }
    ),
)

# The response body is JSON bytes — parse it and pull out the text.
result = json.loads(response["body"].read())
print(result["content"][0]["text"])
