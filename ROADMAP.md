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

### v0.3.0 --- OSS Launch + Multi-Provider

- **Multi-provider OAuth** --- `/login` 3-way picker (Anthropic / OpenAI Codex / Google Gemini). PKCE flow per provider, credentials stored 0o600 under `~/.vibe-sensei/`. New OpenAI Codex provider routes `gpt-5.*` / `o1` / `o3` through the user's ChatGPT subscription. New Gemini provider uses the Cloud Code Assist free tier shared with the Gemini CLI. All non-Anthropic providers emit Anthropic-shaped stream events so the REPL renders them identically.
- **`/model` picker expanded** --- 13 extra models (6 Gemini, 7 GPT-5 family) surface when the matching credentials are present.
- **Anthropic-UI cleanup** --- Opus 1M-context banner, "API Usage Billing" tag, Claude in Chrome subscription gate, and claude.ai connector nags now suppress when the active session is non-Anthropic. The `with X effort` suffix only renders for providers that actually wire effort to the API.
- **Gemini multi-turn correctness** --- `functionResponse.name` uses tool name (not `tool_use_id`); `thoughtSignature` captured and echoed; `inlineAndClean` cycle guard for circular `$ref`; 429 classifier distinguishes permanent capacity exhaustion from transient rate limits.
- **Governance docs** --- CONTRIBUTING, Code of Conduct, SECURITY, ROADMAP, MIT LICENSE.

---

## Current

### v0.3.x --- Launch Polish

- **`--demo` mode** --- zero API keys required, try the full experience instantly (scaffolding landed, content next)
- **VHS hero GIF** --- animated terminal demo for the README
- **README rewrite** --- lazygit-style one-liner install, hero GIF, quick-start
- **Wiki** --- multi-provider guide, provider-architecture deep-dive, "add a master" contributor guide

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
