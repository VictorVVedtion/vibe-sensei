import type { TradingBalance } from '../../../shared/ipc-channels'

interface BalanceDisplayProps {
  balances: TradingBalance[]
  totalPortfolioValue: number
}

function formatUsd(n: number): string {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K'
  return '$' + n.toFixed(2)
}

function AllocationBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={styles.allocTrack}>
      <div
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: color,
          borderRadius: 0,

        }}
      />
    </div>
  )
}

const ASSET_COLORS: Record<string, string> = {
  USDT: '#26a17b',
  USDC: '#2775ca',
  BTC: '#f7931a',
  ETH: '#627eea',
  BNB: '#f3ba2f',
  SOL: '#9945ff',
  XRP: '#23292f',
}

function getAssetColor(currency: string): string {
  return ASSET_COLORS[currency.toUpperCase()] ?? '#00FF41'
}

export function BalanceDisplay({ balances, totalPortfolioValue }: BalanceDisplayProps) {
  const nonZeroBalances = balances.filter((b) => b.total > 0.01)

  return (
    <div style={styles.container}>
      <div style={styles.headerBar}>
        <span style={styles.title}>Balance</span>
      </div>
      <div style={styles.totalRow}>
        <span style={styles.totalLabel}>Portfolio Value</span>
        <span style={styles.totalValue}>{formatUsd(totalPortfolioValue)}</span>
      </div>
      {nonZeroBalances.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyText}>No balances</span>
        </div>
      ) : (
        <div style={styles.list}>
          {nonZeroBalances.map((bal) => {
            const pct =
              totalPortfolioValue > 0
                ? (bal.total / totalPortfolioValue) * 100
                : 0
            const color = getAssetColor(bal.currency)
            return (
              <div key={bal.currency} style={styles.assetRow}>
                <div style={styles.assetInfo}>
                  <span style={{ ...styles.assetName, color }}>{bal.currency}</span>
                  <span style={styles.assetAmount}>
                    {bal.total.toFixed(bal.total < 1 ? 6 : 2)}
                  </span>
                </div>
                <AllocationBar pct={pct} color={color} />
                <div style={styles.assetMeta}>
                  <span style={styles.assetPct}>{pct.toFixed(1)}%</span>
                  <span style={styles.assetBreakdown}>
                    Free: +{bal.free.toFixed(2)} / Used: -{bal.used.toFixed(2)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#0F1924',
    borderRadius: 0,
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
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '10px 10px 8px',
    borderBottom: '1px solid #182233',
  },
  totalLabel: {
    fontSize: 10,
    color: '#7B8AA0',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#00FF41',
    fontVariantNumeric: 'tabular-nums',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  assetRow: {
    padding: '6px 10px',
    borderBottom: '1px solid #182233',
  },
  assetInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  assetName: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  assetAmount: {
    fontSize: 11,
    color: '#E2E4ED',
    fontVariantNumeric: 'tabular-nums',
  },
  allocTrack: {
    height: 3,
    background: '#0A1628',
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: 2,
  },
  assetMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetPct: {
    fontSize: 9,
    color: '#7B8AA0',
    fontWeight: 600,
  },
  assetBreakdown: {
    fontSize: 8,
    color: '#7B8AA0',
  },
  empty: {
    padding: '12px 10px',
    textAlign: 'center' as const,
  },
  emptyText: {
    fontSize: 11,
    color: '#7B8AA0',
  },
}
