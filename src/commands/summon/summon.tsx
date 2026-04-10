/**
 * /summon — re-experience the guardian master ceremony.
 *
 * Renders the SummoningCeremony for the current companion. Master assignment
 * is deterministic per userId, so this re-runs the theatre without changing
 * who you got. Useful for users who missed the first-hatch ceremony or just
 * want to see it again.
 *
 * Falls back to a plain text message if no companion is assigned (e.g.,
 * trust dialog hasn't completed yet).
 */

import * as React from 'react'
import { Box, Text } from '../../ink.js'
import { SummoningCeremony } from '../../components/SummoningCeremony.js'
import { getCompanion } from '../../buddy/companion.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import type { Master, StatName } from '../../buddy/types.js'

export const call: LocalJSXCommandCall = async (onDone) => {
  const companion = getCompanion()
  if (!companion) {
    return (
      <Box paddingY={1}>
        <Text dimColor>No guardian assigned yet. Complete onboarding first.</Text>
      </Box>
    )
  }

  return (
    <SummoningCeremony
      master={companion.species as Master}
      stats={companion.stats as Record<StatName, number>}
      onComplete={() => onDone('Guardian summoned.', { display: 'system' })}
    />
  )
}
