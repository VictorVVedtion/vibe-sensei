import { useTradingState } from '../hooks/useTradingState'
import { useGuardianAlerts } from '../hooks/useGuardianAlerts'

// ── Material Symbol helper ─────────────────────────────────────────────────

function MIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined status-icon${className ? ' ' + className : ''}`}>
      {name}
    </span>
  )
}

// ── Data derivation helpers ────────────────────────────────────────────────

function deriveRegime(riskScore: number): string {
  if (riskScore >= 60) return 'RISK_OFF'
  if (riskScore >= 30) return 'RANGING'
  return 'TRENDING_UP'
}

function deriveHeatPercent(riskScore: number): number {
  return Math.min(100, Math.max(0, riskScore))
}

function findConcentration(alerts: { severity: string; message: string; checkName?: string }[]): {
  value: number
  elevated: boolean
} {
  const concAlert = alerts
    .slice()
    .reverse()
    .find((a) => a.checkName === 'concentration' || a.message.toLowerCase().includes('concentrat'))

  if (!concAlert) return { value: 0, elevated: false }

  const match = concAlert.message.match(/(\d+)%/)
  const pct = match ? parseInt(match[1], 10) : 0
  const elevated = concAlert.severity === 'warning' || concAlert.severity === 'critical' || concAlert.severity === 'emergency'
  return { value: pct, elevated }
}

function computeNextGate(timestamp: number): string {
  if (timestamp === 0) return '--:--'
  const elapsed = Date.now() - timestamp
  const gateInterval = 5 * 60 * 1000
  const remaining = Math.max(0, gateInterval - (elapsed % gateInterval))
  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  if (mins > 0) return `${mins}m`
  return `${secs}s`
}

// ── StatusBar ──────────────────────────────────────────────────────────────

export function StatusBar() {
  const { state } = useTradingState()
  const { alerts } = useGuardianAlerts()

  const regime = deriveRegime(state.riskScore)
  const heat = deriveHeatPercent(state.riskScore)
  const conc = findConcentration(alerts)
  const nextGate = computeNextGate(state.timestamp)

  const regimeClass = regime === 'TRENDING_UP' ? 'regime-up' : regime === 'RISK_OFF' ? 'regime-off' : ''
  const heatElevated = heat > 40
  const concElevated = conc.elevated || conc.value > 30

  return (
    <div className="status-bar">
      <div className="status-item">
        <MIcon name="hub" />
        <span>7 VENUES</span>
      </div>

      <div className="status-item">
        <MIcon name="description" />
        <span>PAPER</span>
      </div>

      <div className={`status-item ${regimeClass}`}>
        <MIcon name="trending_up" />
        <span>REGIME: {regime}</span>
      </div>

      <div className={`status-item${heatElevated ? ' status-elevated' : ''}`}>
        <MIcon name="thermostat" />
        <span>HEAT: {heat}%</span>
      </div>

      <div className={`status-item${concElevated ? ' status-error' : ''}`}>
        <MIcon name="warning" />
        <span>CONC: {conc.value}%{concElevated ? ' [!!]' : ''}</span>
      </div>

      <div className="status-item">
        <MIcon name="timer" />
        <span>NEXT GATE: {nextGate}</span>
      </div>
    </div>
  )
}
