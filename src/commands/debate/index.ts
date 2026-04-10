import type { Command } from '../../commands.js'

const debate = {
  type: 'prompt',
  name: 'debate',
  description: 'Stage a bull vs bear debate between two guardian masters',
  argumentHint: '<topic>',
  allowedTools: ['ConsultMaster'],
  contentLength: 0,
  progressMessage: 'staging debate',
  source: 'builtin',
  async getPromptForCommand(args, _context) {
    const trimmed = (args ?? '').trim()
    if (!trimmed) {
      return [
        {
          type: 'text',
          text:
            'Usage: /debate <topic>. Examples: ' +
            '"/debate buying BTC at 70k", ' +
            '"/debate is ETH overvalued", ' +
            '"/debate this trend is exhausted". ' +
            'Reply with one line explaining this and do not call any tools.',
        },
      ]
    }
    return [
      {
        type: 'text',
        text: [
          `User is requesting a guardian debate on: ${trimmed}`,
          '',
          'Required workflow:',
          '1. Pick TWO masters with opposing trading philosophies for this topic.',
          '   Examples: Soros (reflexive macro) vs Buffett (long-term value), Livermore (trend) vs Taleb (antifragile risk), Druckenmiller (concentrated bets) vs Dalio (systematic diversification).',
          '2. Call `ConsultMaster` once for each master with the user\'s topic as the question.',
          '3. Render the debate as alternating responses:',
          '   - **Bull (master A)**: [in-character argument]',
          '   - **Bear (master B)**: [in-character counterargument]',
          '   - Two more rounds if it makes the debate sharper',
          '4. End with a one-paragraph synthesis: "Where they agree" + "Where you have to choose".',
          '5. Do NOT make the trading decision for the user. Surface the disagreement, leave the call to them.',
        ].join('\n'),
      },
    ]
  },
} satisfies Command

export default debate
