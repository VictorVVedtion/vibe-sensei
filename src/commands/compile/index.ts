import type { Command } from '../../commands.js'

const compile = {
  type: 'local',
  name: 'compile',
  description: 'Compile trading events into a knowledge base wiki',
  argumentHint: '[--full]',
  supportsNonInteractive: true,
  load: () => import('./compile.js'),
} satisfies Command

export default compile
