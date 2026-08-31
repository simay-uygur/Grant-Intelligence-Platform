# Grant Intelligence Platform

An intelligent grant discovery, matchmaking, and application-drafting platform developed as part of the **AWS Amazon University Engagement Program (UEP)**.

---

## Project Team - DBS Team

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

---

## Prerequisites

* Bun 1.x
* Node.js 20.19+ or 22.12+
* Python 3.11+ (tested with Python 3.13)
* Git
* AWS CLI configured with Amazon Bedrock model access

---

## 🚀 Quick Start (Zero Config)

> **Zero Database Setup Required:** Local SQLite database tables and schema bootstrap automatically on first launch. No manual database setup or migrations are needed for local development.

### 1. Install Dependencies & Configure Environment

```bash
# 1. Setup Backend (Python 3.11+)
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 2. Setup Frontend (Node.js 20+)
cd frontend
bun install   # or npm install
cd ..

# 3. Environment configuration
cp .env.example .env
```

#### Key Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_MODE` | `api` (live backend) or `mock` (frontend-only demo) | `api` |
| `VITE_API_URL` | Backend origin for the frontend client | `http://127.0.0.1:8000` |
| `SESSION_STORAGE_TYPE` | `local` (SQLite) or `hosted` (AWS Lightsail Database) | `local` |
| `USE_MOCK_BEDROCK` | Bypass Bedrock calls for offline testing without AWS keys | `false` |

*(Optional)* Use `./scripts/set_env_mode.sh` to switch between modes (e.g. `./scripts/set_env_mode.sh --both-local` for mock demo or `./scripts/set_env_mode.sh --fe-deployed-db-local` for full-stack local dev).

---

### 2. Choose How to Run

#### 💻 Method A: Two-Terminal Workflow (Recommended for Dev)

**Terminal 1 — Backend (FastAPI):**
```bash
source .venv/bin/activate

# (Optional) AWS Bedrock environment
export AWS_PROFILE=grant-platform
export AWS_REGION=us-east-1

# Start backend server
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
* Backend API: `http://127.0.0.1:8000`
* Interactive API Documentation (Swagger): `http://127.0.0.1:8000/docs`

**Terminal 2 — Frontend (Vite + React):**
```bash
cd frontend
bun run dev   # or npm run dev
```
* Web Application: `http://localhost:8080`

---

#### 🐳 Method B: Docker Workflow (All-in-One)

Runs the complete containerized stack (Frontend, Backend, and Nginx reverse proxy):

```bash
docker compose -f deploy/lightsail/docker-compose.local.yml up --build
```

* Web Application: `http://localhost:8080`
* Stop containers: `Ctrl+C` then `docker compose -f deploy/lightsail/docker-compose.local.yml down`

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

Database schema revisions are version-controlled in `backend/migrations/versions/`. In production / Docker deployments, migrations run automatically on container startup (`alembic upgrade head`).

```bash
# Run all pending migrations
source .venv/bin/activate
alembic upgrade head

# Check current revision
alembic current
```

#### Why SQLite-Specific Code Exists in `ApplicationStore`
You may notice helper methods (`_ensure_table_columns` and `_migrate_legacy_status_values`) in [`backend/services/application_store.py`](backend/services/application_store.py). These exist alongside Alembic for two reasons:
1. **Zero-Config Local Dev & Pytest:** When running local tests (`pytest`) or developing locally without Docker, developers don't need to manually run `alembic upgrade head` — the store auto-checks and patches the local SQLite file on boot.
2. **SQLite DDL Limitations:** Unlike PostgreSQL (which supports full `ALTER TABLE` and modifying constraints directly), SQLite cannot alter existing `CHECK` constraints (such as adding new status enums) without creating a temporary table and copying data over. That code is solely a fallback for older local SQLite test databases. Alembic remains the source of truth for managed PostgreSQL environments.


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
