import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'

const inputSchema = z.strictObject({
  insight: z.string().describe('The core market insight or trading vibe, keep it under 30 words so it fits in the speech bubble.'),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']).optional().describe('General sentiment. Used to optionally infer the sprite character emotion.')
})

type InputSchema = typeof inputSchema

export const EmitVibeTool = buildTool({
  name: 'EmitVibeInsight',
  searchHint: 'display a core vibe trading analysis in the Guardian Buddy persistent bubble',
  maxResultSizeChars: 1000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Emit your core trading analysis/vibe directly into the persistent Guardian Buddy speech bubble on the UI.'
  },

  async prompt() {
    return [
      'Call this tool whenever you want to display your summary or trading advice directly through your on-screen avatar (Buddy).',
      'The text will be spoken out of a persistent speech bubble at the bottom right of the terminal.',
      'Keep your insight punchy and under 30 words.'
    ].join('\n')
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: content as string,
    }
  },

  renderToolUseMessage(input) {
    // The visual UI is handled by the Buddy Sprite, so we don't need to clog the REPL history.
    return null
  },

  renderToolResultMessage(content) {
    return null
  },

  async call(input, context) {
    // Append the sentiment as an invisible marker so the emotion inferrer can pick it up
    // The visual bubble will wrap so the hidden marker won't be easily seen, or we just format it logically
    const marker = input.sentiment === 'bullish' ? ' 🚀' : input.sentiment === 'bearish' ? ' 🐻' : ''
    const outMessage = `${input.insight}${marker}`

    context.setAppState(prev => ({
      ...prev,
      companionReaction: outMessage,
      companionReactionPersistent: true
    }))

    return {
      data: `[Successfully emitted to Buddy Bubble. It will stay on screen.]`,
    }
  },
} satisfies ToolDef<InputSchema, string>)
