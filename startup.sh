#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Preparing Python environment"
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required. Install it with: sudo apt-get install -y python3 python3-venv python3-pip"
  exit 1
fi

if [ ! -d "$ROOT/.venv" ]; then
  python3 -m venv "$ROOT/.venv"
fi

source "$ROOT/.venv/bin/activate"
python -m pip install --upgrade pip
python -m pip install -r "$ROOT/requirements.txt"

echo "==> Ensuring Node.js toolchain"
if ! command -v npm >/dev/null 2>&1; then
  echo "Installing Node.js 20 LTS (requires sudo access)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Installing frontend dependencies"
pushd "$ROOT/frontend-next" >/dev/null
npm install
popd >/dev/null

if [ ! -f "$ROOT/.env" ] && [ -f "$ROOT/.env.example" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "Created .env from .env.example. Update OPENAI_API_KEY before first run."
fi

source "$ROOT/.venv/bin/activate"

if command -v pytest >/dev/null 2>&1; then
  echo "==> Running backend checks"
  python -m pytest tests/test_media.py
else
  echo "pytest not found; skipping backend test run."
fi

echo "==> Building frontend (one-time)"
pushd "$ROOT/frontend-next" >/dev/null
npm run build
popd >/dev/null

if command -v lsof >/dev/null 2>&1; then
  backend_pids=$(lsof -ti tcp:8000 || true)
  if [ -n "$backend_pids" ]; then
    echo "Stopping existing process on port 8000: $backend_pids"
    kill $backend_pids || true
  fi
  frontend_pids=$(lsof -ti tcp:3000 || true)
  if [ -n "$frontend_pids" ]; then
    echo "Stopping existing process on port 3000: $frontend_pids"
    kill $frontend_pids || true
  fi
else
  echo "lsof not found; skipping port cleanup."
fi

echo "==> Starting backend and frontend (Ctrl+C to stop)"
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

pushd "$ROOT/frontend-next" >/dev/null
npm run dev -- --hostname 0.0.0.0 --port 3000 &
FRONTEND_PID=$!
popd >/dev/null

cleanup() {
  echo ""
  echo "Stopping services..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

wait "$BACKEND_PID" "$FRONTEND_PID"
