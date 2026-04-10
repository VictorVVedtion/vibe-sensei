import type { TiltState } from '../../../shared/ipc-channels'

interface TiltLockProps {
  tilt: TiltState
}

/**
 * Tilt warning banner — displayed in the guardian sidebar when tilt is active.
 * Red border, reason text, guardian portrait. Auto-dismisses when tilt clears.
 *
 * This is a WARNING only, never a hard lock on orders.
 */
export function TiltLock({ tilt }: TiltLockProps) {
  if (tilt.level === 'none') return null

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.icon}>&#x26A0;</span>
        <span style={styles.title}>TILT WARNING</span>
      </div>
      <div style={styles.triggers}>
        {tilt.triggers.map((trigger, i) => (
          <div key={i} style={styles.triggerLine}>
            <span style={styles.bullet}>&bull;</span>
            <span>{trigger}</span>
          </div>
        ))}
      </div>
      {tilt.recommendation && (
        <div style={styles.recommendation}>{tilt.recommendation}</div>
      )}
      <div style={styles.footer}>
        Auto-dismisses on next profitable trade
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(242, 54, 69, 0.06)',
    border: '1px solid var(--color-loss)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    animation: 'pulse-dot 2s infinite',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  icon: {
    fontSize: 14,
    color: 'var(--color-loss)',
  },
  title: {
    fontFamily: 'var(--font-ui)',
    color: 'var(--color-loss)',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  triggers: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    color: 'var(--text-primary)',
    lineHeight: '1.4',
  },
  triggerLine: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
  },
  bullet: {
    color: 'var(--color-loss)',
    fontSize: 10,
    flexShrink: 0,
  },
  recommendation: {
    marginTop: 6,
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    lineHeight: '1.4',
  },
  footer: {
    marginTop: 6,
    fontFamily: 'var(--font-ui)',
    fontSize: 9,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
}
