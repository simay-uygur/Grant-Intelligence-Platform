# ai-agent/config.py
# Re-exports Bedrock configuration for ai-agent package.

from tools.config import AWS_REGION, BEDROCK_MODEL_ID, get_bedrock_client, get_model_id

__all__ = ["AWS_REGION", "BEDROCK_MODEL_ID", "get_bedrock_client", "get_model_id"]
