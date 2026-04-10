#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${DESKTOP_DIR}/.." && pwd)"

PLATFORM="${1:-}"

if [[ -z "${PLATFORM}" ]]; then
  echo "Usage: build.sh <mac|win|linux>"
  echo "  mac   — DMG + zip for macOS"
  echo "  win   — NSIS installer + portable for Windows"
  echo "  linux — AppImage + deb for Linux"
  exit 1
fi

case "${PLATFORM}" in
  mac|win|linux) ;;
  *)
    echo "Error: unknown platform '${PLATFORM}'"
    echo "Valid options: mac, win, linux"
    exit 1
    ;;
esac

# ── Step 1/5: Build CLI bundle ───────────────────────────────────────────────
echo "==> Step 1/5: Building CLI bundle..."
cd "${PROJECT_ROOT}"

if ! command -v bun &>/dev/null; then
  echo "Error: bun is not installed. Install from https://bun.sh"
  exit 1
fi

bun run build

# Copy CLI bundle to desktop resources
mkdir -p "${DESKTOP_DIR}/resources/bun-cli"
cp "${PROJECT_ROOT}/dist/cli.js" "${DESKTOP_DIR}/resources/bun-cli/cli.js"
echo "  CLI bundle copied to desktop/resources/bun-cli/"

# ── Step 2/5: Install desktop dependencies ───────────────────────────────────
echo "==> Step 2/5: Installing desktop dependencies..."
cd "${DESKTOP_DIR}"
npm install

# ── Step 3/5: Build main process ─────────────────────────────────────────────
echo "==> Step 3/5: Building main process..."
cd "${DESKTOP_DIR}"
npx esbuild main/index.ts --bundle --platform=node \
  --external:electron --external:electron-store \
  --outdir=dist/main --format=cjs
npx esbuild main/preload.ts --bundle --platform=node \
  --external:electron \
  --outdir=dist/main --format=cjs
echo "  Main process compiled to desktop/dist/main/"

# ── Step 4/5: Build renderer ─────────────────────────────────────────────────
echo "==> Step 4/5: Building renderer..."
npx vite build --config vite.config.ts

# ── Step 5/5: Package with electron-builder ──────────────────────────────────
echo "==> Step 5/5: Packaging for ${PLATFORM}..."

BUILDER_FLAG=""
case "${PLATFORM}" in
  mac)   BUILDER_FLAG="--mac"   ;;
  win)   BUILDER_FLAG="--win"   ;;
  linux) BUILDER_FLAG="--linux" ;;
esac

npx electron-builder ${BUILDER_FLAG} --config electron-builder.yml

echo ""
echo "Build complete! Output in desktop/release/"
