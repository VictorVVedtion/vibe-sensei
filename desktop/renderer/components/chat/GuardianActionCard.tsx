/**
 * GuardianActionCard — renders guardian risk alerts as actionable cards
 * in the chat stream. Users can Accept (proceed), Override (ignore), or
 * request a Debate (two masters argue for/against).
 */

import type { GuardianAlert } from '../../../shared/ipc-channels'

interface GuardianActionCardProps {
  alert: GuardianAlert
  onAccept: () => void
  onOverride: () => void
  onDebate: () => void
}

const SEVERITY_COLORS: Record<string, string> = {
  INFO: 'var(--severity-info)',
  WARNING: 'var(--severity-warning)',
  CRITICAL: 'var(--severity-critical)',
  EMERGENCY: 'var(--severity-emergency)',
}

export function GuardianActionCard({ alert, onAccept, onOverride, onDebate }: GuardianActionCardProps) {
  const severityColor = SEVERITY_COLORS[alert.severity.toUpperCase()] ?? 'var(--on-surface-variant)'

  return (
    <div className="guardian-action-card" style={{ borderLeftColor: severityColor }}>
      <div className="guardian-action-card-header">
        <span className="guardian-action-card-master">{alert.masterName}</span>
        <span className="guardian-action-card-severity" style={{ color: severityColor }}>
          {alert.severity.toUpperCase()}
        </span>
      </div>

      <div className="guardian-action-card-message">
        {alert.message}
      </div>

      {alert.checkName && (
        <div className="guardian-action-card-check">
          [{alert.checkName}]
        </div>
      )}

      <div className="guardian-action-card-actions">
        <button className="guardian-card-btn guardian-card-btn--accept" onClick={onAccept} aria-label="Accept guardian recommendation">
          ACCEPT
        </button>
        <button className="guardian-card-btn guardian-card-btn--override" onClick={onOverride} aria-label="Override guardian warning">
          OVERRIDE
        </button>
        <button className="guardian-card-btn guardian-card-btn--debate" onClick={onDebate} aria-label="Request guardian debate">
          DEBATE
        </button>
      </div>
    </div>
  )
}
