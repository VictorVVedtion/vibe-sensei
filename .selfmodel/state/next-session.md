# Next Session Context — Vibe Sensei

## What Is This
AI 交易终端，fork 自 Claude Code 框架。52 个历史大师守护者 + 4 个幽灵警告。深海绿克苏鲁章鱼 logo。

## Current State (截至 2026-04-02)

**已完成 — 12/24 sprints merged + 品牌改造 + 人格系统**
- CCXT 交易所 + paper trading (100k USDT)
- 3 交易工具 (Order, Position, Balance)
- 52 大师类型 + 确定性分配 (mulberry32)
- 守护者风控引擎 (position_size + drawdown)
- 守护者人格 (stat-driven tone)
- 跨守护者咨询 + 辩论 + 幽灵警告
- TradingView UDF + Lightweight Charts 前端
- 交易卡片 + 进化日记
- 品牌 Claude Code → Vibe Sensei (logo + 提示词 + UI)
- Companion 自动初始化

**Repo**: github.com/VictorVVedtion/vibe-sensei (private)
**Location**: ~/Desktop/vibe-sensei

## Next: Phase 3 — Integration (Sprint 13-16)

### Sprint 13: Guardian in Query Loop (P0, opus)
把风控引擎接入查询循环。每次工具调用后 evaluate()，告警注入为消息。

### Sprint 14: --web Flag (P0, codex)
main.tsx 加 --web 参数，启动 UDF 服务器 + 开浏览器。

### Sprint 15: Exchange Singleton (P0, codex)
3 个交易工具改用全局单例，session 内状态持久化。

### Sprint 16: REPL Welcome (P1, codex)
启动时显示守护者信息 + 余额。

**可并行**: Sprint 13 + 14 + 15

## Known Issues
1. sprites.ts 改为大师身份卡后，CompanionSprite 渲染可能需要验证
2. Companion auto-init 用 require() 动态导入，首次启动需验证
3. Paper trading 不跨 session 持久化（需 SQLite）

## 后续 Phase 4-5
- README/CLAUDE.md 重写
- 死代码清理
- 更多风控检查
- WebSocket 行情
- Python 策略桥接
- Karpathy AutoResearch
