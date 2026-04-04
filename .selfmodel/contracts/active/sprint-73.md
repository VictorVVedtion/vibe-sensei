# Sprint 73: Core Cleanup — Feature Gates + Dead Code + Chart Fixes

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-73: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Three cleanup tasks on the companion always-on branch.

## Assigned To
opus

## Deliverables

### Fix 1: Remove remaining feature('BUDDY') gates (6 locations)

These files still have `feature('BUDDY')` checks that need to be removed. The companion is now always-on.

1. **`src/commands.ts:119`** — `const buddy = feature('BUDDY')` and the ternary. Remove feature check, keep inner code unconditional.
2. **`src/components/PromptInput/PromptInput.tsx:312`** — `feature('BUDDY') ? getGlobalConfig() : {...}`. Remove check, always call `getGlobalConfig()`.
3. **`src/components/PromptInput/PromptInput.tsx:1789`** — `if (feature('BUDDY'))` wrapping companion focus. Remove if, keep inner code.
4. **`src/components/PromptInput/PromptInput.tsx:1984`** — `feature('BUDDY') ?` in companionSpeaking. Remove check, always execute the hook.
5. **`src/buddy/prompt.ts:18`** — `if (!feature('BUDDY')) return []`. Remove early return.
6. **`src/utils/attachments.ts:865`** — `feature('BUDDY')` in spread. Remove check, always include.

Remove any `import { feature } from 'bun:bundle'` that becomes unused after removal.

### Fix 2: Dead code cleanup in CompanionSprite.tsx

Remove ALL unused items:

**Unused imports:** useTerminalSize, stringWidth, Theme, renderSprite, spriteFrameCount, MASTER_PORTRAITS

**Unused constants:** IDLE_SEQUENCE, H, PET_HEARTS, SPRITE_BODY_WIDTH, NAME_ROW_PAD, SPRITE_PADDING_X, BUBBLE_WIDTH, NARROW_QUIP_CAP

**Check MIN_COLS_FOR_FULL_SPRITE:** exported — grep if imported elsewhere. If yes, move to the importer. If no, delete.

**Unused function:** spriteColWidth()

**Unused variable:** colWidth at line 219, columns from useTerminalSize (if nothing else uses it)

### Fix 3: Chart coordinate and timezone fixes

1. **CandlestickChart.tsx**: `colWidth = 1` → `colWidth = 2` (match render-candles.ts COL_WIDTH)
2. **render-candles.ts + CandlestickChart.tsx**: Revert getHours→getUTCHours, getMonth→getUTCMonth, getDate→getUTCDate in formatTimeLabel() and buildInfoBar()
3. **CandlestickChart.tsx buildInfoBar()**: Add ' UTC' suffix to dateStr

## Acceptance Criteria
- `grep -r "feature('BUDDY')" src/` returns 0 results
- `grep -r 'feature("BUDDY")' src/` returns 0 results
- CompanionSprite.tsx has no unused imports/constants
- Chart timestamps show UTC with suffix
- `bun run build` succeeds

## Context
Branch: feat/companion-always-on
Base commit: bafa783
