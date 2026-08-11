# Lightsail deployment

For a visual explanation of the deployment, container routing, endpoint access,
and current capacity settings, see
[`docs/lightsail-deployment-guide.md`](../../docs/lightsail-deployment-guide.md).
For the release checklist, see
[`docs/release-guide.md`](../../docs/release-guide.md).

This deployment uses one Lightsail Container Service per branch:

- `main`: production
- `develop`: staging

Each service runs three containers: `nginx`, `frontend`, and `backend`. The
nginx container is the only public endpoint and proxies `/api/*` to FastAPI.
The frontend is built with `VITE_API_URL` empty so browser requests stay on the
same origin.

No Lightsail disk or persistent volume is configured. SQLite therefore lives
inside the backend container and should be treated as disposable. A service
deployment or replacement can lose conversations and saved applications.

## GitHub environments and secrets

Create two GitHub Environments: `production` and `staging`. Configure these
secrets separately inside each environment:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `LIGHTSAIL_SERVICE` — optional override; defaults from the branch name
- `LIGHTSAIL_BACKEND_ENV` — multiline `KEY=value` pairs for backend runtime settings

The AWS identity needs permission to push Lightsail container images and create
container service deployments. The backend environment should include the
Bedrock settings and credentials required by the agent, using a least-privilege
identity. Do not commit `.env` files or credentials.

Set `AUTH_REQUIRED=true` and provide a long random `AUTH_SECRET_KEY` in the
backend environment. Users register through the app's login screen. Their
email and salted password hash are stored in SQLite; the browser keeps only a
signed session token. Tokens expire after `AUTH_TOKEN_TTL_HOURS`.

The workflow automatically selects `production` for `main` and `staging` for
`develop`. If the service named by `LIGHTSAIL_SERVICE` does not exist, the
workflow creates it with Small power and scale 1, waits for it to become ready,
and then deploys the images.

## Run locally with Docker

From the repository root:

```bash
cp .env.example .env
docker compose -f deploy/lightsail/docker-compose.local.yml up --build
```

Open `http://localhost:8080`. nginx exposes the app, while the frontend and
backend remain internal to the Compose network. Stop it with `Ctrl+C`, or run
`docker compose -f deploy/lightsail/docker-compose.local.yml down`.

The Nginx config is a template. Local Compose substitutes `frontend` and
`backend` as upstream hosts, while the Lightsail deployment substitutes
`localhost` for both upstream hosts.

The local Compose setup stores SQLite inside the backend container. It is useful
for testing the deployment shape, but it is disposable by design.
