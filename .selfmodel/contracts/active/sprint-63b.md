# Sprint 63b: Candlestick Chart — Gemini Design Review Polish

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-63b: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
根据 Gemini 3.1 Pro 的专业设计审查，优化终端蜡烛图的视觉美感。融入深海克苏鲁主题。

## Assigned To
opus

## Deliverables
- [ ] `src/components/CandlestickChart/render-candles.ts` — 修改：美学优化

## Design Changes (来自 Gemini 3.1 Pro 审查)

### 1. Y 轴移到右侧
交易员的视线焦点在最右边（最新价格）。把价格刻度从左侧移到右侧。

之前：
```
69200 ┤  █  █
69000 ┤  █  ▓
```
之后：
```
█  █  │ 69200
█  ▓  │ 69000
```

### 2. 阴阳线材质区分
不只靠颜色区分涨跌。用不同 Unicode 字符给阴阳线不同"材质"：

- **阳线（涨）**：`█` (U+2588) — 实心，代表充实、发光
- **阴线（跌）**：`▓` (U+2593) — 网底/深渊，代表被吞噬
- **十字星 (Doji)**：`┼` 或 `─`

这样在无颜色终端也能一眼分辨涨跌。

### 3. 深海克苏鲁配色
抛弃传统红绿配色！使用深海生物发光色：

```typescript
// 在 render-candles.ts 或 types.ts 中定义主题色
const CHART_COLORS = {
  bullish: 'cyan',       // 生物荧光青 — Ink color name (closest to ANSI 51)
  bearish: 'magenta',    // 深渊暗紫 — Ink color name (closest to ANSI 53)
  axis: 'gray',          // 幽暗蓝灰 — 坐标轴和网格
  title: 'white',        // 标题
  priceUp: 'cyan',       // 涨幅数字
  priceDown: 'magenta',  // 跌幅数字
  priceLine: 'yellow',   // 当前价格线 — 深海探照灯
  volume: undefined,     // 跟随蜡烛颜色
}
```

注意：Ink 的 `<Text color="...">` 使用名称如 'cyan', 'magenta', 'gray' 等，不是 ANSI 码。使用 Ink 支持的颜色名称。

### 4. 影线字符统一
替换为更精致的细线字符：

```
之前: │ (U+2502), ╻ (U+257B), ╹ (U+2579)  — 粗细混乱
之后: │ (U+2502), ╷ (U+2577), ╵ (U+2575)  — 统一细线
```

上影线（high 到 body top）：`╷` 或 `│`
下影线（body bottom 到 low）：`╵` 或 `│`

### 5. 当前价格指示线
在最新蜡烛的收盘价位置，横跨图表画一条虚线指向右侧 Y 轴：

```
       █     ▓     │
  ┈┈┈┈┈█┈┈┈┈┈┈┈┈┈┈▶ 69015
       ▓     │     │
```

用 `┈` (U+2508) 虚线 + `▶` (U+25B6) 箭头指向当前价格。
颜色：'yellow'（深海探照灯效果）。

### 6. 背景网格点
在每个时间分界线位置添加暗淡的 `·`，像深海中的气泡：

```
   █  ·   ▓  ·   █  ·   │ 69200
   █  ·   ▓  ·   █  ·   │ 69000
```

颜色：dim gray。只在偶数列或特定间隔显示，不能太密。

### 7. 外边框
用细线包裹主图区域：

```
┌──────────────────────────┐
│  █   ▓   █   █   ▓      │ 69200
│  █   ▓   █   ▓   ▓      │ 69000
└──────┬──────┬──────┬─────┘
```

成交量放在边框下方的开放空间。

### 8. 标题行优化
高亮数值，弱化标签：

```
█ VIBE SENSEI ─ BTC/USDT [4H]  O:68543  H:69201  L:67812  C:69015 (+2.12%)
```

- "VIBE SENSEI" 品牌名用 dim 或 bold
- 数值用白色/高亮
- 涨跌幅颜色跟随涨跌（cyan/magenta）

## 不做的改动
- **不改布林带/MA 均线** — 留给后续 Sprint
- **不改对数坐标** — 留给后续
- **不改 Braille 模式** — 这是一个完全不同的渲染引擎，太大

## Build & Verification
1. `bun run build` 成功
2. 阳线 = █ 青色，阴线 = ▓ 紫色
3. Y 轴在右侧
4. 当前价格指示线 ┈┈┈▶
5. 影线用统一的细线 ╷ ╵ │
6. 有边框包裹主图区
