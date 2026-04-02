# Sprint 16: REPL Guardian Welcome + Status

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-16: <what>`。

## Objective
On REPL startup, display the user's guardian master info and paper trading balance below the logo. 2 lines max.

## Assigned To
codex

## Deliverables
- [ ] src/components/LogoV2/LogoV2.tsx — Add guardian welcome lines after logo

## Acceptance Criteria

### 1. Guardian Welcome in LogoV2 (`src/components/LogoV2/LogoV2.tsx`)

Add 2 lines below the existing logo output. The rendering should:

1. **Get companion synchronously** via `getCompanion()` from `src/buddy/companion.ts`
2. **Get balance asynchronously** via `useEffect` + `getConnectedExchange()` from `src/services/exchange/singleton.ts`
3. **Render 2 lines** using Ink `<Box>` and `<Text>`:

```
🛡️ Guardian: Warren Buffett (Legendary ★★★★★)
   "Rule #1: Never lose money. Rule #2: Never forget Rule #1."
💰 Paper: 100,000.00 USDT
```

Format details:
- Line 1: `🛡️ Guardian: {MASTER_NAMES[species]} ({Rarity} {RARITY_STARS[rarity]})`
- Line 2: `   "{MASTER_QUOTES[species]}"` — indented, dimmed/italic
- Line 3: `💰 Paper: {formatted_balance} USDT`
- Rarity should be capitalized: "Legendary", "Epic", "Rare", etc.
- Balance formatted with commas and 2 decimal places
- If companion is undefined, skip both lines (silent — no error display)
- If balance fetch fails, show guardian line only, skip balance line

### 2. Data Sources

```typescript
// Companion (sync)
import { getCompanion, getMasterName, getMasterQuote } from 'src/buddy/companion.js'
// getCompanion() → { species: Master, stats, rarity, ... } | undefined
// getMasterName(species) → "Warren Buffett"
// getMasterQuote(species) → "Rule #1: Never lose money..."

// Rarity stars
import { RARITY_STARS } from 'src/buddy/types.js'
// RARITY_STARS = { common: '★', uncommon: '★★', rare: '★★★', epic: '★★★★', legendary: '★★★★★' }

// Balance (async)
import { getConnectedExchange } from 'src/services/exchange/singleton.js'
// const exchange = await getConnectedExchange()
// const balances = await exchange.getBalance()
// Find USDT: balances.find(b => b.currency === 'USDT')?.total ?? 100000
```

### 3. React Pattern
LogoV2 uses React with Ink. Follow the existing pattern:
- Use `useState` for balance state
- Use `useEffect` with async IIFE for balance fetch
- Companion data is sync (no effect needed)
- Wrap buddy imports in try-catch — if modules fail to import, render nothing

### 4. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `src/components/LogoV2/LogoV2.tsx` — Primary target, lines 47-200. Understand the render pattern before editing.
- `src/buddy/companion.ts` — getCompanion(), getMasterName(), getMasterQuote()
- `src/buddy/types.ts` — RARITY_STARS, Master type, Rarity type
- `src/services/exchange/singleton.ts` — getConnectedExchange()
- `src/services/exchange/types.ts` — Balance type

## Constraints
- Max execution time: 120s
- Only modify `src/components/LogoV2/LogoV2.tsx`
- 3 lines max in the terminal output (guardian name + quote + balance)
- Silent failure — if buddy modules are missing, show nothing
- Do NOT create new component files — inline in LogoV2
- Use dynamic import() for buddy modules to keep them optional

当前状态: **ACTIVE**
