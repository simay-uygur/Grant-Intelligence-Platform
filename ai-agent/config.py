# ai-agent/config.py
# Re-exports centralized Bedrock configuration from tools.config.

from tools.config import AWS_REGION, BEDROCK_MODEL_ID, get_bedrock_client, get_model_id

__all__ = ["AWS_REGION", "BEDROCK_MODEL_ID", "get_bedrock_client", "get_model_id"]
