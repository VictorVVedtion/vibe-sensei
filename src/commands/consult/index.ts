import type { Command } from '../../commands.js'

const consult = {
  type: 'prompt',
  name: 'consult',
  description: 'Get a second opinion from any of the 68 guardian masters',
  argumentHint: '<master> <question>',
  allowedTools: ['ConsultMaster'],
  contentLength: 0,
  progressMessage: 'consulting guardian',
  source: 'builtin',
  async getPromptForCommand(args, _context) {
    const trimmed = (args ?? '').trim()
    if (!trimmed) {
      return [
        {
          type: 'text',
          text:
            'Usage: /consult <master> <question>. Examples: ' +
            '"/consult soros what about this EUR/USD position?", ' +
            '"/consult buffett should I add to BTC here?", ' +
            '"/consult taleb how much downside is in this trade?". ' +
            'Reply with one line explaining this and do not call any tools.',
        },
      ]
    }
    return [
      {
        type: 'text',
        text: [
          `User is requesting a guardian consultation: ${trimmed}`,
          '',
          'Required workflow:',
          '1. Call `ConsultMaster` with the user\'s natural-language query above.',
          '   ConsultMaster handles fuzzy matching of master names (English, Chinese, aliases).',
          '2. Use the returned persona prompt as a system message for your reply.',
          '3. Respond IN-CHARACTER as that master. Stay terse and opinionated.',
          '4. Do not call any other trading tools. This is advice only.',
          '',
          'If the user did not specify a master, infer from context (e.g. "what would the wise old crypto guy think" → satoshi_nakamoto).',
        ].join('\n'),
      },
    ]
  },
} satisfies Command

export default consult
