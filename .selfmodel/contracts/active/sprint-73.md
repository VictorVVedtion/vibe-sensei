# Sprint 73: REPL Branding Overhaul — Vibe Sensei Identity

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-73: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Full REPL branding overhaul. Transform the terminal from "Claude Code with trading tools" to "Vibe Sensei — deep-sea AI trading terminal."

## Assigned To
opus

## Deliverables

### Fix 1: Redesign Welcome Banner
**File:** `src/components/LogoV2/Clawd.tsx`

Replace the current octopus ASCII art with this Gemini-designed deep-sea version:

```
        _.---._
     .-'       '-.
    /   o     o   \    V I B E   S E N S E I
   |   .-------.   |   v0.1.0-abyssal
    \ / \_.-._/ \ /
     '/|       |\'     [*] GUARDIAN: {masterName} ({rarity})
    / /|       |\ \    [$] BALANCE:  {balance} USDT [PAPER]
   / / |       | \ \   [~] SONAR ACTIVE. AWAITING COMMAND.
  ( (  |       |  ) )
   '-' '-'   '-' '-'
```

Read the current `Clawd.tsx` to understand the component structure (poses, fallback). Replace the ASCII art frames while keeping the component API intact. Keep the Apple Terminal fallback version too (simplified).

Also update `LogoV2.tsx` to pass the guardian name, rarity, and balance into the banner.

### Fix 2: Replace Prompt Symbol
**File:** `src/components/PromptInput/PromptInput.tsx` and/or `PromptInputModeIndicator.tsx`

Find where `❯` is rendered as the prompt character. Replace with `≋` (triple tilde / wave, U+224B).

Search for the exact location — it might be in the TextInput component or the mode indicator. The character should be cyan `#00D4FF` in the normal state.

### Fix 3: Rebrand Status Bar Footer
**Files:** `src/components/PromptInput/PromptInputFooterLeftSide.tsx`, `src/components/StatusLine.tsx`

The current footer shows Claude Code info: model name, context %, speed indicator.

Replace/augment with Vibe Sensei trading info:
- Keep the model name but frame it as: `Opus 4.6 (1M context)` (this is fine, it's the AI model being used)
- Replace or add: `[PAPER]` mode badge, current BTC price if available, guardian name abbreviation
- Remove: Claude Code-specific metrics that don't apply to trading

The goal is: make the footer feel like a trading terminal status line, not a coding assistant.

### Fix 4: Remove Claude Code Notifications
**File:** `src/hooks/notifs/useNpmDeprecationNotification.tsx`

Line 5: `'Claude Code has switched from npm to native installer...'`

Either:
- Remove this notification entirely (return null/empty)
- Or replace with a Vibe Sensei welcome tip: `'Welcome to Vibe Sensei. Type a trade command to begin. /help for commands.'`

### Fix 5: Update Product Constants
**File:** `src/constants/product.ts`

Line 1: `PRODUCT_URL = 'https://claude.com/claude-code'`

Change to: `PRODUCT_URL = 'https://github.com/VictorVVedtion/vibe-sensei'` (or keep as placeholder)

### Fix 6: Update feedConfigs
**File:** `src/components/LogoV2/feedConfigs.tsx`

Search for any "Claude Code" references in changelog/feed messages. Replace with "Vibe Sensei" equivalents or remove entirely.

## Verification
1. `bun run build` succeeds
2. `bun run dev` shows the new welcome banner with octopus art
3. Prompt shows `≋` instead of `❯`
4. No "Claude Code" text visible in the terminal UI
5. Footer shows trading-relevant info

## Context
- Welcome banner: `src/components/LogoV2/Clawd.tsx` (100 lines), `LogoV2.tsx` (150 lines)
- Prompt: `src/components/PromptInput/PromptInput.tsx` (1000+ lines)
- Footer: `src/components/PromptInput/PromptInputFooterLeftSide.tsx`, `src/components/StatusLine.tsx`
- Notifications: `src/hooks/notifs/useNpmDeprecationNotification.tsx`
- Product constants: `src/constants/product.ts`
- Feed configs: `src/components/LogoV2/feedConfigs.tsx`

## Timeout
240 minutes
