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
* **Database & Storage:** SQLite (conversation history, user authentication, application drafts)
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
├── tests/                # Backend API, database, and SSE integration test suites
├── docs/                 # Architecture diagrams, deployment guides, and API specifications
├── storage/              # Local SQLite database and persistent backend logs
├── DEPLOYMENT_NOTES.md   # Deployment configuration and environment specifications
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

## Quick Start

### 1. Install Frontend Dependencies

```bash
cd frontend
bun install
```

### 2. Install Backend Dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

---

## Running Locally

### Frontend

```bash
cd frontend
bun run dev
```

The frontend development server starts on `http://localhost:8080`.

### Backend

```bash
source .venv/bin/activate

# Configure AWS profile and Bedrock environment
export AWS_PROFILE=grant-platform
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=1

# Start the FastAPI server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API server starts on `http://localhost:8000`.

---

## Testing & Quality Assurance

### Run Frontend Lint and Tests

```bash
cd frontend
bun run lint
bun run test
```

### Run Backend Test Suite

```bash
source .venv/bin/activate
pytest tests -q
```

---

## API Documentation

When the backend server is running locally, interactive API specifications and Swagger documentation can be accessed at:

* **Swagger UI:** [`http://localhost:8000/docs`](http://localhost:8000/docs)
* **ReDoc:** [`http://localhost:8000/redoc`](http://localhost:8000/redoc)

For a complete list of endpoints and request/response models, see [docs/backend.md](docs/backend.md).

---

## Deployment Architecture

The service is deployed on **Amazon Lightsail Container Services**:

```text
Public URL -> nginx:80 (Reverse Proxy & SSL)
                    ├── /            -> frontend:3000 (React / TanStack Start)
                    └── /api/*       -> backend:8000 (FastAPI + Amazon Bedrock)
```

See [docs/lightsail-deployment-guide.md](docs/lightsail-deployment-guide.md) and [DEPLOYMENT_NOTES.md](DEPLOYMENT_NOTES.md) for full deployment instructions and secrets configuration.
