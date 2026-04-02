# Sprint 35: Build Pipeline Fix + Preload Bundling

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-35: <what>`。

## Objective
Fix production build blockers: compile main process TypeScript to JavaScript, fix electron-builder file patterns, and ensure the packaged app can actually launch.

## Assigned To
opus

## Deliverables
- [ ] desktop/scripts/build.sh — Add main process compilation step
- [ ] desktop/electron-builder.yml — Fix file patterns to reference compiled output
- [ ] desktop/main/index.ts — Fix preload path to reference compiled .js file
- [ ] desktop/package.json — Add esbuild dependency and main process build script

## Acceptance Criteria

### 1. Main Process Compilation

The problem: `desktop/main/*.ts` files are raw TypeScript. Electron can only load JavaScript in production. The preload script at `desktop/main/preload.ts` is referenced as `.ts` in index.ts line 106.

Add an esbuild step to compile all main process files:

**Add to `desktop/package.json` devDependencies:**
```json
"esbuild": "^0.24.0"
```

**Add script to `desktop/package.json`:**
```json
"build:main": "esbuild main/index.ts main/preload.ts --bundle --platform=node --external:electron --external:electron-store --external:node-pty --outdir=dist/main --format=cjs"
```

Note: `node-pty` and `electron-store` must be external (native modules that can't be bundled).

### 2. Update build.sh

Add Step 3 (renumber existing steps):

```bash
# ── Step 3/5: Build main process ────────────────────────────────────────────
echo "==> Step 3/5: Building main process..."
cd "${DESKTOP_DIR}"
npx esbuild main/index.ts --bundle --platform=node \
  --external:electron --external:electron-store --external:node-pty \
  --outdir=dist/main --format=cjs
npx esbuild main/preload.ts --bundle --platform=node \
  --external:electron \
  --outdir=dist/main --format=cjs
echo "  Main process compiled to desktop/dist/main/"
```

The existing Step 3 (renderer build) becomes Step 4. Packaging becomes Step 5.

### 3. Fix Preload Path in index.ts

Change line 106 from:
```typescript
preload: path.join(__dirname, 'preload.ts'),
```
To:
```typescript
preload: path.join(__dirname, '..', 'dist', 'main', 'preload.js'),
```

But in dev mode, we need the `.ts` version (Electron loads raw TS in dev). So:
```typescript
preload: isDev
  ? path.join(__dirname, 'preload.ts')
  : path.join(__dirname, '..', 'dist', 'main', 'preload.js'),
```

### 4. Fix electron-builder.yml

Change the `files` section from:
```yaml
files:
  - main/
  - shared/
  - renderer/dist/
  - node_modules/
  - package.json
```
To:
```yaml
files:
  - dist/main/
  - dist/renderer/
  - node_modules/
  - package.json
```

The raw `main/` and `shared/` source files should NOT be in the packaged app. Only compiled output goes in.

### 5. Fix package.json main entry

The `"main"` field in desktop/package.json currently points to `main/index.ts`. For production:
```json
"main": "dist/main/index.js"
```

But for dev mode (where Electron loads TS directly), we need it to point to `main/index.ts`. Use a conditional or change the dev script to pass the entry explicitly:
```bash
# dev.sh: explicitly pass the entry
npx electron main/index.ts
```

And set `"main": "dist/main/index.js"` for production.

### 6. Verify

After changes:
- `cd desktop && npm install` succeeds (esbuild installed)
- `npm run build:main` compiles to `dist/main/index.js` + `dist/main/preload.js`
- `npx vite build` still works for renderer
- The build.sh script runs all steps without error (don't run electron-builder itself)

## Context Files (READ THESE FIRST)
- `desktop/scripts/build.sh` — Current 4-step pipeline. Missing main process compilation.
- `desktop/electron-builder.yml` — File patterns point to source `main/` not `dist/main/`.
- `desktop/main/index.ts` — Line 106: preload path is `.ts`.
- `desktop/vite.config.ts` — Only builds renderer, not main process.
- `desktop/package.json` — No esbuild, main entry is `.ts`.
- `desktop/scripts/dev.sh` — Dev mode script.

## Constraints
- Max execution time: 180s
- Do NOT run electron-builder (it requires native compilation)
- Do NOT modify any files outside `desktop/`
- Verify with `npm run build:main` that TypeScript compiles
- Atomic commits: `sprint-35: <what>`

当前状态: **ACTIVE**
