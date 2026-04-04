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

# ── Build main process (CJS) ────────────────────────────────────────────────
# Root package.json has "type":"module" which breaks Electron's raw TS loading.
# Build to CJS first, then launch from dist/.
echo "Building main process..."
npm run build:main

# ── Launch dev environment ───────────────────────────────────────────────────
npx concurrently \
  --names "vite,electron" \
  --prefix-colors "cyan,green" \
  "npx vite --config vite.config.ts" \
  "sleep 3 && npx electron ."
