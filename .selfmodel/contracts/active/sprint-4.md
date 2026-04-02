# Sprint 4: Guardian Risk Engine (2 checks)

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-4: <what>`。

## Objective
创建守护者风控引擎，实现仓位和回撤检查

## Assigned To
opus

## Deliverables
- [ ] src/buddy/guardian.ts — RiskGuardian 类 + 检查框架
- [ ] src/buddy/checks/position-size.ts — 单仓位占比检查 (>30% 告警)
- [ ] src/buddy/checks/drawdown.ts — 总回撤检查 (>10% 告警)
- [ ] src/buddy/checks/index.ts — 检查模块注册

## Acceptance Criteria
1. RiskGuardian 类可以 observe(event) 接收交易事件
2. position-size 检查: 当单个持仓 > 总组合 30% 时触发 WARNING
3. drawdown 检查: 当总 P&L < -10% 时触发 WARNING, < -20% 时触发 CRITICAL
4. 告警使用守护者大师的人格生成 (调用 getGuardianPrompt + getMasterQuote)
5. Policy engine: 同类告警 30 秒冷却, 每轮最多 1 条告警
6. 告警有 severity: INFO | WARNING | CRITICAL | EMERGENCY
7. 导出 RiskAlert 类型: { severity, masterId, message, checkName, timestamp }
8. bun run build 编译通过

## Context Files
- src/buddy/companion.ts (getCompanion, getMasterName, getMasterQuote, getGuardianPrompt)
- src/buddy/types.ts (Master, MASTER_QUOTES, Companion)
- src/services/exchange/types.ts (Position, Balance)
- src/services/exchange/index.ts (createExchange)

## Constraints
- Max execution time: 180s
- 不修改 companion.ts 或 types.ts (已在初始 commit 中完成)
- 不修改 src/services/exchange/ 的文件
- guardian.ts 是独立模块, 不修改查询循环 (后续 sprint 集成)

当前状态: **ACTIVE**
