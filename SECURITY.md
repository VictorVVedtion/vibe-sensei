# Security Policy

## Paper Mode by Default

Vibe Sensei ships in **paper trading mode** by default. No real funds are at risk. The 100K USDT sandbox is entirely simulated.

- **No exchange API keys are required** to use the default paper mode
- **Live trading mode** requires explicit opt-in behind a confirmation gate
- Vibe Sensei will **never** prompt you for exchange credentials unless you actively enable live mode

## Security Design

Vibe Sensei incorporates multiple layers of security protection:

### Fail-Closed PreTradeGate

All 7 order tools (spot, futures, options, stocks, forex, DEX swaps, predictions) execute a **synchronous PreTradeGate** before any order is placed. If the gate fails or encounters an error, the order is blocked — never executed. This is a fail-closed design: when in doubt, the system refuses to trade.

### UDS Peer Authentication

The Unix Domain Socket bridge between the Node.js backend and Rust TUI verifies peer credentials on every connection. Only processes running under the same user ID can connect to the trading backend.

### Prompt Injection Sanitization

All market data, position data, and symbol strings that flow into LLM system prompts are wrapped and escaped to prevent prompt injection from manipulated data.

## Reporting a Vulnerability

If you discover a security issue, please report it responsibly:

1. **Use GitHub Security Advisories**: [Create a private advisory](https://github.com/VictorVVedtion/vibe-sensei/security/advisories/new)
2. **Do NOT** open a public issue for security-sensitive findings
3. We will acknowledge receipt within **48 hours** and aim to provide a fix or mitigation plan within 7 days

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Scope

Security-relevant areas include:

- Order execution bypassing the PreTradeGate
- Unauthorized access to the UDS trading backend
- LLM prompt injection leading to unauthorized trade execution
- Exchange credential handling (live mode key storage and transmission)
- API key exposure in logs, error messages, or git history
- Dependency supply chain issues

## What Is NOT in Scope

- Paper trading simulation accuracy (this is a sandbox, not financial advice)
- AI model output quality or trading recommendations
- Sprite art or cosmetic issues

## Supported Versions

| Version | Supported    |
|---------|-------------|
| v0.3.x  | Yes         |
| v0.2.x  | Best effort |
| < v0.2  | No          |

## Responsible Disclosure

We follow a coordinated disclosure process. Please allow us reasonable time to
address the issue before any public disclosure. We credit reporters in our
release notes (unless anonymity is preferred).
