import type { MasterInfo, Rarity } from '../../../shared/ipc-channels'

interface MasterCardProps {
  master: MasterInfo | null
}

const RARITY_SIGIL: Record<Rarity, string> = {
  common: '\u00B7',
  uncommon: '\u25CB',
  rare: '\u25CF',
  epic: '\u25C6',
  legendary: '\u2605',
}

const RARITY_COLORS: Record<Rarity, string> = {
  common: '#7B8AA0',
  uncommon: '#00D4FF',
  rare: '#00D4FF',
  epic: '#6B4CF0',
  legendary: '#D4A843',
}

const STAT_KEYS = ['PRECISION', 'PATIENCE', 'AGGRESSION', 'WISDOM', 'SASS'] as const

function truncateQuote(quote: string, max: number): string {
  if (quote.length <= max) return quote
  return quote.slice(0, max) + '...'
}

function formatStats(stats: Record<string, number>): string {
  return STAT_KEYS.map((k) => `${k.slice(0, 4)}:${stats[k]}`).join(' ')
}

export function MasterCard({ master }: MasterCardProps) {
  if (!master) {
    return (
      <div style={styles.card}>
        <span style={styles.emptyText}>-- AWAITING GUARDIAN --</span>
      </div>
    )
  }

  const rarityColor = RARITY_COLORS[master.rarity]
  const sigil = RARITY_SIGIL[master.rarity]

  return (
    <div style={styles.card}>
      <div style={styles.nameRow}>
        <span style={{ ...styles.name, color: rarityColor }}>
          {sigil} {master.name}
        </span>
        <span style={styles.archetype}>
          {master.archetype.replace(/_/g, ' ')}
        </span>
      </div>
      <div style={styles.quoteLine}>
        {'\u201C'}{truncateQuote(master.quote, 60)}{'\u201D'}
      </div>
      <div style={styles.statsLine}>
        {formatStats(master.stats)}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#0F1924',
    padding: '6px 8px',
    border: '1px solid #253550',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  },
  emptyText: {
    fontSize: 10,
    color: '#7B8AA0',
    letterSpacing: 0.5,
    textAlign: 'center' as const,
    display: 'block',
    padding: '8px 0',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 6,
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
    fontSize: 9,
    color: '#7B8AA0',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  quoteLine: {
    fontSize: 10,
    color: '#7B8AA0',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    marginBottom: 4,
    borderLeft: '2px solid #253550',
    paddingLeft: 6,
  },
  statsLine: {
    fontSize: 9,
    color: '#7B8AA0',
    fontWeight: 600,
    letterSpacing: 0.3,
    whiteSpace: 'nowrap' as const,
  },
}
