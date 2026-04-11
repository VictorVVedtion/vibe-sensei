/**
 * Stream event envelope helpers.
 *
 * Non-Anthropic providers (OpenAI, Gemini, etc.) must wrap every streamed
 * event in `{ type: 'stream_event', event: <AnthropicEventPart> }` so that
 * `handleMessageFromStream` (src/utils/messages.ts) recognizes them as
 * streaming updates rather than as terminal messages.
 *
 * The native Anthropic path (src/services/api/claude.ts:2300) uses this
 * exact envelope; these helpers produce the same shape.
 *
 * Expected sequence for one assistant turn:
 *
 *   1. messageStartEvent(messageId, model)
 *   2. textBlockStartEvent(0)        (first text block)
 *      textBlockDeltaEvent(0, "He")
 *      textBlockDeltaEvent(0, "llo")
 *      blockStopEvent(0)
 *   3. toolUseBlockStartEvent(1, id, name)
 *      inputJsonDeltaEvent(1, '{"foo":"bar"}')
 *      blockStopEvent(1)
 *   4. messageDeltaEvent('end_turn', usage)
 *   5. messageStopEvent()
 *   6. Final AssistantMessage (consumed by query.ts)
 */

import type { StreamEvent } from '../../../types/message.js'

// Wrap a raw Anthropic-style event part in the stream_event envelope.
function wrapStreamEvent(part: unknown, extra?: { ttftMs?: number }): StreamEvent {
  return { type: 'stream_event', event: part, ...(extra || {}) } as unknown as StreamEvent
}

// message_start — signals the start of a new assistant message.
// ttftMs of 0 is fine; the REPL only reads it if > 0.
export function messageStartEvent(messageId: string, model: string): StreamEvent {
  return wrapStreamEvent({
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  }, { ttftMs: 0 })
}

// content_block_start for a text block at the given index.
export function textBlockStartEvent(index: number): StreamEvent {
  return wrapStreamEvent({
    type: 'content_block_start',
    index,
    content_block: { type: 'text', text: '' },
  })
}

// content_block_delta carrying a text_delta.
export function textBlockDeltaEvent(index: number, text: string): StreamEvent {
  return wrapStreamEvent({
    type: 'content_block_delta',
    index,
    delta: { type: 'text_delta', text },
  })
}

// content_block_start for a tool_use block at the given index.
export function toolUseBlockStartEvent(
  index: number,
  id: string,
  name: string,
): StreamEvent {
  return wrapStreamEvent({
    type: 'content_block_start',
    index,
    content_block: { type: 'tool_use', id, name, input: {} },
  })
}

// content_block_delta carrying an input_json_delta for a tool_use block.
export function inputJsonDeltaEvent(index: number, partialJson: string): StreamEvent {
  return wrapStreamEvent({
    type: 'content_block_delta',
    index,
    delta: { type: 'input_json_delta', partial_json: partialJson },
  })
}

// content_block_start for a thinking block.
export function thinkingBlockStartEvent(index: number): StreamEvent {
  return wrapStreamEvent({
    type: 'content_block_start',
    index,
    content_block: { type: 'thinking', thinking: '', signature: '' },
  })
}

// content_block_delta carrying a thinking_delta.
export function thinkingDeltaEvent(index: number, thinking: string): StreamEvent {
  return wrapStreamEvent({
    type: 'content_block_delta',
    index,
    delta: { type: 'thinking_delta', thinking },
  })
}

// content_block_stop — emit after every content_block_start.
export function blockStopEvent(index: number): StreamEvent {
  return wrapStreamEvent({
    type: 'content_block_stop',
    index,
  })
}

// message_delta — signals stop reason and final usage.
export function messageDeltaEvent(
  stopReason: string,
  usage: { input_tokens: number; output_tokens: number },
): StreamEvent {
  return wrapStreamEvent({
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage,
  })
}

// message_stop — final event before the AssistantMessage.
export function messageStopEvent(): StreamEvent {
  return wrapStreamEvent({ type: 'message_stop' })
}
