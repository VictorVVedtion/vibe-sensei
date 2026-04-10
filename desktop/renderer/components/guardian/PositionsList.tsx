import type { TradingPosition } from '../../../shared/ipc-channels'

interface PositionsListProps {
  positions: TradingPosition[]
}

function formatNumber(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(decimals)
}

function formatPnl(n: number): string {
  const prefix = n >= 0 ? '+' : ''
  return `${prefix}${formatNumber(n)}`
}

function formatPct(n: number): string {
  const prefix = n >= 0 ? '+' : ''
  return `${prefix}${n.toFixed(2)}%`
}

function PositionRow({ position }: { position: TradingPosition }) {
  const isProfit = position.unrealizedPnl >= 0
  const pnlColor = isProfit ? 'var(--color-profit)' : 'var(--color-loss)'
  const sideColor = position.side === 'buy' ? 'var(--color-profit)' : 'var(--color-loss)'

  return (
    <div
      style={{
        ...styles.row,
        borderLeftColor: sideColor,
      }}
      aria-label={`${position.symbol} ${position.side} position, PnL ${position.unrealizedPnl >= 0 ? 'profit' : 'loss'} ${formatNumber(Math.abs(position.unrealizedPnl))}`}
    >
      <div style={styles.symbolCol}>
        <span style={styles.symbol}>{position.symbol}</span>
        <span style={{ ...styles.side, color: sideColor }}>
          {position.side.toUpperCase()}
        </span>
      </div>
      <div style={styles.detailCol}>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Qty</span>
          <span style={styles.detailValue}>{formatNumber(position.quantity, 4)}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Entry</span>
          <span style={styles.detailValue}>{formatNumber(position.entryPrice)}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Mark</span>
          <span style={styles.detailValue}>{formatNumber(position.currentPrice)}</span>
        </div>
      </div>
      <div style={styles.pnlCol}>
        <span style={{ ...styles.pnlValue, color: pnlColor }}>
          {formatPnl(position.unrealizedPnl)}
        </span>
        <span style={{ ...styles.pnlPct, color: pnlColor }}>
          {formatPct(position.unrealizedPnlPercent)}
        </span>
      </div>
    </div>
  )
}

export function PositionsList({ positions }: PositionsListProps) {
  if (positions.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.headerBar}>
          <span style={styles.title}>Positions</span>
          <span style={styles.count}>0</span>
        </div>
        <div style={styles.empty}>
          <span style={styles.emptyText}>No open positions</span>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerBar}>
        <span style={styles.title}>Positions</span>
        <span style={styles.count}>{positions.length}</span>
      </div>
      <div style={styles.list}>
        {positions.map((pos) => (
          <PositionRow key={pos.symbol + pos.side} position={pos} />
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-base)',
    overflow: 'hidden',
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'var(--bg-raised)',
    borderBottom: '1px solid var(--border-base)',
  },
  title: {
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  count: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--text-primary)',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    padding: '1px 6px',
    fontWeight: 600,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-subtle)',
    borderLeft: '2px solid transparent',
    gap: 10,
    transition: 'background 120ms ease',
    cursor: 'default',
  },
  symbolCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 60,
  },
  symbol: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  side: {
    fontFamily: 'var(--font-ui)',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  detailCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 4,
  },
  detailLabel: {
    fontFamily: 'var(--font-ui)',
    fontSize: 10,
    color: 'var(--text-tertiary)',
  },
  detailValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right' as const,
  },
  pnlCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 70,
  },
  pnlValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  pnlPct: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontVariantNumeric: 'tabular-nums',
  },
  empty: {
    padding: '20px 12px',
    textAlign: 'center' as const,
  },
  emptyText: {
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    color: 'var(--text-tertiary)',
  },
}
