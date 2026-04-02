# Sprint 40: Accessibility + Test Infrastructure

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-40: <what>`。

## Objective
Add accessibility (keyboard nav, ARIA labels, colorblind indicators) and basic test infrastructure to the desktop app.

## Assigned To
codex

## Deliverables
- [ ] desktop/renderer/components/Layout.tsx — Add tabindex for Tab navigation
- [ ] desktop/renderer/components/guardian/RiskGauge.tsx — Add ARIA progressbar role
- [ ] desktop/renderer/components/guardian/AlertFeed.tsx — Add ARIA log role
- [ ] desktop/renderer/components/guardian/PositionsList.tsx — Add ARIA labels + colorblind indicators
- [ ] desktop/renderer/components/guardian/BalanceDisplay.tsx — Add colorblind indicators
- [ ] desktop/renderer/styles/layout.css — Improve focus ring visibility
- [ ] desktop/vitest.config.ts — Test configuration
- [ ] desktop/package.json — Add vitest + test script
- [ ] desktop/main/__tests__/pty-manager.test.ts — Basic PTY manager tests

## Acceptance Criteria

### 1. Tab Navigation
In `Layout.tsx`, add `tabIndex={0}` to each panel container div. Add `onFocus` handler that sets the focused panel state. Users should be able to Tab between panels.

### 2. ARIA Roles
- RiskGauge: `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label`
- AlertFeed container: `role="log"` with `aria-live="polite"`
- PositionsList rows: `aria-label` describing the position (e.g. "BTC/USDT long 0.15 units, profit $130")

### 3. Colorblind Indicators
- PositionsList: Add `▲` prefix for profit, `▼` for loss before PnL values
- BalanceDisplay: Add `+` / `-` text indicators alongside color

### 4. Focus Ring
In `layout.css`, change `.panel.focused` style from:
```css
box-shadow: inset 0 0 0 1px rgba(0, 255, 136, 0.35);
```
To:
```css
box-shadow: inset 0 0 0 2px rgba(0, 255, 136, 0.6);
```

### 5. Test Infrastructure
**`desktop/vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
```

**`desktop/package.json`:** Add vitest + test script:
```json
"devDependencies": {
  "vitest": "^3.0.0"
},
"scripts": {
  "test": "vitest run"
}
```

**`desktop/main/__tests__/pty-manager.test.ts`:** Basic tests:
- Test resize bounds validation (cols/rows must be 1-500/1-200)
- Test isAlive() returns false before spawn
- Test clearCallbacks() nulls all callbacks

Note: Can't test actual PTY spawn in CI (needs terminal). Focus on pure logic tests.

### 6. Build + Test Pass
- `cd desktop && npm install` succeeds
- `cd desktop && npm test` passes
- `bun run build` still works

## Context Files
- `desktop/renderer/components/Layout.tsx`
- `desktop/renderer/components/guardian/RiskGauge.tsx`
- `desktop/renderer/components/guardian/AlertFeed.tsx`
- `desktop/renderer/components/guardian/PositionsList.tsx`
- `desktop/renderer/components/guardian/BalanceDisplay.tsx`
- `desktop/renderer/styles/layout.css`
- `desktop/main/pty-manager.ts`

## Constraints
- Max execution time: 240s
- Only modify files under `desktop/`
- Atomic commits: `sprint-40: <what>`

当前状态: **ACTIVE**
