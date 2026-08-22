# Deployment notes

## Overview

The app is deployed as three containers in each AWS Lightsail Container
Service:

```text
Public URL -> nginx:80 -> frontend:3000
                    \-> backend:8000 for /api/*
```

Branches map to separate services:

| Branch | Environment | Service secret |
| --- | --- | --- |
| `main` | Production | GitHub Environment: `production` |
| `develop` | Staging | GitHub Environment: `staging` |

No custom domain is required. AWS provides a public HTTPS URL for each service.
Custom domains are optional and can be added later.

## Agent streaming & execution loop synchronization

```text
[Browser / UI]                  [FastAPI Backend]                 [Agent Execution Loop]
      |                                 |                                   |
      | --- HTTP POST /stream --------> |                                   |
      |                                 | --- Starts Agent Loop ----------> |
      |                                 |                                   | (Step 1: Analyzes inputs)
      | <== SSE Event ("thinking") <=== | <== Yields stage event <========= |
      |                                 |                                   | (Step 2: Invokes Tool / Bedrock)
      | <== SSE Event ("tool_call") <= | <== Yields tool event <========== |
      |                                 |                                   | (Step 3: Receives tool result)
      | <== SSE Event ("progress") <=== | <== Yields intermediate data <=== |
      |                                 |                                   | (Step 4: Completes workflow)
      |                                 | [Auto-saves to SQLite DB]         |
      | <== SSE Event ("result") <===== | <== Yields final output <======== |
      |                                 |                                   |
```

## Login and registration

Hosted deployments show a login/register page before the grant workspace.
Users can register with an email and password or log in to an existing account.
Passwords are salted and hashed, and chat conversations/applications are scoped
to the logged-in user.

The hosted workflow forces authentication on. The backend must receive:

```dotenv
AUTH_REQUIRED=true
AUTH_SECRET_KEY=use-a-long-random-secret-at-least-32-characters
AUTH_TOKEN_TTL_HOURS=168
```

Users are stored in the SQLite `users` table. Never commit the secret key or
AWS credentials.

## Database warning: deployments can delete SQLite

SQLite currently lives inside the backend container. There is no Lightsail disk
or persistent volume. When Lightsail replaces the backend container during a
deployment, the SQLite database can be deleted.

This can remove:

- registered users;
- conversations and chat history;
- saved applications;
- manual application edits.

This is acceptable for an MVP or disposable staging environment. Before
production data matters, move the database to persistent managed PostgreSQL or
another persistent storage solution.

## Managed Relational Database in AWS (RDS vs. Lightsail DB)

To ensure user accounts, conversation history, and application drafts survive container redeployments, replace container-local SQLite with a managed relational database in AWS.

### 1. AWS Relational Database Options Comparison

| Option | Ideal Use Case | Pros | Cons | Estimated Cost |
| :--- | :--- | :--- | :--- | :--- |
| **AWS Lightsail Managed Database (PostgreSQL)** *(Recommended Start)* | Staging & Production on Lightsail | • Native integration with Lightsail Containers<br>• Simple setup & zero VPC peering needed<br>• Automated daily backups & SSL included | • Fixed compute tier scaling | ~\$15 / month |
| **AWS RDS PostgreSQL (`db.t4g.micro`)** | Scalable Production | • Industry standard<br>• Multi-AZ replication & Point-in-time recovery<br>• Storage auto-scaling | • Requires public endpoint / VPC security group configuration for Lightsail access | ~\$15 - \$25 / month |
| **AWS Aurora Serverless v2 (PostgreSQL)** | Enterprise / High Variable Traffic | • Auto-scales ACUs (capacity) instantly<br>• Sub-millisecond failover & cluster cloning | • Higher baseline cost when active | Pay per ACU-hour |

### 2. Relational Schema Mapping (PostgreSQL Compatible)

- **`users`**: `id` (UUID/VARCHAR PK), `email` (VARCHAR UNIQUE), `password_hash` (TEXT), `created_at` (TIMESTAMP WITH TIME ZONE)
- **`conversations`**: `id` (UUID PK), `user_id` (VARCHAR FK -> `users.id`), `title` (TEXT), `created_at`, `updated_at`
- **`messages`**: `id` (UUID PK), `conversation_id` (UUID FK -> `conversations.id`), `role` (VARCHAR), `content` (TEXT), `metadata` (JSONB), `created_at`
- **`applications`**: `id` (UUID PK), `user_id` (VARCHAR FK -> `users.id`), `grant_id` (VARCHAR), `grant_title` (TEXT), `status` (VARCHAR), `sections` (JSONB), `created_at`, `updated_at`

### 3. Deploying Connection Settings

In GitHub Actions Environment Secrets (`LIGHTSAIL_BACKEND_ENV` for `production` / `staging`), set:

```dotenv
SESSION_STORAGE_TYPE=hosted
DATABASE_URL=postgresql://dbuser:dbpassword@rds-instance-endpoint.us-east-1.rds.amazonaws.com:5432/grant_db
```

Anonymous records created before authentication have no owner and will not
appear in a newly authenticated user's account.

## Run locally with Docker

From the repository root:

```bash
cp .env.example .env
docker compose -f deploy/lightsail/docker-compose.local.yml up --build
```

Open `http://localhost:8080`. Stop the stack with:

```bash
docker compose -f deploy/lightsail/docker-compose.local.yml down
```

Local auth is disabled by default. To test the login page, set this in
`deploy/lightsail/docker-compose.local.yml`:

```yaml
VITE_AUTH_REQUIRED: "true"
```

and set this in `.env`:

```dotenv
AUTH_REQUIRED=true
AUTH_SECRET_KEY=local-development-secret-at-least-32-characters
```

Then rebuild with `up --build`.

Useful local commands:

```bash
docker compose -f deploy/lightsail/docker-compose.local.yml config
docker compose -f deploy/lightsail/docker-compose.local.yml ps
docker compose -f deploy/lightsail/docker-compose.local.yml logs -f
docker compose -f deploy/lightsail/docker-compose.local.yml build --no-cache
```

## One-time AWS setup

Create two Lightsail Container Services, for example:

```text
grant-intelligence-main
grant-intelligence-develop
```

The GitHub workflow creates the service automatically if it does not already
exist, using Micro power and scale 1. It then waits for the service to become
ready before pushing images. If `LIGHTSAIL_SERVICE` is omitted, the workflow
uses `grant-intelligence-main` for `main` and `grant-intelligence-develop` for
`develop`.

The AWS deployment identity needs permission to create/read Lightsail container
services, push container images, and create container service deployments. Use a
least-privilege identity, not the AWS root account.

## GitHub Actions environments and secrets

Create two GitHub Environments under **Settings -> Environments**:

```text
production
staging
```

You can add approval rules to `production` so a deployment requires review.
Add these secrets separately inside each environment:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
LIGHTSAIL_SERVICE (optional; defaults by branch)
LIGHTSAIL_BACKEND_ENV
```

Use different values for `production` and `staging`. In particular, each
environment should have its own `LIGHTSAIL_SERVICE`, `LIGHTSAIL_BACKEND_ENV`,
`AUTH_SECRET_KEY`, and any runtime AWS/Bedrock credentials. `main` must never
use the staging auth secret or staging database settings.

`LIGHTSAIL_BACKEND_ENV` is a multiline secret. Example shape:

```dotenv
APP_NAME=Grant Intelligence Backend
APP_VERSION=0.1.0
DEBUG=false
USE_MOCK_BEDROCK=false
SESSION_STORAGE_TYPE=hosted
DATABASE_URL=postgresql://user:password@rds-instance-endpoint.us-east-1.rds.amazonaws.com:5432/grant_db
AWS_REGION=us-east-1
CLAUDE_CODE_USE_BEDROCK=1
AWS_ACCESS_KEY_ID=<bedrock-runtime-access-key>
AWS_SECRET_ACCESS_KEY=<bedrock-runtime-secret-key>
AUTH_SECRET_KEY=replace-with-a-long-random-secret
AUTH_TOKEN_TTL_HOURS=168
```

Note: Setting `SESSION_STORAGE_TYPE=hosted` in `LIGHTSAIL_BACKEND_ENV` causes Pydantic in `backend/core/config.py` to automatically override the local default (`session_storage_type = "local"`) so the backend runs in hosted mode on AWS.

The `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` inside
`LIGHTSAIL_BACKEND_ENV` are for the running backend container to call Bedrock.
They are separate from the GitHub `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY`, which are used by GitHub Actions to create services and
deploy images. Use a dedicated least-privilege IAM identity for Bedrock runtime
access; do not use root credentials.

The workflow forces `AUTH_REQUIRED=true` and fails if `AUTH_SECRET_KEY` is
missing or shorter than 32 characters.

## Deploying changes

The workflow is `.github/workflows/deploy-lightsail.yml` and runs on pushes to
`main` and `develop`.

Staging:

```bash
git checkout develop
git add .
git commit -m "your change"
git push origin develop
```

Production is deployed after the approved merge into `main`:

```bash
git checkout main
git pull origin main
git push origin main
```

The workflow tests the code, builds frontend/backend/nginx images, pushes them
to the matching Lightsail service, and activates a new deployment. It can also
be started manually from GitHub Actions with **Run workflow**.

The workflow installs the Linux Lightsail Control plugin automatically before
uploading images. No plugin installation is needed on local macOS environments for GitHub-hosted
deployments.

## Finding the deployed URLs and logs

In AWS:

```text
Lightsail -> Containers -> select service -> Public endpoint
```

Share the `main` endpoint with production users and the `develop` endpoint with
testers. For logs and deployment status, use the service's **Deployments** and
**Logs** tabs.
