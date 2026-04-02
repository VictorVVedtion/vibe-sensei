# Sprint 2: OrderTool + PositionTool + BalanceTool

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-2: <what>`。禁止操作: rm -rf / git push / 修改 .selfmodel/。

## Objective
创建 3 个交易工具注册到现有工具系统

## Assigned To
opus

## Deliverables
- [ ] src/tools/OrderTool/OrderTool.ts — 下单工具 (市价/限价/止损)
- [ ] src/tools/PositionTool/PositionTool.ts — 查询持仓和 P&L
- [ ] src/tools/BalanceTool/BalanceTool.ts — 账户余额和购买力

## Acceptance Criteria
1. 每个 Tool 遵循现有 Claude Code Tool 模式 (参考 src/Tool.ts 的 Tool 类型定义)
2. 每个 Tool 有: name, description, inputSchema (JSON Schema), call() 实现
3. OrderTool inputSchema: { symbol: string, side: 'buy'|'sell', type: 'market'|'limit'|'stop_loss', quantity: number, price?: number, stopPrice?: number }
4. PositionTool inputSchema: { symbol?: string } — 可选过滤
5. BalanceTool inputSchema: {} — 无参数
6. 所有 Tool 调用 src/services/exchange/ 的 ExchangeInterface
7. 错误处理完整: 余额不足、无效交易对、网络错误都有用户友好的错误消息
8. bun run build 编译通过

## Context Files
- src/Tool.ts (Tool 类型定义和 buildTool 工厂)
- src/tools.ts (工具注册)
- src/tools/BashTool/ (现有工具参考模式)
- src/services/exchange/ (Sprint 1 交付的交易所服务)

## Constraints
- Max execution time: 180s
- 使用 buildTool() 工厂创建工具 (如果可行) 或直接导出 Tool 对象
- 不要修改 src/services/exchange/ 的文件 (Sprint 1 已交付)
- 交易所实例通过全局单例或依赖注入获取

## Worktree
- Branch: sprint/2-opus

当前状态: **ACTIVE**
