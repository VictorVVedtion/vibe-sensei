/**
 * /master — display the user's current guardian + trading record.
 *
 * Composes:
 *   1. GuardianGreeting (sprite/name/archetype/quote/stats card)
 *   2. Cumulative stats line (win rate / total trades / avgR / expectancy)
 *   3. Recent diary entries (last 5 trades with observations + outcomes)
 *
 * Auto-dismisses on any keypress so it behaves like a momentary lookup,
 * not a modal. For users who want to re-experience the gacha animation
 * regardless of hatchedAt, /summon is the right command.
 */

import * as React from 'react'
import { useEffect, useMemo } from 'react'
import { Box, Text, useInput } from '../../ink.js'
import { GuardianGreeting } from '../../components/GuardianGreeting.js'
import type { LocalJSXCommandCall } from '../../types/command.js'

const PATTERN_ICON: Record<string, string> = {
  good_discipline: '✓',
  pyramid_good: '✓',
  early_exit: '⚠',
  late_entry: '⚠',
  oversize: '✗',
  revenge_trade: '✗',
  fomo: '✗',
  position_size_bad: '✗',
  averaging_down_bad: '✗',
  time_of_day_bias: '◐',
  holding_period_bias: '◐',
  instrument_bias: '◐',
  general: '·',
}

const PATTERN_COLOR: Record<string, string> = {
  good_discipline: 'green',
  pyramid_good: 'green',
  early_exit: 'yellow',
  late_entry: 'yellow',
  oversize: 'red',
  revenge_trade: 'red',
  fomo: 'red',
  position_size_bad: 'red',
  averaging_down_bad: 'red',
  general: 'white',
}

function formatPercent(pct: number | undefined): string {
  if (pct === undefined || Number.isNaN(pct)) return ''
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function pnlColor(pct: number | undefined): string | undefined {
  if (pct === undefined || Number.isNaN(pct)) return undefined
  if (pct > 0) return 'green'
  if (pct < 0) return 'red'
  return undefined
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

function DiarySection(): React.ReactNode {
  // Lazy-load diary so the command still works even when buddy/diary
  // is unavailable (defensive — matches the rest of the buddy/ pattern).
  const diary = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../buddy/diary.js') as typeof import('../../buddy/diary.js')
      return new mod.GuardianDiary()
    } catch {
      return null
    }
  }, [])

  if (!diary) {
    return null
  }

  const recent = diary.getRecentEntries(5)
  const stats = diary.getCumulativeStats()
  const total = diary.getAllEntries().length

  if (recent.length === 0 && total === 0) {
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Text dimColor>
            No trades in your diary yet. Place an order — your guardian will start watching.
          </Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
      <Box borderStyle="single" borderColor="cyan" flexDirection="column" paddingX={1}>
        <Text>
          <Text color="cyan" bold>DIARY</Text>
          <Text dimColor> {`· ${total} trade${total === 1 ? '' : 's'} observed`}</Text>
        </Text>

        {stats !== null && (
          <Box marginTop={1}>
            <Text>
              <Text dimColor>win rate </Text>
              <Text color={stats.winRate >= 50 ? 'green' : 'red'}>
                {stats.winRate.toFixed(1)}%
              </Text>
              <Text dimColor>  · avg R </Text>
              <Text color={stats.avgR >= 0 ? 'green' : 'red'}>
                {stats.avgR >= 0 ? '+' : ''}{stats.avgR.toFixed(2)}
              </Text>
              <Text dimColor>  · expectancy </Text>
              <Text color={stats.expectancy >= 0 ? 'green' : 'red'}>
                {stats.expectancy >= 0 ? '+' : ''}{stats.expectancy.toFixed(2)}%
              </Text>
              <Text dimColor>  · n={stats.totalTrades}</Text>
            </Text>
          </Box>
        )}

        <Box flexDirection="column" marginTop={1}>
          {recent.map((entry) => {
            const icon = PATTERN_ICON[entry.patternType] ?? '·'
            const color = PATTERN_COLOR[entry.patternType] ?? 'white'
            const pct = formatPercent(entry.profitPercent)
            const pctTone = pnlColor(entry.profitPercent)
            return (
              <Box key={entry.id} flexDirection="column" marginBottom={0}>
                <Text>
                  <Text color={color}>{icon} </Text>
                  <Text bold>{entry.tradeSymbol}</Text>
                  <Text dimColor> {entry.tradeSide.toUpperCase()}</Text>
                  <Text dimColor> · </Text>
                  <Text color={color}>{entry.patternType.replace(/_/g, ' ')}</Text>
                  {pct && (
                    <>
                      <Text dimColor> · </Text>
                      <Text color={pctTone}>{pct}</Text>
                    </>
                  )}
                </Text>
                <Text dimColor>    &quot;{truncate(entry.observation, 76)}&quot;</Text>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}

function MasterScreen({ onDone }: { onDone: () => void }) {
  // Auto-dismiss on any keypress so /master behaves like a momentary lookup.
  useInput(() => onDone())

  // Safety net — auto-dismiss after 30s even if no input arrives.
  useEffect(() => {
    const timer = setTimeout(() => onDone(), 30_000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <Box flexDirection="column">
      <GuardianGreeting />
      <DiarySection />
      <Box marginTop={1} paddingLeft={2}>
        <Text dimColor>[press any key to dismiss]</Text>
      </Box>
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone) => {
  return <MasterScreen onDone={() => onDone('Master shown.', { display: 'system' })} />
}
