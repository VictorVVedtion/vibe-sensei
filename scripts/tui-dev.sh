#!/usr/bin/env bash
# scripts/tui-dev.sh — Build and launch Rust TUI + Node.js backend
#
# Usage: bash scripts/tui-dev.sh
#
# Steps:
#   1. cargo build --release crates/vibe-tui
#   2. Start bun backend (--tui-backend) in background
#   3. Wait for socket file to appear (poll 100ms, timeout 10s)
#   4. Launch Rust binary with VIBE_SENSEI_SOCK env
#   5. On Rust exit or SIGINT: kill backend, cleanup

set -euo pipefail

# ── Resolve project root (parent of scripts/) ─────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { printf "${CYAN}[tui-dev]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[tui-dev]${NC} %s\n" "$1"; }
err()  { printf "${RED}[tui-dev]${NC} %s\n" "$1" >&2; }
ok()   { printf "${GREEN}[tui-dev]${NC} %s\n" "$1"; }

# ── State ──────────────────────────────────────────────────────────────────
BACKEND_PID=""
SOCK_PATH=""

# ── Cleanup on exit ────────────────────────────────────────────────────────
cleanup() {
  local exit_code=$?
  log "Cleaning up..."

  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    log "Stopping backend (PID $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
    # Give it 3 seconds to drain gracefully
    for _ in $(seq 1 30); do
      kill -0 "$BACKEND_PID" 2>/dev/null || break
      sleep 0.1
    done
    # Force kill if still alive
    kill -0 "$BACKEND_PID" 2>/dev/null && kill -9 "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "$SOCK_PATH" ]] && [[ -e "$SOCK_PATH" ]]; then
    rm -f "$SOCK_PATH"
    log "Removed socket: $SOCK_PATH"
  fi

  if [[ $exit_code -eq 0 ]]; then
    ok "Done."
  else
    err "Exited with code $exit_code"
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# ── Step 1: Build Rust binary ──────────────────────────────────────────────
log "Building Rust TUI (cargo build --release)..."
if ! cargo build --release -p vibe-tui; then
  err "Cargo build failed. Is Rust installed? Try: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi

RUST_BIN="$PROJECT_ROOT/target/release/vibe-tui"
if [[ ! -x "$RUST_BIN" ]]; then
  err "Rust binary not found at $RUST_BIN"
  exit 1
fi
ok "Rust binary built: $RUST_BIN"

# ── Step 2: Determine socket path & start backend ─────────────────────────
# Pre-create a deterministic socket path so we can pass it to both processes
SOCK_PATH="/tmp/vibe-sensei-tui-dev-$$.sock"

# Remove stale socket if it exists
rm -f "$SOCK_PATH"

log "Starting Node.js backend (VIBE_SENSEI_SOCK=$SOCK_PATH)..."
VIBE_SENSEI_SOCK="$SOCK_PATH" bun run tui:backend &
BACKEND_PID=$!

# Verify backend started
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  err "Backend failed to start"
  exit 1
fi
log "Backend started (PID $BACKEND_PID)"

# ── Step 3: Wait for socket file ──────────────────────────────────────────
log "Waiting for socket file..."
WAITED=0
TIMEOUT_MS=10000
POLL_MS=100

while [[ ! -S "$SOCK_PATH" ]]; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    err "Backend process died before creating socket"
    exit 1
  fi

  if (( WAITED >= TIMEOUT_MS )); then
    err "Timeout: socket file did not appear within ${TIMEOUT_MS}ms"
    exit 1
  fi

  sleep 0.1
  WAITED=$((WAITED + POLL_MS))
done

ok "Socket ready: $SOCK_PATH (${WAITED}ms)"

# ── Step 4: Launch Rust TUI ───────────────────────────────────────────────
log "Launching Rust TUI..."
VIBE_SENSEI_SOCK="$SOCK_PATH" "$RUST_BIN"
RUST_EXIT=$?

if [[ $RUST_EXIT -ne 0 ]]; then
  warn "Rust TUI exited with code $RUST_EXIT"
fi

# Cleanup runs via trap EXIT
exit $RUST_EXIT
