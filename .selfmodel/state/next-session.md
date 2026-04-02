# Next Session Context — Vibe Sensei

## Project
Vibe Trading Terminal — fork of Claude Code architecture, repurposed as an AI-powered trading terminal with 52 historical master guardians.

## Detected Stack
- Runtime: Bun (TypeScript)
- UI: React + Ink (terminal), Express + TradingView Lightweight Charts (web, Phase 2)
- AI: Anthropic SDK (Phase 1), Vercel AI SDK (Phase 2 for multi-provider)
- Exchange: CCXT npm (Phase 1)
- Database: SQLite via better-sqlite3 (trade journal)

## Current State
- Initial commit done, pushed to GitHub (private)
- BUDDY feature flag enabled
- 52 master guardian types defined (types.ts + companion.ts rewritten)
- 4 ghost warnings defined (SBF, Do Kwon, Su Zhu, Newton)
- selfmodel initialized

## Phase 1 Remaining (core loop)
1. Install CCXT + paper trading service
2. OrderTool — place market/limit/stop orders
3. PositionTool — query positions and P&L
4. BalanceTool — account balance and buying power
5. Guardian risk checks — position_size + drawdown
6. Trading context injection into system prompt
7. Guardian persona prompt injection

## Design Docs
- Office Hours: ~/.gstack/projects/codexyolo/vvedition-unknown-design-20260401-155029.md
- CEO Plan: ~/.gstack/projects/codexyolo/ceo-plans/2026-04-01-vibe-trading-terminal.md
