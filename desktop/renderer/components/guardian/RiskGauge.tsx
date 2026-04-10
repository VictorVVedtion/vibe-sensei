interface RiskGaugeProps {
  score: number
}

function getSeverityLabel(score: number): string {
  if (score <= 20) return 'LOW'
  if (score <= 50) return 'MODERATE'
  if (score <= 75) return 'HIGH'
  return 'CRITICAL'
}

function getBarColor(score: number): string {
  if (score <= 20) return 'var(--color-profit)'
  if (score <= 50) return 'var(--color-warning)'
  return 'var(--color-loss)'
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const color = getBarColor(clamped)
  const label = getSeverityLabel(clamped)

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>RISK</span>
        <div style={styles.scoreRow}>
          <span style={{ ...styles.score, color }}>{clamped}</span>
          <span style={{ ...styles.label, color }}>{label}</span>
        </div>
      </div>
      <div style={styles.track}>
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            background: color,
            borderRadius: 'var(--radius-lg)',
            transition: 'width 400ms ease, background 400ms ease',
            boxShadow: clamped > 0 ? `0 0 8px ${color}40` : 'none',
          }}
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'var(--font-ui)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
  },
  score: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: 16,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  label: {
    fontFamily: 'var(--font-ui)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  track: {
    height: 4,
    background: 'var(--bg-raised)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  },
}
