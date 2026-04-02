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
  const arrow = n >= 0 ? '\u25B2' : '\u25BC'
  const prefix = n >= 0 ? '+' : ''
  return `${arrow} ${prefix}${formatNumber(n)}`
}

function formatPct(n: number): string {
  const arrow = n >= 0 ? '\u25B2' : '\u25BC'
  const prefix = n >= 0 ? '+' : ''
  return `${arrow} ${prefix}${n.toFixed(2)}%`
}

function PositionRow({ position }: { position: TradingPosition }) {
  const isProfit = position.unrealizedPnl >= 0
  const pnlColor = isProfit ? '#00E5A0' : '#FF4D6A'
  const sideColor = position.side === 'buy' ? '#00D4FF' : '#FF4D6A'

  return (
    <div
      style={styles.row}
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
    background: '#0F1924',
    borderRadius: 6,
    border: '1px solid #253550',
    overflow: 'hidden',
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: '#0A1628',
    borderBottom: '1px solid #253550',
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
    borderRadius: 8,
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
    padding: '8px 10px',
    borderBottom: '1px solid #182233',
    gap: 8,
  },
  symbolCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 60,
  },
  symbol: {
    fontSize: 12,
    fontWeight: 600,
    color: '#E2E4ED',
  },
  side: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  detailCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 4,
  },
  detailLabel: {
    fontSize: 9,
    color: '#7B8AA0',
  },
  detailValue: {
    fontSize: 10,
    color: '#E2E4ED',
    fontVariantNumeric: 'tabular-nums',
  },
  pnlCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 1,
    minWidth: 60,
  },
  pnlValue: {
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  pnlPct: {
    fontSize: 10,
    fontVariantNumeric: 'tabular-nums',
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
