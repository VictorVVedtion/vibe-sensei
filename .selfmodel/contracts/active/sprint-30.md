# Sprint 30: Chart Panel Integration

## Task Preamble
你是 selfmodel 团队的 frontend colleague (Gemini)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-30: <what>`。

## Objective
Port the existing TradingView Lightweight Charts web frontend into a React component for the Electron desktop app, and add desktop mode detection to auto-start the UDF server.

## Assigned To
gemini

## Deliverables
- [ ] desktop/renderer/components/ChartPanel.tsx — TradingView chart in React
- [ ] desktop/renderer/components/chart/ChartControls.tsx — Symbol + timeframe controls
- [ ] desktop/renderer/components/chart/OhlcBar.tsx — OHLC price display
- [ ] desktop/renderer/hooks/useUdfPort.ts — Hook to get UDF port from main process
- [ ] desktop/renderer/styles/theme.css — Dark trading terminal theme
- [ ] desktop/main/preload.ts — Add UDF port IPC
- [ ] desktop/shared/ipc-channels.ts — Add UDF_PORT channel
- [ ] src/main.tsx — Desktop env detection to auto-start UDF server

## Acceptance Criteria

### 1. ChartPanel Component (`desktop/renderer/components/ChartPanel.tsx`)

Port the chart functionality from `web/app.js` (489 lines vanilla JS) into a React component:

- Use `lightweight-charts` npm package (add to desktop/package.json)
- Create chart instance in `useEffect` with a container div ref
- Candlestick series for OHLCV data
- Volume histogram overlay
- Fetch history from `http://localhost:<port>/history?symbol=...&resolution=...&from=...&to=...`
- Connect to WebSocket at `ws://localhost:<port>` for live ticker updates
- Dark theme matching Vibe Sensei brand colors (deep sea green: #0a2a1f, accent: #00ff88)
- Handle component unmount: dispose chart, close WebSocket

Reference `web/app.js` for the exact UDF API integration pattern.

### 2. Chart Controls (`desktop/renderer/components/chart/ChartControls.tsx`)

- Symbol dropdown with the popular pairs from UDF server:
  BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, etc.
- Timeframe buttons: 1m, 5m, 15m, 1H, 4H, 1D
- Active timeframe highlighted
- On change, emit `onSymbolChange` and `onResolutionChange` callbacks

### 3. OHLC Bar (`desktop/renderer/components/chart/OhlcBar.tsx`)

- Display current OHLC values when hovering chart crosshair
- Show symbol label and last price with up/down coloring
- Match the `web/app.js` OHLC bar behavior

### 4. UDF Port Hook (`desktop/renderer/hooks/useUdfPort.ts`)

```typescript
export function useUdfPort(): number | null {
  // Get UDF port from Electron main process via IPC
  // Returns null until port is available
}
```

### 5. Theme CSS (`desktop/renderer/styles/theme.css`)

Port and adapt from `web/styles.css`:
- Deep sea green background (#0a2a1f or similar dark)
- Green accent for positive (#00ff88)
- Red for negative (#ff4444)
- Font: system-ui or monospace
- Controls bar styling for ChartControls
- Chart container sizing (fill available space)

### 6. Update Preload + IPC Channels

Add to `desktop/main/preload.ts`:
```typescript
getUdfPort: () => ipcRenderer.invoke('udf:port'),
```

Add to `desktop/shared/ipc-channels.ts`:
```typescript
UDF_PORT: 'udf:port',
```

Add to `desktop/main/index.ts`:
```typescript
ipcMain.handle('udf:port', () => UDF_PORT) // return the port number
```

### 7. Desktop Mode Detection (`src/main.tsx`)

Add near the beginning of the CLI setup (where --web flag is handled):
```typescript
if (process.env.VIBE_SENSEI_DESKTOP === '1') {
  // Auto-start UDF server on a free port (same logic as --web flag)
  // But don't open browser
}
```

Find where the `--web` flag starts the UDF server and add a parallel check for the VIBE_SENSEI_DESKTOP env var. Use the same port (3456) or detect a free port.

### 8. Update App.tsx

Update `desktop/renderer/App.tsx` to show both TerminalPanel and ChartPanel side by side (simple flexbox for now, Sprint 31 will add the full layout):

```tsx
<div style={{ display: 'flex', height: '100vh' }}>
  <div style={{ flex: 1 }}><TerminalPanel /></div>
  <div style={{ flex: 1 }}><ChartPanel /></div>
</div>
```

## Context Files (READ THESE FIRST)
- `web/app.js` — Existing TradingView chart frontend (489 lines). Port this logic into React.
- `web/styles.css` — Existing dark theme CSS. Adapt for desktop.
- `web/index.html` — HTML structure reference.
- `desktop/renderer/components/TerminalPanel.tsx` — Existing terminal panel (Sprint 29).
- `desktop/main/preload.ts` — Existing preload script.
- `desktop/shared/ipc-channels.ts` — Existing IPC channels.
- `desktop/renderer/App.tsx` — Current root component (just TerminalPanel).
- `src/services/chart/udf-server.ts` — UDF server endpoints.
- `src/services/chart/index.ts` — UDF server startup function (if it exists).

## Constraints
- Max execution time: 240s
- Add `lightweight-charts` to `desktop/package.json` dependencies
- Do NOT modify the web/ directory (keep it for standalone browser use)
- Only modify `src/main.tsx` for desktop env detection — minimal change
- Atomic commits: `sprint-30: <what>`

当前状态: **ACTIVE**
