#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$ROOT/apps/api/.venv" ]; then
  echo "Backend venv missing. Run: make install"
  exit 1
fi

cleanup() {
  echo ""
  echo "Shutting down ORBITO dev servers..."
  kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "ORBITO API  -> http://localhost:8000/docs"
echo "ORBITO Web  -> http://localhost:3000"
echo ""

(
  cd "$ROOT/apps/api"
  .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) &
API_PID=$!

cd "$ROOT"
pnpm --filter @orbito/web dev
