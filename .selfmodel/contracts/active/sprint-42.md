# Sprint 42: Dynamic Check Thresholds by Archetype

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-42: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
创建按 Guardian archetype 动态调整的风险检查阈值系统

## Assigned To
opus

## Deliverables
- [ ] `src/buddy/thresholds.ts` — 新建：9 archetype × check 阈值矩阵，stat 修正，regime 修正
- [ ] `src/buddy/checks/leverage.ts` — 修改：接受可选 ThresholdConfig 参数
- [ ] `src/buddy/checks/position-size.ts` — 修改：接受可选 ThresholdConfig 参数
- [ ] `src/buddy/checks/concentration.ts` — 修改：接受可选 ThresholdConfig 参数
- [ ] `src/buddy/checks/drawdown.ts` — 修改：接受可选 ThresholdConfig 参数
- [ ] `src/buddy/guardian.ts` — 修改：在 evaluate() 中计算并传递动态阈值

## Acceptance Criteria

### 1. ThresholdConfig Type
```typescript
interface ThresholdConfig {
  warn: number   // WARNING 触发阈值
  critical: number // CRITICAL 触发阈值
}
```

### 2. Archetype Threshold Matrix
创建 `ARCHETYPE_THRESHOLDS` 常量，为每种 archetype 定义各 check 的阈值:

| Archetype | leverage warn/crit | position_size warn | concentration warn/crit | drawdown warn/crit |
|---|---|---|---|---|
| value_investor | 1.2/3.0 | 20% | 30/50 | -8/-15 |
| trend_follower | 3.0/7.0 | 40% | 40/70 | -15/-30 |
| macro_trader | 2.5/6.0 | 35% | 35/60 | -12/-25 |
| quant | 2.0/5.0 | 30% | 30/55 | -10/-20 |
| strategist | 2.0/5.0 | 30% | 30/55 | -10/-22 |
| philosopher | 1.5/3.5 | 20% | 25/45 | -8/-18 |
| first_principles | 2.5/6.0 | 35% | 35/60 | -12/-25 |
| crypto_native | 4.0/10.0 | 45% | 45/75 | -20/-40 |
| scientist | 2.0/5.0 | 28% | 28/50 | -10/-20 |

### 3. Stat Modifiers
函数 `applyStatModifiers(base: ThresholdConfig, stats: Record<string, number>)`:
- AGGRESSION > 70: warn *= 1.25, critical *= 1.20 (放宽)
- WISDOM > 70: warn *= 0.85, critical *= 0.85 (收紧)
- PATIENCE > 70: 不影响阈值（影响冷却时间，未来实现）
- 修正后取整到 1 位小数

### 4. Regime Modifiers
函数 `applyRegimeModifiers(base: ThresholdConfig, regime: MarketRegime | null, checkName: string)`:
- trending: concentration warn/crit *= 1.3 (趋势可集中)
- ranging: position_size warn *= 0.85 (震荡少开仓)
- compressing: position_size warn *= 0.80 (压缩期减仓)
- expanding: leverage warn *= 0.85 (波动扩张降杠杆)
- regime 为 null: 不修正

### 5. getThresholds() 主函数
```typescript
function getThresholds(
  archetype: string,
  stats: Record<string, number>,
  regime: MarketRegime | null,
): Record<string, ThresholdConfig>
```
流程: archetype base → stat modifier → regime modifier → 返回

### 6. Check 函数更新
每个 check 函数添加可选 `thresholds?: ThresholdConfig` 参数:
- 有 thresholds: 使用动态值
- 无 thresholds: 使用原有硬编码默认值 (向后兼容)
- 不改变函数签名的其他部分

### 7. Guardian evaluate() 更新
在 RiskGuardian.evaluate() 中:
- 导入 getThresholds, getMasterArchetype (from persona.ts)
- 导入 getLatestRegime (from market/regime.ts)
- 获取 archetype + stats → 计算动态阈值
- 传递给每个 check 函数

## Scoring Rubric
| Dimension | Weight | 本 Sprint 的 10/10 |
|---|---|---|
| Functionality | 30% | 阈值计算正确，9 archetype 全覆盖 |
| Code Quality | 25% | 类型完整，向后兼容，无 any |
| Design Taste | 20% | 阈值矩阵数值合理，符合各 archetype 哲学 |
| Completeness | 15% | 所有 check 函数更新，guardian.ts 集成 |
| Originality | 10% | modifier 设计优雅可扩展 |

## Context Files
- `src/buddy/persona.ts` — getMasterArchetype, archetype 列表
- `src/buddy/types.ts` — master 类型, stats
- `src/buddy/guardian.ts` — RiskGuardian.evaluate()
- `src/buddy/checks/leverage.ts`
- `src/buddy/checks/position-size.ts`
- `src/buddy/checks/concentration.ts`
- `src/buddy/checks/drawdown.ts`
- `src/buddy/checks/index.ts`
- `src/services/market/regime.ts` — getLatestRegime
- `src/services/market/types.ts` — MarketRegime type

## Constraints
- Max execution time: 180s
- 向后兼容: 不传 thresholds 时行为不变
- 不修改 order-validation.ts (fat-finger check 不受 archetype 影响)
- 原子提交

## Lifecycle
当前状态: **ACTIVE**
