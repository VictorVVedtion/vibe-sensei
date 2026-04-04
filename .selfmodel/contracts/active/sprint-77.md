# Sprint 77: Interactive Terminal Candlestick Chart — Mouse Support

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-77: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Upgrade the terminal CandlestickChart component from static rendering to interactive with mouse support. The infrastructure already exists (SGR mouse protocol, hit-test, useInput) — we just need to wire it into the chart component.

## Assigned To
opus

## Background

### What already exists:
- **CandlestickChart component**: `src/components/CandlestickChart/CandlestickChart.tsx` (90 lines) + `render-candles.ts` (440 lines)
- **Full SGR mouse protocol**: `src/ink/parse-keypress.ts` — supports 1000/1002/1003/1006 modes (button, drag, motion, SGR format)
- **Hit testing**: `src/ink/hit-test.ts` — recursive DOM tree traversal, click-to-focus
- **useInput hook**: `src/ink/hooks/use-input.ts` — fires callbacks on key/mouse events
- **Mouse tracking toggle**: `src/ink/termio/dec.ts` — ENABLE_MOUSE_TRACKING / DISABLE_MOUSE_TRACKING
- **AlternateScreen**: `src/ink/components/AlternateScreen.tsx` — toggles mouse on mount
- **Terminal size**: `useTerminalSize()` hook for responsive layout
- **Damage-tracking renderer**: `src/ink/output.ts` — cell-level diffing for efficient updates

### Current chart limitations:
- Static render only — no mouse interaction
- No crosshair on hover
- No zoom/pan
- No OHLC tooltip on hover
- Redraws entire chart on every render

## Deliverables

### Feature 1: Crosshair on Mouse Hover
**Files:** `src/components/CandlestickChart/CandlestickChart.tsx`

When mouse hovers over the chart area:
- Show a vertical dashed line (│) at the mouse column
- Show a horizontal dashed line (─) at the mouse row
- At the intersection, show the price value
- In a tooltip line below the chart, show: `O: {open} H: {high} L: {low} C: {close} V: {vol}` for the candle under the cursor

Implementation:
- Use `useInput` hook to capture mouse events
- Track `hoverCol` and `hoverRow` state
- In the render function, overlay crosshair characters on top of the existing chart grid
- Use `onMouseMove` events (SGR mode 1003) for smooth tracking

### Feature 2: Scroll Wheel Zoom
**Files:** `src/components/CandlestickChart/CandlestickChart.tsx`

Mouse wheel up/down changes the visible candle range:
- Scroll up = zoom in (show fewer candles, more detail)
- Scroll down = zoom out (show more candles, less detail)
- Minimum: 10 candles, Maximum: all available candles
- Center the zoom on the cursor position

Implementation:
- Detect wheel events from `useInput` (button codes 64=up, 65=down in SGR mouse)
- Track `visibleStart` and `visibleEnd` indices into the candles array
- On zoom, adjust the range and re-render with the visible subset

### Feature 3: Click-Drag Pan
**Files:** `src/components/CandlestickChart/CandlestickChart.tsx`

Left-click and drag to pan the chart left/right:
- Track `isDragging` state
- On drag move, shift `visibleStart`/`visibleEnd` proportionally
- Clamp to available data bounds

### Feature 4: Price Line Indicator
**Files:** `src/components/CandlestickChart/render-candles.ts`

Show the current (last) price as a highlighted horizontal dashed line across the chart:
- Use a distinct color (yellow or bright green)
- Show the price label on the right Y-axis

### Feature 5: Interactive OHLC Display
**Files:** `src/components/CandlestickChart/CandlestickChart.tsx`

Below the chart, show a live-updating info line:
```
BTC/USDT 1H | O 66870 H 67200 L 66400 C 66900 | Vol 1.2K | ▲ +0.04%
```
- Updates as mouse moves over different candles
- When not hovering, shows the last candle's data

## Technical Notes

### Mouse event detection in Ink
```typescript
// In useInput callback:
useInput((input, key, event) => {
  if (event.mouse) {
    const { x, y, button, pressed } = event.mouse
    // button 0 = left click
    // button 64 = wheel up, 65 = wheel down
    // Check if (x, y) is within chart bounds
  }
})
```

### Chart bounds
The chart renders within a known grid. Track:
- `chartLeft`, `chartTop` = top-left corner of the chart area (inside borders)
- `chartRight`, `chartBottom` = bottom-right corner
- Map pixel coordinates to candle index: `candleIndex = Math.floor((x - chartLeft) / candleWidth)`
- Map pixel coordinates to price: `price = maxPrice - (y - chartTop) * pricePerRow`

### Performance
- Use `useState` for hover position — Ink's damage tracking ensures only changed cells redraw
- Don't recompute the full chart on every mouse move — only overlay the crosshair
- Separate the crosshair layer from the base chart layer

## Verification
1. `bun run build` succeeds
2. `bun run dev` — type a chart command, hover mouse over chart, see crosshair
3. Scroll wheel zooms in/out
4. OHLC updates on hover
5. Performance: no visible lag on mouse movement

## Context
- Chart component: `src/components/CandlestickChart/CandlestickChart.tsx` (90 lines)
- Render engine: `src/components/CandlestickChart/render-candles.ts` (440 lines)
- Types: `src/components/CandlestickChart/types.ts` (49 lines)
- Mouse parsing: `src/ink/parse-keypress.ts` (500+ lines)
- Hit testing: `src/ink/hit-test.ts` (140 lines)
- Input hook: `src/ink/hooks/use-input.ts`
- ShowChart tool: `src/tools/ChartTool/ChartTool.ts` (120 lines)

## Timeout
300 minutes
