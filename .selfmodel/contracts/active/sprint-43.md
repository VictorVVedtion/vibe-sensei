# Sprint 43: Pre-Trade Gate Tool (9 Pre-Flight Checks)

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-43: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
创建交易前 9 项风险门禁工具，在下单前拦截高风险交易

## Assigned To
opus

## Deliverables
- [ ] `src/tools/PreTradeGateTool/PreTradeGateTool.ts` — 新建：PreTradeGate tool 定义
- [ ] `src/tools/PreTradeGateTool/types.ts` — 新建：GateStatus, CheckResult, RiskGateResult 类型
- [ ] `src/tools/PreTradeGateTool/gateEvaluator.ts` — 新建：评估引擎, 编排所有 checks
- [ ] `src/buddy/checks/portfolio-heat.ts` — 新建：组合热度检查
- [ ] `src/buddy/checks/single-position-risk.ts` — 新建：单仓风险检查
- [ ] `src/buddy/checks/regime-alignment.ts` — 新建：regime 对齐检查
- [ ] `src/buddy/checks/volume-confirmation.ts` — 新建：成交量确认检查
- [ ] `src/buddy/checks/stop-loss-defined.ts` — 新建：止损定义检查
- [ ] `src/buddy/checks/risk-reward-ratio.ts` — 新建：风险回报比检查
- [ ] `src/buddy/checks/revenge-trade.ts` — 新建：报复交易检查
- [ ] `src/buddy/checks/daily-loss-limit.ts` — 新建：日亏损限制检查

## Acceptance Criteria

### 1. PreTradeGateTool
- 作为独立 Tool 注册 (name: "PreTradeGate")
- inputSchema: symbol, side, type, quantity, price?, stopPrice?, targetPrice?, acceptWarnings?
- call() 方法运行所有 9 项检查，返回结构化结果
- 工具结果作为文本返回给 LLM (LLM 负责决定是否继续下单)

### 2. GateStatus 和 CheckResult
```typescript
type GateStatus = 'pass' | 'warn' | 'fail'
interface CheckResult {
  name: string
  status: 'pass' | 'warning' | 'fail'
  message: string
  recommendation?: string
}
interface RiskGateResult {
  status: GateStatus
  checks: CheckResult[]
  summary: string
  recommendation?: string
}
```

### 3. 九项检查 (每项独立文件)

**3a. Portfolio Heat (portfolio-heat.ts)**
- 使用 src/services/portfolio/heat-calculator.ts 的 calculatePortfolioHeat()
- pass: heat < 10% | warn: 10-20% | fail: > 20%
- 使用 getThresholds() 获取 archetype 动态阈值

**3b. Single Position Risk (single-position-risk.ts)**
- 计算: 本次交易的风险金额 / 总权益
- 如果有 stopPrice: risk = |price - stopPrice| × quantity / equity
- 如果没有 stopPrice: risk = price × quantity × 0.10 / equity
- pass: < 5% | warn: 5-10% | fail: > 10%

**3c. Regime Alignment (regime-alignment.ts)**
- 使用 getLatestRegime(symbol) 获取当前 regime
- buy + trending_up = pass | buy + trending_down = warn | sell + trending_down = pass
- regime 为 null 时: pass (无法判断)
- 只 warn 不 fail

**3d. Volume Confirmation (volume-confirmation.ts)**
- 获取 exchange.getTicker(symbol) 的 volume
- 获取 exchange.getCandles(symbol, '4h', 20) 计算 20 期平均成交量
- volume ratio = current / avg
- pass: > 1.0x | warn: 0.5-1.0x | fail: < 0.5x

**3e. Stop-Loss Defined (stop-loss-defined.ts)**
- 检查 order 是否有 stopPrice
- pass: 有 stopPrice 或 order type 是 stop_loss
- warn: 没有 stopPrice 但 position risk < 5%
- fail: 没有 stopPrice 且 position risk > 5%

**3f. Risk/Reward Ratio (risk-reward-ratio.ts)**
- 需要 stopPrice 和 targetPrice
- R:R = |targetPrice - entryPrice| / |entryPrice - stopPrice|
- pass: R:R >= 1.5 | warn: 1.0-1.5 | fail: < 1.0
- 如果缺少 stop 或 target: pass (无法计算, 不惩罚)

**3g. Revenge Trade (revenge-trade.ts)**
- 获取最近交易历史 (diary 或 positions)
- 检查最近 5 分钟内是否有亏损关闭
- pass: 无近期亏损 | warn: 5-15 分钟内有亏损 | fail: < 2 分钟内有亏损

**3h. Daily Loss Limit (daily-loss-limit.ts)**
- 计算今日已实现 + 未实现亏损
- pass: < 3% | warn: 3-5% | fail: > 5%
- 简化版: 使用 positions 的 unrealizedPnl 总和

**3i. Concentration Check**
- 复用现有 concentration.ts 的逻辑
- 检查新交易是否会使某资产超过组合的阈值

### 4. Gate Evaluator
- 运行所有 9 项检查, 收集结果
- 整体状态: 任一 fail → fail; 任一 warn (无 fail) → warn; 全 pass → pass
- 返回建议: 如 "Reduce quantity to 0.3 to pass single-position-risk check"

### 5. 工具注册
- 注册到 tools 数组 (查找 tools 注册的位置并添加)
- 确保 LLM 可以在 PlaceOrder 之前调用 PreTradeGate

### 6. 格式化输出
```
═══ Pre-Trade Gate ═══════════════════════════
Symbol: BTC/USDT | Side: BUY | Qty: 0.5

[PASS] Portfolio Heat: 2.1% (limit 20%)
[PASS] Position Risk: 1.8% (limit 10%)
[WARN] Concentration: 28% crypto (limit 30%)
[PASS] Regime: trending_up — aligned ✓
[FAIL] Volume: 0.4x average (min 0.5x)
[FAIL] Stop-Loss: not defined, risk 7.2%
[PASS] R:R Ratio: N/A (no target)
[PASS] Revenge: no recent loss
[PASS] Daily Loss: -1.2% (limit 5%)

Status: FAIL — 2 issues must be resolved
→ Set a stop-loss or reduce position size
═══════════════════════════════════════════════
```

## Scoring Rubric
| Dimension | Weight | 本 Sprint 的 10/10 |
|---|---|---|
| Functionality | 30% | 所有 9 项检查正确运行, gate 逻辑无误 |
| Code Quality | 25% | 每个 check <40 行, 类型完整, 无 any |
| Design Taste | 20% | 输出格式清晰美观, 建议具体可操作 |
| Completeness | 15% | 所有 deliverable 交付, tool 正确注册 |
| Originality | 10% | check 之间数据复用高效 |

## Context Files
- `src/tools/OrderTool/OrderTool.ts` — 了解现有 order tool 结构
- `src/services/exchange/types.ts` — Position, Balance, Order, Ticker types
- `src/services/exchange/singleton.ts` — getConnectedExchange
- `src/services/portfolio/heat-calculator.ts` — 复用 heat 计算
- `src/services/market/regime.ts` — getLatestRegime
- `src/buddy/thresholds.ts` — getThresholds, ThresholdConfig
- `src/buddy/checks/concentration.ts` — 复用 concentration 逻辑
- `src/buddy/diary.ts` — getRecentEntries (revenge trade)
- `src/buddy/companion.ts` — getCompanion
- `src/buddy/persona.ts` — getMasterArchetype
- 找到 tools 注册的位置 (可能在 src/tools/ 的 index 或 main.tsx 中)

## Constraints
- Max execution time: 300s
- 原子提交
- 禁止 TODO / mock / placeholder
- 不修改 OrderTool (gate 是独立工具)
- 检查失败不阻止 PlaceOrder (gate 只是建议, LLM 决定是否继续)
- 所有 exchange 调用用 try/catch 包裹

## E2E Depth
- Depth: standard
- Notes: 验证 tool 注册成功, 输出格式正确

## Lifecycle
当前状态: **ACTIVE**
