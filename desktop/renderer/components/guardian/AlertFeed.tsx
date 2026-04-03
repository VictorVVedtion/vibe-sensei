import { useEffect, useRef } from 'react'
import type { AlertSeverity, GuardianAlert } from '../../../shared/ipc-channels'

interface AlertFeedProps {
  alerts: GuardianAlert[]
}

const SEVERITY_ICONS: Record<AlertSeverity, string> = {
  info: '\u2139\uFE0F',
  warning: '\u26A0\uFE0F',
  critical: '\uD83D\uDFE0',
  emergency: '\uD83D\uDD34',
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: '#7B8AA0',
  warning: '#FFBB33',
  critical: '#D4A843',
  emergency: '#C850C0',
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function AlertItem({ alert }: { alert: GuardianAlert }) {
  const color = SEVERITY_COLORS[alert.severity]

  return (
    <div style={styles.alertRow}>
      <span style={styles.icon}>{SEVERITY_ICONS[alert.severity]}</span>
      <div style={styles.alertContent}>
        <div style={styles.alertHeader}>
          <span style={{ ...styles.masterName, color }}>{alert.masterName}</span>
          <span style={styles.timestamp}>{formatTimestamp(alert.timestamp)}</span>
        </div>
        <span style={{ ...styles.message, color }}>{alert.message}</span>
      </div>
    </div>
  )
}

export function AlertFeed({ alerts }: AlertFeedProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [alerts.length])

  return (
    <div style={styles.container} role="log" aria-live="polite" aria-label="Guardian alerts">
      <div style={styles.headerBar}>
        <span style={styles.title}>Alerts</span>
        <span style={styles.count}>{alerts.length}</span>
      </div>
      {alerts.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyText}>No alerts yet</span>
        </div>
      ) : (
        <div ref={listRef} style={styles.list}>
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#0F1924',
    border: '1px solid #253550',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    flex: 1,
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: '#0A1628',
    borderBottom: '1px solid #253550',
    flexShrink: 0,
  },
  title: {
    fontSize: 11,
    fontWeight: 600,
    color: '#7B8AA0',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  count: {
    fontSize: 10,
    color: '#00D4FF',
    background: '#182233',
    padding: '1px 6px',
    fontWeight: 600,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto' as const,
    flex: 1,
    minHeight: 0,
  },
  alertRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '6px 10px',
    borderBottom: '1px solid #182233',
  },
  icon: {
    fontSize: 11,
    flexShrink: 0,
    marginTop: 1,
  },
  alertContent: {
    flex: 1,
    minWidth: 0,
  },
  alertHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    marginBottom: 1,
  },
  masterName: {
    fontSize: 10,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  timestamp: {
    fontSize: 9,
    color: '#7B8AA0',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  message: {
    fontSize: 11,
    lineHeight: 1.3,
    display: 'block',
    wordBreak: 'break-word' as const,
  },
  empty: {
    padding: '16px 10px',
    textAlign: 'center' as const,
  },
  emptyText: {
    fontSize: 11,
    color: '#7B8AA0',
  },
}
