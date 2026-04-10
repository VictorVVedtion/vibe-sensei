import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  ExecutionTracker,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATES,
  type ExecutionState,
} from '../state-machine'

/** Create a fresh temp directory for each test's log file. */
function tempLogPath(): string {
  const dir = join(tmpdir(), `vibe-exec-test-${crypto.randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return join(dir, 'execution-log.jsonl')
}

describe('ExecutionTracker', () => {
  let logPath: string
  let tracker: ExecutionTracker

  beforeEach(() => {
    logPath = tempLogPath()
    tracker = new ExecutionTracker(logPath)
  })

  afterEach(() => {
    const dir = join(logPath, '..')
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  // ── Creation ───────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a record in QUOTE state', () => {
      const rec = tracker.create('binance', 'CEX_SPOT', 'BTC/USDT', 'buy')
      expect(rec.state).toBe('QUOTE')
      expect(rec.venueId).toBe('binance')
      expect(rec.vertical).toBe('CEX_SPOT')
      expect(rec.symbol).toBe('BTC/USDT')
      expect(rec.side).toBe('buy')
      expect(rec.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
      expect(rec.transitions).toHaveLength(0)
    })
  })

  // ── Valid transitions ──────────────────────────────────────────────────

  describe('valid transitions', () => {
    it('CEX market order: QUOTE → CONFIRMED → SETTLED', () => {
      const rec = tracker.create('binance', 'CEX_SPOT', 'ETH/USDT', 'buy')
      const r1 = tracker.transition(rec.id, 'CONFIRMED')
      expect(r1.state).toBe('CONFIRMED')
      expect(r1.transitions).toHaveLength(1)

      const r2 = tracker.transition(rec.id, 'SETTLED')
      expect(r2.state).toBe('SETTLED')
      expect(r2.transitions).toHaveLength(2)
      expect(r2.transitions[0]).toMatchObject({ from: 'QUOTE', to: 'CONFIRMED' })
      expect(r2.transitions[1]).toMatchObject({ from: 'CONFIRMED', to: 'SETTLED' })
    })

    it('DEX full chain: QUOTE → APPROVE → SIGN → BROADCAST → PENDING → CONFIRMED → SETTLED', () => {
      const rec = tracker.create('uniswap', 'DEX_SPOT', 'WETH/USDC', 'sell')
      tracker.transition(rec.id, 'APPROVE')
      tracker.transition(rec.id, 'SIGN')
      tracker.transition(rec.id, 'BROADCAST', { txHash: '0xabc123' })
      tracker.transition(rec.id, 'PENDING')
      tracker.transition(rec.id, 'CONFIRMED')
      const final = tracker.transition(rec.id, 'SETTLED')

      expect(final.state).toBe('SETTLED')
      expect(final.txHash).toBe('0xabc123')
      expect(final.transitions).toHaveLength(6)
      const chain = final.transitions.map(t => t.to)
      expect(chain).toEqual([
        'APPROVE', 'SIGN', 'BROADCAST', 'PENDING', 'CONFIRMED', 'SETTLED',
      ])
    })

    it('QUOTE → EXPIRED for timed-out quotes', () => {
      const rec = tracker.create('hyperliquid', 'PERP', 'BTC/USD', 'buy')
      const r = tracker.transition(rec.id, 'EXPIRED')
      expect(r.state).toBe('EXPIRED')
    })

    it('BROADCAST → TX_LOST for dropped transactions', () => {
      const rec = tracker.create('uniswap', 'DEX_SPOT', 'UNI/ETH', 'buy')
      tracker.transition(rec.id, 'APPROVE')
      tracker.transition(rec.id, 'SIGN')
      tracker.transition(rec.id, 'BROADCAST', { txHash: '0xdead' })
      const r = tracker.transition(rec.id, 'TX_LOST', { error: 'tx dropped' })
      expect(r.state).toBe('TX_LOST')
      expect(r.error).toBe('tx dropped')
    })

    it('stores txHash and error on transition', () => {
      const rec = tracker.create('binance', 'CEX_SPOT', 'SOL/USDT', 'sell')
      tracker.transition(rec.id, 'CONFIRMED', { txHash: '0xfeed' })
      const r = tracker.get(rec.id)!
      expect(r.txHash).toBe('0xfeed')
    })
  })

  // ── Invalid transitions ────────────────────────────────────────────────

  describe('invalid transitions', () => {
    it('QUOTE → SETTLED throws (skip not allowed)', () => {
      const rec = tracker.create('binance', 'CEX_SPOT', 'BTC/USDT', 'buy')
      expect(() => tracker.transition(rec.id, 'SETTLED')).toThrowError(
        /Invalid transition: QUOTE → SETTLED/,
      )
    })

    it('terminal state SETTLED has no outgoing transitions', () => {
      const rec = tracker.create('binance', 'CEX_SPOT', 'ETH/USDT', 'buy')
      tracker.transition(rec.id, 'CONFIRMED')
      tracker.transition(rec.id, 'SETTLED')
      expect(() => tracker.transition(rec.id, 'CONFIRMED')).toThrowError(
        /terminal state/,
      )
    })

    it('non-existent record throws', () => {
      expect(() => tracker.transition('no-such-id', 'CONFIRMED')).toThrowError(
        /not found/,
      )
    })
  })

  // ── Query helpers ──────────────────────────────────────────────────────

  describe('getActive() / getPending()', () => {
    it('getActive excludes terminal records', () => {
      const a = tracker.create('binance', 'CEX_SPOT', 'BTC/USDT', 'buy')
      const b = tracker.create('binance', 'CEX_SPOT', 'ETH/USDT', 'sell')
      tracker.transition(a.id, 'CONFIRMED')
      tracker.transition(a.id, 'SETTLED')
      // b stays in QUOTE (active)
      const active = tracker.getActive()
      expect(active).toHaveLength(1)
      expect(active[0].id).toBe(b.id)
    })

    it('getPending returns only BROADCAST and PENDING records', () => {
      const a = tracker.create('uniswap', 'DEX_SPOT', 'WETH/USDC', 'buy')
      const b = tracker.create('binance', 'CEX_SPOT', 'BTC/USDT', 'buy')
      tracker.transition(a.id, 'APPROVE')
      tracker.transition(a.id, 'SIGN')
      tracker.transition(a.id, 'BROADCAST')
      // b stays in QUOTE
      const pending = tracker.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0].id).toBe(a.id)
      expect(pending[0].state).toBe('BROADCAST')
    })
  })

  // ── Allowed transitions map integrity ──────────────────────────────────

  describe('ALLOWED_TRANSITIONS', () => {
    it('every target state exists as a key', () => {
      const allStates = new Set(Object.keys(ALLOWED_TRANSITIONS))
      for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
        for (const target of targets) {
          expect(allStates.has(target)).toBe(true)
        }
      }
    })

    it('terminal states have no outgoing transitions', () => {
      for (const state of TERMINAL_STATES) {
        expect(ALLOWED_TRANSITIONS[state]).toEqual([])
      }
    })
  })

  // ── Persistence & Recovery ─────────────────────────────────────────────

  describe('persistence and recovery', () => {
    it('recovers active records from log', () => {
      // First tracker: create and transition, which writes to log
      const rec = tracker.create('binance', 'CEX_SPOT', 'BTC/USDT', 'buy')
      tracker.transition(rec.id, 'CONFIRMED')

      // Second tracker: reads log and recovers
      const tracker2 = new ExecutionTracker(logPath)
      tracker2.recoverFromLog()
      const recovered = tracker2.get(rec.id)
      expect(recovered).toBeDefined()
      expect(recovered!.state).toBe('CONFIRMED')
      expect(recovered!.transitions).toHaveLength(1)
    })

    it('recovers full DEX chain from log', () => {
      const rec = tracker.create('uniswap', 'DEX_SPOT', 'WETH/USDC', 'sell')
      tracker.transition(rec.id, 'APPROVE')
      tracker.transition(rec.id, 'SIGN')
      tracker.transition(rec.id, 'BROADCAST', { txHash: '0xabc' })
      tracker.transition(rec.id, 'PENDING')
      tracker.transition(rec.id, 'CONFIRMED')
      tracker.transition(rec.id, 'SETTLED')

      const tracker2 = new ExecutionTracker(logPath)
      tracker2.recoverFromLog()
      const recovered = tracker2.get(rec.id)
      expect(recovered!.state).toBe('SETTLED')
      expect(recovered!.txHash).toBe('0xabc')
      expect(recovered!.transitions).toHaveLength(6)
    })

    it('flags PENDING older than 5 minutes as TX_LOST on recovery', () => {
      // Manually write a log entry with old timestamp
      const oldTimestamp = Date.now() - 6 * 60 * 1000 // 6 minutes ago
      const id = crypto.randomUUID()
      const entries = [
        JSON.stringify({
          id,
          from: 'QUOTE',
          to: 'APPROVE',
          timestamp: oldTimestamp - 1000,
        }),
        JSON.stringify({
          id,
          from: 'APPROVE',
          to: 'SIGN',
          timestamp: oldTimestamp - 500,
        }),
        JSON.stringify({
          id,
          from: 'SIGN',
          to: 'BROADCAST',
          txHash: '0xstale',
          timestamp: oldTimestamp - 200,
        }),
        JSON.stringify({
          id,
          from: 'BROADCAST',
          to: 'PENDING',
          timestamp: oldTimestamp,
        }),
      ]
      writeFileSync(logPath, entries.join('\n') + '\n', 'utf-8')

      const tracker2 = new ExecutionTracker(logPath)
      tracker2.recoverFromLog()
      const recovered = tracker2.get(id)
      expect(recovered).toBeDefined()
      expect(recovered!.state).toBe('TX_LOST')
      // Should have 5 transitions: 4 from log + 1 TX_LOST from recovery
      expect(recovered!.transitions).toHaveLength(5)
      expect(recovered!.transitions[4]).toMatchObject({
        from: 'PENDING',
        to: 'TX_LOST',
      })
    })

    it('does NOT flag recent PENDING as TX_LOST', () => {
      const rec = tracker.create('uniswap', 'DEX_SPOT', 'WETH/USDC', 'buy')
      tracker.transition(rec.id, 'APPROVE')
      tracker.transition(rec.id, 'SIGN')
      tracker.transition(rec.id, 'BROADCAST')
      tracker.transition(rec.id, 'PENDING')

      const tracker2 = new ExecutionTracker(logPath)
      tracker2.recoverFromLog()
      const recovered = tracker2.get(rec.id)
      expect(recovered!.state).toBe('PENDING')
    })

    it('handles empty log file gracefully', () => {
      writeFileSync(logPath, '', 'utf-8')
      const tracker2 = new ExecutionTracker(logPath)
      expect(() => tracker2.recoverFromLog()).not.toThrow()
      expect(tracker2.getActive()).toHaveLength(0)
    })

    it('handles missing log file gracefully', () => {
      const tracker2 = new ExecutionTracker(join(tmpdir(), 'nonexistent', 'log.jsonl'))
      expect(() => tracker2.recoverFromLog()).not.toThrow()
    })
  })
})
