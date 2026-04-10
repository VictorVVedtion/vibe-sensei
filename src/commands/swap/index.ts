import type { Command } from '../../commands.js'

const swap = {
  type: 'prompt',
  name: 'swap',
  description: 'Swap tokens via DEX (Jupiter or 1inch)',
  argumentHint: '<from> <to> <amount>',
  allowedTools: ['SwapDEX'],
  contentLength: 0,
  progressMessage: 'preparing swap',
  source: 'builtin',
  async getPromptForCommand(args, _context) {
    const trimmed = (args ?? '').trim()
    if (!trimmed) {
      return [
        {
          type: 'text',
          text:
            'Usage: /swap <from> <to> <amount>. Example: /swap USDC SOL 100. ' +
            'Reply with one line explaining this and do not call any tools.',
        },
      ]
    }
    return [
      {
        type: 'text',
        text: [
          `User wants to swap: ${trimmed}`,
          '',
          'Required workflow:',
          '1. Parse fromToken, toToken, and amount from the input above.',
          '2. Call `SwapDEX` to fetch a quote (do not execute yet — quote first).',
          '3. Show the user: input amount, expected output, price impact, gas estimate, slippage tolerance, route.',
          '4. Ask for explicit user confirmation before executing the swap.',
          '5. Only call `SwapDEX` again with execute=true after user confirms.',
          '',
          'If the price impact is >2% or gas exceeds 5% of trade value, warn the user before asking for confirmation.',
        ].join('\n'),
      },
    ]
  },
} satisfies Command

export default swap
