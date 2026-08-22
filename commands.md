# Development and test commands

Run commands from the repository root unless a section says otherwise:

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform
```

## One-time setup

The frontend build is verified with Node `22.23.1`.

```bash
nvm use 22.23.1

python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt

cd frontend
bun install
bunx playwright install chromium
cd ..
```

For live API mode, create `frontend/.env.local` with:

```dotenv
VITE_API_MODE=api
VITE_API_URL=http://127.0.0.1:8000
```

Use `VITE_API_MODE=mock` when the frontend should run without backend requests.

## Environment Mode Permutations (Frontend & Backend DB Flags)

Use `scripts/set_env_mode.sh` to switch between Frontend (`VITE_API_MODE`) and Backend Storage (`SESSION_STORAGE_TYPE`):

### Permutation 1: Both Local (Frontend Mock + Backend SQLite)

```bash
./scripts/set_env_mode.sh --both-local
```

### Permutation 2: Both Deployed / Hosted (Frontend API + Backend RDS DB)

```bash
./scripts/set_env_mode.sh --both-deployed
```

### Permutation 3: Frontend Mock + Backend Deployed DB

```bash
./scripts/set_env_mode.sh --fe-local-db-deployed
```

### Permutation 4: Frontend API + Backend Local SQLite

```bash
./scripts/set_env_mode.sh --fe-deployed-db-local
```

### Individual Toggles

Frontend Mock:

```bash
./scripts/set_env_mode.sh --fe-local
```

Frontend API:

```bash
./scripts/set_env_mode.sh --fe-deployed
```

Backend Local SQLite DB:

```bash
./scripts/set_env_mode.sh --db-local
```

Backend Hosted RDS DB:

```bash
./scripts/set_env_mode.sh --db-hosted
```

### Check Current Active Configuration

```bash
./scripts/set_env_mode.sh
```

## Run the application

Terminal 1 — backend:

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform
.venv/bin/python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2 — frontend:

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/frontend
nvm use 22.23.1
bun run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://127.0.0.1:5173`.

## Run all verification

Frontend unit tests:

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/frontend
bun run test
```

Backend tests:

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform
.venv/bin/python -m pytest tests -q
```

Browser end-to-end tests:

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/frontend
nvm use 22.23.1
bun run test:e2e
```

Production build:

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/frontend
nvm use 22.23.1
bun run build
```

## Run focused integration tests

Conversation history merge unit tests:

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/frontend
bun run test src/services/chatHistory.test.ts
```

Backend chat and metadata tests:

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform
.venv/bin/python -m pytest tests/test_chat_api.py tests/test_meta_api.py -v
```

Conversation history reload browser test:

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/frontend
bun run test:e2e -- --grep "restores missing backend history"
```

## Test backend conversation history manually

Create a conversation:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/chat/conversations
```

Copy the returned `conversation_id` and use it below:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "REPLACE_WITH_CONVERSATION_ID",
    "session_id": "manual-test",
    "user_message": "I need an AI grant for an SME in Germany",
    "context": {
      "organization_type": "SME",
      "country": "Germany",
      "budget_range": "100000-500000 EUR",
      "project_goal": "Reduce manufacturing energy use with AI"
    }
  }'
```

Read the persisted messages:

```bash
curl http://127.0.0.1:8000/api/v1/chat/conversations/REPLACE_WITH_CONVERSATION_ID/messages
```

Other useful endpoints:

```bash
curl http://127.0.0.1:8000/api/v1/health
curl http://127.0.0.1:8000/api/v1/meta/frontend-config
curl http://127.0.0.1:8000/api/v1/meta/tools-list
curl http://127.0.0.1:8000/api/v1/chat/loop-preview
```

Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

## Review, commit, and push the integration

The following staging commands include the integration, its tests, Playwright
configuration and lockfile, and this command reference. They intentionally do
not include personal notes, helper scripts, or the local SQLite database.

```bash
cd /Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform

git add .env.example backend/core/config.py commands.md tests/test_meta_api.py
git add frontend/.gitignore frontend/package.json frontend/bun.lock frontend/playwright.config.ts
git add frontend/e2e
git add frontend/src/components frontend/src/data/mockGrants.ts
git add frontend/src/hooks/useConversations.ts frontend/src/services frontend/src/types/index.ts

git diff --cached --check
git diff --cached --stat
git diff --cached

git commit -m "feat(frontend): integrate backend chat, grants, and history"
git push -u origin frontend-backend-integration
```

Do not stage these local or unrelated paths unless they are intentionally part
of a separate commit:

```text
README.md
a.txt
docs/notes/
scripts/
storage/backend.db
todo.md
week1.md
frontend/src/routeTree.gen.ts
```
