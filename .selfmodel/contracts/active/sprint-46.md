# Sprint 46: Post-Trade R-Multiple Report

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-46: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
创建交易关闭后的 R 倍数报告系统

## Assigned To
opus

## Deliverables
- [ ] `src/buddy/trade-report.ts` — 新建：TradeReport 类型, generateTradeReport(), formatTradeReport(), calculateMAEMFE()
- [ ] `src/tools/OrderTool/OrderTool.ts` — 修改：在卖出成交后检测仓位关闭, 生成报告
- [ ] `src/buddy/diary.ts` — 修改：添加 tradeReports 数组, recordTradeWithReport(), computeCumulativeStats()
- [ ] `src/buddy/trade-card.ts` — 修改：添加 generateTradeReportCard()

## Acceptance Criteria

### 1. TradeReport Type
```typescript
interface TradeReport {
  symbol: string
  side: string
  entryPrice: number
  exitPrice: number
  quantity: number
  grossPnL: number        // (exit - entry) × qty
  netPnL: number          // gross - fees
  netPnLPercent: number   // net / (entry × qty) × 100
  totalFees: number
  initialRisk: number     // |entry - stop| × qty, or ATR-based estimate
  rMultiple: number       // netPnL / initialRisk
  holdDurationMs: number
  holdDurationHuman: string  // "2h 15m" or "3d 4h"
  mae: number             // max adverse excursion (%) during hold
  mfe: number             // max favorable excursion (%) during hold
  efficiencyRatio: number // |netPnLPercent| / |mfe| if mfe > 0
  timestamp: number
}
```

### 2. Position Close Detection
在 OrderTool.ts 的 call() 方法中:
- 卖出订单成交后，比较成交前后的 positions
- 如果某 symbol 的 position quantity 从 N → 0 (或消失)，视为仓位关闭
- 仅 sell side 成交后触发 (不在 buy 时触发)
- 需要在 placeOrder 前快照当前 positions

### 3. Report Generation
- `generateTradeReport(closedPosition, order, exchange)`:
  - 从 closedPosition 获取 entry/qty, 从 order 获取 exit/fees
  - 如果有 stop-loss order: initialRisk = |entry - stop| × qty
  - 如果无 stop: 通过 getCandles 获取 4h candles 计算 ATR, initialRisk = ATR × qty
  - rMultiple = netPnL / initialRisk (initialRisk > 0 时)
  - holdDuration: 使用 order timestamp 与 position 的启发式估计

### 4. MAE/MFE Calculation
- `calculateMAEMFE(entryPrice, candles, side)`:
  - 从 1h candles 中找 hold 期间的最低低点和最高高点
  - 做多: MAE = (minLow - entry)/entry × 100, MFE = (maxHigh - entry)/entry × 100
  - 做空: MAE = (maxHigh - entry)/entry × 100, MFE = (entry - minLow)/entry × 100
  - 如果无法获取 candle 数据，MAE/MFE 设为 0

### 5. Duration Formatting
- `formatDuration(ms)` 返回人类可读时间:
  - < 1h: "Xm" (如 "45m")
  - 1-24h: "Xh Ym" (如 "3h 15m")
  - 1-7d: "Xd Yh" (如 "2d 8h")
  - > 7d: "Xd" (如 "14d")

### 6. Terminal Report Format
```
━━━ Trade Closed ━━━━━━━━━━━━━━━━━━━━━━━━━━
BTC/USDT LONG | +$1,081.35 (+3.21%)
Entry: $67,500.00 × 0.5 | Exit: $69,800.00
R-Multiple: 1.44R | Hold: 3d 4h
MAE: -1.04% | MFE: +4.44% | Efficiency: 72%
Rolling: 65% WR | 1.2 avg R | 0.78 expectancy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 7. Diary Integration
- `GuardianDiary.recordTradeReport(report)` 存储到 tradeReports 数组
- `computeCumulativeStats()` 计算最近 20 笔的滚动统计: winRate, avgR, expectancy
- tradeReports 随 diary 持久化

### 8. Trade Card Integration
- `generateTradeReportCard(report)` 返回可分享的文本卡片
- 复用现有 trade-card.ts 的 box-drawing 风格

## Scoring Rubric
| Dimension | Weight | 本 Sprint 的 10/10 |
|---|---|---|
| Functionality | 30% | 仓位关闭检测准确, R 倍数计算正确 |
| Code Quality | 25% | 类型完整, 函数 <50 行, 边界处理 |
| Design Taste | 20% | 报告格式美观, 数据有意义 |
| Completeness | 15% | 所有 deliverable 交付 |
| Originality | 10% | MAE/MFE 效率比设计 |

## Context Files
- `src/tools/OrderTool/OrderTool.ts`
- `src/services/exchange/types.ts`
- `src/services/exchange/singleton.ts`
- `src/buddy/diary.ts`
- `src/buddy/trade-card.ts`
- `src/buddy/types.ts`

## Constraints
- Max execution time: 240s
- 不修改 PlaceOrder 的成功路径 (report 是附加信息)
- ATR 计算可复用 regime.ts 的逻辑但不直接依赖它
- 原子提交

## Lifecycle
当前状态: **ACTIVE**
