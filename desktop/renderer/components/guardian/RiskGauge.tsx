interface RiskGaugeProps {
  score: number
}

const TOTAL_BLOCKS = 20
const FILLED = '\u2588'  // █
const EMPTY = '\u2591'   // ░

function getSeverityLabel(score: number): string {
  if (score <= 20) return 'LOW'
  if (score <= 50) return 'MODERATE'
  if (score <= 75) return 'HIGH'
  return 'CRITICAL'
}

function getSeverityColor(score: number): string {
  if (score <= 20) return '#00FF41'
  if (score <= 50) return '#FFEA00'
  if (score <= 75) return '#FF003C'
  return '#FF003C'
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const filled = Math.round((clamped / 100) * TOTAL_BLOCKS)
  const empty = TOTAL_BLOCKS - filled
  const color = getSeverityColor(clamped)
  const label = getSeverityLabel(clamped)

  return (
    <div style={styles.container}>
      <span style={styles.title}>RISK</span>
      <span style={{ ...styles.blocks, color }}>
        {FILLED.repeat(filled)}
      </span>
      <span style={styles.emptyBlocks}>
        {EMPTY.repeat(empty)}
      </span>
      <span style={{ ...styles.score, color }}>{clamped}</span>
      <span style={styles.label}>{label}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#0A0F0A',
    border: '1px solid #002B0E',
    padding: '6px 8px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#008F11',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  blocks: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    lineHeight: 1,
  },
  emptyBlocks: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    lineHeight: 1,
    color: '#002B0E',
  },
  score: {
    fontWeight: 700,
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums' as const,
    marginLeft: 4,
  },
  label: {
    color: '#008F11',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
}
