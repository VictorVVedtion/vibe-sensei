# Sprint 51: Proactive Companion Engine (Async Interjections)

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-51: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
创建主动对话引擎。大师不再只是被动回应交易，而是会在安静时刻主动插话 — 提醒你休息、警告市场变化、干预危险行为、表扬连续盈利。这是"陪伴"的核心。

## Assigned To
opus

## Deliverables
- [ ] `src/services/companion/engine.ts` — 新建：CompanionEngine 中央协调器
- [ ] `src/services/companion/proactive-monitor.ts` — 新建：4类触发器 + cooldown 系统
- [ ] `src/services/companion/types.ts` — 新建：共享类型定义
- [ ] 集成到 REPL 或 query loop — 修改：启动 monitor，连接 companionReaction

## Acceptance Criteria

### 1. CompanionEngine (engine.ts)

中央协调器，管理所有 companion 子服务的生命周期：

```typescript
export class CompanionEngine {
  private monitor: ProactiveMonitor
  private expression: ExpressionEngine  // Sprint 50 已有
  
  constructor(config: CompanionConfig) {}
  
  /** 启动所有子服务 */
  start(): void
  
  /** 停止所有子服务 */
  stop(): void
  
  /** 处理交易事件 (guardian-observer 调用) */
  handleTradingEvent(event: TradingEvent): void
  
  /** 获取当前状态 */
  getStatus(): CompanionStatus
}
```

CompanionConfig:
```typescript
interface CompanionConfig {
  enabled: boolean
  proactiveEnabled: boolean
  cooldownMs: number        // 默认 300_000 (5分钟)
  sessionStartTime: number  // Date.now()
}
```

### 2. ProactiveMonitor (proactive-monitor.ts)

4 类触发器，每类独立检查：

#### 2a. 时间触发器 (SessionTimer)
- 盯盘超 2 小时 → 提醒休息
- 凌晨 0-5 点交易 → 提醒注意力下降
- 连续 session 超 4 小时 → 强烈建议休息
- 实现：检查 sessionStartTime 与 Date.now() 差值

#### 2b. 行为触发器 (BehaviorWatcher)  
- 检测 diary.ts 的行为模式：
  - revenge trading detected → 大师主动干预："停下来。你在追损。"
  - averaging down detected → 警告
  - 连续 3+ 亏损 → 安慰 + 建议暂停
- 需要从 diary 获取最近交易模式
- 实现：调用 diary 的 checkBehavioralPatterns() (Sprint 45 已有)

#### 2c. 市场触发器 (MarketWatcher)
- market regime 变化 (trending→ranging, 等) → 通知
- portfolio heat 超过阈值 (>60%) → 警告
- 实现：调用 market-regime.ts 的 getCurrentRegime() 和 portfolio-heat.ts 的 calculateHeat()
- 注意：这些函数需要 exchange 连接，如果不可用就跳过

#### 2d. 鼓励触发器 (EncouragementWatcher)
- 连续 3+ 盈利交易 → 表扬
- 遵守了止损 → 肯定纪律
- R-multiple > 2 → 特别赞扬
- 实现：从 diary 获取最近交易记录

### 3. Cooldown 系统

```typescript
class CooldownManager {
  private lastInterjection: number = 0
  private cooldownMs: number
  
  /** 是否可以说话 */
  canSpeak(): boolean {
    return Date.now() - this.lastInterjection >= this.cooldownMs
  }
  
  /** 记录一次说话 */
  recordSpeak(): void {
    this.lastInterjection = Date.now()
  }
}
```

- 默认 cooldown: 5 分钟
- 严重级别可以无视 cooldown (emergency/critical)
- 低级别遵守 cooldown

### 4. 消息生成

大师说话必须用自己的人格风格。消息格式：

```typescript
interface ProactiveMessage {
  trigger: TriggerType      // 'time' | 'behavior' | 'market' | 'encouragement'
  severity: 'gentle' | 'firm' | 'urgent'
  message: string           // 大师风格的消息文本
  emotion: Emotion          // 触发的表情变化
}
```

消息模板 — 每个触发器有 2-3 个模板，用大师的 archetype 风格化：
```
// 休息提醒 (gentle)
value_investor: "你已经盯盘 {hours} 小时了。巴菲特一年只做几笔交易。关上屏幕，去思考。"
trend_follower: "趋势不会因为你盯着看就改变。{hours} 小时了，休息一下。"
strategist: "知进退者不殆。休息是战略的一部分。"

// revenge trading (firm)
value_investor: "停。你在追损。Rule #1: 永远不要亏钱。Rule #2: 永远不要忘记 Rule #1。"
quant: "数据显示你在情绪交易。模型不会犯这种错误。暂停，让系统冷却。"

// 鼓励 (gentle)
value_investor: "连续 {count} 笔盈利。好的投资像看漆变干一样无聊。保持。"
strategist: "连胜 {count} 场。但善战者无赫赫之功 — 保持谦逊。"
```

**不需要调用外部 AI API 生成消息。** 用预定义模板 + archetype 变量即可。简单、快速、零成本。

### 5. 集成点

**推送机制：** 使用现有 `companionReaction`：
```typescript
import { useSetAppState } from '../../state/AppState.js'
// 或者通过全局 store
setAppState(prev => ({ ...prev, companionReaction: message.message }))
```

**启动时机：** 
- 在 REPL 启动时创建 CompanionEngine 实例
- 或者在 query.ts 的初始化阶段
- 建议在 `src/buddy/companion.ts` 的 `getCompanion()` 调用后初始化

**轮询方式：**
```typescript
// 每 60 秒检查一次所有触发器
const CHECK_INTERVAL = 60_000
setInterval(() => {
  const trigger = monitor.check()
  if (trigger && cooldown.canSpeak()) {
    pushMessage(trigger)
    cooldown.recordSpeak()
    expression.setEmotion(trigger.emotion, 15_000)
  }
}, CHECK_INTERVAL)
```

**注意：** 触发器检查必须是非阻塞的。如果 diary/regime/heat 数据不可用（exchange 未连接、diary 为空），静默跳过。永远不要因为 proactive monitor 的错误阻塞用户的正常交易操作。

### 6. 错误处理

- diary 不可用 → 跳过行为触发器
- market-regime 不可用 → 跳过市场触发器
- exchange 未连接 → 跳过需要 exchange 的检查
- 所有触发器检查 wrap 在 try/catch 里，失败时 console.error + 继续

## Build & Verification
1. `bun run build` 成功
2. `src/services/companion/` 下有 engine.ts, proactive-monitor.ts, types.ts
3. ProactiveMonitor 有 4 类触发器
4. CooldownManager 实现 5 分钟默认间隔
5. 消息模板覆盖至少 4 个 archetype
6. 每个触发器检查都有 try/catch 保护
