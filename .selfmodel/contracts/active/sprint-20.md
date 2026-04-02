# Sprint 20: Package.json Cleanup

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-20: <what>`。

## Objective
Clean up package.json: update metadata for Vibe Sensei, remove clearly unused dependencies, verify install + build.

## Assigned To
codex

## Deliverables
- [ ] package.json — Updated metadata + dependency cleanup

## Acceptance Criteria

### 1. Update Metadata
- `name`: should be `vibe-sensei` (verify)
- `description`: "AI trading terminal with 52 master guardians"
- `author`: keep existing or update if set to Anthropic
- `homepage`: update if pointing to Anthropic
- `repository`: update if pointing to Anthropic
- Remove any `bugs` URL pointing to Anthropic

### 2. Dependency Audit
**Strategy:** Conservative removal only. If in doubt, KEEP IT.

Check these categories:
- `@anthropic-ai/*` — keep `@anthropic-ai/sdk` (needed for API), review others
- `@sentry/*` — if Sentry was already removed, these deps can go
- `growthbook` / `@growthbook/*` — if no growthbook imports remain in src/, can remove
- `statsig-*` — check if used
- `datadog-*` / `dd-trace` — Datadog was stubbed, check if SDK still imported

**Before removing any dep:**
1. Search for imports of that package in `src/` (not in node_modules or worktrees)
2. If ANY file imports it, KEEP IT — even if it's a stub, the import needs the package
3. Only remove if zero imports found

### 3. Verify After Changes
```bash
rm -rf node_modules bun.lockb
bun install
bun run build
```
All three must succeed.

### 4. Do NOT Touch
- `dependencies` that are clearly used (anthropic SDK, ccxt, express, ink, react, commander, zod, etc.)
- `devDependencies` like typescript, @types/*
- `workspaces` configuration
- `scripts` section
- Any dependency you're not 100% sure is unused

## Context Files
- `package.json` — The target file
- `src/services/analytics/datadog.ts` — Stubbed (check if it still imports `axios`)
- `src/services/analytics/growthbook.ts` — Check if it imports growthbook SDK

## Constraints
- Max execution time: 120s
- Only modify `package.json`
- Conservative: when in doubt, keep the dependency
- Must pass `bun install && bun run build` after changes

当前状态: **ACTIVE**
