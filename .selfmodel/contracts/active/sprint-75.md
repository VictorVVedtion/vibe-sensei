# Sprint 75: Desktop Visual Polish — Chart + Sidebar + Detail Fixes

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-75: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Fix all visual detail issues in the Desktop Electron app. The Matrix green color system is correct — this sprint is about component-level polish.

## Assigned To
opus

## Deliverables

### Fix 1: Chart — Reduce Candle Density
**File:** `desktop/renderer/components/ChartPanel.tsx`

Currently loads 30 days of 1H data = ~720 candles. Way too dense.

**Fix:** Adjust the history range based on the selected timeframe:
```typescript
const TIMEFRAME_RANGES: Record<string, number> = {
  '1': 4 * 60 * 60,        // 1m: 4 hours = 240 candles
  '5': 12 * 60 * 60,       // 5m: 12 hours = 144 candles
  '15': 2 * 24 * 60 * 60,  // 15m: 2 days = 192 candles
  '60': 7 * 24 * 60 * 60,  // 1H: 7 days = 168 candles
  '240': 30 * 24 * 60 * 60, // 4H: 30 days = 180 candles
  '1D': 180 * 24 * 60 * 60, // 1D: 180 days = 180 candles
};
```
Replace the hardcoded `thirtyDaysAgo` with the appropriate range for the current resolution.

### Fix 2: Chart — Hollow Green / Solid Red Candles
**File:** `desktop/renderer/components/ChartPanel.tsx`

Per DESIGN.md and Gemini's spec:
- **Bullish (up)**: Hollow candles — transparent fill, green border + wick
- **Bearish (down)**: Solid candles — red fill, red border + wick

Update the candlestick series config:
```typescript
{
  upColor: 'transparent',        // Hollow green
  downColor: '#FF003C',          // Solid red
  borderUpColor: '#00FF41',      // Green border
  borderDownColor: '#FF003C',    // Red border
  wickUpColor: '#00FF41',        // Green wick
  wickDownColor: '#FF003C',      // Red wick
}
```

### Fix 3: Risk Gauge — ASCII Blocks
**File:** `desktop/renderer/components/guardian/RiskGauge.tsx`

Replace the CSS gradient gauge with monospace ASCII blocks. This was done in Sprint 71 but lost in the merge.

Rewrite the component to render:
```
RISK  ████████░░░░░░░░░░░░  42 MODERATE
```

- 20 blocks total
- Filled blocks: `█` (U+2588)
- Empty blocks: `░` (U+2591)
- Color by range: 0-20 green `#00FF41`, 21-50 yellow `#FFEA00`, 51-75 orange, 76-100 red `#FF003C`
- Use monospace font, no CSS gradient, no diamond indicator
- Single line, inline layout

### Fix 4: MasterCard — Compact Stats
**File:** `desktop/renderer/components/guardian/MasterCard.tsx`

Replace the colored stat bars with compact inline text:

Before (full bars):
```
PREC ▓▓▓░░ 8
PATI ▓░░░░ 1
AGGR ▓▓▓▓░ 38
WISD ▓▓▓▓▓ 64
SASS ▓░░░░ 5
```

After (one-line compact):
```
Vane                    TREND FOLLOWER
"A zen-coded oracle..." (truncated 60 chars)
PREC:8 PATI:1 AGGR:38 WISD:64 SASS:5
```

- Name + archetype on first line
- Quote truncated to 60 chars on second line
- Stats as inline `KEY:VALUE` pairs on third line
- Total card height: ~60-70px max (was ~180px)
- Remove the colored stat bar divs entirely

### Fix 5: Remove All CSS Transitions (re-apply Sprint 71)
**Files:** `desktop/renderer/styles/layout.css`, `desktop/renderer/styles/theme.css`

Remove all `transition` properties. This was done in Sprint 71 but lost.

Search for `transition:` and `transition-` in both CSS files and remove them. Hover/focus state changes should be instant (0ms).

### Fix 6: Chart Grid Lines — Subtler
**File:** `desktop/renderer/components/ChartPanel.tsx`

The grid lines should be very subtle dark green, not visible gray:
```typescript
grid: {
  vertLines: { color: 'rgba(0, 43, 14, 0.3)' },  // Very subtle
  horzLines: { color: 'rgba(0, 43, 14, 0.3)' },
}
```

### Fix 7: Volume Bars — Lower Opacity
**File:** `desktop/renderer/components/ChartPanel.tsx`

Volume bars should be more subtle so they don't compete with candles:
```typescript
// Volume up
color: 'rgba(0, 255, 65, 0.15)',  // Was 0.35
// Volume down  
color: 'rgba(255, 0, 60, 0.15)',  // Was 0.35
```

## Verification
1. `cd desktop && npm run build:main && npx vite build` succeeds
2. Launch desktop — chart shows ~170 candles for 1H (not 720)
3. Bullish candles are hollow green, bearish are solid red
4. Risk gauge shows ASCII blocks, not gradient
5. MasterCard is 3 lines compact, no colored bars
6. No CSS transitions remain
7. Grid lines are barely visible dark green

### Fix 8: Kill ALL Remaining border-radius
**Files:** `desktop/renderer/styles/theme.css`, `desktop/renderer/styles/layout.css`

Found 6 remaining border-radius values that weren't caught:
- theme.css:51 `border-radius: 4px` (symbol-select)
- theme.css:79 `border-radius: 4px` (tf-btn)
- theme.css:129 `border-radius: 8px` (error-overlay)
- layout.css:71 `border-radius: 2px` 
- layout.css:230 `border-radius: 50%` (connection-dot — keep this one, dots should be round)
- layout.css:258 `border-radius: 3px` (mode-badge)

Set ALL to `0` EXCEPT the connection-dot (dots are naturally round).

### Fix 9: Kill ALL Remaining box-shadow
**Files:** `desktop/renderer/styles/theme.css`, `desktop/renderer/styles/layout.css`

Found 4 remaining box-shadow values:
- theme.css:65 `box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.25)` — OLD CYAN color! Change to green
- layout.css:37 `box-shadow: inset 0 0 0 2px rgba(0, 255, 65, 0.6)` — replace with `outline`
- layout.css:42 same
- layout.css:236 `box-shadow: 0 0 4px rgba(0, 229, 160, 0.4)` — OLD GREEN, update

Replace ALL box-shadow with `outline: 1px solid #00FF41` for focus states. Remove decorative shadows entirely.

### Fix 10: Kill ALL CSS Transitions
**Files:** `desktop/renderer/styles/theme.css`, `desktop/renderer/styles/layout.css`

Found 5 remaining transitions:
- theme.css:84 `transition: background 0.15s, border-color 0.15s`
- theme.css:106 `transition: opacity 0.2s`
- layout.css:33 `transition: box-shadow 0.2s ease`
- layout.css:90 `transition: background 0.15s ease`
- layout.css:186 `transition: background 0.1s, color 0.1s`

Remove ALL. Zero transitions. Instant state changes.

### Fix 11: Chart Grid Lines Too Visible
**File:** `desktop/renderer/components/ChartPanel.tsx`

Current grid colors `#0D150D` are too dark/invisible OR too bright. Set to:
```typescript
vertLines: { color: 'rgba(0, 143, 17, 0.08)' },  // Very faint green grid
horzLines: { color: 'rgba(0, 143, 17, 0.08)' },
```

## Timeout
180 minutes
