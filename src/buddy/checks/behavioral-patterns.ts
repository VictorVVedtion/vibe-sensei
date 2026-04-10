/**
 * Behavioral patterns check — warns when diary reveals harmful trading habits.
 * Queries the enhanced summary from GuardianDiary and returns the highest-severity
 * behavioral alert relevant to current positions.
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../guardian.js'
import { GuardianDiary } from '../diary.js'

let sharedDiary: GuardianDiary | null = null

function getDiary(): GuardianDiary {
  if (!sharedDiary) {
    sharedDiary = new GuardianDiary()
  }
  return sharedDiary
}

export function checkBehavioralPatterns(
  positions: Position[],
  _balances: Balance[],
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  const diary = getDiary()
  const summary = diary.getEnhancedSummary()
  if (!summary) return null

  // Collect behavioral alerts with severity
  const alerts: Array<{ severity: Severity; message: string }> = []

  // Check instrument bias against currently open positions
  for (const bias of summary.instrumentBiases) {
    const matchingPos = positions.find(p => p.symbol === bias.symbol)
    if (matchingPos) {
      const pct = (bias.winRate * 100).toFixed(0)
      alerts.push({
        severity: 'WARNING',
        message: `${masterName}: You're trading ${bias.symbol} again — only ${pct}% win rate on ${bias.totalTrades} past trades. "${masterQuote}"`,
      })
    }
  }

  // Check position size correlation
  if (summary.positionSizeBias) {
    const hasLargePosition = positions.some(p => {
      const entries = diary.getAllEntries()
      const recent = entries.filter(e => e.positionSizePercentile !== undefined)
      if (recent.length === 0) return false
      return true // if there's a bias and any position exists, warn
    })
    if (hasLargePosition) {
      alerts.push({
        severity: 'WARNING',
        message: `${masterName}: ${summary.positionSizeBias} "${masterQuote}"`,
      })
    }
  }

  // Check averaging down stats
  if (summary.averagingDownStats.emotional > 0) {
    alerts.push({
      severity: 'CRITICAL',
      message: `${masterName}: Detected ${summary.averagingDownStats.emotional} emotional averaging-down sequences. Stop catching falling knives. "${masterQuote}"`,
    })
  } else if (summary.averagingDownStats.total > 2) {
    alerts.push({
      severity: 'WARNING',
      message: `${masterName}: ${summary.averagingDownStats.total} averaging-down sequences detected. Review your DCA discipline. "${masterQuote}"`,
    })
  }

  // Check time-of-day bias against current time
  const currentHour = new Date().getUTCHours()
  for (const session of summary.timeOfDayAnalysis) {
    if (session.winRate >= 0.35) continue
    const isCurrentSession = (
      (session.session === 'Asian' && currentHour >= 0 && currentHour < 8) ||
      (session.session === 'European' && currentHour >= 8 && currentHour < 16) ||
      (session.session === 'American' && currentHour >= 16 && currentHour < 24)
    )
    if (isCurrentSession && session.totalTrades >= 5) {
      const pct = (session.winRate * 100).toFixed(0)
      alerts.push({
        severity: 'INFO',
        message: `${masterName}: You're in the ${session.session} session — only ${pct}% win rate here. Consider sitting this one out. "${masterQuote}"`,
      })
    }
  }

  if (alerts.length === 0) return null

  // Return highest severity alert
  const severityRank: Record<Severity, number> = {
    INFO: 0,
    WARNING: 1,
    CRITICAL: 2,
    EMERGENCY: 3,
  }

  alerts.sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
  const top = alerts[0]!

  return {
    severity: top.severity,
    masterId,
    masterName,
    message: top.message,
    checkName: 'behavioral-patterns',
    timestamp: new Date(),
  }
}
