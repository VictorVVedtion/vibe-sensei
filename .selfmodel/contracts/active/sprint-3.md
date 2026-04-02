# Sprint 3: Trading Context Injection

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。遵守铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-3: <what>`。禁止操作: rm -rf / git push / 修改 .selfmodel/。

## Objective
将交易状态注入 AI 系统提示词

## Assigned To
codex

## Deliverables
- [ ] src/services/trading-context.ts — 交易上下文构建器

## Acceptance Criteria
1. 导出 `buildTradingContext()` 函数，返回字符串 (≤500 tokens)
2. 包含: 当前持仓 + P&L, 账户余额, 活跃订单数, 守护者大师名称
3. 从 src/services/exchange/ 的 ExchangeInterface 获取数据
4. 格式清晰: 用 markdown 表格或结构化文本，AI 可解析
5. 处理空状态: 无持仓时显示 "No open positions"
6. 处理错误: exchange 服务不可用时返回 "[Trading context unavailable]"
7. bun run build 编译通过

## Context Files
- src/context.ts (现有上下文构建)
- src/services/exchange/types.ts (数据类型)
- src/buddy/companion.ts (获取当前大师)

## Constraints
- Max execution time: 120s
- 不修改 src/context.ts (只创建新文件, 集成由后续 sprint 完成)
- 不修改 src/services/exchange/ 的文件
- 上下文 ≤500 tokens (约 2000 字符)

## Worktree
- Branch: sprint/3-codex

当前状态: **ACTIVE**
