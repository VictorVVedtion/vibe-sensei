/**
 * Chat Query Adapter — thin bridge between the desktop WebSocket chat
 * and the Claude API. Uses queryModelWithStreaming() directly, NOT
 * query.ts (which has deep CLI/REPL dependencies).
 *
 * Manages per-session conversation state, exposes trading tools only,
 * and hooks into guardian-observer for post-trade risk evaluation.
 */

import { randomUUID, type UUID } from 'crypto'
import {
  queryModelWithStreaming,
  type Options,
} from '../api/claude.ts'
import type {
  AssistantMessage,
  Message,
  StreamEvent,
  SystemAPIErrorMessage,
  UserMessage,
} from '../../types/message.js'
import { asSystemPrompt } from '../../utils/systemPromptType.js'
import type { ThinkingConfig } from '../../utils/thinking.js'
import type { Tools, Tool } from '../../Tool.js'
import { getEmptyToolPermissionContext } from '../../Tool.js'
import { getDefaultSonnetModel } from '../../utils/model/model.js'

// Trading tools — imported individually to avoid pulling in CLI-only tools
import { OrderTool } from '../../tools/OrderTool/OrderTool.js'
import { PositionTool } from '../../tools/PositionTool/PositionTool.js'
import { BalanceTool } from '../../tools/BalanceTool/BalanceTool.js'
import { CancelOrderTool } from '../../tools/CancelOrderTool/CancelOrderTool.js'
import { PreTradeGateTool } from '../../tools/PreTradeGateTool/PreTradeGateTool.js'
import { StrategyTool } from '../../tools/StrategyTool/StrategyTool.js'
import { ConsultationTool } from '../../tools/ConsultationTool/ConsultationTool.js'
import { FuturesOrderTool } from '../../tools/FuturesOrderTool/FuturesOrderTool.js'
import { SetLeverageTool } from '../../tools/SetLeverageTool/SetLeverageTool.js'
import { FundingRateTool } from '../../tools/FundingRateTool/FundingRateTool.js'
import { LiquidationTool } from '../../tools/LiquidationTool/LiquidationTool.js'
import { OptionsOrderTool } from '../../tools/OptionsOrderTool/OptionsOrderTool.js'
import { OptionsChainTool } from '../../tools/OptionsChainTool/OptionsChainTool.js'
import { GreeksTool } from '../../tools/GreeksTool/GreeksTool.js'
import { StockOrderTool } from '../../tools/StockOrderTool/StockOrderTool.js'
import { SwapTool } from '../../tools/SwapTool/SwapTool.js'
import { PredictionTool } from '../../tools/PredictionTool/PredictionTool.js'
import { EventMarketsTool } from '../../tools/EventMarketsTool/EventMarketsTool.js'
import { ForexOrderTool } from '../../tools/ForexOrderTool/ForexOrderTool.js'
import { ChartTool } from '../../tools/ChartTool/ChartTool.js'
import { WikiTool } from '../../tools/WikiTool/WikiTool.js'

// ── Types ──────────────────────────────────────────────────────────────────

/** Typed frames sent from server to client over WebSocket */
export type ChatFrame =
  | { type: 'chunk'; content: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; name: string; data: unknown }
  | { type: 'guardian'; alert: string }
  | { type: 'thinking'; content: string }
  | { type: 'done'; usage?: { input_tokens: number; output_tokens: number } }
  | { type: 'error'; message: string }

/** Client-to-server messages */
export type ChatRequest =
  | { type: 'message'; content: string }
  | { type: 'abort' }

// ── Chat tools (trading-focused subset) ────────────────────────────────────

const CHAT_TOOLS: Tools = [
  OrderTool,
  PositionTool,
  BalanceTool,
  CancelOrderTool,
  PreTradeGateTool,
  StrategyTool,
  ConsultationTool,
  FuturesOrderTool,
  SetLeverageTool,
  FundingRateTool,
  LiquidationTool,
  OptionsOrderTool,
  OptionsChainTool,
  GreeksTool,
  StockOrderTool,
  SwapTool,
  PredictionTool,
  EventMarketsTool,
  ForexOrderTool,
  ChartTool,
  WikiTool,
].filter((t) => t.isEnabled()) as Tools

// ── System prompt ──────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = asSystemPrompt([
  `You are Vibe Sensei, an AI trading assistant inside a desktop terminal app.`,
  `You help users analyze markets, execute trades, and manage risk across 7 verticals: spot crypto, perpetual futures, options, stocks, DeFi, prediction markets, and forex.`,
  `You have trading tools available. When a user wants to trade, use the appropriate tool. Always run the PreTradeGate check before executing trades.`,
  `Keep responses concise and trading-focused. Use numbers, levels, and actionable insights.`,
  `If a guardian risk alert fires after a trade, relay it clearly to the user.`,
])

// ── Chat Session ───────────────────────────────────────────────────────────

export class ChatSession {
  readonly id: string
  private messages: Message[] = []
  private abortController: AbortController

  constructor() {
    this.id = randomUUID()
    this.abortController = new AbortController()
  }

  /**
   * Send a user message and yield streaming chat frames.
   * The caller (chat-ws.ts) serializes these to WebSocket.
   */
  async *send(userText: string): AsyncGenerator<ChatFrame, void> {
    // Build user message
    const userMessage: UserMessage = {
      type: 'user',
      uuid: randomUUID() as UUID,
      message: {
        role: 'user',
        content: userText,
      },
    }
    this.messages.push(userMessage)

    // Fresh abort controller per turn
    this.abortController = new AbortController()

    const thinkingConfig: ThinkingConfig = { type: 'disabled' }

    const options: Options = {
      getToolPermissionContext: async () => ({
        ...getEmptyToolPermissionContext(),
        mode: 'bypassPermissions' as any,
      }),
      model: getDefaultSonnetModel(),
      isNonInteractiveSession: true,
      querySource: 'desktop_chat',
      agents: [],
      hasAppendSystemPrompt: false,
      mcpTools: [] as unknown as Tools,
    }

    let assistantMessage: AssistantMessage | null = null

    try {
      const stream = queryModelWithStreaming({
        messages: this.messages,
        systemPrompt: CHAT_SYSTEM_PROMPT,
        thinkingConfig,
        tools: CHAT_TOOLS,
        signal: this.abortController.signal,
        options,
      })

      for await (const event of stream) {
        // StreamEvent — raw streaming deltas
        if (isStreamEvent(event)) {
          // The API wraps events: { type: 'stream_event', event: { type: 'content_block_delta', ... } }
          // Unwrap the inner event if present
          const inner = (event as any).event ?? event
          const frame = streamEventToFrame(inner)
          if (frame) yield frame
          continue
        }

        // AssistantMessage — final response
        if (event.type === 'assistant') {
          assistantMessage = event as AssistantMessage
          continue
        }

        // SystemAPIErrorMessage
        if (event.type === 'system') {
          const errMsg = event as SystemAPIErrorMessage
          const content = typeof errMsg.message?.content === 'string'
            ? errMsg.message.content
            : 'API error'
          yield { type: 'error', message: content }
          return
        }
      }

      // Record assistant message in conversation history
      if (assistantMessage) {
        this.messages.push(assistantMessage)

        // Extract usage from the message
        const usage = assistantMessage.message?.usage as
          | { input_tokens?: number; output_tokens?: number }
          | undefined
        yield {
          type: 'done',
          usage: usage
            ? {
                input_tokens: usage.input_tokens ?? 0,
                output_tokens: usage.output_tokens ?? 0,
              }
            : undefined,
        }

        // Run guardian observer for any tool calls in the response
        await this.runGuardianObserver(assistantMessage)
      } else {
        yield { type: 'done' }
      }
    } catch (err: unknown) {
      if (this.abortController.signal.aborted) {
        yield { type: 'error', message: 'Request aborted' }
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        yield { type: 'error', message: msg }
      }
    }
  }

  /** Abort the current streaming request */
  abort(): void {
    this.abortController.abort()
  }

  /** Clear conversation history (new chat) */
  reset(): void {
    this.messages = []
    this.abortController.abort()
    this.abortController = new AbortController()
  }

  /** Current message count */
  get messageCount(): number {
    return this.messages.length
  }

  /**
   * Run guardian-observer's evaluateAfterToolCall for any trading tools
   * found in the assistant's response. Emits alerts via desktop bridge.
   */
  private async runGuardianObserver(msg: AssistantMessage): Promise<void> {
    try {
      const content = msg.message?.content
      if (!Array.isArray(content)) return

      const { evaluateAfterToolCall } = await import(
        '../trading/guardian-observer.js'
      )

      for (const block of content) {
        if (
          block &&
          typeof block === 'object' &&
          'type' in block &&
          block.type === 'tool_use' &&
          'name' in block &&
          typeof block.name === 'string'
        ) {
          await evaluateAfterToolCall(block.name)
        }
      }
    } catch {
      // Guardian observer is non-fatal — trade still executed
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isStreamEvent(
  event: StreamEvent | AssistantMessage | SystemAPIErrorMessage,
): event is StreamEvent {
  // StreamEvents have arbitrary type strings that aren't 'assistant' or 'system'
  return (
    event.type !== 'assistant' &&
    event.type !== 'system' &&
    !('uuid' in event)
  )
}

/**
 * Convert raw Anthropic streaming events to typed ChatFrames.
 * Only surfaces content deltas and tool use — ignores metadata events.
 */
function streamEventToFrame(event: StreamEvent): ChatFrame | null {
  switch (event.type) {
    case 'content_block_delta': {
      const delta = event.delta as Record<string, unknown> | undefined
      if (!delta) return null

      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        return { type: 'chunk', content: delta.text }
      }
      if (
        delta.type === 'thinking_delta' &&
        typeof delta.thinking === 'string'
      ) {
        return { type: 'thinking', content: delta.thinking }
      }
      return null
    }

    case 'content_block_start': {
      const block = event.content_block as Record<string, unknown> | undefined
      if (
        block?.type === 'tool_use' &&
        typeof block.id === 'string' &&
        typeof block.name === 'string'
      ) {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input ?? {},
        }
      }
      return null
    }

    default:
      return null
  }
}
