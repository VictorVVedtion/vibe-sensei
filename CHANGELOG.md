# Changelog

All notable changes to Vibe Sensei are documented here. Dates are in UTC.

The project follows a loose [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) convention.

## [0.3.0] --- OSS Launch Prep --- 2026-04

### Added

- **Multi-provider OAuth** --- `/login` is now a 3-way picker (Anthropic / OpenAI Codex / Google Gemini). PKCE flow for each, credentials stored 0o600 under `~/.vibe-sensei/`. Successful login auto-switches the session model to the provider's default.
- **OpenAI Codex provider** (`openai-codex-provider.ts`) --- routes gpt-5, o1, o3 requests to `chatgpt.com/backend-api/codex/responses`, reusing the user's ChatGPT Plus/Pro session. Maps `/effort` level to `reasoning.effort: low|medium|high`.
- **Google Gemini provider** (`gemini.ts`) --- routes via `cloudcode-pa.googleapis.com/v1internal:streamGenerateContent` when authed through the Gemini CLI OAuth flow. Reuses Gemini's free-tier Cloud Code Assist capacity.
- **Stream-event envelope normalization** (`stream-event-helpers.ts`) --- non-Anthropic providers emit `message_start → content_block_start → delta → stop → message_delta → message_stop → AssistantMessage` so the REPL renders all three providers identically.
- **Gemini tool-schema sanitizer** --- strict whitelist that strips Google's protobuf extensions (`x-google-enum-descriptions`, `deprecated`, `const`, `exclusiveMinimum`, `$defs`, `$ref`, ...). Handles circular `$ref` via visited-set guard. Remaps `oneOf` → `anyOf` and deep-merges `allOf` so discriminated unions and intersections survive.
- **Gemini thought-signature** capture & echo --- Gemini 3 requires `thoughtSignature` on each `functionCall` to be echoed back in conversation history. Stored as `_geminiThoughtSignature` on `tool_use` blocks and replayed on follow-up turns.
- **`/model` picker** --- extra options for 6 Gemini models + 7 GPT-5 family models when the matching credentials are present.
- **`--demo` mode** --- zero-API-key quick-start (planned for next minor; scaffolding landed).
- **Governance docs** --- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, ROADMAP.md, MIT LICENSE.
- **OSS hygiene** --- `**/.DS_Store` gitignore, `TODO.md` / `RECORD.md` moved to `scripts/dev/`.

### Changed

- **Default Gemini model** on new logins: `gemini-3-flash-preview` (free-tier capacity, same generation as 3-pro but without the 429 wall).
- **Cloud Code Assist model set** --- `CLOUD_CODE_ASSIST_MODELS` no longer lists `gemini-3.1-pro-preview` / `gemini-3-pro-preview` (both return HTTP 429 `MODEL_CAPACITY_EXHAUSTED` on the free tier). `remapToCloudCodeAssistModel` falls through pro-class requests to `gemini-2.5-pro` and everything else to `gemini-3-flash-preview`.
- **Logo status line** --- `"API Usage Billing"` replaced with the provider name (OpenAI / Gemini / DeepSeek / Groq / xAI / Mistral) for non-Anthropic sessions; Claude subscriber label preserved.
- **`with X effort` suffix** --- now suppressed for providers whose request builder doesn't honor the effort setting (currently Gemini). Previously rendered for all providers regardless of whether the effort was actually sent.
- **`Opus now defaults to 1M context` banner** --- gated on the current main-loop model being Anthropic (non-prefixed). Previously shown unconditionally.
- **`Claude in Chrome requires a claude.ai subscription` gate** removed --- the browser-automation MCP is provider-agnostic; any user with the extension can now wire it up via `--chrome`.
- **`claude.ai connector needs auth` nags** suppressed when the active model is non-Anthropic. Local MCP server warnings still fire.

### Fixed

- **Gemini `functionResponse.name`** --- was sending the Anthropic-style `tool_use_id` ("toolu_..."), must be the tool's name ("ShowChart"). Multi-turn conversations after any tool call were silently stalling before this fix.
- **Gemini thought-signature missing** --- follow-up requests were being rejected with `HTTP 400: function call X is missing a thought_signature`. Signatures are now captured and echoed.
- **429 classifier** --- was treating any `RESOURCE_EXHAUSTED` 429 as permanent, killing retry recovery on transient RPM limits. Now only `MODEL_CAPACITY_EXHAUSTED` is non-retryable; `RATE_LIMIT_EXCEEDED` uses Google's natural-language "reset after Ns" hint for backoff timing.
- **`inlineAndClean` infinite recursion** on self-referential `$ref` schemas (e.g. tree-shaped JSON patch inputs). Added `visiting: ReadonlySet<string>` cycle guard.
- **PKCE state=verifier** security bug in Gemini login --- state now generated independently via `randomBytes(16).hex()`. Reusing the verifier as state leaked the PKCE secret via referrer headers and server logs.
- **`sleep()` abort listener leak** in `openai-codex-provider.ts` retry loop --- attached with `{ once: true }` and explicitly removed on the resolve path.
- **Raw HTTP response bodies** in thrown Gemini errors --- now routed through `formatHttpError()` which parses structured `error.message` and caps raw fallbacks at 120 chars.
- **Token directory permissions** --- `~/.vibe-sensei/` created with `mode: 0o700` (was inheriting the process umask, typically 0o755).
- **Debug logs** moved from world-readable `/tmp/vibe-*-debug.log` to `~/.vibe-sensei/*-debug.log` (0o600).

### Removed

- **`loginOpenAICodex`** --- broken dead-code entrypoint (awaited the callback before opening the browser, 5-minute timeout guaranteed). Only `runOpenAICodexLoginFlow` was ever reachable; the dead function has been deleted.
- **301 lines of dead Anthropic-delegating login flow** in `login.tsx` --- the provider picker in the new `multi-login.tsx` fully replaces it.

## [0.2.3] --- Slash Commands & Master Expansion --- 2026-04

### Added
- 10 slash commands: `/buy`, `/sell`, `/swap`, `/positions`, `/balance`, `/risk`, `/consult`, `/debate`, `/chart`, `/master`.
- Master roster expanded from 56 to 68.

## [0.2.2] --- Summon & Pulse --- 2026-03

### Added
- Gacha-style 4-phase summon ceremony with animated guardian reveal.
- `/pulse <symbol>` --- 30-day cross-source sentiment brief synthesizing Reddit, Hacker News, Polymarket, and YouTube signals in the guardian's voice. Auto-injected into pre-trade debate stances.

## [0.2.1] --- Security Hardening --- 2026-03

### Added
- Fail-closed PreTradeGate across all 7 order tools (blocks on any check failure).
- Unix domain socket peer authentication for inter-process bridges.
- LLM prompt injection sanitization on all externally-sourced text.

## [0.2.0] --- Desktop & TUI --- 2026-03

### Added
- Desktop Electron app with 5-panel layout.
- Rust `ratatui` TUI with braille candlestick charts.
- WebSocket chat UI bridging CLI and Desktop.
- TradingView Lightweight Charts integration.

## [0.1.0] --- Foundation --- 2026-04-04

### Added
- Guardian is now always visible on startup with a minimalist face + name display.
- Idle quotes cycle every ~30 seconds, personalized by your guardian's archetype.
- Context-aware idle quotes adapt to market regime, time of day, and your activity.
- Time-aware greetings: morning, late-night, and weekend messages.
- Guardian face color changes with market conditions (red for volatile, yellow for expanding).
- "Attentive" state: guardian briefly acknowledges your trades before returning to idle.
- Idle care: guardian notices when you've been staring at the screen for 10+ minutes.
- Live chart auto-refresh polls exchange data at timeframe-appropriate intervals.
- Stale data indicator appears after 3 consecutive refresh failures with exponential backoff.
- Volume spike highlighting: bars above 2x average volume render at full brightness.
- Lightweight regime poller keeps market state warm for companion insights.
- Primary symbol auto-detection from active positions or recent trades.

### Changed
- Chart renderer rewritten from Braille subpixel to ASCII candlesticks for universal terminal compatibility.
- Chart timestamps restored to UTC with explicit 'UTC' suffix.
- Guardian display consolidated into a singleton to prevent duplicate timers in fullscreen mode.
- Tick frequency adapts: 500ms during reactions, 5s during idle (90% fewer re-renders).
- Narrow terminals (<40 cols) show face only; very narrow (<20 cols) hide companion entirely.

### Fixed
- Removed all `feature('BUDDY')` gates that kept the guardian invisible (6 locations).
- Desktop dev mode: build to CJS before Electron launch, fixing ESM/CJS conflicts.
- Chart `colWidth` mismatch between component (was 1) and renderer (2) unified.
- LiveChart generation ID prevents stale instances from polling after new charts open.

### Removed
- Dead code cleanup: unused sprite animation constants, imports, and functions from CompanionSprite.
