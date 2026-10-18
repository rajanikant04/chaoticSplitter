#!/bin/bash

# Get the project root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting ChaoticSplitter..."

# Locate virtual environment python or system python
PYTHON_CMD="python"
if [ -f "$ROOT_DIR/backend/venv/python.exe" ]; then
    PYTHON_CMD="$ROOT_DIR/backend/venv/python.exe"
elif [ -f "$ROOT_DIR/backend/venv/Scripts/python.exe" ]; then
    PYTHON_CMD="$ROOT_DIR/backend/venv/Scripts/python.exe"
elif [ -f "$ROOT_DIR/backend/venv/bin/python" ]; then
    PYTHON_CMD="$ROOT_DIR/backend/venv/bin/python"
fi

echo "📦 Using Python: $PYTHON_CMD"

# Start FastAPI backend
(
    cd "$ROOT_DIR/backend" || exit 1
    "$PYTHON_CMD" -m uvicorn app.main:app --reload --port 8000
) &

BACKEND_PID=$!

# Start React Vite frontend
(
    cd "$ROOT_DIR/frontend" || exit 1
    npm run dev
) &

FRONTEND_PID=$!

# Trap signals and shut down both services on exit
trap 'kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null' EXIT INT TERM

echo "✨ Services running:"
echo "   - Backend API: http://127.0.0.1:8000"
echo "   - Frontend UI: http://localhost:5173"
echo "Press Ctrl+C to terminate both services."

# Wait for background processes
wait
