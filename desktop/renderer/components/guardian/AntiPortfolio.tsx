import { useEffect, useState } from 'react'
import type { AntiPortfolio, AntiPortfolioEntry } from '../../../shared/ipc-channels'

// ── localStorage persistence key ──────────────────────────────────────────

const STORAGE_KEY = 'vibesensei_anti_portfolio'

// ── Helpers ───────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`
  }
  return `$${amount.toFixed(2)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

function loadPersistedData(): AntiPortfolio | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AntiPortfolio
  } catch {
    return null
  }
}

function persistData(data: AntiPortfolio): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable — silently discard
  }
}

// ── Component ─────────────────────────────────────────────────────────────

interface AntiPortfolioCardProps {
  /** When true, hides internal header (used inside CollapsibleCard) */
  embedded?: boolean
}

export function AntiPortfolioCard({ embedded = false }: AntiPortfolioCardProps = {}) {
  const [data, setData] = useState<AntiPortfolio | null>(loadPersistedData)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api || typeof api.onAntiPortfolio !== 'function') return

    const cleanup = api.onAntiPortfolio((portfolio: AntiPortfolio) => {
      setData(portfolio)
      persistData(portfolio)
    })

    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [])

  if (!data || data.entries.length === 0) {
    return null // Don't render empty card
  }

  const masterName = (data as any).masterName ?? 'Guardian'
  const weeklySaved = (data as any).weeklySavedAmount ?? 0
  const weeklyBlocked = (data as any).weeklyBlocked ?? 0

  const containerStyle = embedded ? styles.containerEmbedded : styles.container

  return (
    <div style={containerStyle}>
      {!embedded && (
        <div style={styles.headerBar}>
          <span style={styles.title}>Shadow PnL</span>
          <span style={styles.badge}>{weeklyBlocked} blocked</span>
        </div>
      )}

      {/* Headline */}
      {weeklySaved > 0 && (
        <div style={styles.headline}>
          <span style={styles.headlineText}>
            {masterName} saved you{' '}
            <span style={styles.savedAmount}>{formatCurrency(weeklySaved)}</span>
            {' '}this week
          </span>
        </div>
      )}

      {/* Blocked trade list */}
      <div style={styles.list}>
        {data.entries.slice(0, 5).map((entry, i) => (
          <AntiPortfolioRow key={`${entry.symbol}-${entry.date}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  )
}

function AntiPortfolioRow({ entry }: { entry: AntiPortfolioEntry }) {
  const pnl = entry.missedPnl ?? 0
  const isLoss = pnl < 0
  const pnlColor = isLoss ? 'var(--color-profit)' : 'var(--color-loss)'
  const pnlLabel = isLoss
    ? `+${formatCurrency(Math.abs(pnl))} saved`
    : `-${formatCurrency(Math.abs(pnl))} missed`

  return (
    <div style={styles.row}>
      <div style={styles.rowLeft}>
        <span style={styles.symbol}>{entry.symbol.replace('/USDT', '')}</span>
        <span style={styles.reason}>{truncate(entry.reason, 40)}</span>
      </div>
      <div style={styles.rowRight}>
        <span style={{ ...styles.pnl, color: pnlColor }}>{pnlLabel}</span>
        <span style={styles.date}>{formatDate(entry.date)}</span>
      </div>
    </div>
  )
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '\u2026' : str
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-base)',
    overflow: 'hidden',
  },
  containerEmbedded: {
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
  badge: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--text-primary)',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    padding: '1px 6px',
    fontWeight: 600,
  },
  headline: {
    padding: '10px 12px 6px',
  },
  headlineText: {
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  savedAmount: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: 'var(--color-profit)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '6px 12px',
    borderBottom: '1px solid var(--border-subtle)',
    gap: 8,
  },
  rowLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  rowRight: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end' as const,
    gap: 2,
    flexShrink: 0,
  },
  symbol: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  reason: {
    fontFamily: 'var(--font-ui)',
    fontSize: 10,
    color: 'var(--text-tertiary)',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  pnl: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  date: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'var(--text-tertiary)',
  },
}
