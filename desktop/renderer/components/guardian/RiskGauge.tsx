interface RiskGaugeProps {
  score: number
}

function getSeverityLabel(score: number): string {
  if (score <= 20) return 'LOW'
  if (score <= 50) return 'MODERATE'
  if (score <= 75) return 'HIGH'
  return 'CRITICAL'
}

function getSeverityColor(score: number): string {
  if (score <= 20) return '#00FF41'
  if (score <= 50) return '#FFEA00'
  if (score <= 75) return '#FF8C00'
  return '#FF003C'
}

function buildAsciiBar(score: number): string {
  const totalBlocks = 20
  const filled = Math.round((score / 100) * totalBlocks)
  const empty = totalBlocks - filled
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty)
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const color = getSeverityColor(clamped)
  const label = getSeverityLabel(clamped)
  const bar = buildAsciiBar(clamped)

  return (
    <div
      style={styles.container}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Risk score ${clamped} out of 100, severity ${label}`}
    >
      <span style={styles.title}>RISK</span>
      <span style={{ ...styles.bar, color }}>{bar}</span>
      <span style={{ ...styles.score, color }}>{clamped}</span>
      <span style={{ ...styles.label, color }}>{label}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#0F1924',
    padding: '8px 12px',
    border: '1px solid #253550',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  },
  title: {
    fontSize: 11,
    fontWeight: 600,
    color: '#7B8AA0',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  bar: {
    fontSize: 12,
    lineHeight: 1,
    letterSpacing: 0,
    flexShrink: 0,
  },
  score: {
    fontSize: 13,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  label: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 0.5,
    flexShrink: 0,
  },
}
