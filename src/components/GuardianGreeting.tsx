/**
 * GuardianGreeting — shows the user's assigned guardian master on startup.
 * Displayed below the WelcomeV2 logo during onboarding and first launch.
 *
 * Renders: rarity-framed box with ASCII portrait/sprite, master name,
 * archetype, quote, and 5 stat bars.
 *
 * On the very first session (hatchedAt timestamp set within the last 10
 * seconds), the SummoningCeremony plays first as a gacha-style reveal,
 * then settles into the static layout below.
 */

import React, { useState } from 'react'
import { Box, Text } from '../ink.js'
import { renderSprite, supportsInlineImages } from '../services/terminal-image.js'
import { StatsBar } from './design-system/StatsBar.js'
import { SummoningCeremony } from './SummoningCeremony.js'
import type { Rarity, Master, StatName } from '../buddy/types.js'

/** A companion is "freshly hatched" if its hatchedAt is within this window. */
const FRESH_HATCH_WINDOW_MS = 10_000

const RARITY_COLORS: Record<string, string> = {
  common: 'white',
  uncommon: 'cyan',
  rare: 'green',
  epic: 'yellow',
  legendary: 'magenta',
}

// Gold color for legendary border
const LEGENDARY_GOLD = 'rgb(247,147,26)'

export function GuardianGreeting(): React.ReactNode {
  const [ceremonyDone, setCeremonyDone] = useState(false)

  try {
    // Dynamic require to avoid breaking if buddy modules aren't available
    const { getCompanion } = require('../buddy/companion.js') as typeof import('../buddy/companion.js')
    const { MASTER_NAMES, RARITY_STARS, MASTER_RARITY, MASTER_QUOTES, STAT_NAMES } = require('../buddy/types.js') as typeof import('../buddy/types.js')
    const { getMasterArchetype } = require('../buddy/persona.js') as typeof import('../buddy/persona.js')

    const companion = getCompanion()
    if (!companion) return null

    const master = companion.species as Master
    const name = MASTER_NAMES[master] ?? String(master)
    const rarity = MASTER_RARITY[master] ?? companion.rarity
    const stars = RARITY_STARS[rarity] ?? '\u2605'
    const color = RARITY_COLORS[rarity] ?? 'white'
    const archetype = getMasterArchetype(master)
    const archetypeLabel = archetype.replace(/_/g, ' ').toUpperCase()
    const quote = MASTER_QUOTES[master]
    const stats = companion.stats as Record<StatName, number>

    // First-hatch ceremony — only on the very first session, when the
    // companion was just persisted milliseconds ago. The 10-second window
    // tolerates clock skew and slow boots without playing on every launch.
    const hatchedAt = typeof companion.hatchedAt === 'number' ? companion.hatchedAt : 0
    const isFreshHatch = hatchedAt > 0 && Date.now() - hatchedAt < FRESH_HATCH_WINDOW_MS

    if (isFreshHatch && !ceremonyDone) {
      return (
        <SummoningCeremony
          master={master}
          stats={stats}
          onComplete={() => setCeremonyDone(true)}
        />
      )
    }

    // Determine border style based on rarity
    const isDoubleBorder = rarity === 'legendary' || rarity === 'epic'
    const borderStyle = isDoubleBorder ? 'double' as const : 'single' as const
    const borderColor = rarity === 'legendary' ? LEGENDARY_GOLD : color

    // Render sprite: inline image if supported, ASCII portrait otherwise
    const spriteText = renderSprite(master, 'neutral', supportsInlineImages() ? 'large' : 'large')

    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Box
          borderStyle={borderStyle}
          borderColor={borderColor}
          flexDirection="column"
          paddingX={1}
          paddingY={0}
        >
          {/* ASCII Portrait */}
          <Box flexDirection="column" marginBottom={0}>
            {spriteText.split('\n').map((line, i) => (
              <Text key={i} color={color}>{line}</Text>
            ))}
          </Box>

          {/* Name and Archetype */}
          <Box marginTop={0}>
            <Text>
              <Text color={color}>{stars}</Text>
              <Text> </Text>
              <Text color={color} bold>{name}</Text>
              <Text dimColor> {'\u00B7'} {archetypeLabel}</Text>
            </Text>
          </Box>

          {/* Quote */}
          {quote && (
            <Text dimColor italic>  &quot;{quote}&quot;</Text>
          )}

          {/* Stats Bars */}
          <Box flexDirection="column" marginTop={1}>
            {STAT_NAMES.map((statName) => (
              <StatsBar
                key={statName}
                label={statName}
                value={stats[statName] ?? 0}
                max={100}
                width={10}
              />
            ))}
          </Box>
        </Box>
      </Box>
    )
  } catch {
    // Guardian system unavailable — silent fallback
    return null
  }
}
