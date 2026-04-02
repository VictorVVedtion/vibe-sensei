# Task: Sprint 1 — CCXT Exchange Service + Paper Trading

Read the contract at `.selfmodel/contracts/active/sprint-1.md` for full details.

## Quick Summary
Create `src/services/exchange/` with:
1. `types.ts` — Order, Position, Balance, Candle, Fill types
2. `ccxt-client.ts` — Unified CCXT wrapper
3. `paper-trading.ts` — Simulated exchange (100k USDT start, market/limit orders, P&L)
4. `index.ts` — Unified export, paper/live mode switch

Install `ccxt` via `bun add ccxt`.

## Key Constraints
- No API keys needed for paper trading
- Complete error handling on all operations
- No TODO, no mock, no placeholder
- Atomic commits with `sprint-1:` prefix
- Run `bun run build` after each commit to verify
