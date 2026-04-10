/**
 * ConsultationTool — Ask any of the 68 guardian masters for their opinion.
 * Wraps the consultation module with NLP parsing and fuzzy name matching.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  parseMasterQuery,
  findMasterByName,
  buildConsultationPrompt,
} from '../../buddy/consultation.js'
import { MASTER_NAMES } from '../../buddy/types.js'
import { getCompanion } from '../../buddy/companion.js'

const inputSchema = z.strictObject({
  master: z
    .string()
    .optional()
    .describe('Master name to consult (e.g. "soros", "buffett", "孙子"). If omitted, parsed from question.'),
  question: z
    .string()
    .describe('The trading question to ask the master (e.g. "what would soros do about this ETH position?")'),
  context: z
    .string()
    .optional()
    .describe('Additional trading context (current positions, market conditions, etc.)'),
})

type InputSchema = typeof inputSchema
type Output = string

export const ConsultationTool = buildTool({
  name: 'ConsultMaster',
  searchHint: 'consult ask master guardian opinion advice soros buffett taleb',
  maxResultSizeChars: 10_000,

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
    return 'Consult any of the 68 guardian masters for their trading opinion. Supports natural language queries like "what would soros do?" or "ask buffett about ETH".'
  },

  async prompt() {
    return [
      'Consult a specific guardian master for their trading opinion.',
      'Use natural language: "what would soros do?", "ask buffett about ETH", "consult taleb on risk".',
      'Supports English names, short aliases, and Chinese names (e.g. 索罗斯, 孙子).',
      'If no master is specified, the query is parsed for a master name automatically.',
      'The response is a one-shot persona prompt — feed it to the model as a system message.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `consult ${input.master ?? ''} ${input.question}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const master = input.master ?? '?'
    return `ConsultMaster: ${master}`
  },

  async call(input) {
    try {
      let masterId: import('../../buddy/types.js').Master | null = null
      let question = input.question

      // 1. Try explicit master parameter
      if (input.master) {
        masterId = findMasterByName(input.master)
      }

      // 2. Fall back to NLP parsing from question
      if (!masterId) {
        const parsed = parseMasterQuery(input.question)
        if (parsed) {
          masterId = parsed.master
          question = parsed.question
        }
      }

      // 3. Fall back to user's assigned guardian
      if (!masterId) {
        const companion = getCompanion()
        if (companion) {
          masterId = companion.species as import('../../buddy/types.js').Master
        }
      }

      if (!masterId) {
        return { data: 'Could not resolve a master to consult. Try specifying a name like "soros", "buffett", or "孙子".' }
      }

      const masterName = MASTER_NAMES[masterId] ?? masterId
      const tradingContext = input.context ?? ''
      const prompt = buildConsultationPrompt(masterId, question, tradingContext)

      return {
        data: [
          `═══ Guardian Consultation: ${masterName} ═══`,
          '',
          prompt,
          '',
          '═══════════════════════════════════════════════',
        ].join('\n'),
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { data: `Consultation error: ${msg}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
