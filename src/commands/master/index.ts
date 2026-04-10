import type { Command } from '../../commands.js'

const master = {
  type: 'local-jsx',
  name: 'master',
  description: 'Show your current guardian master — name, archetype, stats, quote',
  load: () => import('./master.js'),
} satisfies Command

export default master
