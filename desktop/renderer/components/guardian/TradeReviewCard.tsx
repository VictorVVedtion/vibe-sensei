import { useEffect, useRef } from 'react'
import type { TradeReview } from '../../../shared/ipc-channels'
import { AchievementBadge } from './AchievementBadge'

interface TradeReviewCardProps {
  review: TradeReview
  onDismiss: () => void
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : ''
  return `${sign}$${Math.abs(pnl).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatPrice(price: number): string {
  const abs = Math.abs(price)
  if (abs >= 1) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  if (abs === 0) return '0.00'
  const decimals = Math.max(2, Math.min(6, -Math.floor(Math.log10(abs)) + 2))
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// ── Colors (matching worktree palette) ──────────────────────────────────────

const C = {
  bg: '#0A0F0A',
  bgRaised: '#0D1117',
  border: '#002B0E',
  borderSubtle: '#001A08',
  textDim: '#008F11',
  textBright: '#00FF41',
  profit: '#00FF41',
  loss: '#FF003C',
  yellow: '#FFEA00',
  accent: '#00FF41',
  font: "'JetBrains Mono', monospace",
} as const

/**
 * R-multiple visual bar.
 * Green fill for positive R, red fill for negative R.
 * Scale: -2R to +3R mapped to 0-100%.
 */
function RMultipleBar({ rMultiple }: { rMultiple: number }) {
  const clampedR = Math.max(-2, Math.min(3, rMultiple))
  const percent = ((clampedR + 2) / 5) * 100
  const zeroPoint = (2 / 5) * 100
  const isPositive = clampedR >= 0

  const barLeft = isPositive ? `${zeroPoint}%` : `${percent}%`
  const barWidth = isPositive
    ? `${percent - zeroPoint}%`
    : `${zeroPoint - percent}%`

  return (
    <div style={styles.rBarContainer}>
      <div style={styles.rBarTrack}>
        <div style={{ ...styles.rBarZeroLine, left: `${zeroPoint}%` }} />
        <div
          style={{
            ...styles.rBarFill,
            left: barLeft,
            width: barWidth,
            background: isPositive ? C.profit : C.loss,
          }}
        />
      </div>
      <div style={styles.rBarLabels}>
        <span style={styles.rBarLabel}>-2R</span>
        <span style={styles.rBarLabel}>0</span>
        <span style={styles.rBarLabel}>+3R</span>
      </div>
    </div>
  )
}

function PatternBadge({ pattern }: { pattern: string }) {
  return <span style={styles.patternBadge}>{pattern}</span>
}

export function TradeReviewCard({ review, onDismiss }: TradeReviewCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateX(20px)'
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 300ms ease, transform 300ms ease'
      el.style.opacity = '1'
      el.style.transform = 'translateX(0)'
    })
  }, [])

  const sideLabel = review.side === 'buy' ? 'LONG' : 'SHORT'
  const sideColor = review.side === 'buy' ? C.profit : C.loss
  const pnlColor = (review.pnl ?? 0) >= 0 ? C.profit : C.loss
  const patternLessons = review.lessons.filter((l) => l.length > 0)

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Header */}
      <div style={styles.headerBar}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>TRADE REVIEW</span>
          {review.masterName && (
            <span style={styles.masterLabel}>by {review.masterName}</span>
          )}
        </div>
        <button
          style={styles.dismissBtn}
          onClick={onDismiss}
          aria-label="Dismiss trade review"
        >
          [x]
        </button>
      </div>

      {/* Trade Summary */}
      <div style={styles.summaryRow}>
        <div style={styles.symbolGroup}>
          <span style={styles.symbol}>{review.symbol}</span>
          <span style={{ ...styles.sideTag, color: sideColor, borderColor: sideColor }}>
            {sideLabel}
          </span>
        </div>
        {review.holdDuration && (
          <span style={styles.duration}>{review.holdDuration}</span>
        )}
      </div>

      {/* Price & PnL */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>ENTRY</span>
          <span style={styles.metricValue}>${formatPrice(review.entryPrice)}</span>
        </div>
        {review.exitPrice !== undefined && (
          <div style={styles.metricItem}>
            <span style={styles.metricLabel}>EXIT</span>
            <span style={styles.metricValue}>${formatPrice(review.exitPrice)}</span>
          </div>
        )}
        {review.pnl !== undefined && (
          <div style={styles.metricItem}>
            <span style={styles.metricLabel}>PNL</span>
            <span style={{ ...styles.metricValue, color: pnlColor }}>
              {formatPnl(review.pnl)}
              {review.pnlPercent !== undefined && (
                <span style={styles.pnlPercent}>
                  {' '}({review.pnlPercent > 0 ? '+' : ''}{review.pnlPercent.toFixed(2)}%)
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* R-Multiple Bar */}
      {review.rMultiple !== undefined && (
        <div style={styles.rSection}>
          <div style={styles.rHeader}>
            <span style={styles.metricLabel}>R-MULTIPLE</span>
            <span style={{
              ...styles.rValue,
              color: review.rMultiple >= 0 ? C.profit : C.loss,
            }}>
              {review.rMultiple > 0 ? '+' : ''}{review.rMultiple.toFixed(2)}R
            </span>
          </div>
          <RMultipleBar rMultiple={review.rMultiple} />
        </div>
      )}

      {/* MAE / MFE / Efficiency */}
      {(review.mae !== undefined || review.mfe !== undefined || review.efficiencyRatio !== undefined) && (
        <div style={styles.statsRow}>
          {review.mae !== undefined && (
            <div style={styles.statChip}>
              <span style={styles.statLabel}>MAE</span>
              <span style={{ ...styles.statValue, color: C.loss }}>
                {review.mae.toFixed(2)}%
              </span>
            </div>
          )}
          {review.mfe !== undefined && (
            <div style={styles.statChip}>
              <span style={styles.statLabel}>MFE</span>
              <span style={{ ...styles.statValue, color: C.profit }}>
                +{Math.abs(review.mfe).toFixed(2)}%
              </span>
            </div>
          )}
          {review.efficiencyRatio !== undefined && (
            <div style={styles.statChip}>
              <span style={styles.statLabel}>EFF</span>
              <span style={styles.statValue}>{review.efficiencyRatio}%</span>
            </div>
          )}
        </div>
      )}

      {/* Guardian Commentary */}
      <div style={styles.commentarySection}>
        <p style={styles.commentary}>{review.masterVerdict}</p>
      </div>

      {/* Pattern Badges */}
      {patternLessons.length > 0 && (
        <div style={styles.patternsRow}>
          {patternLessons.map((lesson, i) => (
            <PatternBadge key={i} pattern={lesson} />
          ))}
        </div>
      )}

      {/* Achievement Badges */}
      {review.achievements && review.achievements.length > 0 && (
        <div style={styles.achievementsSection}>
          {review.achievements.map((achievement) => (
            <AchievementBadge key={achievement.id} achievement={achievement} />
          ))}
        </div>
      )}

      {/* Auto-dismiss progress bar */}
      <div style={styles.progressTrack}>
        <div style={styles.progressFill} />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: C.font,
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 8px',
    borderBottom: `1px solid ${C.border}`,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 9,
    fontWeight: 700,
    color: C.textDim,
    letterSpacing: 1,
  },
  masterLabel: {
    fontSize: 9,
    color: C.textDim,
    opacity: 0.7,
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: C.textDim,
    cursor: 'pointer',
    fontFamily: C.font,
    fontSize: 9,
    padding: '1px 2px',
    lineHeight: 1,
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px 2px',
  },
  symbolGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  symbol: {
    fontSize: 12,
    fontWeight: 700,
    color: C.textBright,
  },
  sideTag: {
    fontSize: 9,
    fontWeight: 700,
    border: '1px solid',
    padding: '0px 3px',
    letterSpacing: 0.5,
  },
  duration: {
    fontSize: 9,
    color: C.textDim,
    fontVariantNumeric: 'tabular-nums',
  },
  metricsGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 10,
    padding: '4px 8px 6px',
  },
  metricItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: C.textDim,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 11,
    fontWeight: 700,
    color: C.textBright,
    fontVariantNumeric: 'tabular-nums',
  },
  pnlPercent: {
    fontSize: 9,
    fontWeight: 500,
  },
  rSection: {
    padding: '2px 8px 6px',
  },
  rHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  rValue: {
    fontSize: 11,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  rBarContainer: {
    width: '100%',
  },
  rBarTrack: {
    position: 'relative' as const,
    height: 4,
    background: C.borderSubtle,
    overflow: 'hidden',
  },
  rBarZeroLine: {
    position: 'absolute' as const,
    top: 0,
    width: 1,
    height: '100%',
    background: C.border,
  },
  rBarFill: {
    position: 'absolute' as const,
    top: 0,
    height: '100%',
    transition: 'width 400ms ease',
  },
  rBarLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  rBarLabel: {
    fontSize: 7,
    color: C.textDim,
    opacity: 0.5,
  },
  statsRow: {
    display: 'flex',
    gap: 6,
    padding: '0 8px 6px',
    flexWrap: 'wrap' as const,
  },
  statChip: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    background: C.bgRaised,
    padding: '2px 4px',
    border: `1px solid ${C.borderSubtle}`,
  },
  statLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: C.textDim,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 10,
    fontWeight: 700,
    color: C.textBright,
    fontVariantNumeric: 'tabular-nums',
  },
  commentarySection: {
    padding: '4px 8px 6px',
    borderTop: `1px solid ${C.borderSubtle}`,
  },
  commentary: {
    fontSize: 10,
    lineHeight: 1.5,
    color: C.textDim,
    margin: 0,
    fontStyle: 'italic' as const,
  },
  patternsRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 3,
    padding: '0 8px 6px',
  },
  patternBadge: {
    fontSize: 8,
    color: C.textDim,
    background: C.bgRaised,
    padding: '1px 4px',
    border: `1px solid ${C.borderSubtle}`,
  },
  achievementsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: '0 8px 6px',
  },
  progressTrack: {
    height: 1,
    background: C.borderSubtle,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: C.accent,
    animation: 'review-dismiss 60s linear forwards',
    width: '100%',
  },
}
