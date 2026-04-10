import type { Command } from '../../commands.js'

const ALLOWED_TOOLS = ['pulse']

const pulse = {
  type: 'prompt',
  name: 'pulse',
  description:
    'Fetch a 30-day cross-source sentiment brief (Reddit/HN/Polymarket/YouTube) for a trading symbol',
  argumentHint: '<symbol>',
  allowedTools: ALLOWED_TOOLS,
  contentLength: 0,
  progressMessage: 'reading the vibe',
  source: 'builtin',
  async getPromptForCommand(args, _context) {
    const symbol = (args ?? '').trim()
    if (!symbol) {
      return [
        {
          type: 'text',
          text:
            'No symbol provided. Usage: /pulse <symbol>. Example: /pulse BTC. ' +
            'Reply with a one-line note explaining this and do not call any tools.',
        },
      ]
    }

    const text = [
      `Run the \`pulse\` tool with symbol "${symbol}" to fetch a 30-day social/market sentiment brief.`,
      '',
      'After the tool returns, present the brief verbatim to the user — do NOT summarize or rewrite it.',
      'It is already formatted in the user\'s assigned guardian master voice and meant to render as-is.',
      '',
      'Do not call any other tools. Do not add commentary beyond the brief itself.',
    ].join('\n')

    return [{ type: 'text', text }]
  },
} satisfies Command

export default pulse
