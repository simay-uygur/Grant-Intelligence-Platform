# ai-agent/agent/config.py
# Re-exports centralized ai-agent config for agent.* imports.

try:
    from config import AWS_REGION, BEDROCK_MODEL_ID, get_bedrock_client, get_model_id
except ImportError:
    from ai-agent.config import AWS_REGION, BEDROCK_MODEL_ID, get_bedrock_client, get_model_id  # type: ignore

__all__ = ["AWS_REGION", "BEDROCK_MODEL_ID", "get_bedrock_client", "get_model_id"]
