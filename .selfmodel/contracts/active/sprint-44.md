# Sprint 44: ATR Stop-Loss Advisor + Circuit Breaker

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-44: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
创建 ATR 智能止损建议系统和交易熔断器

## Assigned To
opus

## Deliverables
- [ ] `src/services/market/atr-advisor.ts` — 新建：ATR 止损计算 + 仓位建议
- [ ] `src/state/circuit-state.ts` — 新建：熔断器状态管理
- [ ] `src/buddy/checks/circuit-breaker.ts` — 新建：3 个熔断检查
- [ ] `src/buddy/checks/atr-stop-advisor.ts` — 新建：ATR 止损检查 (INFO 级别建议)
- [ ] `src/tools/PreTradeGateTool/gateEvaluator.ts` — 修改：集成熔断器 (最先运行) 和 ATR advisor
- [ ] `src/buddy/checks/utils.ts` — 修改：添加 SMA 和 TrueRange 辅助函数 (如果尚不存在)

## Acceptance Criteria

### 1. ATR Stop-Loss Advisor (atr-advisor.ts)

**computeATRAdvisor(symbol, entryPrice, side, exchange, riskPercent?):**
- 获取 exchange.getCandles(symbol, '4h', 20)
- 计算 ATR(14): TrueRange = max(H-L, |H-prevClose|, |L-prevClose|), ATR = SMA(TR, 14)
- 检测 regime (简化版: price > SMA(20) = trending, else ranging)
- 止损计算:
  - 做多 trending: stop = entry - ATR × 2.0
  - 做多 ranging: stop = entry - ATR × 1.0
  - 做空: 反向
- 仓位建议:
  - riskAmount = equity × riskPercent (默认 2%)
  - maxQuantity = riskAmount / |entry - stop|
- 返回 ATRRecommendation: { stopPrice, riskAmount, maxQuantity, atrValue, regime, reason }

**不自动下单 — 只返回建议文本给 LLM。**

### 2. ATR Stop Check (atr-stop-advisor.ts)
- 作为 gate check 集成到 PreTradeGate
- 当 order 没有 stopPrice 时触发
- severity: INFO (建议性, 不是 WARNING/FAIL)
- 输出: "ATR suggests stop at $65,900 (2.0 ATR below entry). Max qty: 1.25 BTC at 2% risk."

### 3. Circuit Breaker State (circuit-state.ts)

```typescript
interface CircuitBreakerState {
  dailyStartEquity: number
  dailyStartTime: number     // UTC timestamp
  tradeTimestamps: number[]  // last 20 order fill timestamps
  consecutiveLosses: Array<{pnl: number, timestamp: number}>
}
```

- `createCircuitBreakerState(equity)` 工厂函数
- `getCircuitState()` 全局单例获取 (in-memory, 每日 00:00 UTC 重置)
- `recordTrade(timestamp)` 记录交易时间戳
- `recordLoss(pnl, timestamp)` 记录亏损
- `recordWin()` 清除连续亏损计数
- 日边界检测: 当前时间跨过 UTC 00:00 时自动重置

### 4. Circuit Breaker Checks (circuit-breaker.ts)

**4a. Daily Loss Limit**
- `checkDailyLossLimit(state, currentEquity)`:
- percentLoss = (dailyStartEquity - currentEquity) / dailyStartEquity × 100
- 如果 > 5%: 返回 EMERGENCY (不可绕过的硬拦截)
- 消息: "Circuit breaker: Daily loss X.X% exceeds 5% limit. Trading suspended until 00:00 UTC."

**4b. Trade Frequency**
- `checkTradeFrequency(state)`:
- 统计最近 60 分钟内的交易次数
- 如果 > 20 (即 10+ round-trips): 返回 CRITICAL
- 消息: "Circuit breaker: X trades in 60 min. Cooldown 30 minutes."

**4c. Escalating Loss**
- `checkEscalatingLoss(state)`:
- 检查 consecutiveLosses: 3+ 条, 每条 |pnl| > 前一条
- 返回 CRITICAL
- 消息: "Circuit breaker: X consecutive losses, each larger. Stop trading."

### 5. Gate Integration
- 在 gateEvaluator.ts 中:
  - 熔断器检查在所有其他检查之前运行
  - 如果熔断器触发 EMERGENCY: 直接返回 fail, 不运行后续检查
  - ATR advisor 在其他检查之后运行 (附加信息)
- 更新 formatGateOutput 包含熔断器和 ATR 信息

### 6. 辅助函数
如果 src/buddy/checks/utils.ts 中尚无 SMA/TrueRange:
- `computeSMA(values: number[], period: number): number`
- `computeTrueRange(candle, prevClose): number`

## Scoring Rubric
| Dimension | Weight | 本 Sprint 的 10/10 |
|---|---|---|
| Functionality | 30% | ATR 计算正确, 熔断器 3 条件准确触发 |
| Code Quality | 25% | 类型完整, 函数 <50 行, 状态管理清晰 |
| Design Taste | 20% | ATR 建议信息有价值, 熔断消息有震慑力 |
| Completeness | 15% | 所有 deliverable 交付, gate 集成完成 |
| Originality | 10% | 状态管理设计优雅, 日重置逻辑清晰 |

## Context Files
- `src/tools/PreTradeGateTool/gateEvaluator.ts` — 当前 gate 编排
- `src/tools/PreTradeGateTool/types.ts` — CheckResult, GateStatus
- `src/services/market/regime.ts` — 已有的 regime 计算 (可参考 ATR)
- `src/services/market/types.ts` — MarketRegime types
- `src/services/exchange/types.ts` — Candle, Position, Balance
- `src/services/exchange/singleton.ts` — getConnectedExchange
- `src/buddy/checks/utils.ts` — 现有工具函数

## Constraints
- Max execution time: 300s
- 原子提交
- 禁止 TODO / mock / placeholder
- ATR advisor 不自动下单 (只建议)
- 熔断器 EMERGENCY 级别不可绕过
- CRITICAL 级别可以被 acceptWarnings 绕过
- 不修改现有 9 个 gate checks (只添加新的)

## Lifecycle
当前状态: **ACTIVE**
