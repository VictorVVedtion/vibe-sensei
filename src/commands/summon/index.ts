import type { Command } from '../../commands.js'

const summon = {
  type: 'local-jsx',
  name: 'summon',
  description: 'Re-experience your guardian master summoning ceremony',
  load: () => import('./summon.js'),
} satisfies Command

export default summon
