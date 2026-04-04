# Sprint 76: Replace Lightweight Charts with TradingView Charting Library

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-76: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Replace the Lightweight Charts implementation in the Desktop Electron app with the full TradingView Charting Library. The library is already cloned at `desktop/charting_library/`.

## Assigned To
opus

## Background
- TradingView Charting Library is cloned at `desktop/charting_library/`
- Our UDF server at `src/services/chart/udf-server.ts` already implements the full TradingView UDF protocol (config, time, search, symbols, history, marks)
- The UDF server runs on port 3456 when Desktop mode is active (VIBE_SENSEI_DESKTOP=1)
- The library includes a UDF datafeed adapter at `desktop/charting_library/datafeeds/udf/`

## Deliverables

### Fix 1: Rewrite ChartPanel to use TradingView Widget
**File:** `desktop/renderer/components/ChartPanel.tsx`

Replace the entire Lightweight Charts implementation with TradingView Charting Library widget.

Key points:
- The charting_library static files need to be accessible from the renderer
- Use the UDF datafeed adapter: `new Datafeeds.UDFCompatibleDatafeed('http://localhost:{port}')`
- Widget config:
  ```typescript
  new TradingView.widget({
    symbol: 'BTCUSDT',
    interval: '60',  // 1H default
    container: 'tv_chart_container',
    datafeed: new Datafeeds.UDFCompatibleDatafeed(`http://localhost:${port}`),
    library_path: '/charting_library/',  // path to static files
    locale: 'en',
    theme: 'dark',
    custom_css_url: '/custom_chart.css',  // our dark theme overrides
    autosize: true,
    timezone: 'Etc/UTC',
    disabled_features: [
      'use_localstorage_for_settings',
      'header_symbol_search',     // we have our own symbol selector
      'header_compare',
    ],
    enabled_features: [
      'study_templates',
      'hide_left_toolbar_by_default',
    ],
    overrides: {
      'mainSeriesProperties.candleStyle.upColor': '#26a69a',
      'mainSeriesProperties.candleStyle.downColor': '#ef5350',
      'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
      'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
      'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
      'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
      'paneProperties.background': '#131722',
      'paneProperties.backgroundType': 'solid',
      'scalesProperties.backgroundColor': '#131722',
    },
    loading_screen: {
      backgroundColor: '#131722',
      foregroundColor: '#00FF41',
    },
  })
  ```

### Fix 2: Serve Charting Library Static Files
**Option A (Vite):** Copy charting_library files to the public/static directory so Vite serves them.

**Option B (Electron):** Use a custom protocol handler in Electron to serve the files from `desktop/charting_library/charting_library/`.

**Option C (Express):** Have the UDF server also serve the charting library static files.

Choose the simplest option that works in both dev and production mode.

For Electron, the simplest is probably to use `express.static` on the UDF server to serve the charting library:
```typescript
// In UDF server setup
app.use('/charting_library', express.static(path.join(__dirname, '..', 'desktop', 'charting_library', 'charting_library')));
app.use('/datafeeds', express.static(path.join(__dirname, '..', 'desktop', 'charting_library', 'datafeeds')));
```

Or in Vite config, copy charting_library to public dir.

### Fix 3: Build the UDF Datafeed Bundle
**Directory:** `desktop/charting_library/datafeeds/udf/`

The UDF datafeed adapter needs to be built:
```bash
cd desktop/charting_library/datafeeds/udf
npm install
npm run build  # or rollup -c rollup.config.mjs
```
This produces `dist/bundle.js` which is the UDF compatible datafeed.

### Fix 4: Remove Lightweight Charts Dependency
**File:** `desktop/package.json`

Remove `lightweight-charts` from dependencies since we're now using the full charting library.

### Fix 5: Remove Old Chart Components
**Files to simplify/remove:**
- `desktop/renderer/components/chart/ChartControls.tsx` — TradingView has its own symbol/timeframe selector
- `desktop/renderer/components/chart/OhlcBar.tsx` — TradingView has built-in OHLC display

The ChartPanel should become much simpler — just a container div that the TradingView widget renders into.

### Fix 6: Custom Dark Theme CSS
**New file:** `desktop/renderer/styles/chart-theme.css`

Create CSS overrides for TradingView to match our Matrix green aesthetic:
```css
/* Override TradingView's default colors */
.chart-controls-bar { background: #0D1117 !important; }
```

## Important Notes
- The TradingView widget creates an iframe internally — it manages its own rendering
- The `library_path` must point to where the static charting library files are served
- The `datafeed` is the key connection — our UDF server at localhost:3456 provides the data
- Keep the ChartControls symbol selector if TradingView's built-in one doesn't work with our UDF search endpoint
- The widget needs both `charting_library.standalone.js` AND `datafeeds/udf/dist/bundle.js`

## Verification
1. `cd desktop && npm run build:main && npx vite build` succeeds
2. `VIBE_SENSEI_DESKTOP=1 VIBE_FORCE_PROD=1 npx electron dist/main/index.js` shows TradingView chart with real BTC data
3. Can switch symbols and timeframes
4. Has drawing tools, indicators (RSI, MACD, etc.)
5. Dark theme applied

## Timeout
300 minutes
