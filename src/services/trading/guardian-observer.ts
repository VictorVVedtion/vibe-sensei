/**
 * Guardian Observer — bridges RiskGuardian into the query loop.
 *
 * After each trade-related tool call (PlaceOrder, GetPositions, GetBalance),
 * evaluates current trading state and returns a personalized alert string
 * from the user's assigned master guardian.
 *
 * When running in desktop mode (VIBE_SENSEI_DESKTOP=1), emits bridge messages
 * so the Electron renderer receives live trading state, guardian alerts,
 * and master info updates.
 *
 * All imports are dynamic so the module degrades gracefully if buddy/
 * or exchange modules are unavailable. Guardian failures never propagate.
 */

import type { TradingVertical } from '../exchange/types.js'
import { getBackendEventStream } from '../backend/event-stream.js'

const TRADE_TOOLS = new Set([
  'PlaceOrder', 'GetPositions', 'GetBalance',
  'PlaceFuturesOrder', 'SetLeverage', 'GetFundingRate', 'GetLiquidationPrice',
  'PlaceOptionsOrder', 'GetOptionsChain', 'GetGreeks',
  'PlaceStockOrder', 'SwapDEX', 'PlacePrediction', 'GetEventMarkets', 'PlaceForexOrder',
])

/**
 * Map each trading tool to its trading vertical so the guardian observer
 * knows which vertical-specific risk checks to dispatch after a tool call.
 *
 * Without this map, RiskGuardian would only run the 6 generic ALL_CHECKS
 * on every trade — futures/options/stocks/defi/prediction/forex specialized
 * checks would never fire automatically (they would only run when the AI
 * explicitly invoked PreTradeGateTool).
 */
const TOOL_TO_VERTICAL: Record<string, TradingVertical> = {
  PlaceOrder: 'spot',
  GetPositions: 'spot',
  GetBalance: 'spot',
  PlaceFuturesOrder: 'perp_futures',
  SetLeverage: 'perp_futures',
  GetFundingRate: 'perp_futures',
  GetLiquidationPrice: 'perp_futures',
  PlaceOptionsOrder: 'crypto_options',
  GetOptionsChain: 'crypto_options',
  GetGreeks: 'crypto_options',
  PlaceStockOrder: 'stocks',
  SwapDEX: 'defi_dex',
  PlacePrediction: 'prediction',
  GetEventMarkets: 'prediction',
  PlaceForexOrder: 'forex',
}

/** Returns true when toolName is a trading tool that should trigger guardian evaluation. */
export function isTradeRelatedTool(toolName: string): boolean {
  return TRADE_TOOLS.has(toolName)
}

/** Look up the trading vertical for a tool, or undefined if unknown. */
export function inferVerticalFromTool(toolName: string): TradingVertical | undefined {
  return TOOL_TO_VERTICAL[toolName]
}

// ── Vertical Context ───────────────────────────────────────────────────────

/** Context about the trading vertical for the current tool call. */
export interface VerticalContext {
  vertical: TradingVertical
  venueId?: string
}

/** Session-scoped vertical context, set by trade tool calls. */
let currentVerticalContext: VerticalContext | null = null

/** Set the vertical context for the next guardian evaluation. */
export function setVerticalContext(ctx: VerticalContext): void {
  currentVerticalContext = ctx
}

/** Clear the vertical context after evaluation. */
export function clearVerticalContext(): void {
  currentVerticalContext = null
}

/** Get the current vertical context, if set. */
export function getVerticalContext(): VerticalContext | null {
  return currentVerticalContext
}

// Session-scoped guardian cache — avoids recreating on every tool call.
let cachedGuardian: {
  instance: InstanceType<typeof import('../../buddy/guardian.js').RiskGuardian>
  companion: import('../../buddy/types.js').Companion
} | null = null

// Session-scoped ghost engine — singleton, one per session.
let cachedGhostEngine: InstanceType<typeof import('../../buddy/ghost-warnings.js').GhostEngine> | null = null

// Track ignored alerts for Do Kwon ghost trigger
let ignoredAlertCount = 0

// Module-level cache for dynamic imports — resolved once, reused thereafter.
let cachedModules: {
  guardianMod: typeof import('../../buddy/guardian.js')
  companionMod: typeof import('../../buddy/companion.js')
  personaMod: typeof import('../../buddy/persona.js')
  exchangeMod: typeof import('../exchange/singleton.js')
  bridgeMod: typeof import('../desktop/bridge.js')
  diaryMod: typeof import('../../buddy/diary.js') | null
} | null = null

// Session-scoped diary instance — one per session.
let cachedDiary: InstanceType<typeof import('../../buddy/diary.js').GuardianDiary> | null = null

// Track whether we've sent master info to desktop — only need to send once per companion.
let lastEmittedMasterId: string | null = null

/**
 * Resolve and cache dynamic imports. Returns the cached result on subsequent calls.
 */
async function getModules() {
  if (cachedModules) return cachedModules

  const [guardianMod, companionMod, personaMod, exchangeMod, bridgeMod] =
    await Promise.all([
      import('../../buddy/guardian.js'),
      import('../../buddy/companion.js'),
      import('../../buddy/persona.js'),
      import('../exchange/singleton.js'),
      import('../desktop/bridge.js'),
    ])

  // Diary module is optional — graceful degradation if unavailable
  let diaryMod: typeof import('../../buddy/diary.js') | null = null
  try {
    diaryMod = await import('../../buddy/diary.js')
  } catch {
    // Diary module unavailable — context-aware alerts will fall back
  }

  cachedModules = { guardianMod, companionMod, personaMod, exchangeMod, bridgeMod, diaryMod }
  return cachedModules
}

/**
 * Compute total portfolio value from USDT balance + position market values.
 * Used as single-venue fallback when only one venue is connected.
 */
function computePortfolioValue(
  balances: import('../exchange/types.js').Balance[],
  positions: import('../exchange/types.js').Position[],
): number {
  let total = 0
  for (const b of balances) {
    if (b.currency === 'USDT') total += b.total
  }
  for (const p of positions) {
    total += p.currentPrice * p.quantity
  }
  return total
}

// Cached aggregation result — valid for one evaluateAfterToolCall cycle.
let cachedAggregation: { data: any; ts: number } | null = null

/**
 * Get aggregated portfolio, caching for 2 seconds to avoid redundant
 * venue queries within a single evaluation cycle. Returns null on failure.
 */
async function getCachedAggregation(): Promise<any | null> {
  const now = Date.now()
  if (cachedAggregation && now - cachedAggregation.ts < 2000) {
    return cachedAggregation.data
  }
  try {
    const { aggregatePortfolio } = await import('../portfolio/multi-venue-aggregator.js')
    const result = await aggregatePortfolio()
    cachedAggregation = { data: result, ts: now }
    return result
  } catch {
    return null
  }
}

/**
 * Compute total portfolio value using multi-venue aggregation.
 * Falls back to single-venue calculation when aggregation fails or
 * only one venue is connected (optimization: skip aggregation overhead).
 */
async function computeMultiVenuePortfolioValue(
  balances: import('../exchange/types.js').Balance[],
  positions: import('../exchange/types.js').Position[],
): Promise<number> {
  try {
    const { getVenueRegistry } = await import('../exchange/venue-registry.js')
    const registry = getVenueRegistry()
    const venueIds = registry.getVenueIds()

    const connectedCount = venueIds.filter((id) => registry.isConnected(id)).length
    if (connectedCount <= 1) {
      return computePortfolioValue(balances, positions)
    }

    const result = await getCachedAggregation()
    return result?.totalUSD ?? computePortfolioValue(balances, positions)
  } catch {
    return computePortfolioValue(balances, positions)
  }
}

/**
 * Get or create a session-scoped diary instance.
 * Returns null when the diary module is unavailable.
 */
function getDiary(
  diaryMod: typeof import('../../buddy/diary.js') | null,
): InstanceType<typeof import('../../buddy/diary.js').GuardianDiary> | null {
  if (!diaryMod) return null
  if (cachedDiary) return cachedDiary

  try {
    cachedDiary = new diaryMod.GuardianDiary()
    return cachedDiary
  } catch {
    return null
  }
}

/**
 * Emit trading state to the desktop bridge (positions + balances).
 * Computes actual portfolio heat for the riskScore field.
 * Silently swallows all errors.
 */
async function emitTradingState(
  exchangeMod: typeof import('../exchange/singleton.js'),
  bridgeMod: typeof import('../desktop/bridge.js'),
): Promise<void> {
  try {
    if (!bridgeMod.isDesktopMode()) return

    const exchange = await exchangeMod.getConnectedExchange()
    const [positions, balances, openOrders] = await Promise.all([
      exchange.getPositions(),
      exchange.getBalance(),
      exchange.getOpenOrders(),
    ])

    const { calculatePortfolioHeat } = await import(
      '../portfolio/heat-calculator.js'
    )
    const heat = calculatePortfolioHeat(positions, balances, openOrders)

    // Use multi-venue portfolio value when multiple venues are connected
    const totalValue = await computeMultiVenuePortfolioValue(balances, positions)

    bridgeMod.emitToDesktop('trading_state', {
      positions: positions.map((p) => ({
        symbol: p.symbol,
        side: p.side,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        unrealizedPnl: p.unrealizedPnl,
        unrealizedPnlPercent: p.unrealizedPnlPercent,
      })),
      balances: balances.map((b) => ({
        currency: b.currency,
        free: b.free,
        used: b.used,
        total: b.total,
      })),
      totalPortfolioValue: totalValue,
      riskScore: heat.riskScore,
      vertical: currentVerticalContext?.vertical ?? 'spot',
      timestamp: Date.now(),
    })

    // Emit cross-venue portfolio when multiple venues are connected
    await emitCrossVenuePortfolio(bridgeMod)
  } catch {
    // Bridge emission must never propagate
  }
}

/**
 * Emit cross-venue portfolio data to the desktop bridge.
 * Only emits when the aggregator is available and there are positions.
 * Silently swallows all errors.
 */
async function emitCrossVenuePortfolio(
  bridgeMod: typeof import('../desktop/bridge.js'),
): Promise<void> {
  try {
    const portfolio = await getCachedAggregation()
    if (!portfolio) return

    if (portfolio.positions.length === 0) return

    bridgeMod.emitToDesktop('cross_venue_portfolio', {
      totalUSD: portfolio.portfolioValue.totalUSD,
      staleCount: portfolio.portfolioValue.staleCount,
      positionCount: portfolio.positions.length,
      concentrations: portfolio.concentrations.map((c) => ({
        symbol: c.symbol,
        percentOfPortfolio: c.percentOfPortfolio,
        venueCount: c.venueCount,
      })),
      venueErrors: portfolio.venueErrors.map((e) => ({
        venueId: e.venueId,
        message: e.error.message,
      })),
      timestamp: portfolio.timestamp,
    })
  } catch {
    // Cross-venue emission must never propagate
  }
}

/**
 * Emit master info to the desktop bridge when companion changes.
 * Silently swallows all errors.
 */
function emitMasterInfo(
  companion: import('../../buddy/types.js').Companion,
  personaMod: typeof import('../../buddy/persona.js'),
  bridgeMod: typeof import('../desktop/bridge.js'),
): void {
  try {
    if (!bridgeMod.isDesktopMode()) return

    const masterId = companion.species
    if (masterId === lastEmittedMasterId) return
    lastEmittedMasterId = masterId

    const master = masterId as import('../../buddy/types.js').Master
    bridgeMod.emitToDesktop('master_info', {
      id: masterId,
      name: companion.name,
      rarity: companion.rarity,
      archetype: personaMod.getMasterArchetype(master),
      quote: companion.personality,
      stats: companion.stats,
    })
  } catch {
    // Bridge emission must never propagate
  }
}

/**
 * Emit a guardian alert to the desktop bridge.
 * Silently swallows all errors.
 */
function emitGuardianAlert(
  alert: import('../../buddy/guardian.js').RiskAlert,
  bridgeMod: typeof import('../desktop/bridge.js'),
): void {
  try {
    if (!bridgeMod.isDesktopMode()) return

    bridgeMod.emitToDesktop('guardian_alert', {
      id: `${alert.checkName}-${alert.timestamp.getTime()}`,
      severity: alert.severity.toLowerCase(),
      masterName: alert.masterName,
      message: alert.message,
      timestamp: alert.timestamp.getTime(),
    })
  } catch {
    // Bridge emission must never propagate
  }
}

/**
 * Emit trade history (last 10 diary entries) to the desktop bridge.
 * Called after each trade tool call so the renderer has fresh data.
 * Silently swallows all errors.
 */
function emitTradeHistory(
  diaryMod: typeof import('../../buddy/diary.js') | null,
  bridgeMod: typeof import('../desktop/bridge.js'),
): void {
  try {
    if (!bridgeMod.isDesktopMode()) return

    const diary = getDiary(diaryMod)
    if (!diary) return

    const entries = diary.getRecentEntries(10)
    if (entries.length === 0) return

    bridgeMod.emitToDesktop('trade_history', {
      trades: entries.map((e) => ({
        id: e.id,
        symbol: e.tradeSymbol,
        side: e.tradeSide,
        quantity: 0,
        price: 0,
        timestamp: e.timestamp.getTime(),
        pnl: e.profitPercent ?? undefined,
        patternType: e.patternType,
        observation: e.observation,
        outcome: e.outcome,
        holdDurationMs: e.holdDurationMs,
      })),
      timestamp: Date.now(),
    })
  } catch {
    // Bridge emission must never propagate
  }
}

/**
 * Evaluate tilt state after a PlaceOrder call.
 * Feeds the latest trade into the TiltDetector and emits bridge messages on warning.
 * Silently swallows all errors.
 */
async function evaluateTilt(
  positions: import('../exchange/types.js').Position[],
  balances: import('../exchange/types.js').Balance[],
  companion: import('../../buddy/types.js').Companion,
  bridgeMod: typeof import('../desktop/bridge.js'),
): Promise<void> {
  try {
    const { getTiltDetector } = await import('./tilt-detector.js')
    const detector = getTiltDetector()

    // Use the most recently changed position as the trade signal
    // (the one that was just placed/modified)
    if (positions.length === 0) return

    // Pick the position with the smallest absolute unrealized PnL (likely just opened)
    // or the most recent — heuristic since we don't have explicit trade IDs here
    const latestPosition = positions.reduce((best, p) =>
      Math.abs(p.unrealizedPnlPercent) < Math.abs(best.unrealizedPnlPercent) ? p : best,
    )

    const positionSize = latestPosition.quantity * latestPosition.currentPrice
    const tiltStatus = detector.recordTrade({
      symbol: latestPosition.symbol,
      side: latestPosition.side,
      pnlPercent: latestPosition.unrealizedPnlPercent,
      positionSize,
      timestamp: Date.now(),
    })

    if (!bridgeMod.isDesktopMode()) return

    if (tiltStatus.level === 'warning') {
      // Emit tilt_state bridge message
      bridgeMod.emitToDesktop('tilt_state', {
        level: 'moderate',
        score: 60,
        triggers: tiltStatus.triggers,
        recommendation: 'Step away. Breathe. Review your plan before the next trade.',
        timestamp: Date.now(),
      })

      // Emit companion_speech with stern emotion
      bridgeMod.emitToDesktop('companion_speech', {
        message: `${companion.name} senses tilt. ${tiltStatus.triggers.join('. ')}. Step back and review your trading plan.`,
        emotion: 'stern',
        masterName: companion.name,
        duration: 8000,
        timestamp: Date.now(),
      })

      // Play alert sound (macOS only, fire-and-forget)
      try {
        const { exec } = await import('child_process')
        exec('afplay /System/Library/Sounds/Sosumi.aiff 2>/dev/null &')
      } catch {
        // Sound effect must never propagate
      }
    } else {
      // Tilt cleared — emit none state
      bridgeMod.emitToDesktop('tilt_state', {
        level: 'none',
        score: 0,
        triggers: [],
        recommendation: '',
        timestamp: Date.now(),
      })
    }
  } catch {
    // Tilt evaluation must never propagate
  }
}

/**
 * Evaluate risk after a trade-related tool call.
 *
 * Returns a personalized alert string from the master guardian,
 * or null when there are no alerts (healthy state) or when any
 * dependency is unavailable.
 *
 * Always emits trading_state to desktop bridge after every trade tool call,
 * regardless of whether the guardian fires an alert.
 */
export async function evaluateAfterToolCall(
  toolName: string,
): Promise<string | null> {
  if (!isTradeRelatedTool(toolName)) return null

  // Infer trading vertical from toolName so vertical-specific risk checks
  // (futures, options, stocks, defi, prediction, forex) actually fire after
  // the trade. We only seed the session context when nothing is set, so a
  // future trade tool that calls setVerticalContext with rich data takes
  // precedence. Cleared in the finally block below.
  const inferredVertical = inferVerticalFromTool(toolName)
  if (inferredVertical && !currentVerticalContext) {
    setVerticalContext({ vertical: inferredVertical })
  }

  try {
    // Dynamic imports — non-fatal if any module is missing
    const { guardianMod, companionMod, personaMod, exchangeMod, bridgeMod, diaryMod } =
      await getModules()

    // Always emit trading state to desktop — even if companion is unresolved
    await emitTradingState(exchangeMod, bridgeMod)

    // Emit trade history to desktop (last 10 diary entries)
    emitTradeHistory(diaryMod, bridgeMod)

    // Resolve companion — if none assigned, nothing to evaluate
    const companion = companionMod.getCompanion()
    if (!companion) {
      clearVerticalContext()
      return null
    }

    // Emit master info to desktop bridge (once per companion)
    emitMasterInfo(companion, personaMod, bridgeMod)

    // Reuse cached guardian when companion hasn't changed
    let guardian: InstanceType<typeof guardianMod.RiskGuardian>
    if (
      cachedGuardian &&
      cachedGuardian.companion.species === companion.species
    ) {
      guardian = cachedGuardian.instance
    } else {
      const exchange = await exchangeMod.getConnectedExchange()
      guardian = new guardianMod.RiskGuardian(companion, exchange)
      cachedGuardian = { instance: guardian, companion }
    }

    // Run evaluation — returns at most 1 alert with trading state.
    // Pass the active vertical so RiskGuardian can dispatch vertical-specific
    // checks alongside the generic ALL_CHECKS.
    const result = await guardian.evaluate(currentVerticalContext?.vertical)

    if (result.alerts.length === 0) {
      clearVerticalContext()
      return null
    }

    const topAlert = result.alerts[0]!

    // Emit guardian alert to desktop bridge
    emitGuardianAlert(topAlert, bridgeMod)

    // Emit GuardianAlert to BackendEventStream (fire-and-forget)
    try {
      getBackendEventStream().emitEvent({
        type: 'GuardianAlert',
        severity: topAlert.severity.toLowerCase(),
        message: topAlert.message,
        emotion: topAlert.severity === 'CRITICAL' ? 'alarmed' : 'stern',
        masterName: topAlert.masterName,
        timestamp: Date.now(),
      })
    } catch {
      // Backend event emission must never propagate
    }

    // Notify companion engine about the trading event
    try {
      const { notifyTradingEvent } = await import('../companion/singleton.js')
      const symbolMatch = topAlert.message.match(/([A-Z]{2,10}\/[A-Z]{2,10})/)
      const symbol = symbolMatch ? symbolMatch[1]! : 'UNKNOWN'

      // Extract actual trade data from positions when available
      const matchingPosition = result.positions.find(p => p.symbol === symbol)
      notifyTradingEvent({
        type: 'trade_executed',
        symbol,
        side: matchingPosition?.side ?? 'buy',
        quantity: matchingPosition?.quantity ?? 0,
        price: matchingPosition?.currentPrice ?? 0,
        pnlPercent: matchingPosition?.unrealizedPnlPercent,
      })
    } catch {
      // Companion engine notification must never propagate
    }

    // Emit AlertEvent to Knowledge Base (fire-and-forget)
    try {
      const { appendEvent } = await import('../knowledge/event-store.js')
      const kbSymbolMatch = topAlert.message.match(/([A-Z]{2,10}\/[A-Z]{2,10})/)
      await appendEvent({
        id: '',
        type: 'alert',
        timestamp: topAlert.timestamp.toISOString(),
        severity: topAlert.severity,
        masterName: topAlert.masterName,
        checkName: topAlert.checkName,
        message: topAlert.message,
        symbol: kbSymbolMatch ? kbSymbolMatch[1] : undefined,
      } as import('../knowledge/types.js').KBEvent)
    } catch {
      // KB event emission must never propagate
    }

    // Buffer alert for counterfactual tracking (fire-and-forget)
    try {
      const { recordAlert } = await import('../knowledge/counterfactual.js')
      const cfSymbolMatch = topAlert.message.match(/([A-Z]{2,10}\/[A-Z]{2,10})/)
      recordAlert({
        id: `${topAlert.checkName}-${topAlert.timestamp.getTime()}`,
        symbol: cfSymbolMatch ? cfSymbolMatch[1] : undefined,
        timestamp: topAlert.timestamp,
        severity: topAlert.severity,
        checkName: topAlert.checkName,
      })
    } catch {
      // Counterfactual tracking must never propagate
    }

    // Auto-compile knowledge base after every 5 PlaceOrder calls (fire-and-forget)
    if (toolName === 'PlaceOrder') {
      try {
        const { incrementTradeCount, shouldAutoCompile, autoCompile } = await import('../knowledge/compiler.js')
        incrementTradeCount()
        if (shouldAutoCompile()) {
          autoCompile().catch(() => { /* swallow */ })
        }
      } catch {
        // KB auto-compile must never propagate
      }
    }

    // Tilt detection — feed trade outcome to detector after PlaceOrder (fire-and-forget)
    if (toolName === 'PlaceOrder') {
      try {
        await evaluateTilt(result.positions, result.balances, companion, bridgeMod)
      } catch {
        // Tilt detection must never propagate
      }
    }

    const master = companion.species as import('../../buddy/types.js').Master
    const stats = companion.stats

    // ── Ghost Warning Check ─────────────────────────────────────────
    // Run ghost triggers against current trading state. If a ghost fires,
    // append its formatted warning to the personalized alert output.
    let ghostSuffix = ''
    try {
      const ghostMod = await import('../../buddy/ghost-warnings.js')
      const ghostPersonaMod = await import('../../buddy/ghost-persona.js')

      if (!cachedGhostEngine) {
        cachedGhostEngine = new ghostMod.GhostEngine()
      }

      // Build ghost context from available data
      const lastBuy = result.positions.find(p => p.side === 'buy')
      const ghostContext: import('../../buddy/ghost-warnings.js').GhostContext = {
        positions: result.positions,
        orders: [], // Orders not fetched in guardian eval — ghost triggers handle gracefully
        balances: result.balances,
        ignoredAlertCount,
        lastBuyPrice: lastBuy?.entryPrice ?? 0,
        price24hAgo: 0, // Not available here — Newton ghost will rely on other signals
        currentBtcPrice: result.positions.find(p => p.symbol.startsWith('BTC'))?.currentPrice ?? 0,
        btcPrice24hAgo: 0,
      }

      const ghostWarning = cachedGhostEngine.checkAll(ghostContext)
      if (ghostWarning) {
        ghostSuffix = '\n\n' + ghostPersonaMod.formatGhostWarningWithPersona(ghostWarning)
      }

      // Increment ignored alert counter (resets when no alert fires)
      ignoredAlertCount = topAlert ? ignoredAlertCount + 1 : 0
    } catch {
      // Ghost check must never propagate
    }

    // Emit vertical risk alert when cross-venue concentration is detected
    try {
      if (currentVerticalContext && bridgeMod.isDesktopMode()) {
        const portfolio = await getCachedAggregation()
        if (portfolio?.concentrations?.length > 0) {
          bridgeMod.emitToDesktop('vertical_risk_alert', {
            vertical: currentVerticalContext.vertical,
            concentrations: portfolio.concentrations,
            totalUSD: portfolio.portfolioValue.totalUSD,
            timestamp: Date.now(),
          })
        }
      }
    } catch {
      // Cross-venue risk alert must never propagate
    }

    // Emit venue status to desktop bridge (fire-and-forget)
    try {
      if (bridgeMod.isDesktopMode()) {
        const { getVenueRegistry } = await import('../exchange/venue-registry.js')
        const registry = getVenueRegistry()
        const venueIds = registry.getVenueIds()
        bridgeMod.emitToDesktop('venue_status', {
          venues: venueIds.map((id) => ({
            id,
            connected: registry.isConnected(id),
          })),
          activeVertical: currentVerticalContext?.vertical ?? 'spot',
          timestamp: Date.now(),
        })
      }
    } catch {
      // Venue status emission must never propagate
    }

    // Inject wiki context for the symbol being traded (fire-and-forget)
    let wikiSuffix = ''
    try {
      const { queryWikiBySymbol } = await import('../knowledge/query-router.js')
      const alertSymbol = topAlert?.message?.match(/([A-Z]{2,10}\/[A-Z]{2,10})/)?.[1]
      const posSymbol = result.positions?.[0]?.symbol
      const symbol = alertSymbol ?? posSymbol
      if (symbol) {
        const ctx = await queryWikiBySymbol(symbol)
        if (ctx) wikiSuffix = `\n\n[Wiki]: ${ctx}`
      }
    } catch {
      // Wiki context injection must never propagate
    }

    // Try context-aware alert (with exchange, diary, positions, balances)
    try {
      const diary = getDiary(diaryMod)
      const exchange = guardian.getExchange()
      const alert = await personaMod.getPersonalizedAlertWithContext(
        { species: master, stats },
        topAlert,
        exchange,
        diary,
        result.positions,
        result.balances,
      )
      return alert + ghostSuffix + wikiSuffix
    } catch {
      // Fall back to non-context alert on any failure
      return personaMod.getPersonalizedAlert(master, stats, topAlert) + ghostSuffix + wikiSuffix
    } finally {
      // Clear vertical context after evaluation completes
      clearVerticalContext()
    }
  } catch {
    // Guardian failure must never propagate — silently return null
    clearVerticalContext()
    return null
  }
}
