#!/usr/bin/env bash

# Source this file before running FastAPI:
#   source scripts/use_aws_bedrock.sh

export AWS_PROFILE="${AWS_PROFILE:-grant-platform}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export CLAUDE_CODE_USE_BEDROCK="1"

# Allow the frontend when Vite is opened through the Mac's LAN address.
# Keep an explicitly supplied value unchanged.
if [[ -z "${FRONTEND_CORS_ORIGINS:-}" ]] && command -v ipconfig >/dev/null 2>&1; then
  local_ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  if [[ -n "$local_ip" ]]; then
    export FRONTEND_CORS_ORIGINS="[\"http://$local_ip:8080\",\"http://localhost:8080\",\"http://127.0.0.1:8080\"]"
  fi
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is not installed. Install it with: brew install awscli" >&2
  return 1 2>/dev/null || exit 1
fi

if ! aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null; then
  echo "AWS profile '$AWS_PROFILE' is not configured or is not valid." >&2
  echo "Run: aws configure --profile $AWS_PROFILE" >&2
  return 1 2>/dev/null || exit 1
fi

echo "AWS Bedrock environment loaded for profile: $AWS_PROFILE"
echo "AWS region: $AWS_REGION"
if [[ -n "${FRONTEND_CORS_ORIGINS:-}" ]]; then
  echo "Frontend CORS origins loaded for local development"
fi
