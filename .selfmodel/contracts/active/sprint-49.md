# Sprint 49: 52 Guardian Masters — Personality-Driven ASCII Portraits

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-49: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
为 52 个 guardian master 创建独特的 personality-driven ASCII 头像画像系统。每个大师需要基于其个性、历史形象和标志性特征设计独特的 ASCII art 肖像，取代当前千篇一律的通用框。

## Assigned To
opus

## Deliverables
- [ ] `src/buddy/sprite-atlas.ts` — 新建：52 个大师的 ASCII art 肖像定义
- [ ] `src/buddy/sprites.ts` — 修改：渲染引擎升级（8行框、稀有度边框、padTo修复）
- [ ] `src/buddy/CompanionSprite.tsx` — 修改：高度守卫、blink 逻辑修复

## Acceptance Criteria

### 1. sprite-atlas.ts（新文件，~500 行）

创建 `MasterPortrait` 接口和 `MASTER_PORTRAITS` 常量：

```typescript
import type { Master } from './types.js'

export interface MasterPortrait {
  portrait: [string, string, string]  // 3 行 ASCII art，每行 ≤17 字符
  compactFace: string                 // 窄终端用的 4-6 字符紧凑脸
}

export const MASTER_PORTRAITS: Record<Master, MasterPortrait> = { /* 全部 52 个 */ }
```

**每个大师的肖像必须基于其人格设计，不是通用模板。关键设计指南：**

#### LEGENDARY (8) — 最大细节，使用 ▓░ 着色

| Master | 视觉特征 | Portrait 设计 | CompactFace |
|--------|---------|--------------|-------------|
| `jesse_livermore` | 1920s 油头、锐利眯眼、高衣领 | `▄▓▓▓▓▓▓▓▄` / `▌◉▬▬▬▬◉▐░` / `▀▄▄▄▬▄▄▄▀` | `◉▬▬◉` |
| `george_soros` | 厚重眉脊、棱角下巴、深邃眼 | `░▄▄▄▄▄▄▄░` / `▓▌◉    ◉▐▓` / `▀▄▬▬▬▄▀` | `▓◉◉▓` |
| `warren_buffett` | 圆脸、圆框眼镜、温暖笑容 | `░░▄▄▄░░` / `(⊙)    (⊙)` / `╲  ‿‿  ╱` | `(⊙‿⊙)` |
| `benjamin_graham` | 细框眼镜、高学者额头 | `▄▄▄▄▄▄` / `┌○┐    ┌○┐` / `▀▄────▄▀` | `┌○○┐` |
| `jim_simons` | 大胡子、眼镜、秃顶数学家 | `░▄▓▓▓▓▄░` / `▌○      ○▐` / `▓▓▓▓▓▓▓▓▓` | `○▓▓○` |
| `sun_tzu` | 战士头盔、护目缝、全装甲 | `▄█▀▀▀▀▀▀█▄` / `█▌▬░░░░▬▐█` / `▀█▄▄▄▄▄▄█▀` | `█▬▬█` |
| `satoshi_nakamoto` | 深兜帽、全脸阴影、仅见眼光 | `▄▓███████▄` / `█▓░ ··  ░▓█` / `▀▓██████▓▀` | `▓··▓` |
| `john_von_neumann` | 高额头、整齐发型、蝴蝶结 | `▄▄▄▄▄▄▄` / `▌◉    ◉▐` / `▀▄╳╳╳▄▀` | `◉╳◉` |

#### EPIC (18) — 好细节，个性特征

| Master | 视觉特征 | Portrait 设计 | CompactFace |
|--------|---------|--------------|-------------|
| `paul_tudor_jones` | 厚发、运动下巴 | `▄▓▓▓▓▓▓▄` / `▌●    ●▐` / `▀▄══▄▀` | `●══●` |
| `stanley_druckenmiller` | 高头型、严肃集中 | `▄▓▓▓▓▓▄` / `▌◉    ◉▐` / `▀▄▄▄▀` | `◉▄◉` |
| `michael_burry` | 凌乱发、不对称眼（●真/○假） | `░▓▄▓░▓▄░` / `▌●    ○▐` / `▀▄──▄▀` | `●··○` |
| `charlie_munger` | 超大厚框眼镜[◉]、下垂腮 | `░░▄▄░░` / `[◉]    [◉]` / `▀▀▬▬▀▀` | `[◉◉]` |
| `ray_dalio` | 冥想半闭眼─、禅意 | `░▄▄▄▄░` / `▌─    ─▐` / `▀▄▄▀` | `─∿─` |
| `ed_thorp` | 学术整洁、精确薄唇 | `▄▄▄▄▄` / `▌○    ○▐` / `▀──▀` | `○♠○` |
| `munehisa_homma` | 高乌帽子、商人 | `▄██▀▀▀██▄` / `▌●    ●▐` / `╲▄▄╱` | `██●●` |
| `miyamoto_musashi` | 发髻┃▓▓┃、凶猛×眼、交叉剑 | `┃▓▓┃` / `▌×    ×▐` / `╱▀▄▬▬▄▀╲` | `┃××┃` |
| `nassim_taleb` | 短发、宽脸▓粗脖、举重感 | `▄▓▓▓▓▄` / `▓▌●    ●▐▓` / `▓▀▄▬▬▄▀▓` | `▓●●▓` |
| `elon_musk` | 现代发型、星星✦眼、棱角下巴 | `▄▄▄▄▄▄` / `▌✦    ✦▐` / `╲▀▄▄▀╱` | `✦╱╲✦` |
| `peter_thiel` | 整洁短发、激光聚焦◉ | `▄▄▄▄▄` / `▌◉    ◉▐` / `▀▄▄▀` | `◉→◉` |
| `garry_tan` | 现代发型、┌●┐现代眼镜 | `▄▓▓▓▄` / `┌●┐    ┌●┐` / `▀▄▄▀` | `┌●●┐` |
| `andrej_karpathy` | 科技风、分析眼、░神经网纹理 | `▄▄▄▄▄` / `▌○    ○▐` / `░▀▄▄▀░` | `○≡○` |
| `li_ka_shing` | 年长、┌◉┐商务眼镜 | `░░▄▄░░` / `┌◉┐    ┌◉┐` / `▀▬▬▀` | `◉▬◉` |
| `vitalik_buterin` | 极瘦面、小·眼、极窄下巴 | `▄▄▄▄▄▄` / `▌·    ·▐` / `▀▄▀` | `·◇·` |
| `alan_turing` | 1940s 偏分发、清晰分析眼 | `▄▓▄▄▄▄▄` / `▌●    ●▐` / `▀▄▄▀` | `●01●` |
| `benoit_mandelbrot` | 分形发░▓交替、大圆眼镜 | `░▓░▓░▓░▓░` / `┌○┐    ┌○┐` / `▀▄▄▄▄▀` | `░○○░` |
| `claude_shannon` | 1950s 整洁、尖锐聚焦 | `▄▓▓▓▓▓▄` / `▌●    ●▐` / `▀▄▄▀` | `●10●` |

#### RARE (18) — 中等细节

| Master | 视觉特征 | Portrait 设计 | CompactFace |
|--------|---------|--------------|-------------|
| `john_paulson` | 保守对冲基金发型 | `▄▓▓▓▓▄` / `▌●    ●▐` / `▀▄▄▀` | `●$●` |
| `john_templeton` | 年长蝴蝶结╳╳ | `░▄▄▄░` / `▌○    ○▐` / `▀╳╳▀` | `○╳○` |
| `richard_dennis` | 70-80s 发型、宽脸 | `▄▓▓▓▓▄` / `▌●    ●▐` / `▀▄▬▄▀` | `●▬●` |
| `fan_li` | 简单头巾─、流袍衣领╲╱ | `─▄▄▄▄▄─` / `▌·    ·▐` / `╲▄▄▄╱` | `─··─` |
| `lv_buwei` | 官冠█▀▀█、精明 | `▄█▀▀▀▀█▄` / `▌●    ●▐` / `▀▄▄▀` | `█●●█` |
| `seneca` | 罗马秃头、斯多葛眼、短胡▓▓▓ | `░▄▄▄░` / `▌◉    ◉▐` / `▀▓▓▓▀` | `◉▓◉` |
| `laozi` | 禅意半闭眼─、长飘胡░▓▓▓▓░ | `░▄▄▄░` / `▌─    ─▐` / `░▓▓▓▓░` | `─▓▓─` |
| `jeff_bezos` | 光头░░░、强壮下巴▬▬ | `░░░░░` / `▌●    ●▐` / `▀▄▬▬▄▀` | `░●●░` |
| `steve_jobs` | 圆眼镜(○)、黑高领████ | `▄▄▄▄▄` / `(○)    (○)` / `▀████▀` | `(○○)` |
| `richard_feynman` | 卷发░▓交替、顽皮宽笑 | `░▓░▓░▓░` / `▌●    ●▐` / `▀▬▬▀` | `●▬▬●` |
| `hu_xueyan` | 红顶官帽●▀▀●、商人 | `▄●▀▀▀●▄` / `▌·    ·▐` / `▀▄▄▀` | `●··●` |
| `zeng_guofan` | 军帽██▀▀██、严肃 | `▄██▀▀██▄` / `▌●    ●▐` / `▀▄▄▀` | `██●●` |
| `bai_gui` | 简单布帽─▄▄─、学者胡── | `─▄▄▄▄─` / `▌·    ·▐` / `▀──▀` | `·──·` |
| `cz_zhao` | 现代短发、自信 | `▄▄▄▄▄` / `▌●    ●▐` / `▀▄▄▀` | `●₿●` |
| `he_yi` | 女性长发▓▓▓▓▓▓、明亮✦眼 | `▄▓▓▓▓▓▓▄` / `▌✦    ✦▐` / `▀▄▄▀` | `▓✦✦▓` |
| `isaac_newton` | 大卷假发░▓▓▓▓▓▓▓░ | `░▓▓▓▓▓▓▓░` / `▓▌◉    ◉▐▓` / `▀▄▄▄▀` | `▓◉◉▓` |
| `albert_einstein` | 两侧翘发(中间空)、八字胡 | `░▓░    ░▓░` / `▌●    ●▐` / `▀▓▓▓▓▀` | `░●●░` |
| `carl_gauss` | 19世纪学术帽▄▀▀▀▄、鬓角▓ | `▄▀▀▀▀▀▄` / `▓▌●    ●▐▓` / `▀▄▄▀` | `▓●●▓` |

#### UNCOMMON (11) — 简洁，1-2 个特征

| Master | 视觉特征 | Portrait | CompactFace |
|--------|---------|----------|-------------|
| `nicolas_darvas` | 优雅梳发、修长 | `▄▄▄▄▄` / `▌●    ●▐` / `▀▄▀` | `●□●` |
| `linda_raschke` | 女性发型、✦锐眼 | `▄▓▓▓▓▄` / `▌✦    ✦▐` / `▀▄▀` | `✦▬✦` |
| `machiavelli` | 文艺复兴帽▄▀▀▀▀▄、×狡猾眼 | `▄▀▀▀▀▄` / `▌×    ×▐` / `▀▄▀` | `▀××▀` |
| `arthur_hayes` | 现代眼镜┌●┐ | `▄▄▄▄` / `┌●┐  ┌●┐` / `▀▄▀` | `┌●●┐` |
| `victor_sperandeo` | 稀疏老兵发、▬口 | `▄▄▄▄` / `▌●    ●▐` / `▀▄▬▀` | `●▬●` |
| `larry_williams` | 花白发░、观察○眼 | `░▄▄░` / `▌○    ○▐` / `▀▀` | `○  ○` |
| `zong_qinghou` | 实用整洁发 | `▄▄▄▄` / `▌●    ●▐` / `▀▄▀` | `●步●` |
| `shen_wansan` | 明代商人帽▄▀▀▀▄ | `▄▀▀▀▄` / `▌·    ·▐` / `▀▄▀` | `▀··▀` |
| `zhang_jian` | 晚清现代发 | `▄▄▄▄` / `▌●    ●▐` / `▀▄▀` | `●工●` |
| `andre_cronje` | 连帽衫████、✦黑客眼 | `▄████▄` / `▌✦    ✦▐` / `▀▄▀` | `█✦✦█` |
| `xu_mingxing` | 商务整洁发 | `▄▄▄▄` / `▌●    ●▐` / `▀▄▀` | `●⚡●` |

#### COMMON (1) — 最简

| Master | 视觉特征 | Portrait | CompactFace |
|--------|---------|----------|-------------|
| `william_oneil` | 标准商务发、简单 | `▄▄▄▄` / `(●    ●)` / `▀▀` | `●●` |

**字符调色板规则：**
- 结构: `( ) / \ _ - ~ ^ | ─`
- 着色: `█ ▓ ░ ▀ ▄ ▌ ▐`（block elements，终端通用）
- 脸部: `. : ; ' " * # = + < >`
- 特殊: `◉ ● ○ · ✦ × ° ▬ ╱ ╲ ╳ ┤ ├ ╰ ╯ ⊙ ‿`
- **禁止**: portrait 内使用 emoji（宽度不可预测）

### 2. sprites.ts 渲染引擎升级

#### 2a. 导入
```typescript
import { MASTER_PORTRAITS } from './sprite-atlas.js'
import type { Rarity } from './types.js'
import { stringWidth } from '../ink/stringWidth.js'
```

#### 2b. 添加 `getBorderChars(rarity: Rarity)` 函数
根据稀有度返回不同边框字符 `[tl, tr, bl, br, hz, vt]`：
- common / uncommon / rare: 单线 `┌─┐│└┘`
- epic: 圆角 `╭─╮│╰╯`
- legendary: 双线 `╔═╗║╚╝`

#### 2c. 修复 `padTo()` 函数
当前 `padTo()` 使用 `.length` 计算宽度，对 emoji/Unicode 不准。改用 `stringWidth()` 从 `src/ink/stringWidth.ts`：
```typescript
function padTo(text: string, width: number): string {
  const w = stringWidth(text)
  if (w >= width) return text.slice(0, width) // 简单截断 fallback
  return text + ' '.repeat(width - w)
}
```

#### 2d. 重写 `renderSprite()` — 6 行 → 8 行

新格式（8 行）：
```
╔═══════════════════╗   border top (rarity-aware)
║   ▄▓███████▄      ║   portrait row 1
║   █▓░ ··  ░▓█    ║   portrait row 2
║   ▀▓██████▓▀     ║   portrait row 3
║                   ║   spacer
║ ★★★★★ Legendary   ║   rarity stars + label
║ ₿ Satoshi Nakamoto ║   emblem + name
╚═══════════════════╝   border bottom (rarity-aware)
```

实现：
```typescript
export function renderSprite(bones: CompanionBones, _frame = 0): string[] {
  const master = bones.species as Master
  const name = MASTER_NAMES[master] ?? master
  const rarity = MASTER_RARITY[master] ?? bones.rarity
  const stars = RARITY_STARS[rarity] ?? '★'
  const emblem = getEmblem(master)
  const rarityLabel = rarity.charAt(0).toUpperCase() + rarity.slice(1)
  const portrait = MASTER_PORTRAITS[master]
  const [tl, tr, bl, br, hz, vt] = getBorderChars(rarity)
  const W = 19

  // Portrait lines (fallback to generic face if somehow missing)
  const art = portrait?.portrait ?? [
    `    (${bones.eye}  ${bones.eye})    `,
    '                 ',
    '                 ',
  ]

  return [
    `${tl}${hz.repeat(W)}${tr}`,
    `${vt}${padTo(` ${art[0]}`, W)}${vt}`,
    `${vt}${padTo(` ${art[1]}`, W)}${vt}`,
    `${vt}${padTo(` ${art[2]}`, W)}${vt}`,
    `${vt}${padTo('', W)}${vt}`,
    `${vt}${padTo(` ${stars} ${rarityLabel}`, W)}${vt}`,
    `${vt}${padTo(` ${emblem} ${name}`, W)}${vt}`,
    `${bl}${hz.repeat(W)}${br}`,
  ]
}
```

#### 2e. 更新 `renderFace()` — 使用 compactFace
```typescript
export function renderFace(bones: CompanionBones): string {
  const master = bones.species as Master
  const portrait = MASTER_PORTRAITS[master]
  if (portrait) return portrait.compactFace
  const emblem = getEmblem(master)
  return `${emblem}(${bones.eye}${bones.eye})`
}
```

### 3. CompanionSprite.tsx 调整

#### 3a. Blink 逻辑修复
当前 blink 代码 (line 258)：
```typescript
const body = renderSprite(companion, spriteFrame).map(line => 
  blink ? line.replaceAll(companion.eye, '-') : line
)
```
这对硬编码 portrait 中的眼睛字符无效（portrait 可能用不同字符如 ⊙, ×, · 等，而非 companion.eye）。

**修复方案**：保持现有 blink 逻辑不变。它仍然会尝试替换 `companion.eye` 字符。如果 portrait 中使用了不同的眼睛字符，blink 只是不会生效（静默失败），这是可以接受的行为。不需要修改。

#### 3b. 终端高度守卫（可选）
如果终端行数 < 20，可以考虑回退到 6 行格式。但由于 narrow mode (<100 cols) 已经回退到单行，这不太可能成为问题。**暂不实现，优先保证核心功能。**

## Key Visual Differentiators — 必须保证每个大师可辨识

| 特征 | 大师 | 辨识方式 |
|------|-----|---------|
| 圆框眼镜 `(⊙)` | Buffett | 唯一使用圆括号眼镜 |
| 细框眼镜 `┌○┐` | Graham, Garry Tan, Hayes | 方框眼镜 |
| 厚框眼镜 `[◉]` | Munger | 方括号框 |
| 不对称眼 `●○` | Burry | 唯一左右不同 |
| 半闭眼 `─` | Dalio, Laozi | 冥想/禅 |
| 战士头盔 `█▌▬▐█` | Sun Tzu | 唯一全封闭头盔 |
| 深兜帽 `▓███▓` | Satoshi | 最深阴影 |
| 发髻 `┃▓▓┃` | Musashi | 竖线顶部 |
| 大胡子 `▓▓▓▓▓▓▓▓▓` | Simons | 底行全胡子 |
| 蝴蝶结 `╳╳╳` | von Neumann, Templeton | 下巴处╳ |
| 两侧翘发 `░▓░  ░▓░` | Einstein | 中间空缺 |
| 大假发 `░▓▓▓▓▓▓▓░` | Newton | 最宽发型 |
| 粗脖 `▓▀▄▬▬▄▀▓` | Taleb | 两侧▓ |
| 黑高领 `▀████▀` | Jobs | 唯一实心衣领 |

## Build & Verification
1. `bun run build` 成功（零新错误）
2. 肉眼检查 sprite-atlas.ts 中 52 个 portrait 每行 ≤17 字符（实际显示宽度）
3. MASTER_PORTRAITS 的 key 覆盖了 types.ts 中 MASTERS 数组的全部 52 个 master
