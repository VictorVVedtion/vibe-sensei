import type { MasterInfo, Rarity } from '../../../shared/ipc-channels'

interface MasterCardProps {
  master: MasterInfo | null
}

const RARITY_SIGIL: Record<Rarity, string> = {
  common: '\u00B7',      // ·
  uncommon: '\u25CB',     // ○
  rare: '\u25CF',         // ●
  epic: '\u25C6',         // ◆
  legendary: '\u2605',    // ★
}

const RARITY_COLORS: Record<Rarity, string> = {
  common: '#008F11',
  uncommon: '#00FF41',
  rare: '#00FF41',
  epic: '#6B4CF0',
  legendary: '#FFEA00',
}

const STAT_KEYS = ['PRECISION', 'PATIENCE', 'AGGRESSION', 'WISDOM', 'SASS'] as const

export function MasterCard({ master }: MasterCardProps) {
  if (!master) {
    return (
      <div style={styles.card}>
        <span style={styles.empty}>[AWAITING GUARDIAN]</span>
      </div>
    )
  }

  const color = RARITY_COLORS[master.rarity]
  const sigil = RARITY_SIGIL[master.rarity]
  const quote = master.quote.length > 60 ? master.quote.slice(0, 57) + '...' : master.quote
  const stats = STAT_KEYS.map(k => `${k.slice(0, 4)}:${master.stats[k]}`).join(' ')

  return (
    <div style={styles.card}>
      <div style={styles.line1}>
        <span style={{ color, fontWeight: 700 }}>{sigil} {master.name}</span>
        <span style={styles.archetype}>{master.archetype.replace(/_/g, ' ').toUpperCase()}</span>
      </div>
      <div style={styles.quote}>&ldquo;{quote}&rdquo;</div>
      <div style={styles.stats}>{stats}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#0A0F0A',
    border: '1px solid #002B0E',
    padding: '6px 8px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
  },
  empty: {
    color: '#008F11',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  line1: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    marginBottom: 4,
  },
  archetype: {
    color: '#008F11',
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: 600,
  },
  quote: {
    color: '#008F11',
    fontStyle: 'italic',
    fontSize: 10,
    marginBottom: 4,
    borderLeft: '2px solid #002B0E',
    paddingLeft: 6,
    lineHeight: 1.3,
  },
  stats: {
    color: '#00FF41',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.3,
    fontVariantNumeric: 'tabular-nums' as const,
  },
}
