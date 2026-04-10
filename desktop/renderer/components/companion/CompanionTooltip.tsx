/**
 * CompanionTooltip — hover stats popup over the companion sprite.
 *
 * Shows accumulated trading statistics from localStorage:
 * - Win rate, avg R-Multiple, weekly PnL, protection count
 * Falls back to "No data" for each stat without stored data.
 */

interface CompanionTooltipProps {
  visible: boolean
}

/** LocalStorage keys for companion stats. */
const STAT_KEYS = {
  winRate: 'companion_winRate',
  avgR: 'companion_avgR',
  weeklyPnl: 'companion_weeklyPnl',
  protections: 'companion_protections',
}

interface CompanionStats {
  winRate: string
  avgR: string
  weeklyPnl: string
  protections: string
}

/** Read trading stats from localStorage with fallbacks. */
function readStats(): CompanionStats {
  try {
    return {
      winRate: localStorage.getItem(STAT_KEYS.winRate) ?? 'No trades yet',
      avgR: localStorage.getItem(STAT_KEYS.avgR) ?? '--',
      weeklyPnl: localStorage.getItem(STAT_KEYS.weeklyPnl) ?? '--',
      protections: localStorage.getItem(STAT_KEYS.protections) ?? '0',
    }
  } catch {
    return {
      winRate: 'No trades yet',
      avgR: '--',
      weeklyPnl: '--',
      protections: '0',
    }
  }
}

export function CompanionTooltip({ visible }: CompanionTooltipProps) {
  if (!visible) return null

  const stats = readStats()

  return (
    <div style={tooltipStyle}>
      <StatRow label="WIN RATE" value={stats.winRate} />
      <StatRow label="AVG R" value={stats.avgR} />
      <StatRow label="WEEKLY PnL" value={stats.weeklyPnl} />
      <StatRow label="PROTECTIONS" value={stats.protections} />
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  )
}

const tooltipStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  left: 0,
  marginBottom: 8,
  background: 'var(--bg-raised)',
  border: '1px solid var(--border-base)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 10px',
  minWidth: 160,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  animation: 'tooltip-fade-in 150ms ease',
  zIndex: 30,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '2px 0',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 9,
  fontWeight: 500,
  color: 'var(--text-tertiary)',
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
}

const valueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums' as const,
}
