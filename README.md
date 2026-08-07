# Grant Intelligence Platform

Grant Intelligence Platform is now a merged frontend + backend repository.
The frontend is a chat-first grant workflow built with React, TanStack Start,
and Bun. The backend is a FastAPI service that powers conversation storage,
grant search, and supporting API endpoints.

## What lives in this repo

- `src/` — frontend application code
- `app/` — FastAPI backend code
- `agent/` — stable backend facade that keeps the `agent.service` import contract
- `ai-agent/` — published Bedrock-backed agent implementation and tools
- `tests/` — backend test coverage
- `docs/` — API notes and design docs
- `storage/` — local SQLite data and generated artifacts

## Frontend stack

- React 19 + TypeScript
- Bun for package management and scripts
- Vite / TanStack Start / TanStack Router
- shadcn/ui on top of Radix UI primitives
- Tailwind CSS v4

## Backend stack

- FastAPI
- Pydantic v2 / pydantic-settings
- SQLite for local conversation and application storage
- boto3 and requests for the Bedrock-backed agent and EU Funding & Tenders Portal client
- httpx for outbound HTTP clients and test transport stubs

## Prerequisites

- Bun 1.x
- Node.js 20.19+ or 22.12+ for the frontend dev server
- Python 3.11+ (the repo has been exercised with Python 3.13 in this workspace)
- Git

## Quick start

### 1) Install frontend dependencies

```bash
cd frontend
bun install
```

### 2) Install backend dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

## Run the app

### Frontend

```bash
cd frontend
bun run dev
```

This starts the frontend dev server, typically on `http://localhost:8080`.

### Backend

```bash
source .venv/bin/activate

# AWS profile and Bedrock settings
export AWS_PROFILE=grant-platform
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=1

# Allow the frontend LAN address shown by Vite.
# Replace 10.201.198.239 with your current local IP if it changes.
export FRONTEND_CORS_ORIGINS='["http://10.201.198.239:8080","http://localhost:8080","http://127.0.0.1:8080"]'

uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

This starts the backend API on `http://localhost:8000` by default.

If the frontend is opened through the LAN address, use the same address shown
by Vite, for example `http://10.201.198.239:8080`. The CORS setting above is
needed because browsers treat that LAN origin differently from
`http://localhost:8080`.

## Useful frontend commands

```bash
bun run build
bun run build:dev
bun run preview
bun run lint
bun run format
```

## Useful backend checks

```bash
source .venv/bin/activate
python3 -m pytest tests -q
```

The backend test suite currently covers chat persistence and the agent integration contract.

## Environment variables

### Frontend

Defined in `.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_MODE` | `api` | Uses the FastAPI backend and Bedrock-backed agent. Set to `mock` for frontend-only development. |
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL when `VITE_API_MODE=api`. |

### Backend

The backend reads `.env` via `pydantic-settings`.

For local AWS/Bedrock credentials, follow
[`docs/aws_bedrock_setup.md`](docs/aws_bedrock_setup.md). Do not
place secret keys in this repository.

| Variable | Default | Purpose |
| --- | --- | --- |
| `USE_MOCK_BEDROCK` | `true` | Controls the legacy chat preview flow; grant search and application drafting use the Bedrock agent. |
| `SQLITE_DB_PATH` | `storage/backend.db` | SQLite file shared by chat history and persisted application drafts. |
| `CHAT_HISTORY_WINDOW` | `10` | Number of recent user/assistant messages sent back into the model context. |

## Agent layer

The backend calls `agent/service.py`, which delegates to the published
Bedrock-backed implementation in `ai-agent/agent/service.py`.

`agent/` is not a second LLM implementation. It is a small compatibility
adapter so FastAPI can call the published agent without importing the
`ai-agent/` folder directly.

Required functions:

- `search_grants(profile, max_grants=3)`
- `start_application(grant, profile)`
- `rewrite_section(section_title, current_content, profile, grant=None, instruction=None)`


## API endpoints

### Health

- `GET /api/v1/health`

### Chat

- `POST /api/v1/chat/conversations`
- `POST /api/v1/chat/message`
- `GET /api/v1/chat/conversations/{conversation_id}/messages`

### Grants

- `POST /api/v1/grants/search`
- `POST /api/v1/grants/{grant_id}/start-application`

### Applications

- `GET /api/v1/grants/{grant_id}/applications/latest` — reopen the latest non-archived application linked to a grant
- `GET /api/v1/applications` — paginated dashboard summaries; accepts `status`, `limit`, and `offset`
- `GET /api/v1/applications/{application_id}` — full stored output plus its grant/profile context
- `PATCH /api/v1/applications/{application_id}` — set `draft`, `completed`, or `archived` status
- `PUT /api/v1/applications/{application_id}/sections/{section_id}` — persist a manual section edit
- `PATCH /api/v1/documents/{document_id}/sections/{section_id}` — AI rewrite and persist a section

The normal chat flow checks the grant-specific lookup first. When a saved
application exists it is reopened; otherwise the existing
`POST /api/v1/grants/{grant_id}/start-application` call generates and stores a
new draft.

### Metadata / frontend config

- `GET /api/v1/meta/frontend-config`

## Recommended workflow after the merge

1. Start the backend.
2. Start the frontend.
3. Switch the frontend to API mode when you are ready to test integration.
4. Run the backend tests and a frontend build/lint check before pushing.

## Notes

- `storage/backend.db` is a local SQLite database file and should not be committed.
- The MVP has no authentication or user ownership model, so the application list covers the entire configured local database. Add an owner/user key before multi-tenant deployment.
- The frontend still supports mock mode, which is useful when the backend is not running.
- This repository contains working code plus some design notes in top-level `*.md` files; those notes are kept separate from the main setup instructions above.
