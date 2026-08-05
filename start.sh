#!/usr/bin/env bash
# start.sh — one-click launch: installs deps if needed, then runs the backend
# (nodemon, auto-restarts on server/src changes) and the Vite dev server together.
#
# Usage:
#   ./start.sh [path-to-log-file]
#   LOG_LENS_PORT=7780 ./start.sh /path/to/file.log
#
# Stop with Ctrl-C.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "error: 'node' was not found on PATH." >&2
  echo "install Node.js (e.g. via https://nodejs.org, 'brew install node', or nvm) and retry." >&2
  exit 127
fi

if [ ! -d node_modules ] || [ ! -d server/node_modules ] || [ ! -d client/node_modules ]; then
  echo "[start.sh] installing dependencies..."
  npm install
fi

if [ "${1:-}" != "" ]; then
  export LOG_FILE="$1"
fi

exec npm run dev
