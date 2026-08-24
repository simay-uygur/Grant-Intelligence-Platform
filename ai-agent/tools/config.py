# ai-agent/tools/config.py
# Configuration helper for ai-agent tools, resolving directly from backend.core.config settings.

import os
from typing import Any

try:
    from backend.core.config import settings

    AWS_REGION = settings.aws_region
    BEDROCK_MODEL_ID = settings.bedrock_model_id
except ImportError:
    AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
    BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-6")

_bedrock_client: Any | None = None


def get_bedrock_client():
    """Return a shared singleton boto3 bedrock-runtime client with timeouts and retry configuration."""
    global _bedrock_client
    if _bedrock_client is None:
        import boto3
        from botocore.config import Config

        # 10s connect timeout, 60s read timeout, standard retries for transient throttling
        client_config = Config(
            connect_timeout=10,
            read_timeout=60,
            retries={"max_attempts": 2, "mode": "standard"},
        )
        _bedrock_client = boto3.client(
            "bedrock-runtime",
            region_name=AWS_REGION,
            config=client_config,
        )
    return _bedrock_client


def get_model_id() -> str:
    """Return the configured Bedrock model ID."""
    try:
        from backend.core.config import settings

        return settings.bedrock_model_id
    except ImportError:
        return BEDROCK_MODEL_ID
