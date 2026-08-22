#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux is not installed. Install tmux or use scripts/run_dev.sh instead."
  exit 1
fi

SESSION=grant-dev

echo "Creating tmux session '$SESSION'..."
tmux new-session -d -s "$SESSION" -n backend "PYTHONPATH=. .venv/bin/python -m uvicorn backend.main:app --reload --port 8000 --host 127.0.0.1"
tmux new-window -t "$SESSION:" -n frontend "bash -lc 'cd frontend && if command -v bun >/dev/null 2>&1; then bun run dev; elif command -v npm >/dev/null 2>&1; then npm run dev; else echo \"No bun/npm found\"; fi'"

echo "Attach to the tmux session with: tmux attach -t $SESSION"
tmux attach -t "$SESSION"

