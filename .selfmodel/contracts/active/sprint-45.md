# Sprint 45: Enhanced Diary — 6 New Behavioral Patterns

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-45: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
扩展 Guardian 日记系统，添加 6 种新的行为模式检测

## Assigned To
opus

## Deliverables
- [ ] `src/buddy/diary.ts` — 修改：扩展 DiaryEntry 类型，添加 6 个检测函数，增加 getEnhancedSummary()
- [ ] `src/buddy/types.ts` — 修改：扩展 PatternType union 添加 6 个新类型
- [ ] `src/buddy/checks/behavioral-patterns.ts` — 新建：checkBehavioralPatterns() guardian check
- [ ] `src/buddy/checks/index.ts` — 修改：注册新 check

## Acceptance Criteria

### 1. Extended DiaryEntry Type
在 DiaryEntry 上添加新可选字段:
- `tradeUtcHour?: number` — 0-23, UTC 时区的交易小时
- `holdDurationMs?: number` — 持仓时长（毫秒）
- `positionSizePercentile?: number` — 0-100, 相对用户平均的仓位大小百分位
- `profitPercent?: number` — 已实现或未实现盈亏百分比

### 2. Extended PatternType
添加 6 个新类型到 PatternType union:
- `time_of_day_bias`
- `holding_period_bias`
- `instrument_bias`
- `position_size_bad`
- `averaging_down_bad`
- `pyramid_good`

### 3. 六个新模式检测器

**3a. Time-of-Day Bias (时段偏差)**
- 按 UTC 小时分组: Asian (0-8), European (8-16), American (16-24)
- 计算每个时段的胜率
- 当某时段胜率 < 35% 且该时段有 5+ 笔交易时触发
- 函数: `detectTimeOfDayBias(entries: DiaryEntry[]): string[]`

**3b. Holding Period Bias (持仓期偏差)**
- 分组: scalp (<1h), swing (1-24h), position (1-7d), invest (>7d)
- 计算每个分组的胜率
- 当某分组胜率 < 30% 且有 5+ 笔交易时触发
- 函数: `detectHoldingPeriodBias(entries: DiaryEntry[]): string[]`

**3c. Instrument Bias (品种偏差)**
- 按交易对 (symbol) 分组
- 计算每个品种的胜率
- 当某品种胜率 < 35% 且有 5+ 笔交易时触发
- 函数: `detectInstrumentBias(entries: DiaryEntry[]): string[]`

**3d. Position Size vs Outcome (仓位大小 vs 结果)**
- 计算用户的中位仓位大小
- 分为三档: small (0-33%), medium (33-67%), large (67-100%)
- 当 large 档的胜率比平均胜率低 20%+ 或 < 30% 且有 3+ 大仓位时触发
- 函数: `detectPositionSizeCorrelation(entries: DiaryEntry[]): string | null`

**3e. Averaging Down Detector (越跌越买检测)**
- 检测: 同一品种, 2+ 次连续买入, 价格逐次递减, 时间跨度 < 2 小时
- 时间间隔 < 15min 标记为 emotional, > 30min 标记为可能 planned
- 函数: `detectAveragingDown(entries: DiaryEntry[]): Array<{symbol, buyCount, outcome}>`

**3f. Pyramid Success Tracker (金字塔加仓追踪)**
- 检测: 同一品种, 2+ 次连续买入, 价格逐次递增 (加仓赢家)
- 追踪金字塔 vs 非金字塔的成功率
- 函数: `detectPyramidSuccess(entries: DiaryEntry[]): Array<{symbol, buyCount, outcome}>`

### 4. Enhanced Summary
- `getEnhancedSummary()` 方法返回 EnhancedPatternSummary
- 包含: topPattern, timeOfDayAnalysis, holdingPeriodAnalysis, instrumentBiases, positionSizeBias, averagingDownStats, pyramidStats
- 最少 20 条记录才生成分析
- 所有分析结果缓存，避免重复计算

### 5. Guardian Check Integration
- `checkBehavioralPatterns()` 在 guardian evaluation 中运行
- 查询 diary 的 enhanced summary
- 返回最高严重性的行为 alert (如用户品种胜率 28% 时买入该品种)
- 注册到 ALL_CHECKS 数组

### 6. Serialization
- 新字段正确序列化/反序列化 (JSON round-trip)
- 向后兼容: 旧 diary 文件缺少新字段时不崩溃

## Scoring Rubric
| Dimension | Weight | 本 Sprint 的 10/10 |
|---|---|---|
| Functionality | 30% | 所有 6 个检测器正确触发，边界处理完备 |
| Code Quality | 25% | 每个检测器独立函数 <50 行，类型完整 |
| Design Taste | 20% | 与现有 diary.ts 风格一致，检测阈值合理 |
| Completeness | 15% | 所有 deliverable 交付，序列化兼容 |
| Originality | 10% | 检测算法设计优雅 |

## Context Files
- `src/buddy/diary.ts`
- `src/buddy/types.ts`
- `src/buddy/checks/index.ts`
- `src/buddy/guardian.ts`
- `src/services/exchange/types.ts`

## Constraints
- Max execution time: 300s
- 非交互执行
- 禁止 TODO / mock / placeholder
- 原子提交
- 不修改现有 7 个模式检测器的逻辑
- 不创建新的 npm 依赖

## E2E Depth
- Depth: quick
- Notes: 验证类型兼容和序列化

## Lifecycle
当前状态: **ACTIVE**
