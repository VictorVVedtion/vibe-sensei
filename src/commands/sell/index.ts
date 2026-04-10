import type { Command } from '../../commands.js'

const sell = {
  type: 'prompt',
  name: 'sell',
  description: 'Place a sell order — gate-checked through the guardian first',
  argumentHint: '<symbol> [quantity]',
  allowedTools: ['PreTradeGate', 'PlaceOrder', 'GetPositions'],
  contentLength: 0,
  progressMessage: 'staging sell order',
  source: 'builtin',
  async getPromptForCommand(args, _context) {
    const trimmed = (args ?? '').trim()
    if (!trimmed) {
      return [
        {
          type: 'text',
          text:
            'No symbol provided. Usage: /sell <symbol> [quantity]. ' +
            'Example: /sell BTC/USDT 0.1. ' +
            'Reply with one line explaining this and do not call any tools.',
        },
      ]
    }
    return [
      {
        type: 'text',
        text: [
          `User wants to SELL: ${trimmed}`,
          '',
          'Required workflow:',
          '1. Parse the symbol and (optional) quantity from the input above.',
          '2. If quantity is missing, call `GetPositions` to look up the user\'s current holding for this symbol — propose closing the full position unless the user specifies a partial.',
          '3. Call `PreTradeGate` with side="sell" to run the guardian risk checks.',
          '4. Show the gate result to the user (status + each non-passing check).',
          '5. If the gate is `pass` or `warn`, ask for explicit user confirmation, then call `PlaceOrder`.',
          '6. If the gate is `fail` or `emergency`, do NOT place the order. Explain why and suggest a safer alternative.',
        ].join('\n'),
      },
    ]
  },
} satisfies Command

export default sell
