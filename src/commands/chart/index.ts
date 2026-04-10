import type { Command } from '../../commands.js'

const chart = {
  type: 'prompt',
  name: 'chart',
  description: 'Display an ASCII candlestick chart for a trading symbol',
  argumentHint: '<symbol> [timeframe]',
  allowedTools: ['ShowChart'],
  contentLength: 0,
  progressMessage: 'rendering chart',
  source: 'builtin',
  async getPromptForCommand(args, _context) {
    const trimmed = (args ?? '').trim()
    if (!trimmed) {
      return [
        {
          type: 'text',
          text:
            'Usage: /chart <symbol> [timeframe]. ' +
            'Examples: /chart BTC/USDT, /chart ETH/USDT 4h, /chart SOL/USDT 1d. ' +
            'Default timeframe is 4h. Reply with one line explaining this and do not call any tools.',
        },
      ]
    }
    return [
      {
        type: 'text',
        text: [
          `User wants to see the chart for: ${trimmed}`,
          '',
          'Required workflow:',
          '1. Parse symbol and (optional) timeframe from the input. Default timeframe is 4h.',
          '2. Call `ShowChart` with the parsed parameters.',
          '3. Render the chart output verbatim — it is already formatted as ASCII art.',
          '4. Add a one-line price summary below the chart (current price, 24h change %).',
          '5. Do not add commentary or analysis unless the user explicitly asks.',
        ].join('\n'),
      },
    ]
  },
} satisfies Command

export default chart
