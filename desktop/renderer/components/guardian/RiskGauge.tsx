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
  if (score <= 20) return '#00E5A0'
  if (score <= 50) return '#FFBB33'
  if (score <= 75) return '#D4A843'
  return '#FF4D6A'
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const color = getSeverityColor(clamped)
  const label = getSeverityLabel(clamped)

  // Build gradient stops for the track background
  const trackGradient =
    'linear-gradient(to right, #00E5A0 0%, #FFBB33 35%, #D4A843 65%, #FF4D6A 100%)'

  return (
    <div
      style={styles.container}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Risk score ${clamped} out of 100, severity ${label}`}
    >
      <div style={styles.header}>
        <span style={styles.title}>Risk</span>
        <span style={{ ...styles.scoreLabel, color }}>
          {clamped} <span style={styles.severityTag}>{label}</span>
        </span>
      </div>
      <div style={styles.trackOuter}>
        <div style={{ ...styles.track, background: trackGradient }}>
          <div
            style={{
              ...styles.trackOverlay,
              width: `${100 - clamped}%`,
            }}
          />
        </div>
        <div
          style={{
            ...styles.indicator,
            left: `${clamped}%`,
            borderColor: color,
          }}
        />
      </div>
      <div style={styles.labels}>
        <span style={styles.labelText}>0</span>
        <span style={styles.labelText}>25</span>
        <span style={styles.labelText}>50</span>
        <span style={styles.labelText}>75</span>
        <span style={styles.labelText}>100</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#0F1924',
    padding: '8px 12px',
    border: '1px solid #253550',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 11,
    fontWeight: 600,
    color: '#7B8AA0',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  severityTag: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  trackOuter: {
    position: 'relative' as const,
    height: 8,
    marginBottom: 4,
  },
  track: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    overflow: 'hidden',
  },
  trackOverlay: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    height: '100%',
    background: 'rgba(10, 22, 40, 0.7)',
    transition: 'width 0.4s ease',
  },
  indicator: {
    position: 'absolute' as const,
    top: -2,
    width: 4,
    height: 12,
    background: '#0F1924',
    border: '2px solid',
    transform: 'translateX(-50%)',
    transition: 'left 0.4s ease',
    zIndex: 1,
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  labelText: {
    fontSize: 8,
    color: '#7B8AA0',
    fontVariantNumeric: 'tabular-nums',
  },
}
