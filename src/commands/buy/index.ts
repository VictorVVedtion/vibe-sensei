import type { Command } from '../../commands.js'

const buy = {
  type: 'prompt',
  name: 'buy',
  description: 'Place a buy order — gate-checked through the guardian first',
  argumentHint: '<symbol> [quantity]',
  allowedTools: ['PreTradeGate', 'PlaceOrder', 'GetBalance'],
  contentLength: 0,
  progressMessage: 'staging buy order',
  source: 'builtin',
  async getPromptForCommand(args, _context) {
    const trimmed = (args ?? '').trim()
    if (!trimmed) {
      return [
        {
          type: 'text',
          text:
            'No symbol provided. Usage: /buy <symbol> [quantity]. ' +
            'Example: /buy BTC/USDT 0.1. ' +
            'Reply with one line explaining this and do not call any tools.',
        },
      ]
    }
    return [
      {
        type: 'text',
        text: [
          `User wants to BUY: ${trimmed}`,
          '',
          'Required workflow:',
          '1. Parse the symbol and (optional) quantity from the input above.',
          '2. If quantity is missing, ask the user once before proceeding.',
          '3. Call `PreTradeGate` with side="buy" to run the guardian risk checks.',
          '4. Show the gate result to the user (status + each non-passing check).',
          '5. If the gate is `pass` or `warn`, ask for explicit user confirmation, then call `PlaceOrder`.',
          '6. If the gate is `fail` or `emergency`, do NOT place the order. Explain why and suggest a safer alternative.',
          '',
          'Always default to a market order unless the user specifies otherwise.',
        ].join('\n'),
      },
    ]
  },
} satisfies Command

export default buy
