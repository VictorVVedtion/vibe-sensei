# Sprint 27: Bundle Size Optimization

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-27: <what>`。

## Objective
Reduce the bundle size from ~37MB toward <25MB by removing unused dependencies and converting heavy optional imports to dynamic imports.

## Assigned To
opus

## Deliverables
- [ ] package.json — Remove unused dependencies
- [ ] src/entrypoints/cli.tsx — Audit static imports, convert heavy ones to dynamic
- [ ] src/main.tsx — Lazy-load optional heavy modules
- [ ] Any files that statically import heavy optional deps → convert to dynamic

## Acceptance Criteria

### 1. Remove Unused Dependencies from package.json

Audit and remove packages that are NOT actually imported anywhere in the source code or are behind dead `feature()` gates. Candidates to investigate:

- `@growthbook/growthbook` — was used for feature flags, may have been cleaned in Sprint 19
- `@azure/identity` — check if any Azure auth code exists
- `audio-capture-napi` — check if voice mode is dead code behind feature()
- `plist` — check if Apple plist parsing is used
- `qrcode` — check if QR code generation is used
- `asciichart` — check if chart rendering is used
- `turndown` — check if HTML→markdown conversion is used
- `cli-highlight` — check if syntax highlighting is used
- Any OpenTelemetry exporter packages that have zero imports

**Process for each candidate:**
1. `grep -r "package-name" src/` to find actual usage
2. If behind `feature()` gate (which always returns false), the import is dead code
3. If genuinely unused, remove from package.json
4. Run `bun run build` after each batch removal to verify nothing breaks

### 2. Convert Heavy Optional Imports to Dynamic

For packages that ARE used but only conditionally (e.g., only when specific flags are passed), convert static `import` to dynamic `await import()`:

- CCXT (`ccxt`) — Only needed when trading tools are invoked. If it's statically imported at the top of ccxt-client.ts, keep it there (it's the trading core). But check if any TOP-LEVEL entry point files pull it in statically.
- AWS SDK packages — Only needed for Bedrock provider. Check if they can be lazy-loaded.
- `sharp` — Only needed for image processing. Should be dynamically imported.
- OpenTelemetry stack — Only needed when telemetry is enabled. Check how it's loaded.

### 3. Verify No Regressions

After all changes:
- `bun install` succeeds (lockfile updates)
- `bun run build` produces a bundle
- Bundle size is reported (check `dist/cli.js` size)
- The REPL can start: `timeout 5 bun run dev 2>&1 || true` (just check it doesn't crash immediately)

### 4. Target
- Bundle size < 30MB is acceptable
- Bundle size < 25MB is excellent
- Do NOT sacrifice core functionality for size reduction

## Context Files (READ THESE FIRST)
- `package.json` — Full dependency list (120+ deps at lines 18-122). Key suspects: OpenTelemetry (12 packages), AWS SDK (5 packages), @azure, @growthbook, audio-capture-napi, sharp, plist, qrcode
- `src/entrypoints/cli.tsx` — Entry point with feature() macro and BUILD_TARGET guards
- `src/main.tsx` — CLI setup, imports many services. Check which imports pull in heavy deps transitively
- `tsconfig.json` — Build configuration

## Constraints
- Max execution time: 180s
- Do NOT remove any dependency that is actively imported and used at runtime
- Do NOT break `bun run build`
- Do NOT modify trading logic, guardian system, or UI components
- Prefer removing deps over converting to dynamic imports (removing is simpler and more effective)
- Run `bun install` after modifying package.json to update lockfile
- Atomic commits: `sprint-27: <what>`

当前状态: **ACTIVE**
