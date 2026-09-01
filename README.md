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
* **Database & Persistence:** SQLAlchemy Core with Alembic migrations (dual SQLite / PostgreSQL support)
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

### Sample Upload Documents

The `examples/uploads/` folder contains ready-to-use sample files for demonstrating chat document upload and application drafting context:

* `annual-report-2025.pdf`
* `capability-statement.docx`
* `company-profile.txt`
* `project-summary.md`
* `budget-breakdown.csv`
* `team-and-partners.json`

Upload these from the normal chat paperclip in API mode. The backend extracts text from supported files (`.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.json`) and makes that context available to chat answers, outline generation, application drafting, and document Q&A.

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
# Option A: Full-Stack Local API (Frontend API + Backend Local SQLite) — Recommended
./scripts/set_env_mode.sh --fe-api --db-local

# Option B: Offline Frontend Mock (100% in-browser with localStorage, no backend needed)
./scripts/set_env_mode.sh --fe-mock

# Option C: Both Deployed / Hosted (Frontend API + AWS RDS Database)
./scripts/set_env_mode.sh --both-deployed
```

---

## Running Locally

You can run the platform either using **Docker Compose (Recommended)** or via **Native Dev Servers**.

### Method 1: Docker Compose (RECOMMENDED — Easy to Run & Mirrors Production)

Running with Docker Compose is the easiest and most reliable way to test the full application. It mirrors the production Lightsail multi-container architecture out of the box with zero manual configuration.

```bash
docker compose -f deploy/lightsail/docker-compose.local.yml up --build
```

Once all containers are up, open your browser to:

> **http://localhost:8080**

#### Here is what happens inside Docker:
* **Mounted Local Storage (Data Persistence):** The backend SQLite database is volume-mounted to `./storage/backend.db` on your local host machine. Any applications you start, grant drafts you write, or pipeline status changes persist even when you stop, restart, or rebuild containers.
* **No Authentication Barrier:** Local Docker runs with `VITE_AUTH_REQUIRED=false`, so you will not experience session timeouts or `401 Unauthorized` token issues.
* **Reverse Proxy Networking:** Nginx (port `8080`) automatically routes frontend requests and proxies `/api/*` requests to the FastAPI backend, eliminating CORS problems.
* **AWS Bedrock Access:** Mounts your local `~/.aws` read-only so Claude Sonnet 4.6 Bedrock generation works seamlessly.

**Useful Docker commands:**
```bash
# View running containers and port mappings
docker ps

# Follow container logs
docker compose -f deploy/lightsail/docker-compose.local.yml logs -f

# Stop and remove containers
docker compose -f deploy/lightsail/docker-compose.local.yml down
```

---

### Method 2: Native Dev Servers (Two-Terminal Workflow)

If you prefer running without Docker for rapid local development:

#### 1. Set mode to API:
```bash
./scripts/set_env_mode.sh --fe-api --db-local
```

#### 2. Terminal 1 — Backend:
```bash
source .venv/bin/activate

# Configure AWS profile for Bedrock access
export AWS_PROFILE=grant-platform
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=1

# Start FastAPI server on port 8000
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend server starts on `http://127.0.0.1:8000` (API docs at `http://127.0.0.1:8000/docs`).

#### 3. Terminal 2 — Frontend:
```bash
cd frontend
bun run dev
```
The frontend dev server starts on `http://localhost:5173`.

---

### Method 3: Single-Command Runner

Alternatively, launch both native dev servers together in one terminal:
```bash
./scripts/run_dev.sh
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

## Database Architecture & SQLAlchemy

The backend persistence layer uses **SQLAlchemy Core** paired with **Alembic** migrations. It is designed to be completely database-agnostic, supporting zero-config local development and managed cloud deployments with zero code changes.

### Dual-Database Support (SQLite vs. PostgreSQL)

The database engine is resolved dynamically at runtime based on environment configuration:

* **Local Development (Default):** Uses **SQLite** at `storage/backend.db`. Requires zero external database setup.
* **Hosted / Production (AWS Lightsail / RDS):** Set `DATABASE_URL=postgresql://user:pass@host:5432/dbname` in `.env` to connect to managed PostgreSQL. Connection pooling (`pool_pre_ping=True`, `pool_recycle=1800`) is automatically configured to prevent stale connections.

### Why SQLAlchemy Core?

Instead of using heavy ORM sessions, the platform utilizes **SQLAlchemy Core**:
1. **No Session Leaks:** Avoids complex session lifecycles or lazy-loading issues in asynchronous FastAPI endpoints.
2. **Direct Pydantic Integration:** Query rows returned via `.mappings()` convert directly into validated Pydantic schemas (e.g. `StoredApplication`, `ApplicationDocument`).
3. **Automatic Transactions:** Operations use `with engine.begin() as connection:` to ensure atomic transactions (automatic commit on success, automatic rollback on failure).
4. **Portable Dialects:** Operations with syntax variations (such as `INSERT ... ON CONFLICT DO UPDATE`) are abstracted via `build_upsert()` in [`backend/core/database.py`](backend/core/database.py), executing the appropriate PostgreSQL or SQLite syntax dynamically.

### Database Migrations (Alembic)

Database schema revisions are version-controlled in `backend/migrations/versions/`.

```bash
# Run all pending migrations
source .venv/bin/activate
alembic upgrade head

# Check current revision
alembic current
```

*(Note: Local SQLite databases created during development automatically apply baseline tables and column safety checks on server startup.)*

### Inspecting the Database

* **Command Line (`sqlite3` for local dev):**
  ```bash
  sqlite3 storage/backend.db ".tables"
  sqlite3 storage/backend.db "SELECT count(*) FROM applications;"
  sqlite3 -header -column storage/backend.db "SELECT id, role, substr(content, 1, 60) FROM messages ORDER BY id DESC LIMIT 5;"
  ```
* **Visual Database Tools:** Open `storage/backend.db` using VS Code SQLite Viewer, TablePlus, DB Browser for SQLite, or DBeaver.
* **Interactive API Docs:** Browse to [`http://localhost:8000/docs`](http://localhost:8000/docs) to inspect and query stored data via Swagger UI.

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
