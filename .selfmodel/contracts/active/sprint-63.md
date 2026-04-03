# Sprint 63: Terminal Candlestick Chart (ASCII K-Line)

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-63: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
在终端中用 Unicode 字符绘制实时 K 线蜡烛图。不需要 --web 模式，纯终端内渲染。用户可以直接在 REPL 中看到价格图表。

## Assigned To
opus

## Deliverables
- [ ] `src/components/CandlestickChart/CandlestickChart.tsx` — 新建：Ink/React 蜡烛图组件
- [ ] `src/components/CandlestickChart/render-candles.ts` — 新建：蜡烛图渲染引擎（纯函数）
- [ ] `src/components/CandlestickChart/types.ts` — 新建：图表类型定义
- [ ] `src/tools/ChartTool/ChartTool.ts` — 新建：ChartTool 让 AI 可以展示图表
- [ ] `src/tools/ChartTool/UI.tsx` — 新建：图表工具的 React 渲染组件

## Acceptance Criteria

### 1. 蜡烛图渲染引擎 (render-candles.ts)

纯函数，输入 OHLCV 数据 + 终端尺寸，输出字符串数组（每行一个字符串）。

```typescript
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ChartOptions {
  width: number          // 终端可用宽度
  height: number         // 图表高度（行数），默认 15
  showVolume: boolean    // 是否显示成交量柱，默认 true
  volumeHeight: number   // 成交量区域高度，默认 3
  priceDecimals: number  // 价格小数位
  symbol: string         // 交易对名称
  timeframe: string      // 时间周期 (1m, 5m, 15m, 1h, 4h, 1d)
}

export function renderCandlestickChart(
  candles: Candle[],
  options: ChartOptions,
): string[]
```

#### 蜡烛绘制规则

每根蜡烛占 1-2 列宽度（取决于终端宽度和蜡烛数量）。

**字符映射：**
- 阳线（涨，close > open）：`█` 绿色
- 阴线（跌，close < open）：`█` 红色  
- 上影线：`│` (细线，在蜡烛体上方)
- 下影线：`│` (细线，在蜡烛体下方)
- 十字星（open ≈ close）：`┼` 或 `─`

**价格刻度（右侧 Y 轴）：**
```
69200 ┤
69000 ┤
68800 ┤
...
```
- Y 轴占 8-10 个字符宽度（根据价格位数自适应）
- 刻度数量 = 图表高度
- 自动计算合适的刻度间距（round to nice numbers: 100, 200, 500, 1000...）

**时间刻度（底部 X 轴）：**
```
└──┴──┴──┴──┴──┴──┴──
 12  16  20  00  04  08
```
- 只显示小时，每隔 N 根蜡烛显示一个时间标签
- 日期变化时显示日期

**标题行：**
```
  BTC/USDT 4H  O:68500 H:69200 L:67800 C:69000 (+2.1%)
```
- 最新蜡烛的 OHLC 数据
- 涨跌百分比（绿/红色）

#### 渲染算法

```
1. 计算价格范围：priceMin = min(所有 low), priceMax = max(所有 high)
2. 添加 5% padding
3. 每行代表的价格范围 = (priceMax - priceMin) / chartHeight
4. 对每根蜡烛：
   a. 计算 open/high/low/close 对应的行号
   b. 从 high 行到 low 行画影线 │
   c. 从 open 到 close 之间画实体 █
   d. 涨 = 绿色，跌 = 红色
5. 成交量柱：
   a. 独立区域，volumeHeight 行
   b. 最大 volume 对应 volumeHeight，其他按比例
   c. 用 ▁▂▃▄▅▆▇█ 八级高度
   d. 颜色跟随对应蜡烛涨跌
```

#### 成交量柱

用 Unicode 八分之一 block 元素实现精细高度：

```typescript
const VOLUME_BLOCKS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
// 每个字符 8 级高度精度
```

### 2. CandlestickChart React/Ink 组件

```tsx
interface CandlestickChartProps {
  candles: Candle[]
  symbol: string
  timeframe: string
  showVolume?: boolean
}

export function CandlestickChart({ candles, symbol, timeframe, showVolume = true }: CandlestickChartProps) {
  const { columns, rows } = useTerminalSize()
  
  // 计算可用空间
  const chartHeight = Math.min(Math.max(rows - 10, 8), 20)  // 8-20 行
  const chartWidth = columns - 2  // 留 2 列 padding
  
  const lines = renderCandlestickChart(candles, {
    width: chartWidth,
    height: chartHeight,
    showVolume,
    volumeHeight: 3,
    priceDecimals: symbol.includes('BTC') ? 0 : 2,
    symbol,
    timeframe,
  })
  
  return (
    <Box flexDirection="column" paddingX={1}>
      {lines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  )
}
```

注意：蜡烛颜色需要在渲染引擎中嵌入 ANSI 颜色码，或者返回结构化数据让 Ink 的 `<Text color>` 处理。

**推荐方案：** 返回结构化的 `ChartLine[]`，每行包含多个带颜色的 segment：

```typescript
interface ChartSegment {
  text: string
  color?: 'green' | 'red' | 'gray' | 'cyan' | 'white'
  dim?: boolean
}

type ChartLine = ChartSegment[]

// 这样 Ink 可以逐 segment 渲染颜色
{lines.map((segments, i) => (
  <Text key={i}>
    {segments.map((seg, j) => (
      <Text key={j} color={seg.color} dimColor={seg.dim}>{seg.text}</Text>
    ))}
  </Text>
))}
```

### 3. ChartTool (工具定义)

让 AI 可以主动展示图表给用户。

```typescript
// src/tools/ChartTool/ChartTool.ts
export const ChartTool = {
  name: 'ShowChart',
  description: 'Display a candlestick chart in the terminal for a trading pair',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Trading pair, e.g. BTC/USDT',
      },
      timeframe: {
        type: 'string',
        enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
        description: 'Chart timeframe',
        default: '4h',
      },
      limit: {
        type: 'number',
        description: 'Number of candles to show',
        default: 50,
      },
    },
    required: ['symbol'],
  },
  
  async call(input: { symbol: string, timeframe?: string, limit?: number }) {
    const { getConnectedExchange } = await import('../../services/exchange/singleton.js')
    const exchange = await getConnectedExchange()
    const ohlcv = await exchange.fetchOHLCV(
      input.symbol,
      input.timeframe ?? '4h',
      undefined,
      input.limit ?? 50,
    )
    
    // 转换 CCXT 格式 [timestamp, open, high, low, close, volume]
    const candles: Candle[] = ohlcv.map(([time, open, high, low, close, volume]) => ({
      time, open, high, low, close, volume,
    }))
    
    return { candles, symbol: input.symbol, timeframe: input.timeframe ?? '4h' }
  },
  
  // UI 组件渲染图表
  UIComponent: ChartToolUI,
}
```

```tsx
// src/tools/ChartTool/UI.tsx
function ChartToolUI({ result }: { result: { candles: Candle[], symbol: string, timeframe: string } }) {
  return <CandlestickChart candles={result.candles} symbol={result.symbol} timeframe={result.timeframe} />
}
```

### 4. 注册工具

在 `src/tools.ts` 中注册 ChartTool，让 AI 可以调用。

### 5. 深海绿主题适配

图表颜色应该匹配 Vibe Sensei 的深海绿主题：
- 阳线：使用主题的 `success` 色（绿色系）
- 阴线：使用红色
- 边框/刻度：使用 `inactive` 色（dim gray）
- 标题：使用 `warning` 色（金色/橙色）
- 当前价格线：使用 `permission` 色（蓝色）— 用虚线 `┄┄┄` 标记

### 6. 响应式

- 终端 < 60 列：压缩模式，每根蜡烛 1 列宽，减少刻度
- 终端 60-120 列：标准模式，每根蜡烛 1 列
- 终端 > 120 列：宽模式，每根蜡烛 2 列宽，更多 detail
- 高度自适应终端行数（8-20 行图表区域）

### 7. 示例输出

```
  BTC/USDT 4H  O:68543 H:69201 L:67812 C:69015 (+2.12%)
  69200 ┤                          │               
  69000 ┤                    ╻     █               
  68800 ┤              ╻     █     █     ╻         
  68600 ┤        ╻     █     █     █     █         
  68400 ┤  ╻     █     █     ║     ║     █    ╻    
  68200 ┤  █     █     ║     ║           █    █    
  68000 ┤  █     ║     ║                 ║    █    
  67800 ┤  ║     ║                             ║    
  67600 ┤  ╹     ╹                             ╹    
        └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──
         12  16  20  00  04  08  12  16  20  00  04
  Vol   ▅▃ ▇▅ ██ ▃▂ ▅▃ ▂▁ ▃▂ ▇█ ▅▃ ▂▁ ▃▅ ▅▃ ▇▅
```

## Build & Verification
1. `bun run build` 成功
2. renderCandlestickChart 纯函数，输入 Candle[] 输出 ChartLine[]
3. 阳线绿色，阴线红色
4. Y 轴价格刻度自适应
5. X 轴时间标签
6. 成交量柱用 ▁▂▃▄▅▆▇█ 八级
7. 响应式适配终端宽度
8. ChartTool 注册可用
9. CandlestickChart Ink 组件正确渲染颜色
