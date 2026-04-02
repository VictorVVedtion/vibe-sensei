/**
 * BalanceTool — Query account balances across all currencies.
 * Shows free, used, and total amounts for each currency.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { createExchange } from '../../services/exchange/index.js'
import type { Balance } from '../../services/exchange/types.js'

const inputSchema = z.strictObject({})

type InputSchema = typeof inputSchema
type Output = string

function formatBalance(bal: Balance): string {
  return [
    `${bal.currency}`,
    `  Free: ${bal.free.toFixed(2)}`,
    `  Used: ${bal.used.toFixed(2)}`,
    `  Total: ${bal.total.toFixed(2)}`,
  ].join('\n')
}

function formatBalancesTable(balances: Balance[]): string {
  if (balances.length === 0) {
    return 'No balances found'
  }
  const header = `Account Balances (${balances.length} currencies)\n${'─'.repeat(40)}`
  const rows = balances.map(formatBalance)
  return [header, ...rows].join('\n\n')
}

export const BalanceTool = buildTool({
  name: 'GetBalance',
  searchHint: 'query account balance free used total per currency',
  maxResultSizeChars: 50_000,

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
    return 'Query account balances showing free, used, and total amounts for each currency.'
  },

  async prompt() {
    return [
      'Query account balances on the exchange.',
      'Returns free (available), used (in orders), and total balance per currency.',
      'No parameters required.',
    ].join('\n')
  },

  toAutoClassifierInput() {
    return 'balance'
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage() {
    return 'GetBalance'
  },

  async call() {
    const exchange = createExchange({ mode: 'paper' })
    await exchange.connect()

    const balances = await exchange.getBalance()
    return { data: formatBalancesTable(balances) }
  },
} satisfies ToolDef<InputSchema, Output>)
