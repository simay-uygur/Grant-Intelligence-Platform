# Grant Intelligence Platform

An intelligent grant discovery, matchmaking, and application-drafting platform developed as part of the **AWS Amazon University Engagement Program (UEP)**.

---

## Project Team

* **Dea Berisha**
* **Bleron Bajraktari**
* **Simay Uygur**

---

## Technology Stack

### Frontend
* **Framework & Language:** React 19, TypeScript
* **Runtime & Package Manager:** Bun, Node.js
* **Routing & Bundling:** Vite, TanStack Start, TanStack Router
* **UI & Styling:** Tailwind CSS v4, Radix UI primitives, shadcn/ui, Lucide Icons

### Backend
* **API Framework:** FastAPI, Python 3.11+
* **Validation & Settings:** Pydantic v2, pydantic-settings
* **Database & Storage:** SQLite (local dev), PostgreSQL / AWS Managed DB support
* **Streaming Protocol:** Server-Sent Events (SSE) with `text/event-stream` for real-time AI thinking events
* **HTTP & Web Server:** Uvicorn, HTTPX

### Agent & AI Layer
* **Foundation Models:** Anthropic Claude (Claude 3.5 Sonnet / Claude Sonnet 4.6) via **Amazon Bedrock**
* **Agent Architecture:** Claude Agent SDK, Model Context Protocol (MCP) in-process tool servers
* **Cloud & External APIs:** AWS SDK (`boto3`), EU Funding & Tenders Portal API

### Deployment & DevOps
* **Hosting Platform:** **Amazon Lightsail Container Services**
* **Container Architecture:** Multi-container deployment:
  * `nginx` (port 80): Public reverse proxy and SSL termination
  * `frontend` (port 3000): React application server
  * `backend` (port 8000): FastAPI application server
* **Containerization:** Docker, Docker Compose
* **CI/CD Pipeline:** GitHub Actions automated build and deployment workflows for `main` (Production) and `develop` (Staging)

---

## Project Structure

```text
├── frontend/             # React + TanStack Start frontend application
├── backend/              # FastAPI backend services, routes, schemas, and SQLite models
├── ai-agent/             # Bedrock-backed autonomous agent, MCP servers, and tool implementations
├── agent/                # Stable backend facade for agent integration
├── scripts/              # Development helpers and environment mode configuration scripts
│   ├── set_env_mode.sh   # Switch between 4 Frontend/Backend environment permutations
│   └── run_dev.sh        # Single-command runner for local backend & frontend
├── tests/                # Backend API, database, and SSE integration test suites
├── docs/                 # Architecture diagrams, deployment guides, API specifications, and Final Report
│   └── FINAL_PROJECT_REPORT.md # Week 10 Comprehensive Final Report
├── storage/              # Local SQLite database and persistent backend logs
├── DEPLOYMENT_NOTES.md   # Deployment configuration and environment specifications
├── commands.md           # Development, testing, and environment mode commands
└── docker-compose.yml    # Local multi-container development configuration
```

---

## Prerequisites

* Bun 1.x
* Node.js 20.19+ or 22.12+
* Python 3.11+ (tested with Python 3.13)
* Git
* AWS CLI configured with Amazon Bedrock model access

---

## Quick Start & Environment Configuration

### 1. Install Dependencies

```bash
# Frontend
cd frontend
bun install
cd ..

# Backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy the example files and adjust as needed:

```bash
cp .env.example .env
```

Key variables:

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_MODE` | `api` (live backend) or `mock` (frontend-only demo) | `api` |
| `VITE_API_URL` | Backend origin for the frontend client | `http://127.0.0.1:8000` |
| `DEBUG` | FastAPI debug mode (keep `false` outside development) | `false` |
| `SESSION_STORAGE_TYPE` | `local` (SQLite) or `hosted` (RDS) | `local` |
| `AUTH_REQUIRED` | Enable JWT authentication (`true` in production) | `false` |
| `AUTH_SECRET_KEY` | JWT signing secret — **required when auth is enabled** (min 32 chars) | dev placeholder |
| `USE_MOCK_BEDROCK` | Bypass Bedrock calls for offline testing | `false` |

AWS credentials are resolved through your AWS profile / environment (`AWS_PROFILE`, `AWS_REGION`) or the Lightsail container role in production.

### 3. Configure Environment Mode (Local vs. Deployed)

Use the built-in environment mode script to configure Frontend (`VITE_API_MODE`) and Backend (`SESSION_STORAGE_TYPE`):

```bash
# Option A: Both Local (Frontend Mock + Backend SQLite)
./scripts/set_env_mode.sh --both-local

# Option B: Frontend Connected to Local Backend API (Recommended for local dev)
./scripts/set_env_mode.sh --fe-deployed-db-local

# Option C: Both Deployed / Hosted (Frontend API + AWS RDS Database)
./scripts/set_env_mode.sh --both-deployed
```

---

## Running Locally

> **Recommended:** run the backend and frontend directly with the commands below.
> No Docker is needed for day-to-day development.

### Method 1: Single Command (Recommended)

Run both backend and frontend dev servers together:

```bash
./scripts/run_dev.sh
```

### Method 2: Two-Terminal Workflow

**Terminal 1 — Backend:**

```bash
source .venv/bin/activate

# Configure AWS profile and Bedrock environment
export AWS_PROFILE=grant-platform
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=1

# Start FastAPI server on port 8000 (--host 127.0.0.1 = local access only)
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend server starts on `http://127.0.0.1:8000` — open `http://127.0.0.1:8000/docs`
for the interactive API docs. (Note: always browse to `127.0.0.1` or `localhost`;
`0.0.0.0` is a server bind address, not a clickable URL.)

**Terminal 2 — Frontend:**

```bash
cd frontend
bun run dev
```

The frontend development server starts on `http://localhost:8080`.

### Docker (Optional)

Docker Compose is only needed to mirror the production Lightsail setup locally
(nginx reverse proxy in front of both services).

**Prerequisite — AWS profile:** the backend container needs Amazon Bedrock access.
It mounts your local `~/.aws` directory read-only and uses the `grant-platform`
profile (override with `AWS_PROFILE=<name>`). Create it once if you don't have it:

```bash
# Option A: long-lived access keys
aws configure --profile grant-platform
# Enter your AWS Access Key ID, Secret Access Key, and region (us-east-1)

# Option B: SSO (if your organisation uses AWS IAM Identity Center)
aws configure sso --profile grant-platform
aws sso login --profile grant-platform   # refresh before each dev session

# Verify it works:
aws sts get-caller-identity --profile grant-platform
```

> **Troubleshooting:**
> - **No `~/.aws` directory?** The container still starts, but Bedrock calls run in
>   degraded mode (fallback keywords/scores) until a profile is created.
> - **`Unable to locate credentials` after a break?** Your SSO token likely expired —
>   run `aws sso login --profile grant-platform`, then restart the backend container
>   (`docker compose -f deploy/lightsail/docker-compose.local.yml restart backend`).

Then run:

```bash
docker compose -f deploy/lightsail/docker-compose.local.yml up --build
```

Once all containers are up, open:

> **http://localhost:8080**

That is the only public address — nginx (host port `8080`) proxies `/` to the
frontend container and `/api/*` to the backend container. The individual
frontend (`3000`) and backend (`8000`) ports are internal to Docker's network
and are **not** reachable from your browser by design.

Useful commands while it runs:

```bash
docker ps                                            # verify the 8080->80 port mapping
docker compose -f deploy/lightsail/docker-compose.local.yml logs -f   # follow logs
# Ctrl+C to stop, then:
docker compose -f deploy/lightsail/docker-compose.local.yml down      # remove containers
```

---

## Testing & Quality Assurance

### Backend Lint, Formatting, and Type Checks

```bash
source .venv/bin/activate
python -m ruff check backend tests
python -m ruff format --check backend tests
python -m mypy backend
```

Formatting can be applied automatically with `ruff format backend tests`.

### Run Frontend Lint and Unit Tests

```bash
cd frontend
bun run lint        # ESLint (also auto-fixes)
bun run typecheck   # tsc --noEmit
bun run test        # Vitest unit/integration suite
```

### Run Backend Test Suite

```bash
source .venv/bin/activate
pytest tests -q
```

The same checks run automatically in CI on every push and pull request (`.github/workflows/ci.yml`).

### Run End-to-End Browser Tests

```bash
cd frontend
bun run test:e2e
```

---

## API Documentation

When the backend server is running locally, interactive API specifications and Swagger documentation can be accessed at:

* **Swagger UI:** [`http://localhost:8000/docs`](http://localhost:8000/docs)
* **ReDoc:** [`http://localhost:8000/redoc`](http://localhost:8000/redoc)

---

## Deployment Architecture

The service is deployed on **Amazon Lightsail Container Services**:

```text
Public URL -> nginx:80 (Reverse Proxy & SSL)
                    ├── /            -> frontend:3000 (React / TanStack Start)
                    └── /api/*       -> backend:8000 (FastAPI + Amazon Bedrock)
```

See [docs/FINAL_PROJECT_REPORT.md](docs/FINAL_PROJECT_REPORT.md) and [DEPLOYMENT_NOTES.md](DEPLOYMENT_NOTES.md) for full deployment architecture, environment configurations, and database options.
