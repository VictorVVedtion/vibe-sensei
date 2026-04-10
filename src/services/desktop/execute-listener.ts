/**
 * Execute Listener — polls ~/.vibe-sensei/execute-requests.jsonl for
 * trade execution requests from the desktop UI.
 *
 * When the user clicks EXECUTE on a PlaybookCard in the Electron renderer,
 * the request is written to execute-requests.jsonl via IPC. This listener
 * picks it up and routes it through PlaceOrder with the full guardian pipeline.
 *
 * Safety: UUID dedup (last 100), 30s staleness discard, Zod validation.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { z } from 'zod/v4'
import { isDesktopMode } from './bridge.js'

// ── Schema ──────────────────────────────────────────────────────────────────

const ExecuteRequestSchema = z.object({
  playbookId: z.string(),
  params: z.record(z.unknown()).optional(),
  timestamp: z.number(),
})

type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>

// ── Dedup state ─────────────────────────────────────────────────────────────

const MAX_DEDUP_SIZE = 100
const processedIds = new Set<string>()
const processedOrder: string[] = []

function markProcessed(id: string): void {
  if (processedIds.has(id)) return
  processedIds.add(id)
  processedOrder.push(id)
  while (processedOrder.length > MAX_DEDUP_SIZE) {
    const oldest = processedOrder.shift()
    if (oldest) processedIds.delete(oldest)
  }
}

function isProcessed(id: string): boolean {
  return processedIds.has(id)
}

// ── File path ───────────────────────────────────────────────────────────────

const REQUESTS_FILE = join(homedir(), '.vibe-sensei', 'execute-requests.jsonl')
const STALE_THRESHOLD_MS = 30_000

// ── Listener ────────────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null
let lastFileSize = 0

/**
 * Read and process new lines from the execute-requests.jsonl file.
 * Returns validated, non-stale, non-duplicate requests.
 */
function readNewRequests(): ExecuteRequest[] {
  let content: string
  try {
    content = readFileSync(REQUESTS_FILE, 'utf-8')
  } catch {
    // File doesn't exist yet — nothing to process
    return []
  }

  // Skip if file hasn't grown
  if (content.length <= lastFileSize) {
    lastFileSize = content.length
    return []
  }

  // Only process new bytes
  const newContent = content.slice(lastFileSize)
  lastFileSize = content.length

  const now = Date.now()
  const requests: ExecuteRequest[] = []

  for (const line of newContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Parse JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      continue // Malformed line — skip
    }

    // Validate with Zod
    const result = ExecuteRequestSchema.safeParse(parsed)
    if (!result.success) continue

    const request = result.data

    // Discard stale requests (>30s old)
    if (now - request.timestamp > STALE_THRESHOLD_MS) continue

    // Dedup by playbookId
    if (isProcessed(request.playbookId)) continue

    markProcessed(request.playbookId)
    requests.push(request)
  }

  return requests
}

/**
 * Execute a single playbook request through PlaceOrder with guardian pipeline.
 * Dynamically imports OrderTool to avoid circular dependencies.
 */
async function executeRequest(request: ExecuteRequest): Promise<void> {
  const params = request.params as Record<string, unknown> | undefined
  if (!params) return

  const symbol = params.symbol as string | undefined
  const side = params.side as string | undefined
  const type = params.type as string | undefined
  const quantity = params.quantity as number | undefined

  if (!symbol || !side || !type || !quantity) return

  try {
    const { OrderTool } = await import('../../tools/OrderTool/OrderTool.js')
    await OrderTool.call({
      symbol,
      side: side as 'buy' | 'sell',
      type: type as 'market' | 'limit' | 'stop_loss',
      quantity,
      price: params.price as number | undefined,
      stopPrice: params.stopPrice as number | undefined,
    })
  } catch (error) {
    // Log but never throw — listener must stay alive
    console.error(
      '[execute-listener] Order execution failed:',
      error instanceof Error ? error.message : String(error),
    )
  }
}

/**
 * Poll cycle: read new requests and execute them sequentially.
 */
async function pollCycle(): Promise<void> {
  try {
    const requests = readNewRequests()
    for (const request of requests) {
      await executeRequest(request)
    }
  } catch {
    // Poll cycle failure must never crash the listener
  }
}

/**
 * Start the execute listener. Polls every 500ms for new requests.
 * Only activates in desktop mode (VIBE_SENSEI_DESKTOP=1).
 *
 * Call once during app bootstrap. Idempotent — subsequent calls are no-ops.
 */
export function startExecuteListener(): void {
  if (pollTimer !== null) return
  if (!isDesktopMode()) return

  // Initialize lastFileSize to current file size to skip pre-existing lines
  try {
    const content = readFileSync(REQUESTS_FILE, 'utf-8')
    lastFileSize = content.length
  } catch {
    lastFileSize = 0
  }

  pollTimer = setInterval(pollCycle, 500)

  // Ensure the interval doesn't prevent process exit
  if (pollTimer && typeof pollTimer === 'object' && 'unref' in pollTimer) {
    pollTimer.unref()
  }
}

/**
 * Stop the execute listener. Safe to call even if not started.
 */
export function stopExecuteListener(): void {
  if (pollTimer === null) return
  clearInterval(pollTimer)
  pollTimer = null
}

/**
 * Clear the execute-requests.jsonl file. Used for cleanup.
 */
export function clearExecuteRequests(): void {
  try {
    writeFileSync(REQUESTS_FILE, '', 'utf-8')
    lastFileSize = 0
  } catch {
    // Cleanup failure is non-fatal
  }
}
