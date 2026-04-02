# Sprint 23: Python Strategy Bridge

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-23: <what>`。

## Objective
Create a StrategyTool that executes Python strategy scripts via subprocess and parses BUY/SELL/HOLD signals for the AI to act on.

## Assigned To
opus

## Deliverables
- [ ] src/tools/StrategyTool/StrategyTool.ts — The strategy tool
- [ ] src/tools.ts — Register StrategyTool in the tool list

## Acceptance Criteria

### 1. StrategyTool (`src/tools/StrategyTool/StrategyTool.ts`)
Create a tool following the existing pattern (OrderTool as reference):

**Input Schema (Zod):**
```typescript
z.strictObject({
  script: z.string().describe('Path to the Python strategy script'),
  symbol: z.string().optional().describe('Trading pair to analyze, e.g. BTC/USDT'),
  timeframe: z.string().optional().describe('Timeframe for analysis, e.g. 1h, 4h, 1d'),
  args: z.array(z.string()).optional().describe('Additional arguments to pass to the script'),
})
```

**Execution:**
- Use `Bun.spawn()` to execute: `python3 <script> [--symbol <symbol>] [--timeframe <timeframe>] [args...]`
- Capture stdout and stderr
- Timeout: 30 seconds (kill process if exceeded)
- Working directory: the directory containing the script

**Output Parsing:**
- Look for signal line in stdout matching pattern: `SIGNAL: (BUY|SELL|HOLD)` (case-insensitive)
- Also look for optional fields:
  - `CONFIDENCE: <0-100>` — confidence percentage
  - `REASON: <text>` — explanation
  - `PRICE: <number>` — suggested price
  - `QUANTITY: <number>` — suggested quantity
- Return structured result:
  ```typescript
  interface StrategyResult {
    signal: 'BUY' | 'SELL' | 'HOLD' | 'UNKNOWN'
    confidence?: number
    reason?: string
    suggestedPrice?: number
    suggestedQuantity?: number
    rawOutput: string    // Full stdout for AI to analyze
    exitCode: number
  }
  ```
- If no SIGNAL line found, set signal to 'UNKNOWN' and return full output for AI interpretation

**Tool Properties:**
- `name: 'RunStrategy'`
- `isReadOnly: true` (doesn't modify state, just analyzes)
- `isDestructive: false`
- `isConcurrencySafe: true`

### 2. Tool Registration (`src/tools.ts`)
- Import StrategyTool
- Add to the tools array (same pattern as OrderTool, PositionTool, BalanceTool)

### 3. Security
- Validate script path exists before execution
- Do NOT allow script paths with `..` traversal
- Log the command being executed to stderr
- Capture stderr separately and include in result if non-empty

### 4. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `src/tools/OrderTool/OrderTool.ts` — Reference implementation for tool pattern
- `src/Tool.ts` — Tool interface, buildTool(), ToolDef type
- `src/tools.ts` — Tool registry, how tools are added to the list
- `src/services/exchange/types.ts` — Order types (for reference)

## Key buildTool Pattern
```typescript
export const StrategyTool = buildTool({
  name: 'RunStrategy',
  searchHint: 'python strategy script signal',
  maxResultSizeChars: 50_000,
  get inputSchema() { return inputSchema },
  isReadOnly() { return true },
  isDestructive() { return false },
  isConcurrencySafe() { return true },
  async description() { return '...' },
  async prompt() { return '...' },
  async call(input) { /* execute python, parse output */ },
} satisfies ToolDef<typeof inputSchema, StrategyResult>)
```

## Constraints
- Max execution time: 180s
- Python execution timeout: 30 seconds
- Must validate script path (no traversal, must exist)
- Use Bun.spawn() for subprocess (not child_process)
- Full stdout always returned for AI interpretation
- Do NOT install any npm packages

当前状态: **ACTIVE**
