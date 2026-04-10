import { MasterCard } from './guardian/MasterCard'
import { RiskGauge } from './guardian/RiskGauge'
import { RiskMap } from './guardian/RiskMap'
import { ArbitrageCard } from './guardian/ArbitrageCard'
import { TiltLock } from './guardian/TiltLock'
import { PositionsList } from './guardian/PositionsList'
import { BalanceDisplay } from './guardian/BalanceDisplay'
import { AlertFeed } from './guardian/AlertFeed'
import { AntiPortfolioCard } from './guardian/AntiPortfolio'
import { PlaybookCard } from './guardian/PlaybookCard'
import { TradeReviewCard } from './guardian/TradeReviewCard'
import { CollapsibleCard } from './guardian/CollapsibleCard'
import { TradeHistory } from './guardian/TradeHistory'
import { ModulePicker, loadEnabledModules, type SidebarModuleId } from './ModulePicker'
import { useTradingState } from '../hooks/useTradingState'
import { useGuardianAlerts } from '../hooks/useGuardianAlerts'
import { useTiltState } from '../hooks/useTiltState'
import { usePlaybookCard } from '../hooks/usePlaybookCard'
import { useTradeReview } from '../hooks/useTradeReview'
import { useTradeHistory } from '../hooks/useTradeHistory'
import { useWeeklyReview } from '../hooks/useWeeklyReview'
import { useState } from 'react'

export function GuardianSidebar() {
  const { state, master } = useTradingState()
  const { alerts } = useGuardianAlerts()
  const tilt = useTiltState()
  const { card, dismiss: dismissCard } = usePlaybookCard()
  const { review, dismiss: dismissReview } = useTradeReview()
  const { trades, loading: tradesLoading } = useTradeHistory()
  const { review: weeklyReview } = useWeeklyReview()
  const [enabled, setEnabled] = useState<Set<SidebarModuleId>>(() => loadEnabledModules())
  const show = (id: SidebarModuleId) => enabled.has(id)

  return (
    <div style={styles.container}>
      <div style={styles.scrollArea} className="guardian-sidebar-scroll">
        {/* TIER 1: Always visible, no collapse */}
        {show('MasterCard') && <MasterCard master={master} riskScore={state.riskScore} />}
        <RiskGauge score={state.riskScore} />
        {show('RiskMap') && <RiskMap positions={state.positions} totalValue={state.totalPortfolioValue} />}
        {show('ArbitrageCard') && <ArbitrageCard />}
        {show('Positions') && <PositionsList positions={state.positions} />}

        {/* TIER 3: Event-triggered */}
        {tilt && tilt.level !== 'none' && <TiltLock tilt={tilt} />}
        {card && <PlaybookCard card={card} onDismiss={dismissCard} />}
        {review && <TradeReviewCard review={review} onDismiss={dismissReview} />}

        {/* TIER 2: Default expanded */}
        <CollapsibleCard id="alerts" title="ALERT_FEED" defaultExpanded tier={2}>
          <AlertFeed alerts={alerts} embedded />
        </CollapsibleCard>

        {/* TIER 4: Collapsed by default */}
        <CollapsibleCard id="balance" title="BALANCE_SHEET" tier={4}>
          <BalanceDisplay
            balances={state.balances}
            totalPortfolioValue={state.totalPortfolioValue}
            embedded
          />
        </CollapsibleCard>
        <CollapsibleCard id="trade-history" title="TRADE_HISTORY" tier={4}>
          <TradeHistory trades={trades} loading={tradesLoading} />
        </CollapsibleCard>
        <CollapsibleCard id="weekly-review" title="WEEKLY_REVIEW" tier={4}>
          {weeklyReview ? (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
                {weeklyReview.masterName} — {weeklyReview.periodStart} → {weeklyReview.periodEnd}
              </div>
              <div style={{ marginBottom: 4 }}>
                Trades: {weeklyReview.totalTrades} | WR: {weeklyReview.overallWinRate.toFixed(0)}% | Exp: ${weeklyReview.overallExpectancy.toFixed(2)}
              </div>
              {weeklyReview.perVenue.map((v) => (
                <div key={v.venue} style={{ marginLeft: 8 }}>
                  {v.venue}: {v.tradeCount} trades, {v.winRate.toFixed(0)}% WR
                </div>
              ))}
              {weeklyReview.guardianCommentary && (
                <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--accent)' }}>
                  "{weeklyReview.guardianCommentary.substring(0, 120)}{weeklyReview.guardianCommentary.length > 120 ? '...' : ''}"
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              No review yet
            </div>
          )}
        </CollapsibleCard>
        {show('AntiPortfolio') && (
          <CollapsibleCard id="anti-portfolio" title="ANTI_PORTFOLIO" tier={4}>
            <AntiPortfolioCard embedded />
          </CollapsibleCard>
        )}

        <ModulePicker enabledModules={enabled} onModulesChange={setEnabled} />
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
    background: 'var(--surface-container-low)',
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 8,
    minHeight: 0,
  },
}
