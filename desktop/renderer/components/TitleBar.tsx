import { useCallback, useEffect, useState } from 'react'
import { useTradingState } from '../hooks/useTradingState'

declare global {
  interface Window {
    electronAPI: {
      getUdfPort: () => Promise<number>
      isUdfReady: () => Promise<boolean>
      onUdfReady: (callback: () => void) => () => void
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      isMaximized: () => Promise<boolean>
    }
  }
}

const isMac = navigator.userAgent.includes('Macintosh')

const VENUES = ['SPOT', 'PERP', 'OPT', 'STOCK', 'DEFI', 'PRED', 'FX'] as const
type Venue = (typeof VENUES)[number]

// ── Minimal SVG window controls (Windows/Linux) ───────────────────────────

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 10 10" width="10" height="10">
      <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
    </svg>
  )
}

function MaximizeIcon({ maximized }: { maximized: boolean }) {
  if (maximized) {
    return (
      <svg viewBox="0 0 10 10" width="10" height="10">
        <path
          d="M2 0h6v2h2v6H8v2H0V4h2V0zm1 1v2h5v5h1V2H3zm-2 3v5h6V4H1z"
          fill="currentColor"
          fillRule="evenodd"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 10 10" width="10" height="10">
      <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 10 10" width="10" height="10">
      <path d="M1 0L5 4L9 0L10 1L6 5L10 9L9 10L5 6L1 10L0 9L4 5L0 1Z" fill="currentColor" />
    </svg>
  )
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function formatPortfolioValue(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function computePnlPercent(current: number, initial: number): number {
  if (initial === 0) return 0
  return ((current - initial) / initial) * 100
}

// ── Venue Tab Chip ─────────────────────────────────────────────────────────

function VenueChip({
  venue,
  active,
  onClick,
}: {
  venue: Venue
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`venue-chip${active ? ' venue-chip-active' : ''}`}
      onClick={onClick}
      aria-label={`${venue} venue${active ? ' (active)' : ''}`}
      aria-pressed={active}
    >
      {venue}
      {active && <span className="venue-active-dot">{'\u25CF'}</span>}
    </button>
  )
}

// ── TitleBar ───────────────────────────────────────────────────────────────

const INITIAL_PORTFOLIO = 100_000

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const [activeVenue, setActiveVenue] = useState<Venue>('SPOT')
  const { state } = useTradingState()

  useEffect(() => {
    window.electronAPI?.isMaximized?.()?.then(setMaximized)?.catch(() => {})
  }, [])

  const handleMinimize = useCallback(() => {
    window.electronAPI?.minimizeWindow?.()
  }, [])

  const handleMaximize = useCallback(() => {
    window.electronAPI?.maximizeWindow?.()
    setMaximized((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    window.electronAPI?.closeWindow?.()
  }, [])

  const portfolioValue = state.totalPortfolioValue
  const pnlPct = computePnlPercent(portfolioValue, INITIAL_PORTFOLIO)
  const pnlPositive = pnlPct >= 0
  const activeCount = state.positions.length > 0 ? 1 : 1
  const venueCountLabel = `${activeCount}/7 VENUES`

  return (
    <div className={`title-bar${isMac ? ' macos' : ''}`}>
      {/* Left: Logo + Brand */}
      <div className="title-bar-left">
        <span className="material-symbols-outlined title-bar-logo-icon">account_tree</span>
        <span className="title-bar-brand">OCTOPUS <span style={{ color: 'rgba(255,255,255,0.4)' }}>//</span> VIBE SENSEI</span>
      </div>

      {/* Center: Venue Tabs */}
      <div className="title-bar-center">
        {VENUES.map((v) => (
          <VenueChip key={v} venue={v} active={v === activeVenue} onClick={() => setActiveVenue(v)} />
        ))}
      </div>

      {/* Right: Portfolio + Badges */}
      <div className="title-bar-right">
        <span className="title-bar-portfolio">{formatPortfolioValue(portfolioValue)}</span>
        <span className={`title-bar-pnl-badge${pnlPositive ? ' pnl-up' : ' pnl-down'}`}>
          {pnlPositive ? '+' : ''}{pnlPct.toFixed(2)}%
        </span>
        <span className="title-bar-paper-badge">PAPER MODE</span>
        <span className="title-bar-venue-count">
          <span className="venue-pulse-dot" />
          {venueCountLabel}
        </span>
      </div>

      {/* Window controls (Windows/Linux only) */}
      {!isMac && (
        <div className="window-controls">
          <button className="window-control-btn minimize" onClick={handleMinimize} aria-label="Minimize">
            <MinimizeIcon />
          </button>
          <button className="window-control-btn maximize" onClick={handleMaximize} aria-label={maximized ? 'Restore' : 'Maximize'}>
            <MaximizeIcon maximized={maximized} />
          </button>
          <button className="window-control-btn close" onClick={handleClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  )
}
