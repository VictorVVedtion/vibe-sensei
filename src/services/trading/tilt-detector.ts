/**
 * Tilt Detector — detects emotional trading patterns (tilt) from recent trade history.
 *
 * Singleton. Maintains a sliding window of the last 5 trade outcomes.
 * Triggers a WARNING (not a hard lock) when:
 *   - 3+ consecutive losses in the window, OR
 *   - 2 losses + position size escalation (>150% of rolling average)
 *
 * On tilt trigger:
 *   - Emits companion_speech with stern emotion + warning message
 *   - Emits tilt_state bridge message for the desktop sidebar
 *   - Plays Sosumi alert sound (macOS only)
 *
 * Auto-dismisses when the next trade is profitable.
 *
 * All errors are silently caught — the tilt detector must NEVER crash the trading engine.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface TradeOutcome {
  symbol: string
  side: 'buy' | 'sell'
  pnlPercent: number
  /** Position size in quote currency (quantity * price) */
  positionSize: number
  timestamp: number
  /** Leverage multiplier (for futures tilt detection). */
  leverage?: number
  /** Trading vertical (for vertical-specific tilt patterns). */
  vertical?: string
  /** Days to expiry for options positions (undefined for non-options). */
  daysToExpiry?: number
  /** Whether this is an options trade. */
  isOption?: boolean
}

export type TiltLevel = 'none' | 'warning'

export interface TiltStatus {
  level: TiltLevel
  triggers: string[]
  /** Timestamp of when tilt was first triggered, or 0 if none */
  triggeredAt: number
}

// ── Constants ───────────────────────────────────────────────────────────────

const WINDOW_SIZE = 5
const CONSECUTIVE_LOSS_THRESHOLD = 3
const SIZE_ESCALATION_THRESHOLD = 1.5 // 150% of average
const SIZE_ESCALATION_LOSS_COUNT = 2
const LEVERAGE_ESCALATION_WINDOW = 3
const LEVERAGE_ESCALATION_MIN_LOSSES = 2
const EXPIRY_CHASING_DTE = 7

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: TiltDetector | null = null

export function getTiltDetector(): TiltDetector {
  if (!instance) {
    instance = new TiltDetector()
  }
  return instance
}

/** Reset the singleton — primarily for testing. */
export function resetTiltDetector(): void {
  instance = null
}

// ── Detector ────────────────────────────────────────────────────────────────

const APING_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const APING_MIN_SWAPS = 3

export class TiltDetector {
  private window: TradeOutcome[] = []
  private status: TiltStatus = { level: 'none', triggers: [], triggeredAt: 0 }
  private defiSwapTimestamps: number[] = []

  /** Add a trade outcome and evaluate tilt conditions. */
  recordTrade(outcome: TradeOutcome): TiltStatus {
    // Slide window — keep last WINDOW_SIZE entries
    this.window.push(outcome)
    if (this.window.length > WINDOW_SIZE) {
      this.window = this.window.slice(-WINDOW_SIZE)
    }

    // Auto-dismiss: profitable trade clears tilt
    if (outcome.pnlPercent > 0) {
      if (this.status.level !== 'none') {
        this.status = { level: 'none', triggers: [], triggeredAt: 0 }
      }
      return this.getStatus()
    }

    // Evaluate tilt conditions
    const triggers: string[] = []

    // Condition 1: 3+ consecutive losses
    const consecutiveLosses = this.countConsecutiveLossesFromEnd()
    if (consecutiveLosses >= CONSECUTIVE_LOSS_THRESHOLD) {
      triggers.push(`${consecutiveLosses} consecutive losses`)
    }

    // Condition 2: 2+ losses + size escalation
    if (this.checkSizeEscalation()) {
      triggers.push('position size escalation during losses')
    }

    // Condition 3: leverage escalation on futures (3 trades with increasing leverage, 2+ losses)
    if (this.checkLeverageEscalation()) {
      triggers.push('leverage escalation on futures during losses')
    }

    // Condition 4: expiry chasing — buying options while existing options are losing AND within 7 DTE
    if (this.checkExpiryChasing(outcome)) {
      triggers.push('expiry chasing — buying options near expiry while losing')
    }

    if (triggers.length > 0) {
      this.status = {
        level: 'warning',
        triggers,
        triggeredAt: this.status.triggeredAt || Date.now(),
      }
    }

    return this.getStatus()
  }

  /** Get current tilt status without recording a trade. */
  getStatus(): TiltStatus {
    return { ...this.status, triggers: [...this.status.triggers] }
  }

  /** Get the current trade window (read-only copy). */
  getWindow(): readonly TradeOutcome[] {
    return [...this.window]
  }

  /** Reset the detector state. */
  reset(): void {
    this.window = []
    this.status = { level: 'none', triggers: [], triggeredAt: 0 }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /** Count consecutive losses from the most recent trade backwards. */
  private countConsecutiveLossesFromEnd(): number {
    let count = 0
    for (let i = this.window.length - 1; i >= 0; i--) {
      if (this.window[i]!.pnlPercent < 0) {
        count++
      } else {
        break
      }
    }
    return count
  }

  /**
   * Check for leverage escalation on perpetual futures.
   * Triggers when the last 3 perp_futures trades have strictly increasing
   * leverage AND at least 2 of them are losses.
   */
  private checkLeverageEscalation(): boolean {
    const futuresTrades = this.window.filter(
      t => t.vertical === 'perp_futures' && t.leverage !== undefined && t.leverage > 0,
    )

    if (futuresTrades.length < LEVERAGE_ESCALATION_WINDOW) return false

    const recent = futuresTrades.slice(-LEVERAGE_ESCALATION_WINDOW)

    // Check strictly increasing leverage
    for (let i = 1; i < recent.length; i++) {
      if (recent[i]!.leverage! <= recent[i - 1]!.leverage!) return false
    }

    // Check at least 2 losses among the 3
    const lossCount = recent.filter(t => t.pnlPercent < 0).length
    return lossCount >= LEVERAGE_ESCALATION_MIN_LOSSES
  }

  /**
   * Check for expiry chasing: buying more options when existing options
   * in the window are losing AND within 7 DTE.
   * Pattern: doubling down on expiring losers instead of cutting losses.
   */
  private checkExpiryChasing(latest: TradeOutcome): boolean {
    if (!latest.isOption || latest.side !== 'buy') return false
    if (latest.daysToExpiry === undefined) return false
    if (latest.daysToExpiry > EXPIRY_CHASING_DTE) return false

    // Check if there are existing losing options in the window
    const losingOptions = this.window.filter(
      (t) => t !== latest && t.isOption && t.pnlPercent < 0,
    )
    return losingOptions.length > 0
  }

  /**
   * Check for size escalation: at least 2 losing trades in the window,
   * and the latest losing trade's size is >150% of the average of all trades
   * in the window (excluding the latest).
   */
  private checkSizeEscalation(): boolean {
    if (this.window.length < 2) return false

    // Count recent losses
    const recentLosses = this.window.filter(t => t.pnlPercent < 0)
    if (recentLosses.length < SIZE_ESCALATION_LOSS_COUNT) return false

    // Compute average position size of all trades except the latest
    const priorTrades = this.window.slice(0, -1)
    if (priorTrades.length === 0) return false

    const avgSize =
      priorTrades.reduce((sum, t) => sum + t.positionSize, 0) / priorTrades.length
    if (avgSize <= 0) return false

    // Check if latest trade exceeds threshold
    const latest = this.window[this.window.length - 1]!
    return latest.positionSize > avgSize * SIZE_ESCALATION_THRESHOLD
  }

  /** Record a DEX swap timestamp for aping detection. */
  recordDefiSwap(timestamp?: number): void {
    const now = timestamp ?? Date.now()
    const cutoff = Date.now() - APING_WINDOW_MS
    this.defiSwapTimestamps = this.defiSwapTimestamps.filter(t => t > cutoff)
    this.defiSwapTimestamps.push(now)

    if (this.defiSwapTimestamps.length >= APING_MIN_SWAPS) {
      this.status = {
        level: 'warning',
        triggers: ['rapid DEX swaps (aping)'],
        triggeredAt: this.status.triggeredAt || now,
      }
    }
  }

  /** Check Martingale pattern on current window. */
  checkMartingale(): boolean {
    return detectMartingalePattern(this.window)
  }

  /** Get DEX swap timestamps (for testing). */
  getDefiSwapTimestamps(): number[] {
    return [...this.defiSwapTimestamps]
  }

  /** Reset all state. */
  reset(): void {
    this.window = []
    this.defiSwapTimestamps = []
    this.status = { level: 'none', triggers: [], triggeredAt: 0 }
  }
}

export function detectMartingalePattern(trades: TradeOutcome[]): boolean {
  if (trades.length < 3) return false

  // Find consecutive losses from the end
  const losses: TradeOutcome[] = []
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i]!.pnlPercent < 0) {
      losses.unshift(trades[i]!)
    } else {
      break
    }
  }

  if (losses.length < 3) return false

  // Check if each subsequent loss has >= 1.8x position size
  for (let i = 1; i < losses.length; i++) {
    if (losses[i]!.positionSize < losses[i - 1]!.positionSize * 1.8) {
      return false
    }
  }

  return true
}
