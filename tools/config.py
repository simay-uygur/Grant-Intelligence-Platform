# tools/config.py
# Centralized configuration and Bedrock client factory linking to backend.core.config.settings.

from typing import Any
from backend.core.config import settings

AWS_REGION = settings.aws_region
BEDROCK_MODEL_ID = settings.bedrock_model_id

_bedrock_client: Any | None = None


def get_bedrock_client():
    """Return a shared singleton boto3 bedrock-runtime client using backend core settings."""
    global _bedrock_client
    if _bedrock_client is None:
        import boto3
        _bedrock_client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    return _bedrock_client


def get_model_id() -> str:
    """Return the configured Bedrock model ID from backend core settings."""
    return settings.bedrock_model_id
