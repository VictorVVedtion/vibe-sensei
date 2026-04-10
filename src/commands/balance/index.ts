import type { Command } from '../../commands.js'

const balance = {
  type: 'prompt',
  name: 'balance',
  description: 'Show your portfolio balance across all assets and venues',
  allowedTools: ['GetBalance'],
  contentLength: 0,
  progressMessage: 'fetching balance',
  source: 'builtin',
  async getPromptForCommand(_args, _context) {
    return [
      {
        type: 'text',
        text: [
          'Call the `GetBalance` tool to fetch the user\'s portfolio balance.',
          'Display the result as a table grouped by currency, showing total / free / used.',
          'Include a single-line total portfolio value in USDT at the bottom.',
          'Do not call any other tools.',
        ].join('\n'),
      },
    ]
  },
} satisfies Command

export default balance
