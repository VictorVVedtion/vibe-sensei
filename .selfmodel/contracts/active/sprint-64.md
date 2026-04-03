# Sprint 64: Abyssal Aesthetic — Terminal Visual Overhaul

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-64: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
根据 Gemini 3.1 Pro 的三轮全面设计审查，将终端从"极客玩具"升级为"深海核潜艇控制室"。统一视觉语言，消除玩具感，建立专业交易终端美学。

核心理念：**"克制的神秘感" (Restrained Mystique)** — 大师们不是在喋喋不休推销，而是像雷达上的幽暗光点，在你即将触礁时发出低沉的声呐回音。

## Assigned To
opus

## Deliverables
- [ ] `DESIGN.md` — 新建：深渊调色板 + 设计系统定义
- [ ] 全局 Emoji 替换 — 多文件：🟢🛡️📊🏛️ → 冷峻 ASCII 符号
- [ ] `src/buddy/ghost-warnings.ts` — 修改：幽灵视觉重构（去框化）
- [ ] `src/buddy/sprites.ts` — 修改：统一边框语言
- [ ] 门禁状态高亮 — 相关文件修改

## 改动清单

### 1. 创建 DESIGN.md（项目根目录）

定义 Vibe Sensei 的终端设计系统：

```markdown
# DESIGN.md — Vibe Sensei Terminal Design System

## Philosophy
深海核潜艇控制室。冰冷、精准、残酷。
克苏鲁神话的深渊感通过克制表达，不通过装饰堆砌。

## Abyssal Palette (4色系统)

| Token | 用途 | Ink Color Name | Hex 参考 |
|-------|------|---------------|---------|
| abyss-up | 涨/积极/成功 | cyan | #00FFA3 |
| abyss-down | 跌/消极/危险 | magenta | #8B008B |
| abyss-dim | 背景/边框/次要 | gray | #3B4252 |
| abyss-bright | 高亮/当前价格 | white | #ECEFF4 |

附加色:
| abyss-warn | 警告 | yellow | #EBCB8B |
| abyss-ghost | 幽灵低语 | gray (dim) | #4C566A |

## 边框语言
- 不通过边框形状区分稀有度
- 所有边框使用单线 ┌─┐│└┘
- 稀有度通过颜色亮度区分:
  - Legendary: cyan (亮)
  - Epic: white
  - Rare: gray (标准)
  - Uncommon: gray (dim)
  - Common: gray (very dim)

## 文本符号 (无 Emoji)
- 涨: [+] 或 ▲
- 跌: [-] 或 ▼
- 守护者: [*]
- 警告: [!]
- 紧急: [!!]
- 会议: >>
- 通过: [OK]
- 失败: [XX]
- 信息: [i]

## 消息类型视觉语言
- 大师对话: 圆角气泡 ╭╮╰╯ (现有)
- 系统警告: 整行背景反色 (无框)
- 幽灵低语: dim 灰色文本，无框，斜体感 (...text... - Name)
- 会议结论: >> 前缀缩进
- 门禁状态: 反色 tag [OK] / [XX]

## 信息层次
- P0: K线图 / 价格 / 仓位 PnL
- P1: 风控警告 / 门禁状态
- P2: 大师对话 / 气泡
- P3: 章鱼 / 大师肖像 (默认折叠)
```

### 2. 全局 Emoji 替换

搜索所有 .ts/.tsx 文件中的 Emoji 字符，替换为 ASCII 符号：

| 位置 | 之前 | 之后 |
|------|------|------|
| trade-card.ts | `🟢` BUY | `[+]` BUY |
| trade-card.ts | `🔴` SELL | `[-]` SELL |
| REPL/welcome | `🛡️` Guardian | `[*]` Guardian |
| sprites.ts ARCHETYPE_EMBLEMS | `📊📈🌍🔢⚔️🧠💡🔬` | 不改 — 这些在肖像框内用，不在正文 |
| ghost-warnings.ts | 任何 Emoji | 移除 |
| guardian-observer.ts | 任何 Emoji | 移除 |
| proactive-monitor.ts | `🏛️` 大师会议 | `>>` COUNCIL |

**注意：** sprite-atlas.ts 和 sprites.ts 的 ARCHETYPE_EMBLEMS 里的 emoji（📊📈等）是在肖像框的 name 行使用的。这些保留还是替换取决于：
- 如果替换，name 行会变成 `[▪] Warren Buffett` — 更冷峻
- 如果保留，保持辨识度但有玩具感

**建议保留 ARCHETYPE_EMBLEMS 中的 emoji** — 它们在肖像框内是视觉锚点，不是正文装饰。但如果某些 emoji 在特定终端渲染有问题，可以用 Unicode 符号替代（如 ⚔ 不带 VS16 修饰符）。

### 3. 幽灵视觉重构 (ghost-warnings.ts)

当前：幽灵警告是一个普通的文字消息，通过 companionReaction 推送到气泡框。

改为：幽灵出现时，消息文本本身包含特殊格式，让它看起来像"深海低语"而不是正常对话：

```typescript
// 之前
const message = `${ghost.name}: "${ghost.quote}"`

// 之后 — 幽灵低语格式
const message = `...${ghost.quote.toLowerCase()}... - ${ghost.name}`
// 例如: "...i thought risk management was optional too... - Sam Bankman-Fried"
```

这样即使在普通气泡框中显示，文本风格也与大师的正式语气不同 — 小写、省略号、像低语。

**如果要进一步** — 在 CompanionSprite.tsx 中检测到幽灵消息时，改变气泡颜色为 dim gray。可以通过在消息前加特殊标记 `[GHOST]` 然后在渲染层检测。但这涉及改 CompanionSprite.tsx，可能过于复杂。简单的文本格式化就够了。

### 4. 边框统一 (sprites.ts)

当前 getBorderChars() 返回 3 种边框：
```
legendary: ╔═╗║╚╝  (双线)
epic:      ╭─╮│╰╯  (圆角)
default:   ┌─┐│└┘  (单线)
```

改为所有稀有度统一使用单线，通过**颜色**区分：
```typescript
function getBorderChars(_rarity: Rarity): [string, string, string, string, string, string] {
  // 统一单线边框 — 稀有度通过颜色区分（在 CompanionSprite.tsx 中）
  return ['┌', '┐', '└', '┘', '─', '│']
}
```

但是！这是一个**有争议的改动**。双线/圆角是 Sprint 49 设计审查通过的稀有度视觉差异。如果统一为单线，需要确保颜色差异足够明显。

**保守方案：** 保持现有 3 种边框，因为在某些终端颜色显示不佳时，边框形状是唯一的区分手段。这符合 Sprint 50b 的"无颜色也能区分"原则。

**选择保守方案** — 保持 3 种边框不变。

### 5. 门禁状态高亮

在 PreTradeGateTool 的输出中，PASS/WARN/FAIL 状态词需要更突出。

查找 gate 检查的输出格式化代码，确保：
- PASS: cyan 色 `[OK]`
- WARN: yellow 色 `[!]`  
- FAIL: magenta 色 `[XX]`

如果当前输出是纯文本字符串（非 Ink 组件），可能无法直接加颜色。检查实际输出方式后决定。

## Build & Verification
1. `bun run build` 成功
2. DESIGN.md 存在于项目根目录
3. 正文中无 🟢🔴🛡️🏛️ 等 Emoji（肖像框内的 ARCHETYPE_EMBLEMS 可保留）
4. 幽灵消息使用低语格式（小写 + 省略号）
5. grep 验证：`grep -r "🟢\|🔴\|🛡" src/ --include="*.ts" --include="*.tsx" | grep -v sprite-atlas | grep -v ARCHETYPE_EMBLEMS` 应该无结果
