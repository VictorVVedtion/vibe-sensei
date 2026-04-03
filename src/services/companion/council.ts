/**
 * Async Master Council — background debates triggered by portfolio risk.
 *
 * When portfolio heat rises, positions concentrate, or market regime shifts,
 * 2-3 masters automatically convene and debate the situation. Uses pre-defined
 * stance templates per archetype — NO external AI API calls.
 *
 * Extends the existing debate concept (src/buddy/debate.ts) but runs
 * asynchronously with its own 30-minute cooldown, independent of the
 * ProactiveMonitor's cooldown.
 *
 * Integration: called from CompanionEngine's 60-second polling loop.
 */

import type { Archetype } from '../../buddy/persona.js'
import { getMasterArchetype } from '../../buddy/persona.js'
import type { Master } from '../../buddy/types.js'
import { MASTERS, MASTER_NAMES } from '../../buddy/types.js'
import { getConnectedExchange } from '../exchange/singleton.js'
import { calculatePortfolioHeat } from '../portfolio/heat-calculator.js'
import { getLatestRegime } from '../market/regime.js'

// ── Types ──────────────────────────────────────────────────────────────────

/** Trigger reasons that can convene a council. */
export type CouncilTrigger = 'high_risk' | 'concentration' | 'regime_change'

/** A master's stance in the council debate. */
export interface CouncilMasterStance {
  name: string
  archetype: Archetype
  stance: string
}

/** Result of a council session. */
export interface CouncilResult {
  trigger: CouncilTrigger
  triggerDetail: string
  masters: CouncilMasterStance[]
  conclusion: string
  recommendation: 'reduce' | 'hold' | 'watch' | 'none'
}

/** Context passed to shouldConvene and convene. */
export interface CouncilContext {
  /** The user's assigned guardian master (excluded from council selection). */
  userMaster: Master
  /** Current portfolio heat percentage (0-100). */
  portfolioHeat: number
  /** Largest single position as percentage of portfolio (0-100). */
  maxPositionPercent: number
  /** Whether a market regime change was detected since last check. */
  regimeChanged: boolean
  /** Previous regime label (if changed). */
  previousRegime: string | null
  /** Current regime label (if changed). */
  currentRegime: string | null
}

// ── Stance Templates ───────────────────────────────────────────────────────

/**
 * Pre-defined stance templates for each archetype in each trigger scenario.
 * Placeholders: {heat}, {maxPos}, {regime}, {prevRegime}, {suggested}
 *
 * 3 scenarios x 9 archetypes each.
 */
const COUNCIL_STANCES: Record<CouncilTrigger, Partial<Record<Archetype, string>>> = {
  high_risk: {
    value_investor:
      'Risk is too high at {heat}% portfolio heat. Graham taught us: the essence of investment is the management of risks, not returns. Reduce exposure immediately.',
    trend_follower:
      'If the trend is still intact, the position stays. The question is not heat at {heat}% — the question is whether your stops are set. No stop? Then yes, cut.',
    macro_trader:
      'At {heat}% heat, one macro shock wipes you out. I have seen this before — size the position for survival, not for glory.',
    quant:
      'Current portfolio heat stands at {heat}%. Our volatility models suggest optimal exposure should not exceed {suggested}% in this regime. Rebalance.',
    philosopher:
      '{heat}% of capital at risk. Seneca warned: it is not that we have a short time to live, but that we waste a great deal of it. Protect what you have.',
    strategist:
      'An army that extends all its forces at {heat}% exposure invites encirclement. Pull back to defensible lines.',
    first_principles:
      'First principles: {heat}% heat means you need everything to go right. That is hope, not strategy. Reduce.',
    crypto_native:
      '{heat}% heat? One liquidation cascade and you are done. This is not diamond hands — this is recklessness.',
    scientist:
      'Risk exposure at {heat}% exceeds safe experimental parameters. No responsible scientist would risk the entire lab on a single experiment.',
  },

  concentration: {
    value_investor:
      'One position is {maxPos}% of your portfolio. Even Buffett diversifies across sectors. Do not let conviction become blindness.',
    trend_follower:
      'Concentrated at {maxPos}% in one name — if the trend breaks, the damage is catastrophic. Spread the risk across multiple setups.',
    macro_trader:
      '{maxPos}% in a single position is a bet, not a portfolio. Druckenmiller concentrated, yes — but he also knew when to run.',
    quant:
      'Position concentration at {maxPos}% violates basic portfolio theory. Kelly criterion caps optimal position size well below this. Trim.',
    philosopher:
      'Putting {maxPos}% into one position — you are not trading, you are gambling. Antifragility requires diversification of risk.',
    strategist:
      '{maxPos}% on a single front. If it falls, your entire campaign collapses. Distribute your forces.',
    first_principles:
      'A {maxPos}% single-position bet means your portfolio is really one trade. Ask: would you put everything on this one thesis?',
    crypto_native:
      '{maxPos}% in one token? That is how people go from hero to zero in crypto. Spread it out.',
    scientist:
      'Concentration at {maxPos}%: a single experiment with no control group. If this fails, you lose all your data.',
  },

  regime_change: {
    value_investor:
      'Market shifted from {prevRegime} to {regime}. Templeton said the four most dangerous words are "this time it\'s different." Reassess every position.',
    trend_follower:
      'Regime change: {prevRegime} to {regime}. Old trends are dead. Wait for new signals before adding. Protect open profits.',
    macro_trader:
      'Major regime transition: {prevRegime} to {regime}. The macro playbook just changed. Reassess all positions against the new reality.',
    quant:
      'Regime shift detected: {prevRegime} to {regime}. Model parameters calibrated for the old regime may produce false signals. Recalibrate before acting.',
    philosopher:
      'The market has transformed from {prevRegime} to {regime}. As Heraclitus said, you cannot step in the same river twice. Adapt or be swept away.',
    strategist:
      'The terrain has changed: {prevRegime} to {regime}. What worked before may now be a trap. Scout the new ground before committing.',
    first_principles:
      'Regime change from {prevRegime} to {regime}. Revisit your assumptions from first principles — the foundation may have shifted.',
    crypto_native:
      'Regime flipped: {prevRegime} to {regime}. New meta incoming. The plays that printed last month might be the plays that get rekt this month.',
    scientist:
      'Environmental conditions changed: {prevRegime} to {regime}. Previous experimental results may not replicate. Pause and redesign.',
  },
}

// ── Archetype Selection Map ────────────────────────────────────────────────

/**
 * For each trigger, which archetype pairs should debate.
 * First is the conservative/cautious voice, second is the aggressive/opportunistic voice.
 * A third archetype is added for balance.
 */
const COUNCIL_ARCHETYPE_PICKS: Record<CouncilTrigger, Archetype[]> = {
  high_risk: ['value_investor', 'trend_follower', 'philosopher'],
  concentration: ['value_investor', 'macro_trader', 'quant'],
  regime_change: ['macro_trader', 'quant', 'trend_follower'],
}

// ── Conclusion Templates ───────────────────────────────────────────────────

const CONCLUSION_TEMPLATES: Record<CouncilTrigger, Record<'reduce' | 'hold' | 'watch', string>> = {
  high_risk: {
    reduce: 'The council recommends reducing exposure. Portfolio heat exceeds safe limits.',
    hold: 'Opinions are split. Hold current positions but tighten stops immediately.',
    watch: 'Risk is elevated but manageable. Monitor closely and be ready to act.',
  },
  concentration: {
    reduce: 'The council recommends trimming the concentrated position and diversifying.',
    hold: 'Concentration is high but the thesis is strong. Set a hard stop and reassess in 24h.',
    watch: 'Position size is notable. Watch for any thesis-breaking developments.',
  },
  regime_change: {
    reduce: 'The council recommends reducing positions until the new regime stabilizes.',
    hold: 'Regime changed but positions still align. Hold with caution.',
    watch: 'New regime detected. Watch for confirmation before making changes.',
  },
}

// ── FNV-1a Hash (deterministic random) ─────────────────────────────────────

function fnv1a(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ── Internal State for Regime Tracking ─────────────────────────────────────

interface RegimeState {
  lastKnownRegimes: Map<string, string>
}

// ── AsyncCouncil ───────────────────────────────────────────────────────────

export class AsyncCouncil {
  /** Epoch timestamp of the last council session. */
  private lastCouncilTime: number = 0

  /** 30-minute cooldown between council sessions. */
  private readonly COUNCIL_COOLDOWN = 30 * 60 * 1000

  /** High-risk heat threshold: portfolio heat > 60%. */
  private readonly HEAT_THRESHOLD = 60

  /** Concentration threshold: single position > 30% of portfolio. */
  private readonly CONCENTRATION_THRESHOLD = 30

  /** Regime tracking state for detecting changes. */
  private readonly regimeState: RegimeState = {
    lastKnownRegimes: new Map(),
  }

  /**
   * Check whether a council should be convened.
   *
   * Trigger conditions:
   * 1. Portfolio heat > 60%
   * 2. Single position > 30% of portfolio
   * 3. Market regime change detected
   * 4. Must respect 30-minute cooldown
   */
  shouldConvene(context: CouncilContext): boolean {
    // Cooldown check
    const elapsed = Date.now() - this.lastCouncilTime
    if (this.lastCouncilTime > 0 && elapsed < this.COUNCIL_COOLDOWN) {
      return false
    }

    // Trigger 1: high portfolio heat
    if (context.portfolioHeat > this.HEAT_THRESHOLD) {
      return true
    }

    // Trigger 2: concentrated position
    if (context.maxPositionPercent > this.CONCENTRATION_THRESHOLD) {
      return true
    }

    // Trigger 3: regime change
    if (context.regimeChanged) {
      return true
    }

    return false
  }

  /**
   * Convene the council: select 2-3 relevant masters, generate their stances
   * from templates, produce a conclusion, and return the result.
   *
   * IMPORTANT: No external AI API calls. All content is from pre-defined templates.
   */
  async convene(context: CouncilContext): Promise<CouncilResult> {
    const trigger = this.determineTrigger(context)
    const triggerDetail = this.buildTriggerDetail(trigger, context)
    const selectedMasters = this.selectMasters(trigger, context.userMaster)
    const masterStances = this.buildStances(trigger, selectedMasters, context)
    const recommendation = this.determineRecommendation(trigger, context)
    const conclusion = CONCLUSION_TEMPLATES[trigger][recommendation]

    // Update cooldown timestamp
    this.lastCouncilTime = Date.now()

    return {
      trigger,
      triggerDetail,
      masters: masterStances,
      conclusion,
      recommendation,
    }
  }

  /**
   * Build a CouncilContext by querying the exchange and regime engine.
   * Called from CompanionEngine's polling loop to gather fresh data.
   * Returns null if exchange is unavailable.
   */
  async buildContext(userMaster: Master): Promise<CouncilContext | null> {
    try {
      const exchange = await getConnectedExchange()
      const [positions, balances, openOrders] = await Promise.all([
        exchange.getPositions(),
        exchange.getBalance(),
        exchange.getOpenOrders(),
      ])

      // Portfolio heat
      const heat = calculatePortfolioHeat(positions, balances, openOrders)

      // Compute total equity for concentration check
      let totalEquity = 0
      for (const b of balances) {
        totalEquity += b.total
      }

      // Find largest single position as percentage of total equity
      let maxPositionPercent = 0
      for (const p of positions) {
        const posValue = Math.abs(p.currentPrice * p.quantity)
        const pct = totalEquity > 0 ? (posValue / totalEquity) * 100 : 0
        if (pct > maxPositionPercent) {
          maxPositionPercent = pct
        }
      }

      // Detect regime changes
      let regimeChanged = false
      let previousRegime: string | null = null
      let currentRegime: string | null = null

      try {
        for (const symbol of ['BTC/USDT', 'ETH/USDT']) {
          const regime = getLatestRegime(symbol)
          if (!regime) continue

          const prev = this.regimeState.lastKnownRegimes.get(symbol)
          if (prev && prev !== regime.regime) {
            regimeChanged = true
            previousRegime = prev
            currentRegime = regime.regime
          }
          this.regimeState.lastKnownRegimes.set(symbol, regime.regime)
        }
      } catch {
        // Regime module unavailable — skip regime detection
      }

      return {
        userMaster,
        portfolioHeat: heat.heatPercent,
        maxPositionPercent,
        regimeChanged,
        previousRegime,
        currentRegime,
      }
    } catch {
      // Exchange not connected — cannot build context
      return null
    }
  }

  /**
   * Format a CouncilResult as a message string for delivery via pushMessage.
   */
  formatMessage(result: CouncilResult): string {
    const lines: string[] = []

    lines.push(`>> COUNCIL \u2014 ${result.triggerDetail}`)
    lines.push('')

    for (const master of result.masters) {
      lines.push(`${master.name}: "${master.stance}"`)
    }

    lines.push('')
    lines.push(`Conclusion: ${result.conclusion}`)

    return lines.join('\n')
  }

  // ── Private Methods ────────────────────────────────────────────────────

  /**
   * Determine the primary trigger based on context.
   * Priority: high_risk > concentration > regime_change
   */
  private determineTrigger(context: CouncilContext): CouncilTrigger {
    if (context.portfolioHeat > this.HEAT_THRESHOLD) {
      return 'high_risk'
    }
    if (context.maxPositionPercent > this.CONCENTRATION_THRESHOLD) {
      return 'concentration'
    }
    return 'regime_change'
  }

  /**
   * Build a human-readable trigger detail string.
   */
  private buildTriggerDetail(trigger: CouncilTrigger, context: CouncilContext): string {
    switch (trigger) {
      case 'high_risk':
        return `Portfolio heat at ${Math.round(context.portfolioHeat)}%`
      case 'concentration':
        return `Single position at ${Math.round(context.maxPositionPercent)}% of portfolio`
      case 'regime_change':
        return `Market regime: ${context.previousRegime ?? 'unknown'} \u2192 ${context.currentRegime ?? 'unknown'}`
    }
  }

  /**
   * Select 2-3 masters for the council based on trigger type.
   *
   * Logic:
   * 1. Get the archetype list for this trigger
   * 2. For each archetype, find all masters of that archetype (excluding userMaster)
   * 3. Pick one representative from each archetype deterministically
   * 4. Return 2-3 masters
   */
  private selectMasters(trigger: CouncilTrigger, userMaster: Master): Master[] {
    const targetArchetypes = COUNCIL_ARCHETYPE_PICKS[trigger]
    const selected: Master[] = []
    const seed = fnv1a(userMaster + trigger + String(Math.floor(Date.now() / this.COUNCIL_COOLDOWN)))

    for (let i = 0; i < targetArchetypes.length && selected.length < 3; i++) {
      const archetype = targetArchetypes[i]!
      const candidates = MASTERS.filter((m) => {
        if (m === userMaster) return false
        if (selected.includes(m)) return false
        return getMasterArchetype(m) === archetype
      })

      if (candidates.length > 0) {
        const pick = candidates[(seed + i) % candidates.length]!
        selected.push(pick)
      }
    }

    // Ensure at least 2 masters
    if (selected.length < 2) {
      const fallbackCandidates = MASTERS.filter((m) => {
        if (m === userMaster) return false
        if (selected.includes(m)) return false
        return true
      })
      while (selected.length < 2 && fallbackCandidates.length > 0) {
        const idx = (seed + selected.length) % fallbackCandidates.length
        selected.push(fallbackCandidates[idx]!)
        fallbackCandidates.splice(idx, 1)
      }
    }

    return selected
  }

  /**
   * Build stance strings for each selected master.
   *
   * Uses the template for the master's archetype in the given trigger scenario.
   * Falls back to the value_investor template if the archetype has no template.
   */
  private buildStances(
    trigger: CouncilTrigger,
    masters: Master[],
    context: CouncilContext,
  ): CouncilMasterStance[] {
    const templates = COUNCIL_STANCES[trigger]
    const suggested = this.suggestedExposure(context.portfolioHeat)

    return masters.map((master) => {
      const archetype = getMasterArchetype(master)
      const template = templates[archetype] ?? templates.value_investor ?? ''

      const stance = template
        .replaceAll('{heat}', String(Math.round(context.portfolioHeat)))
        .replaceAll('{maxPos}', String(Math.round(context.maxPositionPercent)))
        .replaceAll('{regime}', context.currentRegime?.replace(/_/g, ' ') ?? 'unknown')
        .replaceAll('{prevRegime}', context.previousRegime?.replace(/_/g, ' ') ?? 'unknown')
        .replaceAll('{suggested}', String(suggested))

      return {
        name: MASTER_NAMES[master],
        archetype,
        stance,
      }
    })
  }

  /**
   * Determine the recommendation based on trigger severity.
   */
  private determineRecommendation(
    trigger: CouncilTrigger,
    context: CouncilContext,
  ): 'reduce' | 'hold' | 'watch' {
    switch (trigger) {
      case 'high_risk':
        if (context.portfolioHeat > 80) return 'reduce'
        if (context.portfolioHeat > 60) return 'hold'
        return 'watch'

      case 'concentration':
        if (context.maxPositionPercent > 50) return 'reduce'
        if (context.maxPositionPercent > 30) return 'hold'
        return 'watch'

      case 'regime_change':
        // Regime changes warrant caution but not necessarily action
        return 'watch'
    }
  }

  /**
   * Suggest an optimal exposure level based on current heat.
   * Simple heuristic: target is roughly half the current dangerous level,
   * clamped between 20% and 50%.
   */
  private suggestedExposure(currentHeat: number): number {
    const target = Math.round(currentHeat * 0.5)
    return Math.max(20, Math.min(50, target))
  }
}
