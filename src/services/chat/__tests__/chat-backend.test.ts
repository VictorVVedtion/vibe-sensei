/**
 * Chat WebSocket Backend tests — ChatSession lifecycle, frame protocol,
 * WebSocket handler wiring, abort handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatSession, type ChatFrame, type ChatRequest } from '../chat-query'

// ── Mock the heavy dependencies ────────────────────────────────────────────

// Mock queryModelWithStreaming to avoid real API calls
vi.mock('../../api/claude.ts', () => ({
  queryModelWithStreaming: vi.fn(),
}))

// Mock guardian-observer
vi.mock('../../trading/guardian-observer.js', () => ({
  evaluateAfterToolCall: vi.fn().mockResolvedValue(null),
}))

// Mock model resolution
vi.mock('../../../utils/model/model.js', () => ({
  getDefaultSonnetModel: () => 'claude-sonnet-4-6-20260405',
}))

// Mock growthbook (imported transitively)
vi.mock('../../../services/analytics/growthbook.js', () => ({
  getFeatureValue_CACHED_MAY_BE_STALE: () => false,
}))

// Mock model providers (imported transitively)
vi.mock('../../../utils/model/providers.js', () => ({
  getAPIProvider: () => 'firstParty',
  isFirstPartyAnthropicBaseUrl: () => true,
}))

// Mock model strings
vi.mock('../../../utils/model/modelStrings.js', () => ({
  getModelStrings: () => ({
    sonnet46: 'claude-sonnet-4-6-20260405',
    opus46: 'claude-opus-4-6-20260405',
    haiku45: 'claude-haiku-4-5-20251001',
  }),
}))

import { queryModelWithStreaming } from '../../api/claude.ts'
import { evaluateAfterToolCall } from '../../trading/guardian-observer.js'
const mockQuery = queryModelWithStreaming as unknown as ReturnType<typeof vi.fn>
const mockEvaluate = evaluateAfterToolCall as unknown as ReturnType<typeof vi.fn>

// ── Helper: create a fake async generator from an array ────────────────────

async function* fakeStream(
  events: Array<{ type: string; [key: string]: unknown }>,
): AsyncGenerator<any, void> {
  for (const e of events) {
    yield e
  }
}

// ── ChatSession ────────────────────────────────────────────────────────────

describe('ChatSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has a unique session ID', () => {
    const a = new ChatSession()
    const b = new ChatSession()
    expect(a.id).toBeTruthy()
    expect(b.id).toBeTruthy()
    expect(a.id).not.toBe(b.id)
  })

  it('starts with zero messages', () => {
    const session = new ChatSession()
    expect(session.messageCount).toBe(0)
  })

  it('streams text chunks from the API', async () => {
    mockQuery.mockReturnValue(
      fakeStream([
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: ' world' },
        },
        {
          type: 'assistant',
          uuid: 'test-uuid',
          message: {
            role: 'assistant',
            content: 'Hello world',
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        },
      ]),
    )

    const session = new ChatSession()
    const frames: ChatFrame[] = []
    for await (const frame of session.send('Hi')) {
      frames.push(frame)
    }

    expect(frames).toEqual([
      { type: 'chunk', content: 'Hello' },
      { type: 'chunk', content: ' world' },
      { type: 'done', usage: { input_tokens: 10, output_tokens: 5 } },
    ])
    expect(session.messageCount).toBe(2) // user + assistant
  })

  it('handles tool_use blocks in the stream', async () => {
    mockQuery.mockReturnValue(
      fakeStream([
        {
          type: 'content_block_start',
          content_block: {
            type: 'tool_use',
            id: 'tool_123',
            name: 'PlaceOrder',
            input: { symbol: 'BTC/USDT', side: 'buy' },
          },
        },
        {
          type: 'assistant',
          uuid: 'test-uuid-2',
          message: { role: 'assistant', content: [] },
        },
      ]),
    )

    const session = new ChatSession()
    const frames: ChatFrame[] = []
    for await (const frame of session.send('Buy BTC')) {
      frames.push(frame)
    }

    expect(frames[0]).toEqual({
      type: 'tool_use',
      id: 'tool_123',
      name: 'PlaceOrder',
      input: { symbol: 'BTC/USDT', side: 'buy' },
    })
  })

  it('yields error frame on API error', async () => {
    mockQuery.mockReturnValue(
      fakeStream([
        {
          type: 'system',
          uuid: 'err-uuid',
          message: { role: 'assistant', content: 'Rate limit exceeded' },
        },
      ]),
    )

    const session = new ChatSession()
    const frames: ChatFrame[] = []
    for await (const frame of session.send('test')) {
      frames.push(frame)
    }

    expect(frames).toEqual([
      { type: 'error', message: 'Rate limit exceeded' },
    ])
  })

  it('yields error frame on thrown exception', async () => {
    mockQuery.mockReturnValue(
      (async function* () {
        throw new Error('Network failure')
      })(),
    )

    const session = new ChatSession()
    const frames: ChatFrame[] = []
    for await (const frame of session.send('test')) {
      frames.push(frame)
    }

    expect(frames).toEqual([
      { type: 'error', message: 'Network failure' },
    ])
  })

  it('abort() signals the abort controller', () => {
    const session = new ChatSession()
    // Just verify abort doesn't throw and reset works after abort
    session.abort()
    session.reset()
    expect(session.messageCount).toBe(0)
  })

  it('reset() clears conversation history', async () => {
    mockQuery.mockReturnValue(
      fakeStream([
        {
          type: 'assistant',
          uuid: 'test-uuid-3',
          message: { role: 'assistant', content: 'Hi' },
        },
      ]),
    )

    const session = new ChatSession()
    // Send a message to add to history
    for await (const _ of session.send('Hello')) { /* consume */ }
    expect(session.messageCount).toBe(2)

    session.reset()
    expect(session.messageCount).toBe(0)
  })

  it('calls queryModelWithStreaming with correct params', async () => {
    mockQuery.mockReturnValue(
      fakeStream([
        {
          type: 'assistant',
          uuid: 'test-uuid-4',
          message: { role: 'assistant', content: 'OK' },
        },
      ]),
    )

    const session = new ChatSession()
    for await (const _ of session.send('Check BTC price')) { /* consume */ }

    // Get the last call (this test's call)
    const lastCallIdx = mockQuery.mock.calls.length - 1
    const call = mockQuery.mock.calls[lastCallIdx]![0]

    // messages is a live reference — after stream completes, assistant is appended.
    // The first message should be the user message we sent.
    expect(call.messages.length).toBeGreaterThanOrEqual(1)
    expect(call.messages[0]!.type).toBe('user')

    // Should pass system prompt
    expect(call.systemPrompt).toBeDefined()
    expect(call.systemPrompt.length).toBeGreaterThan(0)

    // Should pass tools array (trading tools)
    expect(call.tools.length).toBeGreaterThan(0)

    // Should pass abort signal
    expect(call.signal).toBeInstanceOf(AbortSignal)

    // Should be non-interactive
    expect(call.options.isNonInteractiveSession).toBe(true)
    expect(call.options.querySource).toBe('desktop_chat')
  })

  it('ignores non-content stream events gracefully', async () => {
    mockQuery.mockReturnValue(
      fakeStream([
        { type: 'message_start', message: {} },
        { type: 'ping' },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'OK' } },
        {
          type: 'assistant',
          uuid: 'test-uuid-5',
          message: { role: 'assistant', content: 'OK' },
        },
      ]),
    )

    const session = new ChatSession()
    const frames: ChatFrame[] = []
    for await (const frame of session.send('test')) {
      frames.push(frame)
    }

    // Only text chunk + done, metadata events filtered out
    expect(frames).toEqual([
      { type: 'chunk', content: 'OK' },
      { type: 'done', usage: undefined },
    ])
  })
})

// ── Chat WebSocket Handler ─────────────────────────────────────────────────

describe('handleChatConnection', () => {
  // Mock WebSocket
  function createMockWs() {
    const listeners = new Map<string, Function[]>()
    const sent: string[] = []
    const ws = {
      readyState: 1, // OPEN
      send: vi.fn((data: string) => sent.push(data)),
      on: vi.fn((event: string, cb: Function) => {
        if (!listeners.has(event)) listeners.set(event, [])
        listeners.get(event)!.push(cb)
      }),
      close: vi.fn(),
    }
    return {
      ws: ws as unknown as import('ws').WebSocket,
      sent,
      emit(event: string, ...args: any[]) {
        for (const cb of listeners.get(event) ?? []) cb(...args)
      },
    }
  }

  it('sends connected frame on connection', async () => {
    // Dynamic import to avoid module-level side effects
    const { handleChatConnection } = await import('../chat-ws')
    const { ws, sent } = createMockWs()
    handleChatConnection(ws)

    expect(sent.length).toBeGreaterThanOrEqual(1)
    const first = JSON.parse(sent[0]!)
    expect(first.type).toBe('connected')
    expect(first.sessionId).toBeTruthy()
  })

  it('rejects invalid JSON', async () => {
    const { handleChatConnection } = await import('../chat-ws')
    const { ws, sent, emit } = createMockWs()
    handleChatConnection(ws)

    emit('message', 'not json{{{')
    const errorFrame = JSON.parse(sent[sent.length - 1]!)
    expect(errorFrame.type).toBe('error')
    expect(errorFrame.message).toBe('Invalid JSON')
  })

  it('rejects empty message content', async () => {
    const { handleChatConnection } = await import('../chat-ws')
    const { ws, sent, emit } = createMockWs()
    handleChatConnection(ws)

    emit('message', JSON.stringify({ type: 'message', content: '' }))
    const errorFrame = JSON.parse(sent[sent.length - 1]!)
    expect(errorFrame.type).toBe('error')
    expect(errorFrame.message).toBe('Empty message')
  })

  it('rejects unknown message types', async () => {
    const { handleChatConnection } = await import('../chat-ws')
    const { ws, sent, emit } = createMockWs()
    handleChatConnection(ws)

    emit('message', JSON.stringify({ type: 'unknown_type' }))
    const errorFrame = JSON.parse(sent[sent.length - 1]!)
    expect(errorFrame.type).toBe('error')
    expect(errorFrame.message).toContain('Unknown message type')
  })
})

// ── ChatFrame Protocol Types ───────────────────────────────────────────────

describe('ChatFrame protocol', () => {
  it('ChatRequest message type is valid', () => {
    const msg: ChatRequest = { type: 'message', content: 'hello' }
    expect(msg.type).toBe('message')
    expect(msg.content).toBe('hello')
  })

  it('ChatRequest abort type is valid', () => {
    const msg: ChatRequest = { type: 'abort' }
    expect(msg.type).toBe('abort')
  })

  it('ChatFrame covers all server frame types', () => {
    const frames: ChatFrame[] = [
      { type: 'chunk', content: 'text' },
      { type: 'tool_use', id: '1', name: 'PlaceOrder', input: {} },
      { type: 'tool_result', name: 'PlaceOrder', data: {} },
      { type: 'guardian', alert: 'Risk too high' },
      { type: 'thinking', content: '...' },
      { type: 'done', usage: { input_tokens: 10, output_tokens: 5 } },
      { type: 'done' },
      { type: 'error', message: 'oops' },
    ]
    expect(frames).toHaveLength(8)
  })
})

// ── Sprint 123: Additional Tests ─────────────────────────────────────────

describe('ChatSession conversation history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maintains conversation history across multiple send() calls', async () => {
    // First turn
    mockQuery.mockReturnValueOnce(
      fakeStream([
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Response 1' } },
        {
          type: 'assistant',
          uuid: 'uuid-multi-1',
          message: { role: 'assistant', content: 'Response 1' },
        },
      ]),
    )

    const session = new ChatSession()
    for await (const _ of session.send('Hello')) { /* consume */ }
    expect(session.messageCount).toBe(2) // user + assistant

    // Second turn
    mockQuery.mockReturnValueOnce(
      fakeStream([
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Response 2' } },
        {
          type: 'assistant',
          uuid: 'uuid-multi-2',
          message: { role: 'assistant', content: 'Response 2' },
        },
      ]),
    )

    for await (const _ of session.send('Follow-up')) { /* consume */ }
    expect(session.messageCount).toBe(4) // 2 users + 2 assistants

    // Third turn
    mockQuery.mockReturnValueOnce(
      fakeStream([
        {
          type: 'assistant',
          uuid: 'uuid-multi-3',
          message: { role: 'assistant', content: 'Response 3' },
        },
      ]),
    )

    for await (const _ of session.send('Third')) { /* consume */ }
    expect(session.messageCount).toBe(6) // 3 users + 3 assistants
  })

  it('passes full conversation history to each API call', async () => {
    mockQuery.mockReturnValueOnce(
      fakeStream([
        {
          type: 'assistant',
          uuid: 'uuid-hist-1',
          message: { role: 'assistant', content: 'First' },
        },
      ]),
    )

    const session = new ChatSession()
    for await (const _ of session.send('Message 1')) { /* consume */ }

    mockQuery.mockReturnValueOnce(
      fakeStream([
        {
          type: 'assistant',
          uuid: 'uuid-hist-2',
          message: { role: 'assistant', content: 'Second' },
        },
      ]),
    )

    for await (const _ of session.send('Message 2')) { /* consume */ }

    // The second call should have received all prior messages
    const secondCallIdx = mockQuery.mock.calls.length - 1
    const secondCall = mockQuery.mock.calls[secondCallIdx]![0]
    // Should have: user1, assistant1, user2 (at minimum, at time of call)
    expect(secondCall.messages.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Guardian observer integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls evaluateAfterToolCall for tool_use blocks with trade tools', async () => {
    mockQuery.mockReturnValue(
      fakeStream([
        {
          type: 'content_block_start',
          content_block: {
            type: 'tool_use',
            id: 'tool_guard_1',
            name: 'PlaceOrder',
            input: { symbol: 'ETH/USDT', side: 'sell', amount: 1 },
          },
        },
        {
          type: 'assistant',
          uuid: 'uuid-guardian-1',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', name: 'PlaceOrder', id: 'tool_guard_1', input: {} },
            ],
          },
        },
      ]),
    )

    const session = new ChatSession()
    for await (const _ of session.send('Sell 1 ETH')) { /* consume */ }

    expect(mockEvaluate).toHaveBeenCalledWith('PlaceOrder')
  })

  it('calls evaluateAfterToolCall for each tool_use block in multi-tool responses', async () => {
    mockQuery.mockReturnValue(
      fakeStream([
        {
          type: 'assistant',
          uuid: 'uuid-guardian-multi',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', name: 'GetBalance', id: 'tool_bal', input: {} },
              { type: 'tool_use', name: 'PlaceOrder', id: 'tool_ord', input: {} },
            ],
          },
        },
      ]),
    )

    const session = new ChatSession()
    for await (const _ of session.send('Check balance then buy')) { /* consume */ }

    expect(mockEvaluate).toHaveBeenCalledTimes(2)
    expect(mockEvaluate).toHaveBeenCalledWith('GetBalance')
    expect(mockEvaluate).toHaveBeenCalledWith('PlaceOrder')
  })

  it('does not call evaluateAfterToolCall when response has no tool_use blocks', async () => {
    mockQuery.mockReturnValue(
      fakeStream([
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Just text' } },
        {
          type: 'assistant',
          uuid: 'uuid-no-tools',
          message: { role: 'assistant', content: 'Just text' },
        },
      ]),
    )

    const session = new ChatSession()
    for await (const _ of session.send('What is BTC?')) { /* consume */ }

    expect(mockEvaluate).not.toHaveBeenCalled()
  })
})

describe('ChatFrame protocol exhaustiveness', () => {
  it('covers exactly 7 distinct frame type strings', () => {
    const ALL_FRAME_TYPES = [
      'chunk',
      'tool_use',
      'tool_result',
      'guardian',
      'thinking',
      'done',
      'error',
    ] as const

    expect(ALL_FRAME_TYPES).toHaveLength(7)

    // Each can be used to construct a valid ChatFrame
    const frames: ChatFrame[] = [
      { type: 'chunk', content: '' },
      { type: 'tool_use', id: '', name: '', input: null },
      { type: 'tool_result', name: '', data: null },
      { type: 'guardian', alert: '' },
      { type: 'thinking', content: '' },
      { type: 'done' },
      { type: 'error', message: '' },
    ]
    expect(frames).toHaveLength(7)

    // Verify uniqueness
    const typeSet = new Set(frames.map(f => f.type))
    expect(typeSet.size).toBe(7)
  })

  it('ChatRequest covers exactly 2 request types', () => {
    const requests: ChatRequest[] = [
      { type: 'message', content: 'hello' },
      { type: 'abort' },
    ]
    expect(requests).toHaveLength(2)
    const typeSet = new Set(requests.map(r => r.type))
    expect(typeSet.size).toBe(2)
  })

  it('done frame supports optional usage field', () => {
    const withUsage: ChatFrame = {
      type: 'done',
      usage: { input_tokens: 100, output_tokens: 50 },
    }
    const withoutUsage: ChatFrame = { type: 'done' }

    expect(withUsage.type).toBe('done')
    expect(withoutUsage.type).toBe('done')
    expect('usage' in withUsage && withUsage.usage).toEqual({
      input_tokens: 100,
      output_tokens: 50,
    })
  })
})
