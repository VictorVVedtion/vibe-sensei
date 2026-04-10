/**
 * Proactive Monitor — 4 trigger types that make trading masters speak unprompted.
 *
 * Trigger categories:
 *   1. SessionTimer    — rest reminders, late-night warnings
 *   2. BehaviorWatcher — revenge trading intervention, loss comfort
 *   3. MarketWatcher   — regime change notifications, portfolio heat warnings
 *   4. EncouragementWatcher — win streaks, discipline praise
 *
 * All checks are non-blocking. If any dependency (diary, exchange, regime)
 * is unavailable, that trigger category is silently skipped.
 */

import type { Archetype } from '../../buddy/persona.js'
import type { Emotion } from '../../buddy/sprite-atlas.js'
import { GuardianDiary, computeCumulativeStats } from '../../buddy/diary.js'
import { getLatestRegime } from '../market/regime.js'
import { getConnectedExchange } from '../exchange/singleton.js'
import { calculatePortfolioHeat } from '../portfolio/heat-calculator.js'
import type { ProactiveMessage, ProactiveSeverity, TriggerType } from './types.js'

// ── Message Templates ─────────────────────────────────────────────────────

/** Template with placeholders like {hours}, {count}. */
interface MessageTemplate {
  severity: ProactiveSeverity
  emotion: Emotion
  templates: Partial<Record<Archetype, string>>
  /** Fallback when archetype has no specific template. */
  fallback: string
}

const SESSION_REST_REMINDER: MessageTemplate = {
  severity: 'gentle',
  emotion: 'worried',
  templates: {
    value_investor: 'You\'ve been watching screens for {hours} hours. Buffett makes a few trades a year. Close the terminal, go think.',
    trend_follower: 'Trends don\'t change because you stare at them. {hours} hours in — take a break.',
    strategist: 'A wise general knows when to retreat. {hours} hours is enough — rest is part of the strategy.',
    philosopher: 'The market will still be there tomorrow. {hours} hours of attention is a tax on clarity.',
    quant: 'Fatigue degrades decision quality. {hours} hours of screen time detected. Step away from the model.',
    macro_trader: 'Macro moves take days, not minutes. You\'ve been here {hours} hours. Go read a book.',
    first_principles: 'First principle: your brain has limits. {hours} hours in — time to recharge.',
    crypto_native: '{hours} hours of chart-watching. The market is 24/7 but you are not. Touch grass.',
    scientist: 'Cognitive performance drops after sustained attention. {hours}h logged. Run a different experiment: sleep.',
  },
  fallback: 'You\'ve been trading for {hours} hours. Take a break — fresh eyes make better decisions.',
}

const SESSION_EXTENDED_WARNING: MessageTemplate = {
  severity: 'firm',
  emotion: 'stern',
  templates: {
    value_investor: '{hours} hours. This is not investing, this is gambling your attention. Stop.',
    trend_follower: 'You\'re overtrading your attention span at {hours} hours. The trend can wait.',
    strategist: '{hours} hours on the battlefield dulls the blade. Withdraw and sharpen.',
    philosopher: 'Seneca said: the whole future lies in uncertainty. {hours} hours won\'t change that. Rest.',
    quant: 'Warning: {hours}h session. Human error rate increases exponentially past 4 hours.',
    crypto_native: '{hours} hours deep. Even degens need sleep. Your PnL thanks you in advance.',
  },
  fallback: '{hours} hours is too long. Your judgment is compromised. Please stop and rest.',
}

const LATE_NIGHT_WARNING: MessageTemplate = {
  severity: 'firm',
  emotion: 'worried',
  templates: {
    value_investor: 'It\'s {hour}:00. Nothing good happens in markets after midnight. Sleep on it.',
    trend_follower: 'Late-night trading at {hour}:00 is a pattern that loses money. Wait for the morning session.',
    strategist: 'The hour is {hour}:00. Trading tired is fighting blind. Retreat to your quarters.',
    philosopher: 'At {hour}:00, your worst enemy is yourself. Put the charts away.',
    quant: 'Time: {hour}:00. Studies show 3x worse decision-making between midnight and 5 AM. Halt.',
    macro_trader: 'It\'s {hour}:00. The macro picture looks the same in the morning. Get some rest.',
    crypto_native: '{hour}:00 degen hours. Even CZ sleeps sometimes. Close the app.',
    scientist: 'Circadian data: {hour}:00 is peak error time. Shut down the lab.',
  },
  fallback: 'It\'s {hour}:00. Late-night trading leads to poor decisions. Come back tomorrow.',
}

const REVENGE_TRADING_INTERVENTION: MessageTemplate = {
  severity: 'urgent',
  emotion: 'stern',
  templates: {
    value_investor: 'Stop. You\'re chasing losses. Rule #1: Never lose money. Rule #2: Never forget Rule #1.',
    trend_follower: 'You\'re revenge trading. The trend doesn\'t care about your last loss. Walk away.',
    strategist: 'A general who fights out of anger loses the war. Step back from the battlefield.',
    philosopher: 'Pain is making you irrational. The market feels nothing — you feel everything. Pause.',
    quant: 'Data shows you\'re in emotional trading mode. The model doesn\'t revenge trade. Neither should you.',
    macro_trader: 'You\'re trying to get back what the market took. It doesn\'t work that way. Cool down.',
    first_principles: 'First principles: revenge trading has negative expected value. Stop.',
    crypto_native: 'Revenge trading is how portfolios go to zero. Touch grass. Come back clear-headed.',
    scientist: 'Emotional bias detected. The experiment is contaminated. Halt all trades.',
  },
  fallback: 'Stop. You\'re revenge trading. Step away and cool down before making more decisions.',
}

const AVERAGING_DOWN_WARNING: MessageTemplate = {
  severity: 'firm',
  emotion: 'worried',
  templates: {
    value_investor: 'Averaging down needs a thesis. If the thesis hasn\'t changed, be patient. If it has — stop adding.',
    trend_follower: 'Catching a falling knife. The trend is against you. Stop averaging down.',
    strategist: 'Adding to a losing position is reinforcing defeat. Reassess before committing more troops.',
    quant: 'Averaging down detected. Check if this is planned DCA or emotional bias. The data doesn\'t lie.',
    crypto_native: 'You\'re catching a falling knife. Set a max DCA limit or you\'ll bleed out.',
  },
  fallback: 'You\'re averaging down into a losing position. Make sure this is planned, not emotional.',
}

const CONSECUTIVE_LOSSES_COMFORT: MessageTemplate = {
  severity: 'gentle',
  emotion: 'worried',
  templates: {
    value_investor: '{count} losses in a row. Even Buffett has bad quarters. Review your thesis — don\'t abandon discipline.',
    trend_follower: '{count} consecutive stops hit. It happens. Reduce size until the streak breaks.',
    strategist: '{count} defeats in a row. Retreat is not surrender — it\'s repositioning.',
    philosopher: '{count} losses teach more than {count} wins. Reflect, then return stronger.',
    quant: '{count} consecutive losses. Within model parameters? If drawdown exceeds max, halt the system.',
    macro_trader: '{count} losses. The regime may have shifted. Step back and read the macro picture.',
    crypto_native: '{count} L\'s in a row. It\'s a rite of passage. Smaller size until the vibes improve.',
    scientist: '{count} failed experiments. Revise your hypothesis before the next trial.',
  },
  fallback: '{count} losses in a row. Take a moment. Review your strategy before continuing.',
}

const WIN_STREAK_PRAISE: MessageTemplate = {
  severity: 'gentle',
  emotion: 'happy',
  templates: {
    value_investor: '{count} wins in a row. Good investing is boring. Keep it that way.',
    trend_follower: '{count} straight winners. The trend is your friend — but don\'t get cocky. Keep your stops tight.',
    strategist: '{count} consecutive victories. But as Sun Tzu said: the supreme art of war is to subdue the enemy without fighting. Stay humble.',
    philosopher: '{count} wins. But remember — the market giveth and the market taketh. Stay antifragile.',
    quant: '{count} consecutive profitable trades. Edge confirmed. Maintain position sizing discipline.',
    macro_trader: '{count} wins in a row. You\'re reading the macro well. Don\'t let confidence become leverage.',
    first_principles: '{count} wins. Your reasoning is sound. But always question your assumptions.',
    crypto_native: '{count} dubs in a row. You\'re on fire. Don\'t ape into something stupid to celebrate.',
    scientist: '{count} successful experiments. The data supports your model. Continue with caution.',
  },
  fallback: '{count} consecutive wins. Great discipline. Don\'t let overconfidence creep in.',
}

const GOOD_R_MULTIPLE_PRAISE: MessageTemplate = {
  severity: 'gentle',
  emotion: 'happy',
  templates: {
    value_investor: 'Outstanding risk-reward on that trade. Patience pays.',
    trend_follower: 'Letting winners run — that\'s how it\'s done. Excellent R-multiple.',
    strategist: 'Superior positioning. Your risk-reward ratio on that trade was exemplary.',
    quant: 'R-multiple exceeds 2.0. This is what positive expectancy looks like. Well executed.',
    philosopher: 'You risked little and gained much. This is the essence of antifragility.',
    crypto_native: 'Massive R on that trade. You\'re cooking. Don\'t give it back.',
  },
  fallback: 'Excellent risk-reward ratio on that trade. This is disciplined trading at its best.',
}

const STOP_LOSS_DISCIPLINE_PRAISE: MessageTemplate = {
  severity: 'gentle',
  emotion: 'happy',
  templates: {
    value_investor: 'You honored your stop-loss. Protecting capital is the first rule.',
    trend_follower: 'Clean exit at your stop. Cutting losses fast is how trend followers survive.',
    strategist: 'Disciplined retreat. You live to fight another day.',
    quant: 'Stop-loss executed as planned. System integrity maintained.',
    philosopher: 'Accepting a small loss to prevent a large one — that\'s wisdom.',
  },
  fallback: 'Good discipline honoring your stop-loss. Capital preservation is everything.',
}

const REGIME_CHANGE_NOTIFICATION: MessageTemplate = {
  severity: 'firm',
  emotion: 'worried',
  templates: {
    value_investor: 'Market regime shift detected: {from} to {to}. Review whether your positions still make sense.',
    trend_follower: 'Regime change: {from} to {to}. Adjust your strategy. Old trends may be dead.',
    strategist: 'The terrain has changed: {from} to {to}. Reposition your forces accordingly.',
    macro_trader: 'Major regime shift: {from} to {to}. This changes the playbook. Reassess all positions.',
    quant: 'Regime transition: {from} to {to}. Model parameters may need recalibration.',
    crypto_native: 'Regime flipped from {from} to {to}. New meta incoming. Adapt or get rekt.',
    scientist: 'Environmental change detected: {from} to {to}. Update your experimental conditions.',
  },
  fallback: 'Market regime changed from {from} to {to}. Review your positions.',
}

const PORTFOLIO_HEAT_WARNING: MessageTemplate = {
  severity: 'firm',
  emotion: 'stern',
  templates: {
    value_investor: 'Portfolio heat at {heat}%. You\'re overexposed. Reduce or hedge.',
    trend_follower: 'Heat at {heat}%. Too much on the line. Trim losers and tighten stops.',
    strategist: 'Exposure at {heat}%. An overextended army is vulnerable. Consolidate.',
    quant: 'Portfolio heat: {heat}%. Exceeds risk parameters. Reduce exposure to restore target allocation.',
    macro_trader: 'Heat at {heat}%. In uncertain macro, this is reckless. De-risk.',
    crypto_native: '{heat}% heat. You\'re one liquidation cascade away from pain. Scale down.',
    philosopher: '{heat}% of capital at risk. Survival first, profits second.',
    scientist: 'Risk exposure at {heat}%. Well beyond safe experimental parameters. Reduce.',
  },
  fallback: 'Portfolio heat at {heat}%. You\'re overexposed. Consider reducing position sizes.',
}

// ── Template Resolver ─────────────────────────────────────────────────────

function resolveTemplate(
  template: MessageTemplate,
  archetype: Archetype,
  vars: Record<string, string | number>,
  trigger: TriggerType,
): ProactiveMessage {
  const raw = template.templates[archetype] ?? template.fallback
  let message = raw
  for (const [key, value] of Object.entries(vars)) {
    message = message.replaceAll(`{${key}}`, String(value))
  }
  return {
    trigger,
    severity: template.severity,
    message,
    emotion: template.emotion,
  }
}

// ── Cooldown Manager ──────────────────────────────────────────────────────

export class CooldownManager {
  private lastInterjection: number = 0
  private readonly cooldownMs: number

  constructor(cooldownMs: number = 300_000) {
    this.cooldownMs = cooldownMs
  }

  /** Whether a non-urgent message can be delivered now. */
  canSpeak(): boolean {
    return Date.now() - this.lastInterjection >= this.cooldownMs
  }

  /** Record that a message was just delivered. */
  recordSpeak(): void {
    this.lastInterjection = Date.now()
  }

  /** Get the epoch timestamp of the last interjection. */
  getLastSpeakTime(): number {
    return this.lastInterjection
  }

  /** Check if cooldown is currently blocking. */
  isOnCooldown(): boolean {
    return !this.canSpeak()
  }
}

// ── Trigger State ─────────────────────────────────────────────────────────

interface TriggerState {
  /** Whether the 2-hour rest reminder has been sent this session. */
  restReminderSent: boolean
  /** Whether the 4-hour extended warning has been sent this session. */
  extendedWarningSent: boolean
  /** Whether late-night warning was sent for the current late-night block. */
  lateNightWarningSent: boolean
  /** Last known regime per symbol (to detect changes). */
  lastKnownRegimes: Map<string, string>
  /** Last known portfolio heat percent (to detect threshold crossing). */
  lastKnownHeat: number
  /** Count of consecutive losses observed. */
  lastConsecutiveLosses: number
  /** Count of consecutive wins observed. */
  lastConsecutiveWins: number
  /** Whether revenge trading warning was sent recently. */
  revengeWarningSent: boolean
  /** Whether averaging-down warning was sent recently. */
  averagingDownWarningSent: boolean
  /** Last avgR seen (to only praise new highs). */
  lastAvgR: number
}

function createInitialState(): TriggerState {
  return {
    restReminderSent: false,
    extendedWarningSent: false,
    lateNightWarningSent: false,
    lastKnownRegimes: new Map(),
    lastKnownHeat: 0,
    lastConsecutiveLosses: 0,
    lastConsecutiveWins: 0,
    revengeWarningSent: false,
    averagingDownWarningSent: false,
    lastAvgR: 0,
  }
}

// ── Diary Singleton ───────────────────────────────────────────────────────

let diaryInstance: GuardianDiary | null = null

function getDiarySafe(): GuardianDiary | null {
  try {
    if (!diaryInstance) {
      diaryInstance = new GuardianDiary()
    }
    return diaryInstance
  } catch {
    return null
  }
}

// ── Proactive Monitor ─────────────────────────────────────────────────────

export class ProactiveMonitor {
  private readonly archetype: Archetype
  private readonly sessionStartTime: number
  private state: TriggerState

  constructor(archetype: Archetype, sessionStartTime: number) {
    this.archetype = archetype
    this.sessionStartTime = sessionStartTime
    this.state = createInitialState()
  }

  /**
   * Run all trigger checks and return the highest-priority message, or null.
   * Each check is wrapped in try/catch — failures are logged and skipped.
   */
  check(): ProactiveMessage | null {
    const results: ProactiveMessage[] = []

    try {
      const timeMsg = this.checkSessionTimer()
      if (timeMsg) results.push(timeMsg)
    } catch (err: unknown) {
      console.error('[ProactiveMonitor] SessionTimer error:', err instanceof Error ? err.message : err)
    }

    try {
      const behaviorMsg = this.checkBehaviorWatcher()
      if (behaviorMsg) results.push(behaviorMsg)
    } catch (err: unknown) {
      console.error('[ProactiveMonitor] BehaviorWatcher error:', err instanceof Error ? err.message : err)
    }

    try {
      const marketMsg = this.checkMarketWatcher()
      if (marketMsg) results.push(marketMsg)
    } catch (err: unknown) {
      console.error('[ProactiveMonitor] MarketWatcher error:', err instanceof Error ? err.message : err)
    }

    try {
      const encourageMsg = this.checkEncouragementWatcher()
      if (encourageMsg) results.push(encourageMsg)
    } catch (err: unknown) {
      console.error('[ProactiveMonitor] EncouragementWatcher error:', err instanceof Error ? err.message : err)
    }

    if (results.length === 0) return null

    // Priority: urgent > firm > gentle
    const severityRank: Record<ProactiveSeverity, number> = {
      urgent: 3,
      firm: 2,
      gentle: 1,
    }
    results.sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    return results[0]!
  }

  /** Reset trigger state (e.g. on session restart). */
  reset(): void {
    this.state = createInitialState()
  }

  /**
   * Async market checks that require exchange connection.
   * Called separately from the main synchronous check() when exchange is available.
   */
  async checkMarketAsync(): Promise<ProactiveMessage | null> {
    try {
      const exchange = await getConnectedExchange()
      const [positions, balances, openOrders] = await Promise.all([
        exchange.getPositions(),
        exchange.getBalance(),
        exchange.getOpenOrders(),
      ])

      const heat = calculatePortfolioHeat(positions, balances, openOrders)
      const heatPct = heat.heatPercent

      // Only warn when crossing the 60% threshold upward
      const HEAT_THRESHOLD = 60
      if (heatPct >= HEAT_THRESHOLD && this.state.lastKnownHeat < HEAT_THRESHOLD) {
        this.state.lastKnownHeat = heatPct
        return resolveTemplate(PORTFOLIO_HEAT_WARNING, this.archetype, {
          heat: Math.round(heatPct),
        }, 'market')
      }

      this.state.lastKnownHeat = heatPct
    } catch {
      // Exchange not connected or heat calculator unavailable — skip
    }

    return null
  }

  // ── 1. Session Timer ──────────────────────────────────────────────────

  private checkSessionTimer(): ProactiveMessage | null {
    const now = Date.now()
    const elapsedMs = now - this.sessionStartTime
    const elapsedHours = elapsedMs / (60 * 60 * 1000)

    // Extended session warning (>4 hours, sent once)
    if (elapsedHours >= 4 && !this.state.extendedWarningSent) {
      this.state.extendedWarningSent = true
      this.state.restReminderSent = true // also suppress the 2h reminder
      return resolveTemplate(SESSION_EXTENDED_WARNING, this.archetype, {
        hours: Math.floor(elapsedHours),
      }, 'time')
    }

    // Rest reminder (>2 hours, sent once)
    if (elapsedHours >= 2 && !this.state.restReminderSent) {
      this.state.restReminderSent = true
      return resolveTemplate(SESSION_REST_REMINDER, this.archetype, {
        hours: Math.floor(elapsedHours),
      }, 'time')
    }

    // Late-night check (00:00 - 05:00 local time)
    const localHour = new Date(now).getHours()
    if (localHour >= 0 && localHour < 5 && !this.state.lateNightWarningSent) {
      this.state.lateNightWarningSent = true
      return resolveTemplate(LATE_NIGHT_WARNING, this.archetype, {
        hour: localHour,
      }, 'time')
    }

    // Reset late-night flag when no longer in the late-night window
    if (localHour >= 5) {
      this.state.lateNightWarningSent = false
    }

    return null
  }

  // ── 2. Behavior Watcher ───────────────────────────────────────────────

  private checkBehaviorWatcher(): ProactiveMessage | null {
    const diary = getDiarySafe()
    if (!diary) return null

    const recentEntries = diary.getRecentEntries(20)
    if (recentEntries.length === 0) return null

    // Check for revenge trading pattern
    const revengeEntries = recentEntries.filter(e => e.patternType === 'revenge_trade')
    if (revengeEntries.length > 0 && !this.state.revengeWarningSent) {
      this.state.revengeWarningSent = true
      return resolveTemplate(REVENGE_TRADING_INTERVENTION, this.archetype, {}, 'behavior')
    }
    if (revengeEntries.length === 0) {
      this.state.revengeWarningSent = false
    }

    // Check for averaging down pattern
    const avgDownEntries = recentEntries.filter(
      e => e.patternType === 'averaging_down_bad',
    )
    if (avgDownEntries.length > 0 && !this.state.averagingDownWarningSent) {
      this.state.averagingDownWarningSent = true
      return resolveTemplate(AVERAGING_DOWN_WARNING, this.archetype, {}, 'behavior')
    }
    if (avgDownEntries.length === 0) {
      this.state.averagingDownWarningSent = false
    }

    // Check for consecutive losses
    let consecutiveLosses = 0
    for (const entry of recentEntries) {
      if (entry.outcome === 'loss') {
        consecutiveLosses++
      } else {
        break
      }
    }

    if (consecutiveLosses >= 3 && consecutiveLosses > this.state.lastConsecutiveLosses) {
      this.state.lastConsecutiveLosses = consecutiveLosses
      return resolveTemplate(CONSECUTIVE_LOSSES_COMFORT, this.archetype, {
        count: consecutiveLosses,
      }, 'behavior')
    }
    if (consecutiveLosses < this.state.lastConsecutiveLosses) {
      this.state.lastConsecutiveLosses = consecutiveLosses
    }

    return null
  }

  // ── 3. Market Watcher ─────────────────────────────────────────────────

  private checkMarketWatcher(): ProactiveMessage | null {
    // Regime change detection — uses cached data from getLatestRegime, no exchange call
    try {
      for (const symbol of ['BTC/USDT', 'ETH/USDT']) {
        const regime = getLatestRegime(symbol)
        if (!regime) continue

        const prevRegime = this.state.lastKnownRegimes.get(symbol)
        const currentRegime = regime.regime

        if (prevRegime && prevRegime !== currentRegime) {
          this.state.lastKnownRegimes.set(symbol, currentRegime)
          return resolveTemplate(REGIME_CHANGE_NOTIFICATION, this.archetype, {
            from: prevRegime.replace('_', ' '),
            to: currentRegime.replace('_', ' '),
          }, 'market')
        }

        this.state.lastKnownRegimes.set(symbol, currentRegime)
      }
    } catch {
      // Market regime module not available — skip
    }

    // Portfolio heat is checked async via checkMarketAsync()
    return null
  }

  // ── 4. Encouragement Watcher ──────────────────────────────────────────

  private checkEncouragementWatcher(): ProactiveMessage | null {
    const diary = getDiarySafe()
    if (!diary) return null

    const recentEntries = diary.getRecentEntries(20)
    if (recentEntries.length === 0) return null

    // Check for consecutive wins
    let consecutiveWins = 0
    for (const entry of recentEntries) {
      if (entry.outcome === 'profit') {
        consecutiveWins++
      } else {
        break
      }
    }

    if (consecutiveWins >= 3 && consecutiveWins > this.state.lastConsecutiveWins) {
      this.state.lastConsecutiveWins = consecutiveWins
      return resolveTemplate(WIN_STREAK_PRAISE, this.archetype, {
        count: consecutiveWins,
      }, 'encouragement')
    }
    if (consecutiveWins < this.state.lastConsecutiveWins) {
      this.state.lastConsecutiveWins = consecutiveWins
    }

    // Check for stop-loss discipline (most recent trade was a disciplined loss)
    const lastEntry = recentEntries[0]
    if (lastEntry && lastEntry.patternType === 'good_discipline' && lastEntry.outcome === 'loss') {
      return resolveTemplate(STOP_LOSS_DISCIPLINE_PRAISE, this.archetype, {}, 'encouragement')
    }

    // Check for good R-multiple via cumulative stats
    try {
      const stats = computeCumulativeStats()
      if (stats && stats.avgR > 2.0 && stats.avgR > this.state.lastAvgR) {
        this.state.lastAvgR = stats.avgR
        return resolveTemplate(GOOD_R_MULTIPLE_PRAISE, this.archetype, {}, 'encouragement')
      }
      if (stats) {
        this.state.lastAvgR = stats.avgR
      }
    } catch {
      // Stats not available — skip
    }

    return null
  }
}
