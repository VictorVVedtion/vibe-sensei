# Sprint 50b: Expression System — Gemini Design Review Fixes

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-50b: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
根据 Gemini 3.1 Pro 的专业审查修复表情系统的设计问题。核心：修复特征锚点覆盖 bug、个性化表情、强化 stern 状态。

## Assigned To
opus

## Deliverables
- [ ] `src/buddy/sprite-atlas.ts` — 修改：修复所有表情问题

## 修复清单

### 1. 🚨 特征锚点覆盖 Bug（最高优先级）

以下大师的第3行包含标志性特征，表情变化时不能覆盖：

**Jim Simons** — 第3行是大胡子 `▓▓▓▓▓▓▓▓▓`
```typescript
// 之前（BUG）：笑的时候胡子被切开
happy:   [..., ' ▓▓▓▽▽▓▓▓ '],  // ❌ 胡子破损

// 修复：保留胡子完整，只通过眼睛表达
happy:   [' ░▄▓▓▓▓▄░  ', ' ▌^      ^▐', ' ▓▓▓▓▓▓▓▓▓ '],  // ✅ 笑眼 ^ ^
worried: [' ░▄▓▓▓▓▄░  ', ' ▌·      ·▐', ' ▓▓▓▓▓▓▓▓▓ '],  // ✅ 暗眼（已OK）
stern:   [' ░▄▓▓▓▓▄░  ', ' ▌━      ━▐', ' ▓▓▓▓▓▓▓▓▓ '],  // ✅ 锐利眼 ━ ━
```

**Sun Tzu** — 第3行是头盔护甲 `▀█▄▄▄▄▄▄█▀`
```typescript
// 之前（BUG）：面甲被改成嘴巴
happy:   [..., '▀█▄▄▽▽▄▄█▀ '],  // ❌ 面甲破损

// 修复：保留面甲，只通过护目缝眼睛表达
happy:   ['▄█▀▀▀▀▀▀█▄ ', '█▌✦░░░░✦▐█ ', '▀█▄▄▄▄▄▄█▀ '],  // ✅ 眼变亮 ✦
worried: ['▄█▀▀▀▀▀▀█▄ ', '█▌·░░░░·▐█ ', '▀█▄▄▄▄▄▄█▀ '],  // ✅ 眼变暗（已OK）
stern:   ['▄█▀▀▀▀▀▀█▄ ', '█▌━░░░░━▐█ ', '▀█▄▄▄▄▄▄█▀ '],  // ✅ 眼变锐利 ━
```

**John von Neumann** — 第3行是蝴蝶结 `▀▄╳╳╳▄▀`
```typescript
// 之前（BUG）：笑的时候领结消失
happy:   [..., '  ▀▄ ▽▽ ▄▀  '],  // ❌ 领结没了

// 修复：保留领结，只通过眼睛表达
happy:   ['  ▄▄▄▄▄▄▄  ', '  ▌^    ^▐  ', '  ▀▄╳╳╳▄▀  '],  // ✅ 笑眼，领结在
worried: ['  ▄▄▄▄▄▄▄  ', '  ▌·    ·▐  ', '  ▀▄╳╳╳▄▀  '],  // ✅ 暗眼，领结在
stern:   ['  ▄▄▄▄▄▄▄  ', '  ▌━    ━▐  ', '  ▀▄╳╳╳▄▀  '],  // ✅ 锐利眼，领结在
```

**同样检查所有其他大师** — 如果第3行包含标志性元素（衣领、围巾、特殊下巴结构），表情变化不能覆盖它。具体检查：
- `munehisa_homma` — 第3行 `╲▄▄╱` 是传统衣领，不要改
- `miyamoto_musashi` — 第3行 `╱▀▄▬▬▄▀╲` 有交叉剑，happy 时改了嘴但剑还在（检查是否OK）
- `nassim_taleb` — 第3行 `▓▀▄▬▬▄▀▓` 有粗脖▓，happy 改嘴但脖子在（可能OK）
- `steve_jobs` — 第3行 `▀████▀` 是黑高领，不要改

对每个大师：如果第3行有标志特征 → 保留第3行不变，只通过第2行（眼睛）表达情绪。

### 2. 个性化 Happy 表情（不要一刀切 ▽）

根据角色性格分配不同的"开心"表达方式：

| 风格 | 角色 | Happy 嘴部 | 原因 |
|------|------|-----------|------|
| 温暖微笑 | Buffett, Graham, Templeton | `▽▽` 或 `‿‿` | 慈祥老前辈 |
| 冷笑/自信 | Soros, Livermore, Druckenmiller, PTJ | `︶` 或 `⌣` | 金融大鳄不会傻笑 |
| 淡定 | Dalio, Thorp, Shannon | 保持嘴不变，眼睛变亮 | 量化/冥想型 |
| 凶笑 | Taleb, Musashi | `▽` + 保持锐利眼 | 战士型的得意 |
| 纯眼神 | Satoshi, Sun Tzu, Simons, von Neumann | 只改眼 → `✦` 或 `^` | 脸被遮挡 |
| 活力 | Musk, Karpathy, Cronje | `▽▽` 或 `‿‿` | 年轻活力派 |

### 3. 强化 Stern 状态（不只改嘴）

当前 stern 只是嘴变 `═`，跟 neutral 的 `▬` 太像。

修复：stern 时**眼睛也要变化**，变得更锐利：

| 原始眼 | Stern 眼 | 效果 |
|--------|---------|------|
| `◉` | `━` | 锐利、紧缩 |
| `●` | `━` | 同上 |
| `○` | `━` | 同上 |
| `⊙` | `⊙`(保持) | Buffett 不需要锐利，严肃但温和 |
| `▬` | `▬`(保持) | Sun Tzu 已经是最锐利的 |
| `×` | `×`(保持) | Musashi/Machiavelli 已经够凶 |
| `✦` | `✦`(保持) | Musk 保持星星眼 |
| `·` | `××` | Satoshi stern 已经是 ×× |

### 4. Satoshi worried 改进

```typescript
// 之前：·· → .. (几乎看不出)
worried: [' ▄▓███████▄', ' █▓░ ..  ░▓█', ' ▀▓██████▓▀'],  // ❌ 太微妙

// 修复：用 >< 表达协议错误/断连
worried: [' ▄▓███████▄', ' █▓░ ><  ░▓█', ' ▀▓██████▓▀'],  // ✅ 可辨识
```

### 5. 更新 eyeChars

如果某些大师的 stern 用了新眼睛字符（如 `━`），需要把新字符加入 eyeChars 数组（用于 blink 替换）。

例如：如果 Simons 的 stern 眼是 `━`，eyeChars 应该是 `['○', '━', '^']`（覆盖所有可能出现的眼睛字符）。

## 实现注意事项

- 只改 `src/buddy/sprite-atlas.ts`，不改其他文件
- 每行 portrait 仍然 ≤17 显示字符
- 检查所有 52 个大师的 emotions 字段
- Uncommon 和 Common 级别没有 emotions，不用改
- 改完后验证 eyeChars 覆盖了所有使用的眼睛字符

## Build & Verification
1. `bun run build` 成功
2. Jim Simons 的胡子在所有表情下完整
3. Sun Tzu 的面甲在所有表情下完整
4. von Neumann 的领结在所有表情下完整
5. Satoshi worried 是 >< 不是 ..
6. 金融大鳄（Soros 等）happy 不是可爱的 ▽ 而是冷笑 ︶
7. stern 状态眼睛有变化（不只是嘴变 ═）
