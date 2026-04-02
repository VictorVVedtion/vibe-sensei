# Sprint 13: Guardian Observer in Query Loop

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-13: <what>`。

## Objective
Wire RiskGuardian into the query loop so every tool call triggers risk evaluation, and alerts are injected as assistant messages the user sees.

## Assigned To
opus

## Deliverables
- [ ] src/query.ts — Post-tool-call guardian evaluation hook
- [ ] src/services/trading/guardian-observer.ts — Observer module bridging RiskGuardian to query loop

## Acceptance Criteria

### 1. Guardian Observer Module (`src/services/trading/guardian-observer.ts`)
Create a module that:
- Imports `RiskGuardian` from `src/buddy/guardian.ts`
- Imports `getCompanion` from `src/buddy/companion.ts`
- Imports `getPersonalizedAlert` from `src/buddy/persona.ts`
- Imports `getConnectedExchange` from `src/services/exchange/singleton.ts`
- Exports `evaluateAfterToolCall(toolName: string): Promise<string | null>`
  - Only triggers for trading-related tools: `OrderTool`, `PositionTool`, `BalanceTool`
  - Gets companion via `getCompanion()`
  - Gets exchange via `getConnectedExchange()`
  - Creates `RiskGuardian(companion, exchange)`
  - Calls `guardian.evaluate()` → `RiskAlert[]`
  - If alerts exist, calls `getPersonalizedAlert(master, stats, alert)` for the top alert
  - Returns the personalized alert string, or null if no alerts
- Exports `isTradeRelatedTool(toolName: string): boolean`
- All imports use dynamic `import()` wrapped in try-catch (non-fatal if modules missing)
- Guardian instance should be cached per session (don't recreate on every call)

### 2. Query Loop Integration (`src/query.ts`)
In the tool execution section (around lines 1520-1524, after tool results are collected):
- Import `evaluateAfterToolCall` from the guardian observer
- After all tool results are collected and before the next API call:
  - Check if any executed tool was trade-related via `isTradeRelatedTool()`
  - If yes, call `evaluateAfterToolCall(toolName)`
  - If alert string returned, create an assistant message via `createAssistantMessage({ content: alertString })`
  - Yield the alert message so user sees it
  - Push to toolResults array so it flows into next API turn
- Wrap entire guardian block in try-catch — guardian failure must NEVER break the query loop
- Add a comment `// Guardian risk observer — evaluates after trade tool calls`

### 3. Guardian Persona Already Wired
The guardian persona system prompt is already injected via `context.ts` line ~195 (`buildGuardianSystemPrompt`). Do NOT modify this — it's working. Your job is only the runtime evaluation hook.

### 4. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `src/query.ts` — Main query loop, lines 1385-1524 (tool execution section)
- `src/buddy/guardian.ts` — RiskGuardian class, evaluate() API
- `src/buddy/persona.ts` — getPersonalizedAlert(), buildGuardianSystemPrompt()
- `src/buddy/companion.ts` — getCompanion(), getMasterName(), getMasterQuote()
- `src/buddy/types.ts` — Master type, StatName, MASTER_NAMES, MASTER_QUOTES
- `src/services/exchange/singleton.ts` — getConnectedExchange()
- `src/utils/messages.ts` — createAssistantMessage()
- `src/types/message.ts` — Message types

## Key API Signatures
```typescript
// RiskGuardian (src/buddy/guardian.ts)
class RiskGuardian {
  constructor(companion: Companion, exchange?: ExchangeInterface)
  async evaluate(): Promise<RiskAlert[]>
}

// RiskAlert
interface RiskAlert {
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY'
  masterId: string
  masterName: string
  message: string
  checkName: string
  timestamp: Date
}

// Persona (src/buddy/persona.ts)
function getPersonalizedAlert(master: Master, stats: Record<StatName, number>, alert: RiskAlert): string

// Companion (src/buddy/companion.ts)
function getCompanion(): Companion | undefined  // { species: Master, stats: Record<StatName, number> }

// Exchange singleton (src/services/exchange/singleton.ts)
function getConnectedExchange(): Promise<ExchangeInterface>

// Message creation (src/utils/messages.ts)
function createAssistantMessage({ content, usage?, isVirtual? }): AssistantMessage
```

## Constraints
- Max execution time: 180s
- Guardian failure must NEVER crash the query loop — always try-catch
- Only evaluate on trade tool calls (not on Read, Edit, Bash, etc.)
- Cache guardian instance per session for performance
- Do NOT modify context.ts, persona.ts, guardian.ts, companion.ts — only ADD the observer module and EDIT query.ts

当前状态: **ACTIVE**
