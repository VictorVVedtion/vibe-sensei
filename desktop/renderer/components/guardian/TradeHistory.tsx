import type { TradeHistoryEntry } from '../../../shared/ipc-channels'

interface TradeHistoryProps {
  trades: TradeHistoryEntry[]
  loading: boolean
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatPnl(pnl: number | undefined): string {
  if (pnl === undefined) return '--'
  const sign = pnl >= 0 ? '+' : ''
  return `${sign}${pnl.toFixed(2)}%`
}

// ── Trade Row ───────────────────────────────────────────────────────────

function TradeRow({ trade }: { trade: TradeHistoryEntry }) {
  const pnlColor = trade.outcome === 'profit'
    ? 'var(--primary-fixed)'
    : trade.outcome === 'loss'
      ? 'var(--error-dim)'
      : 'var(--text-tertiary)'

  const cleanSymbol = trade.symbol.replace('/USDT', '').replace('/USD', '')

  return (
    <div style={styles.row}>
      <span style={styles.asset}>{cleanSymbol}</span>
      <span style={styles.qty}>{trade.quantity.toFixed(4)}</span>
      <span style={{ ...styles.pnl, color: pnlColor }}>
        {formatPnl(trade.pnl)}
      </span>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────

export function TradeHistory({ trades, loading }: TradeHistoryProps) {
  if (loading) {
    return (
      <div style={styles.empty}>
        <span style={styles.emptyText}>LOADING...</span>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div style={styles.empty}>
        <span style={styles.emptyText}>NO TRADES</span>
      </div>
    )
  }

  return (
    <div style={styles.list}>
      {/* Column headers */}
      <div style={styles.headerRow}>
        <span style={styles.headerCell}>ASSET</span>
        <span style={styles.headerCell}>QTY</span>
        <span style={styles.headerCell}>P&L</span>
      </div>
      {trades.map((trade) => (
        <TradeRow key={trade.id} trade={trade} />
      ))}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto' as const,
    flex: 1,
    minHeight: 0,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderBottom: '1px solid rgba(156, 255, 147, 0.1)',
  },
  headerCell: {
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    fontWeight: 700,
    color: 'var(--text-tertiary)',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderBottom: '1px solid rgba(156, 255, 147, 0.05)',
  },
  asset: {
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  qty: {
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'var(--text-secondary)',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  pnl: {
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const,
    textAlign: 'right' as const,
  },
  empty: {
    padding: '16px 10px',
    textAlign: 'center' as const,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'var(--text-tertiary)',
    letterSpacing: 1,
  },
}
