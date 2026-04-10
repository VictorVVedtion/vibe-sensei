import { describe, test, expect, beforeEach } from 'bun:test'
import {
  BackendEventStream,
  getBackendEventStream,
  resetBackendEventStream,
} from '../event-stream.js'
import type {
  StreamChunkEvent,
  ToolCallStartEvent,
  ToolCallEndEvent,
  GuardianAlertEvent,
  DebateStartEvent,
  GhostWarningEvent,
  BalanceUpdateEvent,
  PriceUpdateEvent,
  StateSyncEvent,
  BackendEvent,
} from '../types.js'

describe('BackendEventStream', () => {
  beforeEach(() => {
    resetBackendEventStream()
  })

  // ─── Singleton ──────────────────────────────────────────────────────────

  test('getBackendEventStream returns the same instance', () => {
    const a = getBackendEventStream()
    const b = getBackendEventStream()
    expect(a).toBe(b)
  })

  test('resetBackendEventStream creates a fresh instance', () => {
    const a = getBackendEventStream()
    resetBackendEventStream()
    const b = getBackendEventStream()
    expect(a).not.toBe(b)
  })

  test('instance is a BackendEventStream', () => {
    const stream = getBackendEventStream()
    expect(stream).toBeInstanceOf(BackendEventStream)
  })

  // ─── StreamChunk ────────────────────────────────────────────────────────

  test('emits StreamChunk events', () => {
    const stream = getBackendEventStream()
    const received: StreamChunkEvent[] = []
    stream.onEvent('StreamChunk', (e) => received.push(e))

    const event: StreamChunkEvent = {
      type: 'StreamChunk',
      text: 'Hello world',
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    expect(received).toHaveLength(1)
    expect(received[0]!.type).toBe('StreamChunk')
    expect(received[0]!.text).toBe('Hello world')
  })

  // ─── ToolCallStart ──────────────────────────────────────────────────────

  test('emits ToolCallStart events', () => {
    const stream = getBackendEventStream()
    const received: ToolCallStartEvent[] = []
    stream.onEvent('ToolCallStart', (e) => received.push(e))

    const event: ToolCallStartEvent = {
      type: 'ToolCallStart',
      id: 'tool-123',
      name: 'PlaceOrder',
      input: { symbol: 'BTC/USDT', side: 'buy', quantity: 0.1 },
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    expect(received).toHaveLength(1)
    expect(received[0]!.name).toBe('PlaceOrder')
    expect(received[0]!.id).toBe('tool-123')
  })

  // ─── ToolCallEnd ────────────────────────────────────────────────────────

  test('emits ToolCallEnd events', () => {
    const stream = getBackendEventStream()
    const received: ToolCallEndEvent[] = []
    stream.onEvent('ToolCallEnd', (e) => received.push(e))

    const event: ToolCallEndEvent = {
      type: 'ToolCallEnd',
      id: 'tool-123',
      output: 'Order placed successfully',
      isError: false,
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    expect(received).toHaveLength(1)
    expect(received[0]!.output).toBe('Order placed successfully')
    expect(received[0]!.isError).toBe(false)
  })

  // ─── GuardianAlert ──────────────────────────────────────────────────────

  test('emits GuardianAlert events', () => {
    const stream = getBackendEventStream()
    const received: GuardianAlertEvent[] = []
    stream.onEvent('GuardianAlert', (e) => received.push(e))

    const event: GuardianAlertEvent = {
      type: 'GuardianAlert',
      severity: 'warning',
      message: 'Position size exceeds 10% of portfolio',
      emotion: 'stern',
      masterName: 'Warren Buffett',
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    expect(received).toHaveLength(1)
    expect(received[0]!.severity).toBe('warning')
    expect(received[0]!.masterName).toBe('Warren Buffett')
  })

  // ─── DebateStart ────────────────────────────────────────────────────────

  test('emits DebateStart events', () => {
    const stream = getBackendEventStream()
    const received: DebateStartEvent[] = []
    stream.onEvent('DebateStart', (e) => received.push(e))

    const event: DebateStartEvent = {
      type: 'DebateStart',
      forMaster: 'jesse_livermore',
      againstMaster: 'benjamin_graham',
      topic: 'BUY 1.5 BTC/USDT at market',
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    expect(received).toHaveLength(1)
    expect(received[0]!.forMaster).toBe('jesse_livermore')
    expect(received[0]!.againstMaster).toBe('benjamin_graham')
    expect(received[0]!.topic).toBe('BUY 1.5 BTC/USDT at market')
  })

  // ─── GhostWarning ──────────────────────────────────────────────────────

  test('emits GhostWarning events', () => {
    const stream = getBackendEventStream()
    const received: GhostWarningEvent[] = []
    stream.onEvent('GhostWarning', (e) => received.push(e))

    const event: GhostWarningEvent = {
      type: 'GhostWarning',
      ghostId: 'sbf',
      ghostName: 'Sam Bankman-Fried',
      triggerReason: 'Concentrated position in single asset',
      quote: 'I thought the risk was managed...',
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    expect(received).toHaveLength(1)
    expect(received[0]!.ghostId).toBe('sbf')
    expect(received[0]!.ghostName).toBe('Sam Bankman-Fried')
  })

  // ─── BalanceUpdate ──────────────────────────────────────────────────────

  test('emits BalanceUpdate events', () => {
    const stream = getBackendEventStream()
    const received: BalanceUpdateEvent[] = []
    stream.onEvent('BalanceUpdate', (e) => received.push(e))

    const event: BalanceUpdateEvent = {
      type: 'BalanceUpdate',
      balances: [
        { currency: 'USDT', free: 95000, used: 5000, total: 100000 },
        { currency: 'BTC', free: 0.5, used: 0, total: 0.5 },
      ],
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    expect(received).toHaveLength(1)
    expect(received[0]!.balances).toHaveLength(2)
    expect(received[0]!.balances[0]!.currency).toBe('USDT')
  })

  // ─── PriceUpdate ────────────────────────────────────────────────────────

  test('emits PriceUpdate events', () => {
    const stream = getBackendEventStream()
    const received: PriceUpdateEvent[] = []
    stream.onEvent('PriceUpdate', (e) => received.push(e))

    const event: PriceUpdateEvent = {
      type: 'PriceUpdate',
      symbol: 'BTC/USDT',
      ohlcv: {
        open: 67000,
        high: 68500,
        low: 66800,
        close: 68200,
        volume: 15000,
      },
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    expect(received).toHaveLength(1)
    expect(received[0]!.symbol).toBe('BTC/USDT')
    expect(received[0]!.ohlcv.close).toBe(68200)
  })

  // ─── StateSync ──────────────────────────────────────────────────────────

  test('emits StateSync events', () => {
    const stream = getBackendEventStream()
    const received: StateSyncEvent[] = []
    stream.onEvent('StateSync', (e) => received.push(e))

    const event: StateSyncEvent = {
      type: 'StateSync',
      fullState: {
        sessionId: 'abc-123',
        contextUsage: 0.45,
        turnCount: 12,
      },
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    expect(received).toHaveLength(1)
    expect(received[0]!.fullState.sessionId).toBe('abc-123')
  })

  // ─── Multiple Consumers ─────────────────────────────────────────────────

  test('multiple consumers receive the same event', () => {
    const stream = getBackendEventStream()
    const consumer1: StreamChunkEvent[] = []
    const consumer2: StreamChunkEvent[] = []

    stream.onEvent('StreamChunk', (e) => consumer1.push(e))
    stream.onEvent('StreamChunk', (e) => consumer2.push(e))

    const event: StreamChunkEvent = {
      type: 'StreamChunk',
      text: 'shared text',
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    expect(consumer1).toHaveLength(1)
    expect(consumer2).toHaveLength(1)
    expect(consumer1[0]).toBe(consumer2[0])
  })

  // ─── onAnyEvent ─────────────────────────────────────────────────────────

  test('onAnyEvent receives events of all types', () => {
    const stream = getBackendEventStream()
    const received: BackendEvent[] = []
    stream.onAnyEvent((e) => received.push(e))

    stream.emitEvent({
      type: 'StreamChunk',
      text: 'hello',
      timestamp: Date.now(),
    })
    stream.emitEvent({
      type: 'GuardianAlert',
      severity: 'warning',
      message: 'test',
      emotion: 'calm',
      masterName: 'Test',
      timestamp: Date.now(),
    })
    stream.emitEvent({
      type: 'GhostWarning',
      ghostId: 'sbf',
      ghostName: 'SBF',
      triggerReason: 'test',
      quote: 'test',
      timestamp: Date.now(),
    })

    expect(received).toHaveLength(3)
    expect(received[0]!.type).toBe('StreamChunk')
    expect(received[1]!.type).toBe('GuardianAlert')
    expect(received[2]!.type).toBe('GhostWarning')
  })

  // ─── offAnyEvent ────────────────────────────────────────────────────────

  test('offAnyEvent removes the handler from all event types', () => {
    const stream = getBackendEventStream()
    const received: BackendEvent[] = []
    const handler = (e: BackendEvent) => received.push(e)

    stream.onAnyEvent(handler)
    stream.emitEvent({
      type: 'StreamChunk',
      text: 'before',
      timestamp: Date.now(),
    })
    expect(received).toHaveLength(1)

    stream.offAnyEvent(handler)
    stream.emitEvent({
      type: 'StreamChunk',
      text: 'after',
      timestamp: Date.now(),
    })
    expect(received).toHaveLength(1) // no new event received
  })

  // ─── Fire-and-forget safety ─────────────────────────────────────────────

  test('emitEvent does not throw when listener throws', () => {
    const stream = getBackendEventStream()
    stream.onEvent('StreamChunk', () => {
      throw new Error('listener exploded')
    })

    // Should not throw
    expect(() => {
      stream.emitEvent({
        type: 'StreamChunk',
        text: 'test',
        timestamp: Date.now(),
      })
    }).not.toThrow()
  })

  // ─── Event isolation ────────────────────────────────────────────────────

  test('events of different types do not cross-fire', () => {
    const stream = getBackendEventStream()
    const chunks: StreamChunkEvent[] = []
    const alerts: GuardianAlertEvent[] = []

    stream.onEvent('StreamChunk', (e) => chunks.push(e))
    stream.onEvent('GuardianAlert', (e) => alerts.push(e))

    stream.emitEvent({
      type: 'StreamChunk',
      text: 'hello',
      timestamp: Date.now(),
    })

    expect(chunks).toHaveLength(1)
    expect(alerts).toHaveLength(0)
  })
})
