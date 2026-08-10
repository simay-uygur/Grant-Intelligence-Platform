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
| `main` | Production | `LIGHTSAIL_MAIN_SERVICE` |
| `develop` | Staging | `LIGHTSAIL_DEVELOP_SERVICE` |

No custom domain is required. AWS provides a public HTTPS URL for each service.
Custom domains are optional and can be added later.

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

The GitHub workflow pushes images and creates deployments; it does not create
the services. Record the exact service names for the GitHub secrets.

The AWS deployment identity needs permission to push Lightsail container images
and create container service deployments. Use a least-privilege identity, not
the AWS root account.

## GitHub Actions secrets

Add these under GitHub repository **Settings -> Secrets and variables -> Actions**:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
LIGHTSAIL_MAIN_SERVICE
LIGHTSAIL_DEVELOP_SERVICE
LIGHTSAIL_BACKEND_ENV
```

`LIGHTSAIL_BACKEND_ENV` is a multiline secret. Example shape:

```dotenv
APP_NAME=Grant Intelligence Backend
APP_VERSION=0.1.0
DEBUG=false
USE_MOCK_BEDROCK=false
AWS_REGION=us-east-1
CLAUDE_CODE_USE_BEDROCK=1
AUTH_SECRET_KEY=replace-with-a-long-random-secret
AUTH_TOKEN_TTL_HOURS=168
```

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

## Finding the deployed URLs and logs

In AWS:

```text
Lightsail -> Containers -> select service -> Public endpoint
```

Share the `main` endpoint with production users and the `develop` endpoint with
testers. For logs and deployment status, use the service's **Deployments** and
**Logs** tabs.
