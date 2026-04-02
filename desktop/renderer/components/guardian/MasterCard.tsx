import { useMemo } from 'react'
import type { MasterInfo, Rarity } from '../../../shared/ipc-channels'

interface MasterCardProps {
  master: MasterInfo | null
}

const RARITY_STARS: Record<Rarity, string> = {
  common: '\u2605',
  uncommon: '\u2605\u2605',
  rare: '\u2605\u2605\u2605',
  epic: '\u2605\u2605\u2605\u2605',
  legendary: '\u2605\u2605\u2605\u2605\u2605',
}

const RARITY_COLORS: Record<Rarity, string> = {
  common: '#7B8AA0',
  uncommon: '#00D4FF',
  rare: '#00D4FF',
  epic: '#6B4CF0',
  legendary: '#D4A843',
}

const STAT_LABELS = ['PRECISION', 'PATIENCE', 'AGGRESSION', 'WISDOM', 'SASS'] as const

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const hue = label === 'AGGRESSION' ? 0 : label === 'SASS' ? 300 : 150
  const color =
    label === 'AGGRESSION'
      ? `hsl(${Math.max(0, 30 - pct * 0.3)}, 85%, ${50 + pct * 0.15}%)`
      : label === 'SASS'
        ? `hsl(${280 + pct * 0.4}, 70%, ${55 + pct * 0.1}%)`
        : `hsl(${hue}, ${60 + pct * 0.2}%, ${40 + pct * 0.15}%)`

  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label.slice(0, 4)}</span>
      <div style={styles.statTrack}>
        <div
          style={{
            ...styles.statFill,
            width: `${pct}%`,
            background: color,
          }}
        />
      </div>
      <span style={styles.statValue}>{value}</span>
    </div>
  )
}

export function MasterCard({ master }: MasterCardProps) {
  if (!master) {
    return (
      <div style={styles.card}>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>&#x2694;&#xFE0F;</span>
          <span style={styles.emptyText}>Awaiting Guardian</span>
        </div>
      </div>
    )
  }

  const rarityColor = RARITY_COLORS[master.rarity]
  const stars = RARITY_STARS[master.rarity]

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.nameRow}>
          <span style={{ ...styles.name, color: rarityColor }}>{master.name}</span>
          <span style={{ ...styles.stars, color: rarityColor }}>{stars}</span>
        </div>
        <span style={styles.archetype}>{master.archetype.replace(/_/g, ' ')}</span>
      </div>
      <div style={styles.quote}>
        <span style={styles.quoteText}>&ldquo;{master.quote}&rdquo;</span>
      </div>
      <div style={styles.statsContainer}>
        {STAT_LABELS.map((stat) => (
          <StatBar key={stat} label={stat} value={master.stats[stat]} />
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#0F1924',
    borderRadius: 6,
    padding: 12,
    border: '1px solid #253550',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '16px 0',
    color: '#7B8AA0',
  },
  emptyIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  header: {
    marginBottom: 8,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  stars: {
    fontSize: 11,
    flexShrink: 0,
    letterSpacing: 1,
  },
  archetype: {
    fontSize: 10,
    color: '#7B8AA0',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: 2,
    display: 'block',
  },
  quote: {
    background: '#0A1628',
    borderRadius: 4,
    padding: '6px 8px',
    marginBottom: 10,
    borderLeft: '2px solid #253550',
  },
  quoteText: {
    fontSize: 11,
    color: '#7B8AA0',
    fontStyle: 'italic',
    lineHeight: 1.4,
    display: 'block',
  },
  statsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 9,
    color: '#7B8AA0',
    width: 32,
    flexShrink: 0,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  statTrack: {
    flex: 1,
    height: 4,
    background: '#0A1628',
    borderRadius: 2,
    overflow: 'hidden',
  },
  statFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.4s ease',
  },
  statValue: {
    fontSize: 9,
    color: '#7B8AA0',
    width: 18,
    textAlign: 'right' as const,
    flexShrink: 0,
  },
}
