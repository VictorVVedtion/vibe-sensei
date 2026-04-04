# Sprint 71: Desktop Design Overhaul — Gemini 3.1 Pro Review Implementation

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-71: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Implement Gemini 3.1 Pro's top design improvements for the Desktop Electron app. Focus on P0 and P1 items that transform the app from "generic Electron wrapper" to "tactical submarine control room."

## Assigned To
opus

## Deliverables — Priority Order

### Fix 1: Kill All Curves and Shadows (P0 — Highest Impact)
**Files:** `desktop/renderer/styles/layout.css`, `desktop/renderer/styles/theme.css`

Zero `border-radius` and `box-shadow` globally. This instantly transforms the aesthetic from web app to hardware terminal.

```css
/* Add to theme.css */
*, *::before, *::after {
  border-radius: 0 !important;
  box-shadow: none !important;
}
```

Remove any existing `border-radius` values in component styles (MasterCard, ChartControls buttons, error overlay, mode badge, etc.).

### Fix 2: Enforce Abyssal Palette — Cyan/Magenta Instead of Green/Red (P0)
**Files:** `desktop/renderer/styles/theme.css`, `desktop/renderer/components/ChartPanel.tsx`, `desktop/renderer/components/chart/OhlcBar.tsx`, `desktop/renderer/components/guardian/PositionsList.tsx`, `desktop/renderer/components/guardian/RiskGauge.tsx`, `desktop/renderer/components/guardian/BalanceDisplay.tsx`, `desktop/renderer/components/StatusBar.tsx`

Per DESIGN.md, the abyss palette uses:
- Up/Profit: `#00FFA3` (abyss-up, bright cyan-green) — NOT standard green `#00E5A0`
- Down/Loss: `#FF4D6A` → change to `#C850C0` (magenta/deep pink) for the abyssal feel

Update everywhere:
- Candlestick up/down colors in ChartPanel.tsx lightweight-charts config
- Volume histogram colors
- PnL display colors in PositionsList.tsx
- Status bar price up/down colors
- OHLC bar price colors
- Risk gauge gradient — adjust to use the new palette
- Always prefix PnL with `+` or `-` or `▲`/`▼` for accessibility (never color-only)

### Fix 3: Discretize Risk Gauge — ASCII Blocks (P0)
**File:** `desktop/renderer/components/guardian/RiskGauge.tsx`

Replace the smooth CSS gradient gauge with discrete block characters:

```
RISK  ████████░░░░░░░░░░░░  42 MODERATE
```

Use `█` (U+2588) for filled and `░` (U+2591) for empty. 20 blocks total = 5 per tick.
Color the blocks based on value ranges:
- 0-20: `#00FFA3` (low)
- 21-50: `#FFBB33` (moderate)  
- 51-75: `#C850C0` (high)
- 76-100: `#FF4D6A` (critical)

Remove the CSS gradient track and diamond indicator. Pure monospace text.

### Fix 4: Compact Guardian Card (P1)
**File:** `desktop/renderer/components/guardian/MasterCard.tsx`

Reduce the guardian card footprint:
- Collapse the long quote into a single truncated line (max 60 chars + `...`)
- Stat bars: make them thinner (2px height instead of current) and compress into a single row if possible
- Or: convert stats to inline text: `PREC:8 PATI:1 AGGR:38 WISD:64 SASS:5`
- Rarity stars → single character indicator: `★` for legendary, `◆` for epic, `●` for rare, `○` for uncommon, `·` for common
- Net effect: reduce card from ~180px height to ~80px

### Fix 5: Remove CSS Transitions (P1)
**Files:** `desktop/renderer/styles/layout.css`, `desktop/renderer/styles/theme.css`

Remove all `transition` properties. Hover states and focus changes should be instant (0ms). The submarine control room doesn't animate — it snaps.

Exception: keep the xterm cursor blink (it's part of terminal behavior).

### Fix 6: Tighten Spacing (P1)
**Files:** `desktop/renderer/styles/layout.css`, all component files

- Reduce panel padding from 12px to 8px
- List item padding from 10px to 6px
- Card padding from 12px to 8px
- Sidebar gap from 8px to 4px
- Status bar height stays 24px (already good)
- Chart controls padding from `8px 16px` to `4px 12px`

### Fix 7: Status Bar — Darker Background (P2)
**File:** `desktop/renderer/styles/layout.css`

Status bar background: change from `#0F1924` to `#050B14` (darker than main bg) to visually anchor it.

Use hard brackets for mode badge: `[PAPER]` instead of rounded badge.

### Fix 8: Tabular Numbers (P2)
**Files:** `desktop/renderer/styles/theme.css`

Add to root:
```css
:root {
  font-variant-numeric: tabular-nums;
}
```

This prevents price tickers from jiggling when digits change width.

### Fix 9: Step Animations (P2)
**File:** `desktop/renderer/styles/layout.css`, `desktop/renderer/components/TerminalPanel.tsx`

Change loading spinner and pulse animations from smooth to stepped:
```css
@keyframes pulse-dot {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0.4; }
}
```

Use `animation-timing-function: step-end;` for connection dot and loading indicators.

## Verification
1. `cd desktop && npm run build:main && npx vite build` succeeds
2. `VIBE_SENSEI_DESKTOP=1 VIBE_FORCE_PROD=1 npx electron dist/main/index.js` renders all panels
3. Visual check: no rounded corners, no gradients, magenta for loss, cyan-green for profit
4. Risk gauge shows ASCII blocks
5. Guardian card is compact

## Context
- Styles: `desktop/renderer/styles/theme.css`, `layout.css`
- Components: `desktop/renderer/components/` (all files)
- Chart: `desktop/renderer/components/ChartPanel.tsx`, `chart/ChartControls.tsx`, `chart/OhlcBar.tsx`
- Guardian: `desktop/renderer/components/guardian/MasterCard.tsx`, `RiskGauge.tsx`, `PositionsList.tsx`, `BalanceDisplay.tsx`, `AlertFeed.tsx`

## Timeout
240 minutes
