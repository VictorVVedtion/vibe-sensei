/**
 * SummoningCeremony — animated guardian master reveal.
 *
 * Plays a 4-phase ASCII gacha sequence on first session (or via /summon):
 *   1. SCAN     (1500ms) — candidate portraits flash through the frame
 *   2. APPROACH (1000ms) — slowdown + spinner, "a presence approaches..."
 *   3. REVEAL   (1000ms) — final card with rarity-styled border
 *   4. QUOTE    (variable) — typewriter quote then "press any key"
 *
 * The ceremony is purely decorative — the master is determined by the
 * existing deterministic roll in companion.ts. The carousel of candidates
 * is for theatre, not real randomness.
 *
 * Skippable at any time by pressing any key. Calls onComplete when finished
 * (or skipped) so the parent can transition to the static greeting layout.
 */

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useAnimationFrame, useInput } from '../ink.js'
import { renderSprite } from '../services/terminal-image.js'
import {
  MASTERS,
  MASTER_NAMES,
  MASTER_QUOTES,
  MASTER_RARITY,
  RARITY_STARS,
  STAT_NAMES,
  type Master,
  type Rarity,
  type StatName,
} from '../buddy/types.js'
import { getMasterArchetype } from '../buddy/persona.js'
import { StatsBar } from './design-system/StatsBar.js'

const RARITY_COLORS: Record<Rarity, string> = {
  common: 'white',
  uncommon: 'cyan',
  rare: 'green',
  epic: 'yellow',
  legendary: 'magenta',
}

const LEGENDARY_GOLD = 'rgb(247,147,26)'

// macOS system sounds — silently no-op on Linux/Windows.
// Higher rarity gets a meatier sound at the reveal moment.
const RARITY_REVEAL_SOUND: Record<Rarity, string> = {
  common: '/System/Library/Sounds/Tink.aiff',
  uncommon: '/System/Library/Sounds/Glass.aiff',
  rare: '/System/Library/Sounds/Pop.aiff',
  epic: '/System/Library/Sounds/Sosumi.aiff',
  legendary: '/System/Library/Sounds/Funk.aiff',
}

const SCAN_TICK_SOUND = '/System/Library/Sounds/Tink.aiff'

// Phase boundaries in ms from start
const PHASE_SCAN_END = 1500
const PHASE_APPROACH_END = 2500
const PHASE_REVEAL_END = 3500
// QUOTE phase runs from PHASE_REVEAL_END until typewriter completes,
// then waits for keypress.

const SCAN_FRAME_MS = 180
const APPROACH_FRAME_MS = 220
const TYPEWRITER_CHAR_MS = 28

const SPINNER_FRAMES = ['⢿', '⣻', '⣽', '⣾', '⣷', '⣯', '⣟', '⡿']

type Phase = 'scan' | 'approach' | 'reveal' | 'quote' | 'done'

export interface SummoningCeremonyProps {
  /** The chosen master to reveal. Comes from getCompanion(). */
  master: Master
  /** Master's stat block for the post-reveal stat bars. */
  stats: Record<StatName, number>
  /** Called once the ceremony finishes (or is skipped). */
  onComplete: () => void
  /**
   * Debug-only: pin the elapsed time to a fixed value so the component
   * renders a specific phase as a static frame. Used by the offline
   * preview script to capture clean per-phase snapshots without animation
   * artifacts. Production callers should not pass this.
   */
  _debugElapsedMs?: number
}

/**
 * Fire-and-forget macOS sound effect. Silently fails on other platforms.
 * Uses backgrounded child_process to avoid blocking React rendering.
 */
function playSound(soundPath: string): void {
  if (process.platform !== 'darwin') return
  try {
    // Lazy require — avoids loading child_process if sound is never played
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { exec } = require('node:child_process') as typeof import('node:child_process')
    exec(`afplay ${soundPath} 2>/dev/null &`, () => {
      /* swallow — sound effects must never propagate */
    })
  } catch {
    // Sound effects must never propagate
  }
}

/**
 * Pick a deterministic carousel of "candidate" masters to flash through
 * during the scan phase. Always includes the chosen master at the END so
 * the reveal feels honest. We exclude the chosen master from the early
 * frames to avoid spoiling the result.
 *
 * Exported for testing.
 */
export function buildCarousel(chosen: Master): Master[] {
  const others = MASTERS.filter((m) => m !== chosen)
  // Stable shuffle keyed off the chosen master so the same user sees the
  // same theatre on a re-summon (small consistency win, no real importance).
  const seed = chosen.length
  const shuffled = [...others].sort((a, b) => {
    const ah = (a.charCodeAt(0) * 31 + seed) % 97
    const bh = (b.charCodeAt(0) * 31 + seed) % 97
    return ah - bh
  })
  // 7 candidates + the chosen master at the end of the scan phase
  return [...shuffled.slice(0, 7), chosen]
}

export function SummoningCeremony({
  master,
  stats,
  onComplete,
  _debugElapsedMs,
}: SummoningCeremonyProps): React.ReactNode {
  const [, time] = useAnimationFrame(60)
  const startRef = useRef<number | null>(null)
  if (startRef.current === null) startRef.current = time
  const elapsed = _debugElapsedMs ?? (time - (startRef.current ?? time))

  const carousel = useMemo(() => buildCarousel(master), [master])
  const rarity = MASTER_RARITY[master] ?? 'common'
  const color = RARITY_COLORS[rarity]
  const borderColor = rarity === 'legendary' ? LEGENDARY_GOLD : color
  const isDoubleBorder = rarity === 'legendary' || rarity === 'epic'
  const stars = RARITY_STARS[rarity]
  const archetype = getMasterArchetype(master).replace(/_/g, ' ').toUpperCase()
  const masterName = MASTER_NAMES[master] ?? String(master)

  // Compute current phase from elapsed time
  const phase: Phase = useMemo(() => {
    if (elapsed < PHASE_SCAN_END) return 'scan'
    if (elapsed < PHASE_APPROACH_END) return 'approach'
    if (elapsed < PHASE_REVEAL_END) return 'reveal'
    return 'quote'
  }, [elapsed])

  // Track previous phase to fire phase-transition side effects (sound)
  const lastPhaseRef = useRef<Phase>('scan')
  useEffect(() => {
    if (phase === lastPhaseRef.current) return
    lastPhaseRef.current = phase
    if (phase === 'reveal') {
      playSound(RARITY_REVEAL_SOUND[rarity])
    }
  }, [phase, rarity])

  // Tick sound during scan phase — once per carousel frame
  const scanFrameIdx = Math.floor(elapsed / SCAN_FRAME_MS)
  const lastScanFrameRef = useRef<number>(-1)
  useEffect(() => {
    if (phase !== 'scan') return
    if (scanFrameIdx === lastScanFrameRef.current) return
    lastScanFrameRef.current = scanFrameIdx
    // Only tick on every other frame so it doesn't get noisy
    if (scanFrameIdx % 2 === 0) playSound(SCAN_TICK_SOUND)
  }, [phase, scanFrameIdx])

  // Pick which carousel master to show in scan phase
  const carouselIdx = Math.min(scanFrameIdx, carousel.length - 1)
  const scanMaster = carousel[carouselIdx] ?? master

  // Approach phase spinner
  const approachFrameIdx = Math.floor(
    (elapsed - PHASE_SCAN_END) / APPROACH_FRAME_MS,
  )
  const spinner = SPINNER_FRAMES[approachFrameIdx % SPINNER_FRAMES.length]

  // Quote typewriter — characters revealed over time after PHASE_REVEAL_END
  const quote = MASTER_QUOTES[master] ?? ''
  const quoteElapsed = Math.max(0, elapsed - PHASE_REVEAL_END)
  const charsToShow = Math.min(
    quote.length,
    Math.floor(quoteElapsed / TYPEWRITER_CHAR_MS),
  )
  const visibleQuote = quote.slice(0, charsToShow)
  const quoteComplete = charsToShow >= quote.length

  // After quote completes, wait for any keypress to dismiss
  const [waitingForKey, setWaitingForKey] = useState(false)
  useEffect(() => {
    if (phase === 'quote' && quoteComplete && !waitingForKey) {
      setWaitingForKey(true)
    }
  }, [phase, quoteComplete, waitingForKey])

  // Skip-on-keypress — both for early skip and for "press any key" dismissal
  useInput(() => {
    onComplete()
  })

  // Render the sprite for the current phase. During scan we cycle candidates;
  // during approach/reveal/quote we show the chosen master.
  const displayMaster = phase === 'scan' ? scanMaster : master
  const spriteEmotion =
    phase === 'reveal' || phase === 'quote' ? 'celebrate' : 'idle'
  const sprite = useMemo(
    () => renderSprite(displayMaster, spriteEmotion, 'large'),
    [displayMaster, spriteEmotion],
  )

  // Phase-specific status line
  let statusLine: React.ReactNode = null
  if (phase === 'scan') {
    statusLine = <Text dimColor>{'   . . . scanning the archives . . .'}</Text>
  } else if (phase === 'approach') {
    statusLine = (
      <Text color={color}>
        {'   '}
        {spinner} a presence approaches…
      </Text>
    )
  } else if (phase === 'reveal') {
    statusLine = (
      <Text color={borderColor} bold>
        {'   '}✦ {stars} {String(rarity).toUpperCase()} ✦
      </Text>
    )
  } else {
    statusLine = (
      <Text dimColor italic>
        {'   '}&quot;{visibleQuote}
        {!quoteComplete && '_'}&quot;
      </Text>
    )
  }

  // Footer — only after typewriter completes
  const footer =
    waitingForKey ? (
      <Box marginTop={1}>
        <Text dimColor>   [press any key to enter]</Text>
      </Box>
    ) : phase === 'scan' || phase === 'approach' ? (
      <Box marginTop={1}>
        <Text dimColor>   [press any key to skip]</Text>
      </Box>
    ) : null

  // During scan phase the master name is hidden (suspense). After reveal
  // we show the real name with the archetype.
  const nameLine =
    phase === 'reveal' || phase === 'quote' ? (
      <Box marginTop={0}>
        <Text>
          <Text color={borderColor}>{stars}</Text>
          <Text> </Text>
          <Text color={borderColor} bold>
            {masterName}
          </Text>
          <Text dimColor> {'\u00B7'} {archetype}</Text>
        </Text>
      </Box>
    ) : (
      <Box marginTop={0}>
        <Text dimColor>{'   ???'}</Text>
      </Box>
    )

  // Stat bars — only revealed in quote phase, after the name lands
  const statsBlock =
    phase === 'quote' ? (
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
    ) : null

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
      <Box
        borderStyle={isDoubleBorder ? 'double' : 'single'}
        borderColor={borderColor}
        flexDirection="column"
        paddingX={1}
        paddingY={0}
      >
        <Box flexDirection="column" marginBottom={0}>
          {sprite.split('\n').map((line, i) => (
            <Text key={i} color={color}>
              {line}
            </Text>
          ))}
        </Box>

        {nameLine}
        {statusLine}
        {statsBlock}
        {footer}
      </Box>
    </Box>
  )
}
