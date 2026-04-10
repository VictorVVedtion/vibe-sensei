import React from 'react'
import { Text } from '../../ink.js'
import type { Theme } from '../../utils/theme.js'

type StatsBarProps = {
  /** Current value */
  value: number
  /** Maximum value */
  max: number
  /** Width of the bar in characters (default 20) */
  width?: number
  /** Color for the filled portion */
  color?: keyof Theme
  /** Optional label prefix, e.g., "PRE" */
  label?: string
  /** Show percentage after the bar */
  showPercent?: boolean
  /** Warning threshold (percentage) — switches to warning color */
  warnAt?: number
  /** Error threshold (percentage) — switches to error color */
  errorAt?: number
}

/**
 * ASCII stats bar for operator dashboard display.
 *
 * @example
 * <StatsBar value={42} max={100} label="HEAT" />
 * // Renders: HEAT [████████░░░░░░░░░░░░] 42%
 *
 * @example
 * <StatsBar value={7} max={10} width={10} />
 * // Renders: [███████░░░]
 */
export function StatsBar({
  value,
  max,
  width = 20,
  color = 'accent',
  label,
  showPercent = true,
  warnAt,
  errorAt,
}: StatsBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const filled = Math.round((pct / 100) * width)
  const empty = width - filled

  // Determine color based on thresholds
  let barColor: keyof Theme = color
  if (errorAt !== undefined && pct >= errorAt) {
    barColor = 'error'
  } else if (warnAt !== undefined && pct >= warnAt) {
    barColor = 'warning'
  }

  const filledStr = '\u2588'.repeat(filled)  // █
  const emptyStr = '\u2591'.repeat(empty)    // ░

  return (
    <Text>
      {label && <Text dimColor>{label} </Text>}
      <Text color={barColor}>{filledStr}</Text>
      <Text dimColor>{emptyStr}</Text>
      {showPercent && <Text dimColor> {pct}%</Text>}
    </Text>
  )
}
