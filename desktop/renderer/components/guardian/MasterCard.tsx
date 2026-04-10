import type { MasterInfo, Rarity } from '../../../shared/ipc-channels'
import { GuardianSprite } from './GuardianSprite'

interface MasterCardProps {
  master: MasterInfo | null
  riskScore?: number
}

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'COMMON',
  uncommon: 'UNCOMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
}

const RARITY_CSS_VAR: Record<Rarity, string> = {
  common: 'var(--rarity-common)',
  uncommon: 'var(--rarity-uncommon)',
  rare: 'var(--rarity-rare)',
  epic: 'var(--rarity-epic)',
  legendary: 'var(--rarity-legendary)',
}

const STAT_KEYS = ['PRECISION', 'PATIENCE', 'AGGRESSION', 'WISDOM', 'SASS'] as const

function riskToSpriteState(score: number): 'idle' | 'active' | 'happy' | 'worried' | 'alert' | 'celebrate' {
  if (score <= 10) return 'idle'
  if (score <= 30) return 'active'
  if (score <= 50) return 'worried'
  return 'alert'
}

function renderAsciiBar(value: number): string {
  const filled = Math.round(value / 10)
  const empty = 10 - filled
  return '[' + '|'.repeat(filled) + '-'.repeat(empty) + ']'
}

function formatStatKey(key: string): string {
  return key.slice(0, 3)
}

export function MasterCard({ master, riskScore = 0 }: MasterCardProps) {
  if (!master) {
    return (
      <div style={styles.card}>
        <span style={styles.empty}>[AWAITING GUARDIAN]</span>
      </div>
    )
  }

  const color = RARITY_CSS_VAR[master.rarity]
  const rarityLabel = RARITY_LABEL[master.rarity]
  const starCount = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }[master.rarity]
  const stars = '\u2605'.repeat(starCount)
  const spriteState = riskToSpriteState(riskScore)

  return (
    <div style={styles.card}>
      {/* Portrait row */}
      <div style={styles.portraitRow}>
        <div style={styles.portraitFrame}>
          <GuardianSprite
            masterId={master.id}
            state={spriteState}
            size={72}
          />
        </div>
        <div style={styles.identityCol}>
          <span style={styles.soulLabel}>OPERATOR_SOUL</span>
          <span style={{ ...styles.name, color: 'var(--primary)' }}>
            {master.name.toUpperCase()}
          </span>
          <span style={{ ...styles.rarity, color }}>
            {stars} {rarityLabel}
          </span>
        </div>
      </div>

      {/* Stats as ASCII bars */}
      <div style={styles.statsBlock}>
        {STAT_KEYS.map(k => (
          <div key={k} style={styles.statLine}>
            <span style={styles.statKey}>{formatStatKey(k)}</span>
            <span style={styles.statVal}>{String(master.stats[k]).padStart(2, ' ')}</span>
            <span style={styles.statBar}>{renderAsciiBar(master.stats[k])}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#000000',
    border: '1px solid rgba(156, 255, 147, 0.3)',
    borderRadius: 0,
    padding: 12,
    overflow: 'visible',
  },
  portraitRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  portraitFrame: {
    flexShrink: 0,
    filter: 'grayscale(60%) sepia(40%) hue-rotate(100deg) saturate(200%)',
  },
  identityCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  soulLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'rgba(156, 255, 147, 0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  name: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  rarity: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: 500,
  },
  empty: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  statsBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  statLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    textTransform: 'uppercase' as const,
    color: 'var(--primary)',
  },
  statKey: {
    width: 28,
    flexShrink: 0,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  statVal: {
    width: 18,
    flexShrink: 0,
    textAlign: 'right' as const,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  statBar: {
    letterSpacing: -0.5,
    opacity: 0.8,
  },
}
