import { MasterCard } from './guardian/MasterCard'
import { RiskGauge } from './guardian/RiskGauge'
import { PositionsList } from './guardian/PositionsList'
import { BalanceDisplay } from './guardian/BalanceDisplay'
import { AlertFeed } from './guardian/AlertFeed'
import { useTradingState } from '../hooks/useTradingState'
import { useGuardianAlerts } from '../hooks/useGuardianAlerts'

export function GuardianSidebar() {
  const { state, master } = useTradingState()
  const { alerts } = useGuardianAlerts()

  return (
    <div style={styles.container}>
      <div style={styles.scrollArea}>
        <MasterCard master={master} />
        <RiskGauge score={state.riskScore} />
        <PositionsList positions={state.positions} />
        <BalanceDisplay
          balances={state.balances}
          totalPortfolioValue={state.totalPortfolioValue}
        />
        <AlertFeed alerts={alerts} />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: '#0F1924',
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 8,
    minHeight: 0,
  },
}
