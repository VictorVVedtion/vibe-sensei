# Sprint 74: Matrix Green Theme + Logo/Guardian Separation

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-74: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Two major changes:
1. Fix Logo vs Guardian confusion — Logo is the fixed brand identity (Cthulhu octopus), Guardian is the user's assigned trading master. They are SEPARATE.
2. Change the entire color system from cyan to MATRIX GREEN (phosphor green on dark green-black).

## Assigned To
opus

## Deliverables

### Part A: Logo / Guardian Separation

#### Fix A1: Restore Logo as Pure Brand Identity
**File:** `src/components/LogoV2/Clawd.tsx`

The Clawd octopus is the PRODUCT LOGO — it should NOT display guardian info. It's the Vibe Sensei mascot, like Twitter's bird or GitHub's octocat.

Restore the octopus as a pure visual logo. Remove the guardian name/rarity/balance props that Sprint 73 added. The logo should show:
- The octopus ASCII art (the deep-sea Cthulhu design)
- "V I B E  S E N S E I" branding
- Version number
- Nothing else — no guardian, no balance

#### Fix A2: Guardian Info Displayed Separately Below Logo
**File:** `src/components/LogoV2/LogoV2.tsx`

After the logo, display the guardian info as a separate section:
```
[*] Guardian: William O'Neil (Common *)
    "Cut losses short, let profits run."
[$] Paper: 100,000.00 USDT
```

This should be clearly separated from the logo — different visual block, below the octopus art. The guardian is the user's personal trading master, not part of the brand identity.

### Part B: Matrix Green Color System

Apply this Gemini-designed palette EVERYWHERE:

| Token | Hex | Usage |
|-------|-----|-------|
| PRIMARY | `#00FF41` | Main accent, active states, UI elements, cursor |
| BACKGROUND | `#0D1117` | Main background (dark with slight green tint) |
| UP/PROFIT | `#20C20E` | Candlestick up, profit PnL |
| DOWN/LOSS | `#FF003C` | Candlestick down, loss PnL |
| DIM/MUTED | `#008F11` | Secondary text, timestamps, labels |
| BORDER | `#002B0E` | Panel borders, dividers, separators |
| WARNING | `#FFEA00` | Warnings, caution states |
| CRITICAL | `#FF003C` | Emergencies, same as loss |
| SELECTION | `#004D1A` | Selection background, hover |
| FOREGROUND | `#00FF41` | Default text color (Matrix green) |

#### Fix B1: CLI Terminal Colors
**File:** `src/screens/REPL.tsx` or wherever terminal colors are configured

If there are any hardcoded cyan (#00D4FF) references in the REPL rendering, change them to #00FF41.

#### Fix B2: Welcome Banner Colors  
**File:** `src/components/LogoV2/Clawd.tsx`, `LogoV2.tsx`

The logo and guardian info text should render in Matrix green, not cyan.

#### Fix B3: Desktop Theme — Complete Overhaul
**Files:** `desktop/renderer/styles/theme.css`, `desktop/renderer/styles/layout.css`

Replace ALL color values:
- `#00D4FF` (cyan accent) → `#00FF41` (Matrix green)
- `#00FFA3` (abyss-up) → `#20C20E` (Matrix profit green)
- `#C850C0` (magenta down) → `#FF003C` (neon crimson)
- `#0A1628` (navy background) → `#0D1117` (dark green-black)
- `#0F1924` (secondary bg) → `#0A0F0A` (darker green-black)
- `#182233` (tertiary bg) → `#0D150D` (card bg)
- `#253550` (border) → `#002B0E` (dark green border)
- `#7B8AA0` (muted text) → `#008F11` (muted green)
- `#E2E4ED` (foreground text) → `#00FF41` (Matrix green foreground)

#### Fix B4: Desktop Chart Colors
**File:** `desktop/renderer/components/ChartPanel.tsx`

Update Lightweight Charts config:
- Layout background: `#0D1117`
- Text color: `#00FF41`
- Grid lines: `rgba(0, 43, 14, 0.4)` (dark green)
- Crosshair: `#002B0E`
- Candlestick up: `#20C20E` (fill, border, wick)
- Candlestick down: `#FF003C` (fill, border, wick)
- Volume up: `rgba(32, 194, 14, 0.35)`
- Volume down: `rgba(255, 0, 60, 0.35)`

#### Fix B5: Desktop xterm.js Theme
**File:** `desktop/renderer/components/TerminalPanel.tsx`

Replace the xterm theme with the Matrix palette:
```typescript
theme: {
  background: '#0D1117',
  foreground: '#00FF41',
  cursor: '#00FF41',
  cursorAccent: '#0D1117',
  selectionBackground: '#004D1A',
  black: '#0D1117',
  red: '#FF003C',
  green: '#20C20E',
  yellow: '#FFEA00',
  blue: '#005F8F',
  magenta: '#8F008F',
  cyan: '#008F8F',
  white: '#008F11',
  brightBlack: '#002B0E',
  brightRed: '#FF003C',
  brightGreen: '#00FF41',
  brightYellow: '#FFEA00',
  brightBlue: '#00B3FF',
  brightMagenta: '#D900FF',
  brightCyan: '#00FFFF',
  brightWhite: '#B2FFC8',
}
```

#### Fix B6: Desktop Component Colors
**Files:** All files in `desktop/renderer/components/` and `desktop/renderer/components/guardian/`

Search-and-replace all remaining color references:
- StatusBar, MasterCard, RiskGauge, PositionsList, BalanceDisplay, AlertFeed, OhlcBar, ChartControls, TitleBar
- Every `#00D4FF` → `#00FF41`
- Every `#00FFA3` → `#20C20E`
- Every `#C850C0` → `#FF003C`
- Every `#0A1628` → `#0D1117`
- Every `#0F1924` → `#0A0F0A`
- Every `#253550` → `#002B0E`
- Every `#7B8AA0` → `#008F11`
- Every `#E2E4ED` → `#00FF41`

#### Fix B7: DESIGN.md Update
**File:** `DESIGN.md`

Update the design system document to reflect the new Matrix green palette. Replace all color definitions with the new values.

## Verification
1. `bun run build` succeeds
2. `bun run dev` shows Matrix green text, not cyan
3. Desktop app: `cd desktop && npm run build:main && npx vite build` succeeds
4. Desktop renders with green-on-black Matrix aesthetic
5. Logo is separate from guardian info
6. No cyan (#00D4FF) remains anywhere in CSS or component styles

## Timeout
300 minutes
