/**
 * Provider command — manage multi-provider AI models.
 *
 * Subcommands: list, auth, set, status, cost
 */

import type { Command } from '../../types/command.js'

const provider = {
  type: 'local',
  name: 'provider',
  description: 'Manage AI providers and models (list, auth, set, status, cost)',
  aliases: ['providers'],
  supportsNonInteractive: true,
  load: () => import('./provider.js'),
} satisfies Command

export default provider
