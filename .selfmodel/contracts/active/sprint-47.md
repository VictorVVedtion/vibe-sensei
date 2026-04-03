# Sprint 47: Dynamic Guardian Prompts (Context-Aware Alerts)

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-47: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
让 Guardian 警告具备 regime + 行为 + 组合 + 回撤上下文感知

## Assigned To
opus

## Deliverables
- [ ] `src/buddy/persona.ts` — 修改：添加 4 个 context builder 函数, ARCHETYPE_RECOVERY_GUIDANCE 常量, getPersonalizedAlertWithContext()
- [ ] `src/buddy/guardian.ts` — 修改：传递 exchange + diary 到 alert 生成
- [ ] `src/services/trading/guardian-observer.ts` — 修改：传递 diary 实例

## Acceptance Criteria

### 1. 四层上下文 (仅 alert 时注入)

**Layer 1: Regime Context (~50 tokens)**
- 读取 getLatestRegime(symbol) 获取当前 regime
- 格式: "Market: {regime} ({confidence}% confidence). {archetype_guidance}"
- archetype_guidance 示例: "As a trend_follower, this trending market favors your style."
- 如果 regime 为 null, 跳过此层

**Layer 2: Diary Context (~80 tokens)**  
- 读取 diary.getEnhancedSummary()
- 格式: "Your patterns: {top_pattern} ({count}x). {worst_instrument_warning}. Best session: {session}."
- 如果 summary 为 null (不足 20 条), 跳过此层

**Layer 3: Portfolio State (~60 tokens)**
- 从 positions + balances 计算
- 格式: "Portfolio: {heat}% heat, {drawdown}% from peak, {position_count} positions, {correlation} corr risk."
- correlation 估计: 全 L1 token = "high", 混合 = "moderate", 含 stablecoin = "low"

**Layer 4: Recovery Context (~70 tokens, 仅 drawdown > 5%)**
- 使用 ARCHETYPE_RECOVERY_GUIDANCE 常量
- 两个深度: shallow (5-15% drawdown), deep (>15% drawdown)
- 格式: "{archetype_recovery_message}"

### 2. ARCHETYPE_RECOVERY_GUIDANCE 常量
9 个 archetype × 2 个深度 = 18 条指导语:

```typescript
const ARCHETYPE_RECOVERY_GUIDANCE: Record<string, {shallow: string, deep: string}> = {
  value_investor: {
    shallow: 'Hold conviction. Weakness is opportunity.',
    deep: 'Mr. Market is offering discounts. But only buy if your thesis holds.',
  },
  trend_follower: {
    shallow: 'The trend broke. Cut losses and wait for new signals.',
    deep: 'Preservation comes first. Step away. The trend will return.',
  },
  // ... 7 more
}
```

### 3. getPersonalizedAlertWithContext()
```typescript
async function getPersonalizedAlertWithContext(
  master: {species: string, stats: Record<string, number>},
  alert: RiskAlert,
  exchange: ExchangeInterface,
  diary: GuardianDiary | null,
  positions: Position[],
  balances: Balance[],
): Promise<string>
```
- 构建所有可用的 context layer
- 拼接到 getPersonalizedAlert() 的结果后面
- 总 token 预算: ≤ 410 tokens (base ~150 + context ~260)
- 如果 context 超长, 按优先级截断: regime > portfolio > diary > recovery

### 4. Guardian Integration
- guardian.ts 的 evaluate() 或 alert 格式化路径调用新函数
- guardian-observer.ts 传递 diary 实例 (通过动态 import 或参数)
- 普通查询 (非 alert) 的 prompt 不受影响 (仍 150 tokens)

### 5. 向后兼容
- 如果 exchange/diary/positions 不可用, 退回到原有 getPersonalizedAlert()
- 不破坏现有 alert 格式

## Scoring Rubric
| Dimension | Weight | 本 Sprint 的 10/10 |
|---|---|---|
| Functionality | 30% | 4 层上下文正确构建, 条件判断准确 |
| Code Quality | 25% | async 正确处理, 错误不崩溃 |
| Design Taste | 20% | 恢复指导语有深度, 符合 archetype 哲学 |
| Completeness | 15% | 所有 deliverable 交付 |
| Originality | 10% | context 优先级截断设计 |

## Context Files
- `src/buddy/persona.ts`
- `src/buddy/guardian.ts`
- `src/buddy/types.ts`
- `src/buddy/diary.ts` (getEnhancedSummary)
- `src/services/market/regime.ts` (getLatestRegime)
- `src/services/market/types.ts` (MarketRegime)
- `src/services/trading/guardian-observer.ts`
- `src/services/exchange/types.ts`

## Constraints
- Max execution time: 240s
- 仅 alert 路径注入 context, 不影响普通查询
- ARCHETYPE_RECOVERY_GUIDANCE 硬编码 (不用 LLM 生成)
- 原子提交

## Lifecycle
当前状态: **ACTIVE**
