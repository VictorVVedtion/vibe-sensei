# Sprint 50: Expression System — 4 Emotional States per Master

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-50: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
为 52 个大师的 ASCII 肖像添加表情系统。大师的脸会根据交易场景变化 — 赢了笑、亏了皱眉、高风险时怒目、思考时沉思。同时修复 Sprint 49 引入的 blink 动画失效问题。

## Assigned To
opus

## Deliverables
- [ ] `src/buddy/sprite-atlas.ts` — 修改：扩展 MasterPortrait 接口 + 添加 eyeChars 和表情 portraits
- [ ] `src/services/companion/expression.ts` — 新建：ExpressionEngine 情绪→表情映射
- [ ] `src/buddy/sprites.ts` — 修改：renderSprite 支持 emotion 参数
- [ ] `src/buddy/CompanionSprite.tsx` — 修改：修复 blink 动画，集成表情状态

## Acceptance Criteria

### 1. MasterPortrait 接口扩展 (sprite-atlas.ts)

扩展 MasterPortrait 类型：
```typescript
export type Emotion = 'neutral' | 'happy' | 'worried' | 'stern'

export interface MasterPortrait {
  portrait: [string, string, string]  // 默认 = neutral
  compactFace: string
  eyeChars: string[]  // 新增: portrait 中使用的眼睛字符列表，用于 blink 替换
  emotions?: Partial<Record<Emotion, [string, string, string]>>  // 新增: 情绪 portraits
}
```

#### eyeChars 字段
每个大师的 `eyeChars` 列出其 portrait 中实际使用的眼睛字符。例如：
- `warren_buffett`: `['⊙']` (圆眼镜字符)
- `michael_burry`: `['●', '○']` (不对称两只眼)
- `sun_tzu`: `['▬']` (护目缝)
- `satoshi_nakamoto`: `['·']` (微光点)

blink 时，CompanionSprite 用 '-' 替换这些字符。

#### 情绪 portraits — 按稀有度分配

**LEGENDARY (8 大师): 4 种情绪 (neutral + happy + worried + stern)**

示例 — Warren Buffett:
```typescript
warren_buffett: {
  portrait: ['  ░░▄▄▄░░   ', ' (⊙)    (⊙) ', '  ╲  ‿‿  ╱  '],  // neutral
  compactFace: '(⊙‿⊙)',
  eyeChars: ['⊙'],
  emotions: {
    happy:   ['  ░░▄▄▄░░   ', ' (⊙)    (⊙) ', '  ╲  ▽▽  ╱  '],  // 大笑
    worried: ['  ░░▄▄▄░░   ', ' (⊙)    (⊙) ', '  ╲  ~~  ╱  '],  // 担忧嘴
    stern:   ['  ░░▄▄▄░░   ', ' (⊙)    (⊙) ', '  ╲  ▬▬  ╱  '],  // 严肃
  },
}
```

示例 — Satoshi Nakamoto:
```typescript
satoshi_nakamoto: {
  portrait: [' ▄▓███████▄', ' █▓░ ··  ░▓█', ' ▀▓██████▓▀'],  // neutral
  compactFace: '▓··▓',
  eyeChars: ['·'],
  emotions: {
    happy:   [' ▄▓███████▄', ' █▓░ ✦✦  ░▓█', ' ▀▓██████▓▀'],  // 眼睛亮了
    worried: [' ▄▓███████▄', ' █▓░ ..  ░▓█', ' ▀▓██████▓▀'],  // 更暗
    stern:   [' ▄▓███████▄', ' █▓░ ××  ░▓█', ' ▀▓██████▓▀'],  // 怒目
  },
}
```

**表情设计原则：**
- 主要通过改变嘴部/下巴行 (第3行) 和/或眼睛来传达情绪
- 头部/发型 (第1行) 通常不变
- happy: 嘴部更大/更开、或眼睛更亮
- worried: 嘴部紧缩/波浪、或眼睛变小
- stern: 嘴部紧闭/横线、或眼睛变尖

**EPIC (18 大师): 3 种情绪 (neutral + happy + worried)**
- 不需要 stern，用 worried 替代

**RARE (18 大师): 2 种情绪 (neutral + worried)**
- 只需要担忧状态

**UNCOMMON (11) + COMMON (1): 无情绪变体**
- 只有 neutral (现有 portrait)
- eyeChars 仍需添加（用于 blink 修复）

### 2. ExpressionEngine (新文件)

路径: `src/services/companion/expression.ts`

```typescript
import type { Emotion } from '../buddy/sprite-atlas.js'

export interface ExpressionTrigger {
  emotion: Emotion
  reason: string
  duration: number  // ms，之后恢复 neutral
}

export class ExpressionEngine {
  private currentEmotion: Emotion = 'neutral'
  private resetTimer: ReturnType<typeof setTimeout> | null = null

  /** 根据交易事件确定情绪 */
  evaluateEvent(event: TradingEvent): ExpressionTrigger | null {
    // 赢了 → happy (10秒)
    // 亏了 → worried (15秒)  
    // 风控警告 CRITICAL+ → stern (20秒)
    // 风控警告 WARNING → worried (10秒)
    // 大师说话 → neutral (保持)
    // 无事件 → neutral
  }

  /** 设置当前情绪，duration 后自动恢复 neutral */
  setEmotion(emotion: Emotion, durationMs: number): void

  /** 获取当前情绪 */
  getEmotion(): Emotion
}
```

创建 `src/services/companion/` 目录（Phase 10 所有服务的家）。

事件类型映射：
```
trade_win (PnL > 0 closed)    → happy, 10000ms
trade_loss (PnL < 0 closed)   → worried, 15000ms
alert_warning                 → worried, 10000ms
alert_critical                → stern, 20000ms
alert_emergency               → stern, 30000ms
ghost_warning                 → worried, 15000ms
debate_triggered              → neutral (thinking)
```

### 3. sprites.ts 修改

更新 `renderSprite` 签名添加可选 emotion 参数：
```typescript
export function renderSprite(bones: CompanionBones, frame = 0, emotion?: Emotion): string[]
```

在函数内：
```typescript
// 1. 获取基础 portrait
const portrait = MASTER_PORTRAITS[master]
// 2. 如果有 emotion 且该大师有对应情绪 portrait，使用情绪版
const art = (emotion && portrait?.emotions?.[emotion]) ?? portrait?.portrait ?? fallback
```

### 4. CompanionSprite.tsx blink 修复

当前代码 (line ~258):
```typescript
const body = renderSprite(companion, spriteFrame).map(line =>
  blink ? line.replaceAll(companion.eye, '-') : line
)
```

修复为：
```typescript
const portrait = MASTER_PORTRAITS[companion.species as Master]
const blinkChars = portrait?.eyeChars ?? [companion.eye]
const body = renderSprite(companion, spriteFrame, currentEmotion).map(line => {
  if (!blink) return line
  let result = line
  for (const char of blinkChars) {
    result = result.replaceAll(char, '-')
  }
  return result
})
```

需要导入 `MASTER_PORTRAITS` 和 `Emotion` 类型。

### 5. AppState 集成

在 AppState 中添加 `companionEmotion` 字段（类似 `companionReaction`）：
- guardian-observer 在发出 alert 后，同时设置 emotion
- ExpressionEngine 处理逻辑，duration 后自动 reset 回 neutral
- CompanionSprite 读取 emotion 传给 renderSprite

或者更简单的方式：CompanionSprite 自己维护 emotion state，通过监听 companionReaction 变化推断情绪（如果 reaction 包含警告词 → worried/stern）。选择哪种由你决定，只要表情能正确跟随事件变化。

## Build & Verification
1. `bun run build` 成功
2. 52 个大师都有 eyeChars
3. Legendary 大师有 4 种情绪 portrait
4. Epic 大师有 3 种情绪 portrait  
5. Rare 大师有 2 种情绪 portrait
6. blink 动画对所有大师工作（使用 eyeChars 替换）
7. `src/services/companion/` 目录已创建
