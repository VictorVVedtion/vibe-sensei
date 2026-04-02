/**
 * StrategyTool — Execute Python strategy scripts and parse trading signals.
 * Runs a Python script via Bun.spawn(), captures stdout/stderr, and extracts
 * structured BUY/SELL/HOLD signals for AI interpretation.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { existsSync } from 'fs'
import { resolve, dirname, isAbsolute } from 'path'

const inputSchema = z.strictObject({
  script: z.string().describe('Path to the Python strategy script'),
  symbol: z
    .string()
    .optional()
    .describe('Trading pair to analyze, e.g. BTC/USDT'),
  timeframe: z
    .string()
    .optional()
    .describe('Timeframe for analysis, e.g. 1h, 4h, 1d'),
  args: z
    .array(z.string())
    .optional()
    .describe('Additional arguments to pass to the script'),
})

type InputSchema = typeof inputSchema

interface StrategyResult {
  signal: 'BUY' | 'SELL' | 'HOLD' | 'UNKNOWN'
  confidence?: number
  reason?: string
  suggestedPrice?: number
  suggestedQuantity?: number
  rawOutput: string
  stderr?: string
  exitCode: number
}

type Output = string

const SIGNAL_RE = /^SIGNAL:\s*(BUY|SELL|HOLD)\s*$/im
const CONFIDENCE_RE = /^CONFIDENCE:\s*(\d+)\s*$/im
const REASON_RE = /^REASON:\s*(.+)$/im
const PRICE_RE = /^PRICE:\s*([\d.]+)\s*$/im
const QUANTITY_RE = /^QUANTITY:\s*([\d.]+)\s*$/im

const TIMEOUT_MS = 30_000

function parseStrategyOutput(
  stdout: string,
  exitCode: number,
  stderr: string,
): StrategyResult {
  const signalMatch = stdout.match(SIGNAL_RE)
  const signal = signalMatch
    ? (signalMatch[1].toUpperCase() as 'BUY' | 'SELL' | 'HOLD')
    : 'UNKNOWN'

  const confidenceMatch = stdout.match(CONFIDENCE_RE)
  const confidence = confidenceMatch
    ? Math.min(100, Math.max(0, parseInt(confidenceMatch[1], 10)))
    : undefined

  const reasonMatch = stdout.match(REASON_RE)
  const reason = reasonMatch ? reasonMatch[1].trim() : undefined

  const priceMatch = stdout.match(PRICE_RE)
  const suggestedPrice = priceMatch
    ? parseFloat(priceMatch[1])
    : undefined

  const quantityMatch = stdout.match(QUANTITY_RE)
  const suggestedQuantity = quantityMatch
    ? parseFloat(quantityMatch[1])
    : undefined

  const result: StrategyResult = {
    signal,
    rawOutput: stdout,
    exitCode,
  }
  if (confidence !== undefined) result.confidence = confidence
  if (reason !== undefined) result.reason = reason
  if (suggestedPrice !== undefined && !isNaN(suggestedPrice)) {
    result.suggestedPrice = suggestedPrice
  }
  if (suggestedQuantity !== undefined && !isNaN(suggestedQuantity)) {
    result.suggestedQuantity = suggestedQuantity
  }
  if (stderr.length > 0) result.stderr = stderr

  return result
}

function validateScriptPath(script: string): string | null {
  if (script.includes('..')) {
    return 'Script path must not contain ".." traversal'
  }
  const resolved = isAbsolute(script) ? script : resolve(script)
  if (resolved.includes('..')) {
    return 'Resolved script path must not contain ".." traversal'
  }
  if (!existsSync(resolved)) {
    return `Script not found: ${resolved}`
  }
  return null
}

function formatResult(result: StrategyResult): string {
  const lines: string[] = []
  lines.push(`Signal: ${result.signal}`)
  if (result.confidence !== undefined) {
    lines.push(`Confidence: ${result.confidence}%`)
  }
  if (result.reason) {
    lines.push(`Reason: ${result.reason}`)
  }
  if (result.suggestedPrice !== undefined) {
    lines.push(`Suggested Price: ${result.suggestedPrice}`)
  }
  if (result.suggestedQuantity !== undefined) {
    lines.push(`Suggested Quantity: ${result.suggestedQuantity}`)
  }
  lines.push(`Exit Code: ${result.exitCode}`)
  if (result.stderr) {
    lines.push(`\nStderr:\n${result.stderr}`)
  }
  lines.push(`\nRaw Output:\n${result.rawOutput}`)
  return lines.join('\n')
}

export const StrategyTool = buildTool({
  name: 'RunStrategy',
  searchHint: 'python strategy script signal trading',
  maxResultSizeChars: 50_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return true
  },

  isDestructive() {
    return false
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Execute a Python trading strategy script and parse BUY/SELL/HOLD signals from its output.'
  },

  async prompt() {
    return [
      'Execute a Python strategy script and parse trading signals from stdout.',
      'The script is run via `python3 <script> [--symbol X] [--timeframe Y] [extra args...]`.',
      'Parsed output fields: SIGNAL (BUY/SELL/HOLD), CONFIDENCE (0-100), REASON, PRICE, QUANTITY.',
      'If no SIGNAL line is found, signal is set to UNKNOWN and full output is returned for analysis.',
      'Script must exist on disk and path must not contain ".." traversal.',
      'Timeout: 30 seconds.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `python3 ${input.script ?? '?'} ${input.symbol ?? ''} ${input.timeframe ?? ''}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const script = input.script ?? '?'
    const symbol = input.symbol ? ` ${input.symbol}` : ''
    return `RunStrategy: ${script}${symbol}`
  },

  async call(input) {
    const scriptPath = isAbsolute(input.script)
      ? input.script
      : resolve(input.script)

    const validationError = validateScriptPath(input.script)
    if (validationError) {
      return { data: validationError }
    }

    const cmdArgs = ['python3', scriptPath]
    if (input.symbol) {
      cmdArgs.push('--symbol', input.symbol)
    }
    if (input.timeframe) {
      cmdArgs.push('--timeframe', input.timeframe)
    }
    if (input.args) {
      cmdArgs.push(...input.args)
    }

    const cwd = dirname(scriptPath)
    console.error(`[StrategyTool] Executing: ${cmdArgs.join(' ')}`)

    let proc: ReturnType<typeof Bun.spawn> | null = null
    let timedOut = false

    try {
      proc = Bun.spawn(cmdArgs, {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          timedOut = true
          if (proc) {
            proc.kill()
          }
          reject(new Error('Strategy script timed out after 30s'))
        }, TIMEOUT_MS)
      })

      const execution = (async () => {
        const stdoutText = await new Response(proc!.stdout).text()
        const stderrText = await new Response(proc!.stderr).text()
        const exitCode = await proc!.exited
        return { stdoutText, stderrText, exitCode }
      })()

      const { stdoutText, stderrText, exitCode } = await Promise.race([
        execution,
        timeout,
      ])

      const result = parseStrategyOutput(stdoutText, exitCode, stderrText)
      return { data: formatResult(result) }
    } catch (error: unknown) {
      if (timedOut) {
        return {
          data: 'Strategy script timed out after 30 seconds. Consider optimizing the script or increasing the timeout.',
        }
      }
      const msg =
        error instanceof Error ? error.message : String(error)
      return { data: `Strategy execution failed: ${msg}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
