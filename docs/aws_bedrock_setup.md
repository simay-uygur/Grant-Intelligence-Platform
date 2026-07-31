# AWS Bedrock Local Setup

The backend calls Claude through Amazon Bedrock. AWS credentials must be
available to the Python process that runs FastAPI.

## Option 1: AWS Single Sign-On

SSO means Single Sign-On: your organization gives you an AWS access portal and
you log in through a browser. Use this only if an organization administrator
gave you an AWS access portal. It is usually not needed for a personal AWS
account.

```bash
aws configure sso --profile grant-platform
aws sso login --profile grant-platform
export AWS_PROFILE=grant-platform
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=1
```

The administrator must assign your account or permission set access to Amazon
Bedrock and the Claude model used by the agent.

## Option 2: Local access-key profile

For a personal AWS account, create or use a dedicated IAM user with limited
Bedrock permissions. Do not create access keys for the AWS root account. Then
configure the credentials locally:

In the AWS Console:

1. Open **IAM** and choose **Users**.
2. Choose **Create user** and use a name such as `grant-platform-local`.
3. Give the user a policy that permits Bedrock model invocation. For a quick
   personal prototype, the visible AWS-managed `AmazonBedrockLimitedAccess`
   policy is the closest choice. Do not select the AgentCore, Mantle,
   Marketplace, ReadOnly, or DataZone policies. `AmazonBedrockFullAccess` is
   broader than this project needs.
4. For a stricter setup, create a custom policy containing
   `bedrock:InvokeModel` and `bedrock:GetInferenceProfile`. The code uses the
   Bedrock Converse API with a Claude inference profile.
5. Open the new user, choose **Security credentials**, then **Create access
   key**.
6. Choose the local CLI use case, create the key, and save both values. The
   secret access key is shown only at creation time.

```bash
aws configure --profile grant-platform
export AWS_PROFILE=grant-platform
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=1
```

The `aws configure` prompts expect the access key, secret key, default region
(`us-east-1`), and output format (`json`). The credentials are stored in your
local `~/.aws/credentials` file, outside this repository.

After configuring the profile, load the project environment with:

```bash
source scripts/use_aws_bedrock.sh
```

## Verify the profile

Run this before starting FastAPI:

```bash
aws sts get-caller-identity --profile grant-platform
```

If it succeeds, start the backend from the same terminal so it inherits
`AWS_PROFILE`:

```bash
source .venv/bin/activate

export AWS_PROFILE=grant-platform
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=1
export FRONTEND_CORS_ORIGINS='["http://10.201.198.239:8080","http://localhost:8080","http://127.0.0.1:8080"]'

uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Replace `10.201.198.239` with the current LAN IP shown by Vite if it changes.
The CORS value is required only when you open the frontend through that LAN
address instead of `localhost`.

## Security rules

- Never commit AWS keys, `.env`, or `~/.aws/credentials`.
- Never paste a secret key into GitHub, chat, screenshots, or issue reports.
- Do not create or use root-account access keys.
- Ask the AWS administrator for least-privilege Bedrock access and model access
  in `us-east-1`.
- If a key is exposed, deactivate and rotate it immediately in IAM.
