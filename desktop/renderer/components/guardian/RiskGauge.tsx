interface RiskGaugeProps {
  score: number
}

const TOTAL_BLOCKS = 20

function getSeverityLabel(score: number): string {
  if (score <= 20) return 'LOW'
  if (score <= 50) return 'MODERATE'
  if (score <= 75) return 'HIGH'
  return 'CRITICAL'
}

function getSeverityColor(score: number): string {
  if (score <= 20) return '#00FFA3'
  if (score <= 50) return '#FFBB33'
  if (score <= 75) return '#C850C0'
  return '#C850C0'
}

function buildBlockString(score: number): string {
  const filled = Math.round((score / 100) * TOTAL_BLOCKS)
  const empty = TOTAL_BLOCKS - filled
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty)
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const color = getSeverityColor(clamped)
  const label = getSeverityLabel(clamped)
  const blocks = buildBlockString(clamped)

  return (
    <div
      style={styles.container}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Risk score ${clamped} out of 100, severity ${label}`}
    >
      <div style={styles.gaugeRow}>
        <span style={styles.title}>RISK</span>
        <span style={{ ...styles.blocks, color }}>{blocks}</span>
        <span style={{ ...styles.scoreLabel, color }}>
          {String(clamped).padStart(3, ' ')}
        </span>
        <span style={{ ...styles.severityTag, color }}>{label}</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#0F1924',
    padding: '6px 8px',
    border: '1px solid #253550',
  },
  gaugeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  },
  title: {
    fontSize: 10,
    fontWeight: 700,
    color: '#7B8AA0',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  blocks: {
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 1,
    flexShrink: 0,
    whiteSpace: 'pre' as const,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
    whiteSpace: 'pre' as const,
  },
  severityTag: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 0.5,
    flexShrink: 0,
  },
}
