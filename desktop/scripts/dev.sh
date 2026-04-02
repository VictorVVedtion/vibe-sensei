#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Check for Bun runtime ────────────────────────────────────────────────────
if ! command -v bun &>/dev/null; then
  echo "Error: bun is not installed."
  echo "Install from https://bun.sh:"
  echo "  curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

echo "Bun $(bun --version) detected"

# ── Install dependencies if needed ───────────────────────────────────────────
cd "${DESKTOP_DIR}"

if [ ! -d "node_modules" ]; then
  echo "Installing desktop dependencies..."
  npm install
fi

# ── Launch dev environment ───────────────────────────────────────────────────
# Dev mode: pass main/index.ts directly so Electron loads raw TypeScript
# (package.json "main" points to dist/main/index.js for production)
npx concurrently \
  --names "vite,electron" \
  --prefix-colors "cyan,green" \
  "npx vite --config vite.config.ts" \
  "sleep 3 && npx electron main/index.ts"
