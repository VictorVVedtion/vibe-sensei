import type { MasterInfo, Rarity } from '../../../shared/ipc-channels'

interface MasterCardProps {
  master: MasterInfo | null
}

const RARITY_COLORS: Record<Rarity, string> = {
  common: '#7B8AA0',
  uncommon: '#00FF41',
  rare: '#00FF41',
  epic: '#6B4CF0',
  legendary: '#D4A843',
}

const STAT_KEYS = ['PRECISION', 'PATIENCE', 'AGGRESSION', 'WISDOM', 'SASS'] as const
const STAT_SHORT: Record<string, string> = {
  PRECISION: 'PREC',
  PATIENCE: 'PATI',
  AGGRESSION: 'AGGR',
  WISDOM: 'WISD',
  SASS: 'SASS',
}

export function MasterCard({ master }: MasterCardProps) {
  if (!master) {
    return (
      <div style={styles.card}>
        <span style={styles.emptyText}>Awaiting Guardian</span>
      </div>
    )
  }

  const rarityColor = RARITY_COLORS[master.rarity]
  const quote = master.quote.length > 60
    ? master.quote.slice(0, 57) + '...'
    : master.quote

  const statsLine = STAT_KEYS
    .map((k) => `${STAT_SHORT[k]}:${master.stats[k]}`)
    .join(' ')

  return (
    <div style={styles.card}>
      <div style={styles.nameLine}>
        <span style={{ ...styles.name, color: rarityColor }}>{master.name}</span>
        <span style={styles.archetype}>{master.archetype.replace(/_/g, ' ')}</span>
      </div>
      <div style={styles.quoteLine}>
        <span style={styles.quoteText}>&ldquo;{quote}&rdquo;</span>
      </div>
      <div style={styles.statsLine}>
        <span style={styles.statsText}>{statsLine}</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#0F1924',
    padding: '8px 12px',
    border: '1px solid #253550',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  },
  emptyText: {
    fontSize: 11,
    color: '#7B8AA0',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  nameLine: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  archetype: {
    fontSize: 10,
    color: '#7B8AA0',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  },
  quoteLine: {
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 10,
    color: '#7B8AA0',
    fontStyle: 'italic',
    lineHeight: 1.3,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  statsLine: {},
  statsText: {
    fontSize: 10,
    color: '#00FF41',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: 0.3,
  },
}
