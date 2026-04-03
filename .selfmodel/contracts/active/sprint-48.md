# Sprint 48: Enhanced Ghost Triggers (4 New Financial Ghosts)

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-48: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
添加 LTCM、Lehman、Enron、SVB 四个新金融幽灵警告

## Assigned To
opus

## Deliverables
- [ ] `src/buddy/types.ts` — 修改：GHOST_WARNINGS 数组添加 4 个新幽灵条目
- [ ] `src/buddy/checks/ghost-triggers.ts` — 修改：添加 4 个新 check 函数
- [ ] `src/buddy/ghost-warnings.ts` — 修改：更新 GhostEngine, 支持 8 个幽灵, 添加 per-ghost 冷却
- [ ] `src/buddy/ghost-persona.ts` — 新建：每个幽灵的语气和恢复建议

## Acceptance Criteria

### 1. 四个新幽灵定义 (types.ts)
在 GHOST_WARNINGS 数组中添加:
- `ltcm` — "Long-Term Capital Management", trigger: 'correlation_collapse', quote: "We thought diversification would save us. It didn't."
- `lehman` — "Lehman Brothers", trigger: 'cascade_liquidation', quote: "The music stopped. We were still dancing."
- `enron` — "Enron", trigger: 'concentrated_loser', quote: "We believed our own story too deeply."
- `svb` — "Silicon Valley Bank", trigger: 'duration_mismatch', quote: "We held too long, hoping the rates would turn."

### 2. 四个新触发器 (ghost-triggers.ts)

**2a. LTCM — 相关性崩塌**
- `checkLtcmTrigger(positions, exchange)`: 需要 3+ 持仓
- 对每个持仓获取 ticker, 计算各持仓的百分比变动
- 如果某持仓变动偏离中位数 >3x → 触发
- 数据: positions + getTicker per symbol (用 currentPrice vs entryPrice)

**2b. Lehman — 级联清算**
- `checkLehmanTrigger(positions, balances, ticker24hAgo, currentTicker)`:
- 条件: 总杠杆 > 2x AND 市场(BTC)过去 24h 下跌 > 5%
- 杠杆 = Σ|qty × currentPrice| / Σbalance.total

**2c. Enron — 集中亏损**
- `checkEnronTrigger(positions, balances)`:
- 条件: 单一持仓 > 60% 组合价值 AND 该持仓 unrealizedPnlPercent < 0

**2d. SVB — 长期套牢**
- `checkSvbTrigger(positions)`:
- 条件: 持仓时间 > 14 天 AND unrealizedPnlPercent < -15%
- 注意: Position 可能没有 entryTime，使用 entryPrice 与 currentPrice 的比较 + 启发式方法

### 3. GhostEngine 更新 (ghost-warnings.ts)
- `checkAll()` 运行全部 8 个 ghost check (原 4 + 新 4)
- 添加 per-ghost 冷却: `ghostCooldowns: Map<string, number>`
- 冷却时间: 60 分钟 per ghost
- 移除 `triggeredThisSession` 的一次性限制，改为 per-ghost cooldown
- 扩展 GhostContext 接口添加必要的新字段

### 4. Ghost Persona (ghost-persona.ts)
- 导出 `GHOST_PERSONAS: Record<string, {tone, recovery}>` 对象
- 8 个幽灵各有独特的 tone 描述和 recovery 建议
- 导出 `formatGhostWarningWithPersona(warning)` 格式化函数
- 使用 ANSI 转义码: bold, dim, italic

### 5. 集成
- 新触发器与现有架构一致 (返回 GhostWarning | null)
- 不破坏现有 4 个幽灵的行为
- 所有新代码有完整 TypeScript 类型

## Scoring Rubric
| Dimension | Weight | 本 Sprint 的 10/10 |
|---|---|---|
| Functionality | 30% | 所有 4 个触发器条件正确，冷却机制有效 |
| Code Quality | 25% | 类型完整，每个触发器 <40 行，无 any |
| Design Taste | 20% | 幽灵语录有震撼力，persona tone 风格独特 |
| Completeness | 15% | 所有 deliverable 交付 |
| Originality | 10% | 触发条件设计合理有创意 |

## Context Files
- `src/buddy/ghost-warnings.ts`
- `src/buddy/checks/ghost-triggers.ts`
- `src/buddy/types.ts`
- `src/buddy/guardian.ts`
- `src/services/exchange/types.ts`

## Constraints
- Max execution time: 240s
- 非交互执行
- 禁止 TODO / mock / placeholder
- 原子提交
- 不修改现有 4 个幽灵的触发逻辑
- 不创建新的 npm 依赖

## E2E Depth
- Depth: quick
- Notes: 验证类型正确和 checkAll 不崩溃

## Lifecycle
当前状态: **ACTIVE**
