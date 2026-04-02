# Sprint 34: Build Pipeline + Distribution

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-34: <what>`。

## Objective
Create the complete build pipeline for the Electron desktop app: build scripts, electron-builder config, Bun runtime detection, and package scripts.

## Assigned To
opus

## Deliverables
- [ ] desktop/electron-builder.yml — electron-builder configuration
- [ ] desktop/scripts/build.sh — Full build pipeline script
- [ ] desktop/scripts/dev.sh — Update dev script if needed
- [ ] desktop/main/index.ts — Bun runtime detection at startup
- [ ] package.json — Add desktop:dev and desktop:build scripts
- [ ] .gitignore — Add desktop build artifacts

## Acceptance Criteria

### 1. electron-builder Configuration (`desktop/electron-builder.yml`)

```yaml
appId: com.vibesensei.desktop
productName: Vibe Sensei
copyright: Copyright 2026

directories:
  output: release
  buildResources: assets

files:
  - "main/**/*.ts"
  - "main/**/*.js"
  - "shared/**/*.ts"
  - "renderer/dist/**/*"
  - "node_modules/**/*"
  - "package.json"

extraResources:
  - from: "resources/bun-cli/"
    to: "bun-cli"
    filter:
      - "**/*"

mac:
  target:
    - dmg
    - zip
  icon: assets/icon.png
  category: public.app-category.finance
  darkModeSupport: true

win:
  target:
    - nsis
    - portable
  icon: assets/icon.png

linux:
  target:
    - AppImage
    - deb
  icon: assets/icon.png
  category: Finance

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true

dmg:
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
```

### 2. Build Script (`desktop/scripts/build.sh`)

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DESKTOP_DIR="$PROJECT_ROOT/desktop"

echo "═══ Vibe Sensei Desktop Build ═══"

# Step 1: Build Bun CLI bundle
echo "→ Building Bun CLI..."
cd "$PROJECT_ROOT"
bun run build
mkdir -p "$DESKTOP_DIR/resources/bun-cli"
cp dist/cli.js "$DESKTOP_DIR/resources/bun-cli/"

# Step 2: Install desktop dependencies
echo "→ Installing desktop dependencies..."
cd "$DESKTOP_DIR"
npm install --production=false

# Step 3: Build Vite renderer
echo "→ Building renderer..."
npx vite build --config vite.config.ts

# Step 4: Build Electron app
echo "→ Packaging Electron app..."
PLATFORM="${1:-}"
if [ "$PLATFORM" = "mac" ]; then
  npx electron-builder --mac
elif [ "$PLATFORM" = "win" ]; then
  npx electron-builder --win
elif [ "$PLATFORM" = "linux" ]; then
  npx electron-builder --linux
else
  npx electron-builder
fi

echo "═══ Build complete! ═══"
echo "Output: $DESKTOP_DIR/release/"
```

### 3. Bun Runtime Detection (`desktop/main/index.ts`)

Add a check at app startup that verifies Bun is available:

```typescript
import { execSync } from 'child_process'

function checkBunRuntime(): boolean {
  try {
    execSync('bun --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}
```

In `app.whenReady()`, before spawning PTY:
- Check if `bun` is in PATH
- If not found, show a dialog: "Bun runtime not found. Vibe Sensei requires Bun to run. Install from https://bun.sh"
- Provide an "Install Now" button that opens the URL, and a "Quit" button

### 4. Root package.json Scripts

Add to the root `package.json` scripts:
```json
"desktop:dev": "cd desktop && bash scripts/dev.sh",
"desktop:build": "cd desktop && bash scripts/build.sh"
```

### 5. .gitignore Updates

Add to the root `.gitignore`:
```
# Desktop build artifacts
desktop/release/
desktop/dist/
desktop/resources/bun-cli/
desktop/node_modules/
```

### 6. Dev Script Update (`desktop/scripts/dev.sh`)

Ensure the dev script:
- Checks for Bun
- Starts Vite dev server
- Waits for Vite to be ready
- Starts Electron

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Check Bun
if ! command -v bun &>/dev/null; then
  echo "Error: Bun not found. Install from https://bun.sh"
  exit 1
fi

# Install deps if needed
[ -d node_modules ] || npm install

# Run Vite + Electron concurrently
npx concurrently \
  --names "vite,electron" \
  --prefix "[{name}]" \
  "npx vite --config vite.config.ts" \
  "sleep 3 && npx electron ."
```

## Context Files (READ THESE FIRST)
- `desktop/package.json` — Current desktop package
- `desktop/main/index.ts` — Main process
- `desktop/main/pty-manager.ts` — PTY spawn logic
- `desktop/scripts/dev.sh` — Current dev script
- `desktop/vite.config.ts` — Vite config
- `package.json` — Root package.json
- `.gitignore` — Root gitignore

## Constraints
- Max execution time: 300s
- Do NOT actually run electron-builder (it requires native compilation)
- Verify `bun run build` still works for the CLI
- The `desktop/resources/bun-cli/` directory should be created by the build script, not committed
- Atomic commits: `sprint-34: <what>`

当前状态: **ACTIVE**
