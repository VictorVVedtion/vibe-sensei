import { useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface GateDot {
  name: string
  status: 'green' | 'yellow' | 'red'
  message: string
}

export interface PlaybookCardData {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit' | 'stop_loss'
  quantity: number
  entryPrice: number
  stopPrice: number | null
  targetPrice: number | null
  rationale: string
  rrRatio: number | null
  riskPct: number | null
  rewardPct: number | null
  portfolioPct: number
  gateStatus: 'pass' | 'warn' | 'fail'
  gateDots: GateDot[]
  timestamp: number
}

interface PlaybookCardProps {
  card: PlaybookCardData
  onDismiss: () => void
}

type ExecuteState = 'idle' | 'executing' | 'success' | 'error'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  if (n >= 10000) return n.toFixed(0)
  if (n >= 100) return n.toFixed(1)
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(4)
}

function formatQty(n: number): string {
  if (n >= 1000) return n.toFixed(1)
  if (n >= 1) return n.toFixed(3)
  return n.toFixed(6)
}

function getDotColor(status: 'green' | 'yellow' | 'red'): string {
  switch (status) {
    case 'green': return 'var(--color-profit)'
    case 'yellow': return 'var(--color-warning)'
    case 'red': return 'var(--color-loss)'
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'market': return 'MKT'
    case 'limit': return 'LMT'
    case 'stop_loss': return 'STP'
    default: return type.toUpperCase()
  }
}

// ── R:R Bar ──────────────────────────────────────────────────────────────────

function RiskRewardBar({
  riskPct,
  rewardPct,
}: {
  riskPct: number
  rewardPct: number
}) {
  const total = riskPct + rewardPct
  if (total <= 0) return null
  const riskWidth = (riskPct / total) * 100
  const rewardWidth = (rewardPct / total) * 100

  return (
    <div style={styles.rrBarContainer}>
      <div style={styles.rrLabels}>
        <span style={{ ...styles.rrLabel, color: 'var(--color-loss)' }}>
          -{riskPct.toFixed(1)}%
        </span>
        <span style={{ ...styles.rrLabel, color: 'var(--color-profit)' }}>
          +{rewardPct.toFixed(1)}%
        </span>
      </div>
      <div style={styles.rrTrack}>
        <div
          style={{
            width: `${riskWidth}%`,
            height: '100%',
            background: 'var(--color-loss)',
            borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
          }}
        />
        <div
          style={{
            width: `${rewardWidth}%`,
            height: '100%',
            background: 'var(--color-profit)',
            borderRadius: '0 var(--radius-lg) var(--radius-lg) 0',
          }}
        />
      </div>
    </div>
  )
}

// ── Gate Dots ────────────────────────────────────────────────────────────────

function GateDots({ dots }: { dots: GateDot[] }) {
  return (
    <div style={styles.gateDotsRow}>
      {dots.map((dot, i) => (
        <div
          key={i}
          title={`${dot.name}: ${dot.message}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: getDotColor(dot.status),
            boxShadow: `0 0 4px ${getDotColor(dot.status)}60`,
            transition: 'background var(--transition-fast)',
          }}
        />
      ))}
    </div>
  )
}

// ── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={styles.spinner} />
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function PlaybookCard({ card, onDismiss }: PlaybookCardProps) {
  const [executeState, setExecuteState] = useState<ExecuteState>('idle')
  const [resultMsg, setResultMsg] = useState('')

  const isBuy = card.side === 'buy'
  const dirColor = isBuy ? 'var(--color-profit)' : 'var(--color-loss)'
  const dirLabel = isBuy ? 'BUY' : 'SELL'

  const handleExecute = useCallback(() => {
    if (executeState !== 'idle') return
    setExecuteState('executing')

    const api = (window as any).electronAPI
    if (!api || typeof api.executePlaybook !== 'function') {
      setExecuteState('error')
      setResultMsg('Bridge unavailable')
      return
    }

    api.executePlaybook(card.id, {
      symbol: card.symbol,
      side: card.side,
      type: card.type,
      quantity: card.quantity,
      price: card.entryPrice > 0 ? card.entryPrice : undefined,
      stopPrice: card.stopPrice ?? undefined,
    })

    // Optimistic: show executing for 2s, then success
    setTimeout(() => {
      setExecuteState('success')
      setResultMsg('Order sent')
    }, 2000)
  }, [card, executeState])

  const handleDismiss = useCallback(() => {
    if (executeState === 'executing') return
    onDismiss()
  }, [executeState, onDismiss])

  return (
    <div
      style={{
        ...styles.container,
        borderLeftColor: dirColor,
        opacity: executeState === 'success' ? 0.6 : 1,
        transition: 'opacity 600ms ease',
      }}
    >
      {/* Header: direction + symbol + type */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={{ ...styles.dirBadge, background: dirColor }}>
            {dirLabel}
          </span>
          <span style={styles.symbol}>{card.symbol}</span>
        </div>
        <span style={styles.typeBadge}>{getTypeLabel(card.type)}</span>
      </div>

      {/* Price levels */}
      <div style={styles.priceGrid}>
        <div style={styles.priceRow}>
          <span style={styles.priceLabel}>Entry</span>
          <span style={styles.priceValue}>
            {card.entryPrice > 0 ? formatPrice(card.entryPrice) : '-'}
          </span>
        </div>
        {card.stopPrice !== null && (
          <div style={styles.priceRow}>
            <span style={{ ...styles.priceLabel, color: 'var(--color-loss)' }}>Stop</span>
            <span style={{ ...styles.priceValue, color: 'var(--color-loss)' }}>
              {formatPrice(card.stopPrice)}
            </span>
          </div>
        )}
        {card.targetPrice !== null && (
          <div style={styles.priceRow}>
            <span style={{ ...styles.priceLabel, color: 'var(--color-profit)' }}>Target</span>
            <span style={{ ...styles.priceValue, color: 'var(--color-profit)' }}>
              {formatPrice(card.targetPrice)}
            </span>
          </div>
        )}
        <div style={styles.priceRow}>
          <span style={styles.priceLabel}>Qty</span>
          <span style={styles.priceValue}>{formatQty(card.quantity)}</span>
        </div>
      </div>

      {/* R:R bar */}
      {card.riskPct !== null && card.rewardPct !== null && (
        <div style={styles.section}>
          <div style={styles.rrHeader}>
            <span style={styles.sectionTitle}>R:R</span>
            {card.rrRatio !== null && (
              <span style={styles.rrValue}>1:{card.rrRatio.toFixed(1)}</span>
            )}
          </div>
          <RiskRewardBar riskPct={card.riskPct} rewardPct={card.rewardPct} />
        </div>
      )}

      {/* Portfolio % */}
      {card.portfolioPct > 0 && (
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Portfolio</span>
          <span style={styles.metaValue}>{card.portfolioPct.toFixed(1)}%</span>
        </div>
      )}

      {/* Gate dots */}
      {card.gateDots.length > 0 && (
        <div style={styles.section}>
          <div style={styles.gateHeader}>
            <span style={styles.sectionTitle}>Gates</span>
            <span style={{
              ...styles.gateStatusBadge,
              color: card.gateStatus === 'pass'
                ? 'var(--color-profit)'
                : card.gateStatus === 'warn'
                  ? 'var(--color-warning)'
                  : 'var(--color-loss)',
            }}>
              {card.gateStatus.toUpperCase()}
            </span>
          </div>
          <GateDots dots={card.gateDots} />
        </div>
      )}

      {/* Rationale */}
      {card.rationale && (
        <div style={styles.rationale}>
          <p style={styles.rationaleText}>{card.rationale}</p>
        </div>
      )}

      {/* Action buttons */}
      <div style={styles.actions}>
        {executeState === 'idle' && (
          <>
            <button
              style={styles.executeBtn}
              onClick={handleExecute}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = '#00c896'
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = 'var(--color-accent)'
              }}
            >
              EXECUTE
            </button>
            <button
              style={styles.dismissBtn}
              onClick={handleDismiss}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = 'var(--bg-active)'
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              DISMISS
            </button>
          </>
        )}
        {executeState === 'executing' && (
          <div style={styles.executingRow}>
            <Spinner />
            <span style={styles.executingText}>执行中...</span>
          </div>
        )}
        {executeState === 'success' && (
          <span style={styles.resultSuccess}>{resultMsg}</span>
        )}
        {executeState === 'error' && (
          <span style={styles.resultError}>{resultMsg}</span>
        )}
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-base)',
    borderLeft: '3px solid transparent',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'var(--bg-raised)',
    borderBottom: '1px solid var(--border-base)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dirBadge: {
    fontFamily: 'var(--font-ui)',
    fontSize: 10,
    fontWeight: 700,
    color: '#fff',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  symbol: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  typeBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    background: 'var(--bg-surface)',
    padding: '1px 6px',
    borderRadius: 'var(--radius-sm)',
    letterSpacing: 0.5,
  },
  priceGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '10px 12px',
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontFamily: 'var(--font-ui)',
    fontSize: 10,
    color: 'var(--text-tertiary)',
    fontWeight: 500,
  },
  priceValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  section: {
    padding: '0 12px 10px',
  },
  rrHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: 'var(--font-ui)',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  rrValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  rrBarContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  rrLabels: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  rrLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  rrTrack: {
    height: 4,
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    background: 'var(--bg-raised)',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 12px 10px',
  },
  metaLabel: {
    fontFamily: 'var(--font-ui)',
    fontSize: 10,
    color: 'var(--text-tertiary)',
    fontWeight: 500,
  },
  metaValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  gateHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gateStatusBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  gateDotsRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  rationale: {
    padding: '0 12px 10px',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: 10,
    marginTop: 2,
  },
  rationaleText: {
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  actions: {
    display: 'flex',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid var(--border-base)',
    background: 'var(--bg-raised)',
  },
  executeBtn: {
    flex: 1,
    minHeight: 44,
    background: 'var(--color-accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    cursor: 'pointer',
    transition: 'background var(--transition-fast)',
    textTransform: 'uppercase' as const,
  },
  dismissBtn: {
    minHeight: 44,
    padding: '0 16px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.5,
    cursor: 'pointer',
    transition: 'background var(--transition-fast)',
    textTransform: 'uppercase' as const,
  },
  executingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
    minHeight: 44,
  },
  executingText: {
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  spinner: {
    width: 14,
    height: 14,
    border: '2px solid var(--border-base)',
    borderTopColor: 'var(--color-accent)',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 800ms linear infinite',
  },
  resultSuccess: {
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-profit)',
    flex: 1,
    textAlign: 'center' as const,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultError: {
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-loss)',
    flex: 1,
    textAlign: 'center' as const,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
