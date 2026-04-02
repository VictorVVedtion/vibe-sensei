# Sprint 8: Ghost Warning System

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-8: <what>`。

## Objective
实现反面教材幽灵警告系统

## Assigned To
codex

## Deliverables
- [ ] src/buddy/ghost-warnings.ts — 幽灵警告引擎
- [ ] src/buddy/checks/ghost-triggers.ts — 4 个幽灵触发检测

## Acceptance Criteria
1. 4 个幽灵触发器各自独立检测:
   - SBF: 检测无止损的持仓 (有 position 但无 stop_loss order)
   - Do Kwon: 检测忽略连续 WARNING 告警 (>3 个告警被忽视)
   - Su Zhu / 3AC: 检测有效杠杆 >3x (总持仓价值 / 总余额)
   - Newton: 检测 FOMO 买入 (在价格已上涨 >20% 后买入)
2. 幽灵警告有独特的视觉标识: 用 ANSI escape codes 实现终端效果 (暗色文字 + 闪烁引号)
3. 每个 session 最多触发 1 个幽灵 (防疲劳)
4. 幽灵警告输出格式: `⚠️ GHOST: [Name] — "[quote]"`
5. 导出 GhostWarning 类型和 checkGhostTriggers() 函数
6. bun run build 编译通过

## Context Files
- src/buddy/types.ts (GHOST_WARNINGS 数组)
- src/buddy/guardian.ts (RiskAlert, Severity)
- src/services/exchange/types.ts (Order, Position, Balance)

## Constraints
- Max execution time: 120s
- 不修改已有文件
- ANSI 效果要有 no-color fallback (检测 NO_COLOR 环境变量)
- Newton 的 FOMO 检测需要价格历史 — 简化为检测当前价格 vs 24h 前的变化率

当前状态: **ACTIVE**
