# Sprint 1: CCXT Exchange Service + Paper Trading

## Task Preamble（自动注入，不要修改）

你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作，将绝对路径转换为 worktree 相对路径
5. 每个独立变更单独 commit，commit message 格式: `sprint-1: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
创建统一交易所服务层和模拟交易引擎

## Assigned To
opus

## Deliverables
- [ ] src/services/exchange/types.ts — Order, Position, Balance, Candle, Fill, OrderBook 类型定义
- [ ] src/services/exchange/ccxt-client.ts — CCXT 统一封装 (connect, getBalance, placeOrder, getPositions, getCandles)
- [ ] src/services/exchange/paper-trading.ts — 模拟交易引擎 (内存订单簿, 撮合, 持仓跟踪, P&L 计算)
- [ ] src/services/exchange/index.ts — 统一导出, 根据配置切换 paper/live 模式
- [ ] package.json 更新 — 添加 ccxt 依赖

## Acceptance Criteria（可测试的验收标准）
1. `import { createExchange } from 'src/services/exchange'` 编译通过
2. Paper trading 引擎可以: 创建市价单 → 即时成交 → 更新持仓 → 计算 P&L
3. Paper trading 初始余额 100,000 USDT
4. 限价单: 挂单 → 当价格到达时成交 (模拟)
5. 所有 I/O 操作有完整错误处理 (网络超时, 无效参数, 余额不足)
6. 类型安全: 所有导出函数有完整 TypeScript 类型
7. `bun run build` 编译通过

## Scoring Rubric（本 Sprint 专属评分）
| Dimension | Weight | 本 Sprint 的 10/10 |
|---|---|---|
| Functionality | 30% | Paper trading 完整支持市价/限价/止损, P&L 实时更新 |
| Code Quality | 25% | DRY, 明确的错误类型, 无 any 类型, 函数 <50 行 |
| Design Taste | 20% | Exchange trait 抽象优雅, paper/live 切换透明 |
| Completeness | 15% | 所有边界情况处理 (余额不足, 无效交易对, 零数量) |
| Originality | 10% | 接口设计考虑未来扩展 (多交易所, WebSocket) |

## Context Files（Agent 需要提前读取）
- src/services/ (现有服务目录结构)
- src/types/ (现有类型定义模式)
- package.json (现有依赖)

## Constraints
- Max execution time: 180s
- 非交互执行（两层静默防护）
- 禁止 TODO / mock / placeholder
- **原子提交**: 每完成一个可独立验证的变更即 commit
- **即时验证**: 每次 commit 后运行 bun run build 验证编译
- 使用 ccxt npm 包 (不是 ccxt-rust)
- Paper trading 不需要任何 API key
- 金额计算使用 number 类型 (后续可升级为 decimal.js)

## Worktree
- Branch: sprint/1-opus
- Path: (Agent tool isolation)

## Lifecycle
DRAFT → ACTIVE → DELIVERED → REVIEWED → MERGED | REJECTED
当前状态: **ACTIVE**
