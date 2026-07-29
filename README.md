# Grant Intelligence Platform

Grant Intelligence Platform is now a merged frontend + backend repository.
The frontend is a chat-first grant workflow built with React, TanStack Start,
and Bun. The backend is a FastAPI service that powers conversation storage,
grant search, and supporting API endpoints.

## What lives in this repo

- `src/` — frontend application code
- `app/` — FastAPI backend code
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
- SQLite for local conversation storage
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
uvicorn backend.main:backend --reload
```

This starts the backend API on `http://localhost:8000` by default.

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

The backend test suite currently covers chat persistence and EU Horizon search behavior.

## Environment variables

### Frontend

Defined in `.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_MODE` | `mock` | Uses the local mock frontend service. Set to `api` to call the backend. |
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL when `VITE_API_MODE=api`. |

### Backend

The backend reads `.env` via `pydantic-settings`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `USE_MOCK_BEDROCK` | `true` | Keeps the backend on the local/mock Bedrock flow. |
| `SQLITE_DB_PATH` | `storage/app.db` | SQLite file used for chat conversations and messages. |
| `CHAT_HISTORY_WINDOW` | `10` | Number of recent user/assistant messages sent back into the model context. |

## API endpoints

### Health

- `GET /api/v1/health`

### Chat

- `POST /api/v1/chat/conversations`
- `POST /api/v1/chat/message`
- `GET /api/v1/chat/conversations/{conversation_id}/messages`

### Grants

- `POST /api/v1/grants/search`

### Metadata / frontend config

- `GET /api/v1/meta/frontend-config`

## Recommended workflow after the merge

1. Start the backend.
2. Start the frontend.
3. Switch the frontend to API mode when you are ready to test integration.
4. Run the backend tests and a frontend build/lint check before pushing.

## Notes

- `storage/app.db` is a local SQLite database file and should not be committed.
- The frontend still supports mock mode, which is useful when the backend is not running.
- This repository contains working code plus some design notes in top-level `*.md` files; those notes are kept separate from the main setup instructions above.
