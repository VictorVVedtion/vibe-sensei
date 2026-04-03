# Sprint 52: Async Master Council (Background Debates)

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-52: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
创建异步大师会议系统。当持仓风险升高或市场发生重大变化时，多个大师在后台自动展开辩论，把结论推送给用户。扩展现有的 debate.ts 辩论引擎。

## Assigned To
opus

## Deliverables
- [ ] `src/services/companion/council.ts` — 新建：AsyncCouncil 后台辩论服务
- [ ] 集成到 CompanionEngine — 修改 engine.ts 添加 council 管理

## Acceptance Criteria

### 1. AsyncCouncil (council.ts)

```typescript
export class AsyncCouncil {
  private lastCouncilTime: number = 0
  private readonly COUNCIL_COOLDOWN = 30 * 60 * 1000  // 30 分钟

  /** 检查是否应该召开会议 */
  shouldConvene(context: CouncilContext): boolean

  /** 召开会议 — 选择 2-3 个相关大师，运行辩论 */
  async convene(context: CouncilContext): Promise<CouncilResult>
}
```

#### 触发条件 (shouldConvene)
1. portfolio heat > 60% — 持仓风险过高
2. 单一持仓 > 30% 组合 — 过度集中
3. market regime 变化 — 市场状态转换
4. 30 分钟 cooldown — 不能太频繁

#### 大师选择逻辑
根据触发原因选择最相关的 2-3 个大师 archetype：
- 高风险 → value_investor (保守) vs trend_follower (进攻)
- 集中持仓 → value_investor (分散) vs macro_trader (集中)
- 市场变化 → macro_trader (宏观) vs quant (数据)

从 MASTERS 数组中按 archetype 过滤，随机选 1 个代表。排除用户当前的守护大师（他已经在主对话中）。

#### 辩论执行
**不调用外部 AI API。** 使用预定义的立场模板：

```typescript
// 每个 archetype 对每种情境有预定义立场
const COUNCIL_STANCES: Record<string, Record<string, string>> = {
  high_risk: {
    value_investor: "风险过高。格雷厄姆说过，投资管理的本质是风险管理。应该减仓。",
    trend_follower: "如果趋势还在，持仓就该在。问题不是风险大小，是你有没有止损。",
    quant: "当前波动率处于 {regime} 状态。模型建议仓位不超过 {suggested}%。",
    // ...
  },
  concentration: { ... },
  regime_change: { ... },
}
```

#### 输出格式
```typescript
interface CouncilResult {
  trigger: string
  masters: { name: string, archetype: string, stance: string }[]
  conclusion: string  // 综合总结
  recommendation: 'reduce' | 'hold' | 'watch' | 'none'
}
```

推送到 companionReaction 的消息格式：
```
🏛️ 大师会议 — [trigger reason]
[Master1]: "[stance]"
[Master2]: "[stance]"  
结论: [conclusion]
```

### 2. 集成到 CompanionEngine

在 engine.ts 中：
- 添加 AsyncCouncil 实例
- 在 60 秒轮询中加入 council.shouldConvene() 检查
- 如果应该召开，异步调用 council.convene()，完成后推送结果
- Council 消息独立于 ProactiveMonitor 的 cooldown（有自己的 30 分钟 cooldown）

### 3. 依赖的现有代码

- `src/buddy/debate.ts` — 参考辩论格式和评分逻辑（但不直接调用，因为它需要 AI API）
- `src/buddy/types.ts` — MASTERS 数组、Master 类型
- `src/buddy/persona.ts` — archetype 定义、getMasterArchetype()
- `src/services/companion/types.ts` — CompanionConfig、TradingEvent
- `src/services/companion/engine.ts` — CompanionEngine（要修改）

## Build & Verification
1. `bun run build` 成功
2. AsyncCouncil 有 3 个触发条件
3. 大师选择基于 archetype 匹配
4. 预定义立场模板覆盖至少 3 种情境 × 4 个 archetype
5. 30 分钟 cooldown 实现
6. 集成到 CompanionEngine 的轮询循环
