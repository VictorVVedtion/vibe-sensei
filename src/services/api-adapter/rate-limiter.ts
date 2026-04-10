/**
 * API Adapter — in-memory sliding window rate limiter.
 *
 * Per-API call tracking. Resets on process restart (correct for CLI).
 */

const callLog: Map<string, number[]> = new Map()

/** Prune stale entries and return recent count. */
function pruneAndCount(apiName: string): number {
  const timestamps = callLog.get(apiName)
  if (!timestamps) return 0
  const cutoff = Date.now() - 60_000
  let write = 0
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] > cutoff) timestamps[write++] = timestamps[i]
  }
  timestamps.length = write
  if (write === 0) {
    callLog.delete(apiName)
    return 0
  }
  return write
}

/** Check if the API can accept another call within its rate limit. */
export function canCall(apiName: string, maxPerMinute: number): boolean {
  return pruneAndCount(apiName) < maxPerMinute
}

/** Record a successful call for rate limiting. */
export function recordCall(apiName: string): void {
  const timestamps = callLog.get(apiName)
  if (timestamps) {
    timestamps.push(Date.now())
  } else {
    callLog.set(apiName, [Date.now()])
  }
}

/** Get remaining calls in the current minute window. */
export function remainingCalls(apiName: string, maxPerMinute: number): number {
  return Math.max(0, maxPerMinute - pruneAndCount(apiName))
}
