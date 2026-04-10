/**
 * CompanionPane — Fixed right-side panel showing the guardian companion.
 * Renders: pixel art sprite (iTerm2) or ASCII portrait, name, stats, balance, speech bubble.
 * Always visible, never scrolls. The companion is the soul of the product.
 */

import React, { useEffect, useState } from 'react'
import { Box, Text } from '../ink.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { renderSprite, supportsInlineImages, getCompactFace } from '../services/terminal-image.js'
import { useGuardianDisplay } from '../buddy/guardian-display.js'

/** Minimum terminal width to show the companion pane */
export const MIN_COLS_FOR_PANE = 120

/** Width of the companion pane in characters */
export const COMPANION_PANE_WIDTH = 26

type GuardianData = {
  masterName: string
  archetype: string
  rarity: string
  stars: string
  masterId: string
  portrait: string[]
  stats: Record<string, number>
}

const RARITY_COLORS: Record<string, string> = {
  common: 'rgb(171,171,171)',
  uncommon: 'rgb(8,153,129)',
  rare: 'rgb(41,98,255)',
  epic: 'rgb(123,97,255)',
  legendary: 'rgb(247,147,26)',
}

export function CompanionPane() {
  const { columns } = useTerminalSize()
  const [guardian, setGuardian] = useState<GuardianData | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const { displayText, fading } = useGuardianDisplay()

  useEffect(() => {
    try {
      const { getCompanion } = require('../buddy/companion.js') as any
      const { MASTER_NAMES, RARITY_STARS, MASTER_RARITY } = require('../buddy/types.js') as any
      const { getMasterArchetype } = require('../buddy/persona.js') as any
      const { MASTER_PORTRAITS } = require('../buddy/sprite-atlas.js') as any

      const companion = getCompanion()
      if (companion?.species) {
        const master = companion.species
        setGuardian({
          masterName: MASTER_NAMES[master] ?? master,
          archetype: getMasterArchetype(master).replace(/_/g, ' ').toUpperCase(),
          rarity: companion.rarity ?? 'common',
          stars: RARITY_STARS[companion.rarity] ?? '★',
          masterId: master,
          portrait: MASTER_PORTRAITS[master]?.portrait ?? [],
          stats: companion.stats ?? {},
        })
      }
    } catch { /* silent */ }

    // Load balance
    ;(async () => {
      try {
        const { getConnectedExchange } = await import('../services/exchange/singleton.js') as any
        const exchange = await getConnectedExchange()
        const balances = await exchange.getBalance()
        const usdt = balances.find((b: any) => b.currency === 'USDT')
        if (usdt) setBalance(usdt.total.toLocaleString('en-US', { minimumFractionDigits: 2 }))
      } catch { /* silent */ }
    })()
  }, [])

  // Don't render if terminal too narrow or no guardian
  if (columns < MIN_COLS_FOR_PANE || !guardian) return null

  const color = RARITY_COLORS[guardian.rarity] ?? 'white'
  const paneWidth = COMPANION_PANE_WIDTH

  // Stats bar helper
  const statBar = (value: number) => {
    const w = 6
    const filled = Math.round((value / 100) * w)
    return '█'.repeat(filled) + '░'.repeat(w - filled)
  }

  // Sprite: iTerm2 inline image or ASCII portrait
  const spriteOutput = supportsInlineImages()
    ? renderSprite(guardian.masterId, 'neutral', 'small')
    : null

  return (
    <Box
      flexDirection="column"
      width={paneWidth}
      flexShrink={0}
      borderStyle="single"
      borderColor={color}
      borderLeft={true}
      borderRight={false}
      borderTop={false}
      borderBottom={false}
      paddingLeft={1}
    >
      {/* Sprite / Portrait */}
      {spriteOutput ? (
        <Text>{spriteOutput}</Text>
      ) : (
        <Box flexDirection="column">
          {guardian.portrait.map((line, i) => (
            <Text key={i} color={color}>{line}</Text>
          ))}
        </Box>
      )}

      {/* Name + Rarity */}
      <Text color={color} bold>{guardian.masterName}</Text>
      <Text dimColor>{guardian.stars} {guardian.archetype}</Text>

      {/* Divider */}
      <Text dimColor>{'─'.repeat(paneWidth - 3)}</Text>

      {/* Balance */}
      {balance && (
        <Text>
          <Text color="rgb(156,255,147)">{balance}</Text>
          <Text dimColor> USDT</Text>
        </Text>
      )}

      {/* Key Stats (compact) */}
      {Object.keys(guardian.stats).length > 0 && (
        <Box flexDirection="column" marginTop={0}>
          {Object.entries(guardian.stats).slice(0, 3).map(([key, val]) => (
            <Text key={key} dimColor>
              {key.slice(0, 3).toUpperCase()} {statBar(val as number)}
            </Text>
          ))}
        </Box>
      )}

      {/* Spacer */}
      <Box flexGrow={1} />

      {/* Speech Bubble */}
      {displayText && (
        <Box flexDirection="column" marginBottom={0}>
          <Box borderStyle="single" borderColor={color} paddingX={1}>
            <Text dimColor={fading} wrap="wrap">{displayText}</Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
