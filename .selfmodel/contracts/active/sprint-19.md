# Sprint 19: Remove Dead Code + Analytics Stubs

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-19: <what>`。

## Objective
Remove Anthropic-specific dead code: nativeInstaller system, Datadog analytics, and autoUpdater GCS logic. Scope is limited to SAFE removals that won't break 100+ import sites.

## Assigned To
opus

## Deliverables
- [ ] Remove nativeInstaller directory and stub its import sites
- [ ] Stub Datadog analytics to no-op
- [ ] Stub autoUpdater GCS functions
- [ ] Verify build passes after each removal

## Acceptance Criteria

### 1. NativeInstaller Removal (Priority 1)
The native installer handles Anthropic's binary distribution — not needed for Vibe Sensei.

**Delete the directory:**
- `src/utils/nativeInstaller/` (index.ts, installer.ts, download.ts, packageManagers.ts, pidLock.ts)

**Stub the 13 import sites** — find all files that import from `nativeInstaller` and fix them:
- `src/components/NativeAutoUpdater.tsx` — make component return `null` early, remove nativeInstaller import
- `src/components/AutoUpdater.tsx` — remove nativeInstaller references, keep non-native update logic
- `src/components/PackageManagerAutoUpdater.tsx` — keep as-is if it doesn't use nativeInstaller directly
- `src/utils/status.tsx` — remove native installer status checks
- `src/utils/backgroundHousekeeping.ts` — remove native installer cleanup logic
- `src/utils/cleanup.ts` — remove native installer cleanup
- `src/utils/doctorDiagnostic.ts` — remove native installer diagnostics
- Any CLI update commands — stub native update paths

**Strategy:** For each import site:
1. Remove the import statement
2. If the import was used in a conditional (`if (isNativeInstall)`), remove the entire conditional branch
3. If the import was the ONLY thing the file did, make the file export no-ops
4. Do NOT delete the importing files — just remove the native-specific code paths

### 2. Datadog Analytics Stub (Priority 2)
**File:** `src/services/analytics/datadog.ts` (307 lines)

Replace the entire file with a no-op stub:
```typescript
// Datadog analytics stub — disabled for Vibe Sensei
export function trackDatadogEvent(): void {}
export function flushDatadog(): Promise<void> { return Promise.resolve() }
```

Keep the same export names so `src/services/analytics/sink.ts` doesn't break.

### 3. AutoUpdater GCS Stub (Priority 3)
**File:** `src/utils/autoUpdater.ts` (564 lines)

The version check is already disabled (early `return` on line 72). Additionally stub the GCS-specific functions:
- `getLatestVersionFromGcs()` → return `null`
- `getGcsDistTags()` → return `{ latest: null, stable: null }`
- `getVersionHistory()` → return `[]`

Keep the rest of autoUpdater intact (npm/bun version checking structure).

### 4. Build Verification
After EACH removal step:
1. Run `bun run build`
2. If build fails, fix the broken imports before proceeding
3. Commit atomically: one commit per removal category

### 5. Commit Strategy
Three atomic commits:
1. `sprint-19: remove nativeInstaller and stub import sites`
2. `sprint-19: stub Datadog analytics to no-op`
3. `sprint-19: stub autoUpdater GCS functions`

## Context Files (READ THESE FIRST)
- `src/utils/nativeInstaller/index.ts` — Entry point, see what it exports
- `src/utils/nativeInstaller/installer.ts` — Main installer logic
- `src/services/analytics/datadog.ts` — Datadog event tracking
- `src/services/analytics/sink.ts` — Analytics router (imports Datadog)
- `src/utils/autoUpdater.ts` — Auto-update with GCS logic
- `src/components/NativeAutoUpdater.tsx` — UI component using installer
- `src/components/AutoUpdater.tsx` — Update UI

## What NOT to Remove
- `src/services/analytics/index.ts` — 239 callers, core event system
- `src/services/analytics/growthbook.ts` — 124 callers, too entangled
- `src/utils/telemetry/` — 26 callers, core logging
- `packages/@ant/` — real MCP packages, not stubs
- `src/services/analytics/sink.ts` — keep but stub Datadog call

## Constraints
- Max execution time: 180s
- Build must pass after EACH removal step
- Do NOT break existing functionality — stub, don't delete import sites
- If a removal breaks >5 files, abort that removal and stub instead
- Commit atomically per removal category

当前状态: **ACTIVE**
