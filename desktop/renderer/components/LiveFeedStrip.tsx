import React from 'react'
import '../styles/live-feed.css'

// ── Placeholder Feed Data ───────────────────────────────────────────────────

interface FeedEntry {
  timestamp: string
  action: 'BUY' | 'SELL'
  amount: string
  pair: string
  source: string
  regime?: string
  regimeDir?: 'UP' | 'DOWN' | 'FLAT'
}

const PLACEHOLDER_ENTRIES: FeedEntry[] = [
  { timestamp: '14:02:11', action: 'BUY',  amount: '0.1',   pair: 'BTC',  source: 'BINANCE_SPOT',  regime: 'UP',   regimeDir: 'UP' },
  { timestamp: '14:01:58', action: 'SELL', amount: '2.5',   pair: 'ETH',  source: 'BINANCE_SPOT',  regime: 'DOWN', regimeDir: 'DOWN' },
  { timestamp: '14:01:42', action: 'BUY',  amount: '150',   pair: 'SOL',  source: 'BYBIT_PERP' },
  { timestamp: '14:01:30', action: 'SELL', amount: '0.05',  pair: 'BTC',  source: 'OKX_SPOT',      regime: 'FLAT', regimeDir: 'FLAT' },
  { timestamp: '14:01:15', action: 'BUY',  amount: '500',   pair: 'DOGE', source: 'BINANCE_SPOT' },
  { timestamp: '14:00:58', action: 'BUY',  amount: '10',    pair: 'AVAX', source: 'BYBIT_PERP',    regime: 'UP',   regimeDir: 'UP' },
  { timestamp: '14:00:41', action: 'SELL', amount: '1.2',   pair: 'ETH',  source: 'BINANCE_SPOT' },
  { timestamp: '14:00:22', action: 'BUY',  amount: '0.02',  pair: 'BTC',  source: 'OKX_SPOT',      regime: 'UP',   regimeDir: 'UP' },
  { timestamp: '14:00:05', action: 'SELL', amount: '80',    pair: 'SOL',  source: 'BYBIT_PERP',    regime: 'DOWN', regimeDir: 'DOWN' },
  { timestamp: '13:59:48', action: 'BUY',  amount: '3.0',   pair: 'LINK', source: 'BINANCE_SPOT' },
  { timestamp: '13:59:30', action: 'SELL', amount: '0.15',  pair: 'BTC',  source: 'BINANCE_SPOT',  regime: 'UP',   regimeDir: 'UP' },
  { timestamp: '13:59:12', action: 'BUY',  amount: '200',   pair: 'ADA',  source: 'OKX_SPOT' },
]

// ── Regime Arrow ─────────────────────────────────────────────────────────────

function regimeArrow(dir: 'UP' | 'DOWN' | 'FLAT'): string {
  if (dir === 'UP') return '\u25B2'
  if (dir === 'DOWN') return '\u25BC'
  return '\u25AC'
}

// ── Single Feed Entry ────────────────────────────────────────────────────────

function FeedEntryRow({ entry }: { entry: FeedEntry }) {
  const actionClass = entry.action === 'BUY' ? 'buy' : 'sell'
  return (
    <div className="live-feed-entry">
      <div className="feed-entry-action">
        <span className="feed-entry-timestamp">{entry.timestamp}</span>
        <span className={`feed-entry-label ${actionClass}`}>{entry.action}</span>
        <span className="feed-entry-pair">{entry.amount} {entry.pair}</span>
      </div>
      <div className="feed-entry-source">FROM: {entry.source}</div>
      {entry.regime && entry.regimeDir && (
        <div className="feed-entry-regime">
          REGIME: {entry.regime} {regimeArrow(entry.regimeDir)}
        </div>
      )}
    </div>
  )
}

// ── Live Feed Strip ──────────────────────────────────────────────────────────

export function LiveFeedStrip() {
  // Duplicate entries for seamless scroll loop
  const doubled = [...PLACEHOLDER_ENTRIES, ...PLACEHOLDER_ENTRIES]

  return (
    <div className="live-feed-strip">
      <div className="live-feed-entries">
        <div className="live-feed-scroll-inner">
          {doubled.map((entry, i) => (
            <FeedEntryRow key={i} entry={entry} />
          ))}
        </div>
      </div>

      <div className="live-feed-controls">
        <button className="feed-btn" type="button" aria-label="Execute trade">
          <span className="feed-btn-icon">{'\u25B6'}</span>
          EXEC
        </button>
        <button className="feed-btn feed-btn-forced-exit" type="button" aria-label="Force exit all positions">
          FORCED_EXIT
        </button>
        <button className="feed-btn feed-btn-sys-stat" type="button" aria-label="System status">
          <span className="feed-btn-icon">{'\u2630'}</span>
          SYS_STAT
        </button>
      </div>
    </div>
  )
}
