# Sprint 41: Market Regime Engine + Portfolio Heat Calculator

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-41: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
创建市场 Regime 引擎和投资组合风险热度计算器

## Assigned To
opus

## Deliverables
- [ ] `src/services/market/types.ts` — RegimeType, MarketRegime, RegimeSnapshot 类型定义
- [ ] `src/services/market/regime.ts` — MarketRegimeEngine 类，computeRegimeForSymbol() 函数
- [ ] `src/services/portfolio/heat-calculator.ts` — calculatePortfolioHeat() 函数，HeatMetrics 类型
- [ ] `src/services/market/feed.ts` — 修改：hook regime 计算到 poll 循环 (每 4h)
- [ ] `src/services/trading-context.ts` — 修改：在 buildTradingContext() 中包含 heat 指标
- [ ] `src/services/desktop/bridge.ts` — 修改：确保 trading_state 消息包含 riskScore
- [ ] `src/services/trading/guardian-observer.ts` — 修改：emit 时用实际 heat 替换 riskScore: 0

## Acceptance Criteria

### 1. Market Regime Engine
- `computeRegimeForSymbol(symbol, exchange)` 从 4h candles 计算 regime
- ATR(14) 计算正确: TrueRange = max(H-L, |H-prevClose|, |L-prevClose|), ATR = SMA(TrueRange, 14)
- ATR 百分位: 当前 ATR 相对最近 50 根 candles 的百分位 (0-100)
- 方向分类: 统计最近 14 根 candles 的 HH+HL 和 LL+LH 数量
- Regime 分类逻辑:
  - trending_up: HL count ≥ 7 且 ATR 百分位 > 70
  - trending_down: LH count ≥ 7 且 ATR 百分位 > 70
  - ranging: 无明确方向且 ATR 百分位 30-70
  - compressing: 无明确方向且 ATR 百分位 < 30
  - expanding: 无明确方向且 ATR 百分位 > 70
- confidence 分数 (0-1) 基于方向强度和 ATR
- `getLatestRegime(symbol)` 返回缓存的最新 regime (或 null)
- Regime 每 4h 重新计算一次 (在 feed.ts poll 中检查时间)

### 2. Portfolio Heat Calculator
- `calculatePortfolioHeat(positions, balances, openOrders)` 返回 HeatMetrics
- 有止损的持仓: risk = |entry - stopPrice| × quantity
- 无止损的持仓: risk = entry × quantity × 0.10 (假设 10% 最大不利波动)
- Heat% = Σ(risks) / totalEquity × 100
- `riskScoreFromHeat(heatPercent)` 返回 0-100 分数
- 处理边界: 无持仓返回 0, 零权益不除零

### 3. 集成
- guardian-observer.ts 中 emitTradingState 时使用实际 heat 作为 riskScore
- buildTradingContext() 输出包含 `**Portfolio Heat:** X.X%`
- candles 不足 15 根时 regime 返回 null (不崩溃)
- 所有新代码有完整 TypeScript 类型

## Scoring Rubric
| Dimension | Weight | 本 Sprint 的 10/10 |
|---|---|---|
| Functionality | 30% | Regime 和 Heat 计算完全正确，所有边界处理 |
| Code Quality | 25% | 类型完整，函数 <50 行，无 any |
| Design Taste | 20% | 与现有 market/feed.ts 和 exchange 架构一致 |
| Completeness | 15% | 所有 deliverable 交付，所有 AC 满足 |
| Originality | 10% | Regime 置信度算法合理优雅 |

## Context Files
- `src/services/market/feed.ts`
- `src/services/exchange/types.ts`
- `src/services/exchange/singleton.ts`
- `src/services/trading-context.ts`
- `src/services/trading/guardian-observer.ts`
- `src/services/desktop/bridge.ts`
- `src/buddy/checks/utils.ts`
- `desktop/shared/ipc-channels.ts`

## Constraints
- Max execution time: 300s
- 非交互执行
- 禁止 TODO / mock / placeholder
- 原子提交
- 不修改现有 check 阈值 (Sprint 42 处理)
- 不创建新的 npm 依赖

## E2E Depth
- Depth: standard
- Notes: 验证 regime 计算和 heat 计算的数值正确性

## Worktree
- Branch: sprint/41-opus
- Path: (auto-created by Agent tool)

## Lifecycle
当前状态: **ACTIVE**
