#!/usr/bin/env bash
set -euo pipefail
# Simple dev runner: starts backend (uvicorn) and frontend (bun or npm) and
# keeps both running. Use Ctrl+C to stop and the script will attempt to kill
# child processes.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pids=()
cleanup() {
  echo "\nStopping dev servers..."
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

echo "Starting backend..."
if [ -x ".venv/bin/python" ]; then
  .venv/bin/python -m uvicorn app.main:app --reload --port 8000 --host 127.0.0.1 &
else
  echo "Warning: virtualenv not found at .venv; falling back to system python3"
  python3 -m uvicorn app.main:app --reload --port 8000 --host 127.0.0.1 &
fi
pids+=("$!")

echo "Starting frontend..."
if [ -d "frontend" ]; then
  if command -v bun >/dev/null 2>&1; then
    echo "Using bun to run frontend"
    (cd frontend && bun run dev) &
  elif command -v npm >/dev/null 2>&1; then
    echo "bun not found, using npm to run frontend"
    (cd frontend && npm run dev) &
  else
    echo "Neither bun nor npm were found; frontend will not be started"
  fi
else
  echo "frontend directory not found; skipping frontend"
fi
pids+=("$!")

echo "Dev servers started. Backend: http://127.0.0.1:8000  Frontend: see dev server output"
echo "Press Ctrl+C to stop."

wait

