import type { Command } from '../../commands.js'

const risk = {
  type: 'prompt',
  name: 'risk',
  description: 'Run the pre-trade risk gate without placing an order',
  argumentHint: '<symbol> <buy|sell> <quantity>',
  allowedTools: ['PreTradeGate'],
  contentLength: 0,
  progressMessage: 'running risk gate',
  source: 'builtin',
  async getPromptForCommand(args, _context) {
    const trimmed = (args ?? '').trim()
    if (!trimmed) {
      return [
        {
          type: 'text',
          text:
            'Usage: /risk <symbol> <buy|sell> <quantity>. Example: /risk BTC/USDT buy 0.1. ' +
            'Reply with one line explaining this and do not call any tools.',
        },
      ]
    }
    return [
      {
        type: 'text',
        text: [
          `User wants to dry-run the risk gate for: ${trimmed}`,
          '',
          'Required workflow:',
          '1. Parse symbol, side, and quantity from the input above.',
          '2. Call `PreTradeGate` with the parsed parameters.',
          '3. Show the FULL gate result — every check (pass/warn/fail/emergency), each circuit breaker, the ATR advisor, and any vertical-specific checks.',
          '4. Do NOT place an order. This is risk inspection only.',
          '5. End with the overall status and a one-line recommendation.',
        ].join('\n'),
      },
    ]
  },
} satisfies Command

export default risk
