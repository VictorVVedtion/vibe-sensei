import type { Command } from '../../commands.js'

const positions = {
  type: 'prompt',
  name: 'positions',
  description: 'Show your current open trading positions across all venues',
  allowedTools: ['GetPositions'],
  contentLength: 0,
  progressMessage: 'fetching positions',
  source: 'builtin',
  async getPromptForCommand(_args, _context) {
    return [
      {
        type: 'text',
        text: [
          'Call the `GetPositions` tool to fetch the user\'s current open positions.',
          'Display the result as a clean table sorted by absolute unrealized PnL (largest first).',
          'For each position show: symbol, side, quantity, entry price, current price, unrealized PnL (USD and %).',
          'Do not call any other tools. Do not run a pre-trade gate.',
        ].join('\n'),
      },
    ]
  },
} satisfies Command

export default positions
