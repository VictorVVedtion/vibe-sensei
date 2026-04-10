# Roadmap

## Shipped

### v0.1.0 --- Foundation

Core trading loop with LLM-powered assistant, 68 guardian personas with deterministic assignment, paper trading sandbox (100k USDT via CCXT), and six risk checks: position size, drawdown, leverage, concentration, fat-finger, and behavioral. Ghost warnings from crypto's fallen (SBF, Do Kwon, 3AC, Newton).

### v0.2.0 --- Desktop & TUI

Desktop Electron app with 5-panel layout, Rust ratatui TUI with braille candlestick charts, chat UI via WebSocket, and TradingView chart integration.

### v0.2.1 --- Security Hardening

Fail-closed PreTradeGate on all 7 order tools, Unix domain socket peer authentication, and LLM prompt injection sanitization.

### v0.2.2 --- Summon & Pulse

Gacha-style summon ceremony with 4-phase animated guardian reveal. `/pulse` delivers a 30-day cross-source sentiment brief (Reddit, Hacker News, Polymarket, YouTube).

### v0.2.3 --- Slash Commands

10 slash commands: `/buy` `/sell` `/swap` `/positions` `/balance` `/risk` `/consult` `/debate` `/chart` `/master`. Master roster expanded from 56 to 68.

---

## Current

### v0.3.0 --- OSS Launch

- **`--demo` mode** --- zero API keys required, try the full experience instantly
- **VHS hero GIF** --- animated terminal demo for the README
- **README rewrite** --- lazygit-style one-liner install, hero GIF, quick-start
- **Governance docs** --- CONTRIBUTING, Code of Conduct, SECURITY, ROADMAP

---

## Planned

### v0.4.0 --- Debate Council

Structured 4-role investment committee: Bull Guardian, Bear Guardian, Risk Guardian, and PM Guardian deliberate before high-conviction trades. YAML-configurable presets for different debate styles.

### v0.5.0 --- MCP Server

Expose guardian risk tools as an MCP server so Claude Desktop, Cursor, and other MCP-compatible clients can call risk checks, consultations, and debates natively.

### v0.6.0 --- Community

Master marketplace for sharing and trading guardians, community-submitted strategies, and a contributor pipeline for new guardian personas.

---

Want to help? See [CONTRIBUTING.md](CONTRIBUTING.md).
