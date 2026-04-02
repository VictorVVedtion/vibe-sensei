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

const TRADE_TOOLS = new Set(['PlaceOrder', 'GetPositions', 'GetBalance'])

/** Returns true when toolName is a trading tool that should trigger guardian evaluation. */
export function isTradeRelatedTool(toolName: string): boolean {
  return TRADE_TOOLS.has(toolName)
}

// Session-scoped guardian cache — avoids recreating on every tool call.
let cachedGuardian: {
  instance: InstanceType<typeof import('../../buddy/guardian.js').RiskGuardian>
  companion: import('../../buddy/types.js').Companion
} | null = null

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
 * Silently swallows all errors.
 */
async function emitTradingState(
  exchangeMod: typeof import('../exchange/singleton.js'),
  bridgeMod: typeof import('../desktop/bridge.js'),
): Promise<void> {
  try {
    if (!bridgeMod.isDesktopMode()) return

    const exchange = await exchangeMod.getConnectedExchange()
    const [positions, balances] = await Promise.all([
      exchange.getPositions(),
      exchange.getBalance(),
    ])

    // Compute total portfolio value from USDT balance + position values
    let totalValue = 0
    for (const b of balances) {
      if (b.currency === 'USDT') totalValue += b.total
    }
    for (const p of positions) {
      totalValue += p.currentPrice * p.quantity
    }

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
      riskScore: 0,
      timestamp: Date.now(),
    })
  } catch {
    // Bridge emission must never propagate
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

  try {
    // Dynamic imports — non-fatal if any module is missing
    const { guardianMod, companionMod, personaMod, exchangeMod, bridgeMod, diaryMod } =
      await getModules()

    // Always emit trading state to desktop — even if companion is unresolved
    await emitTradingState(exchangeMod, bridgeMod)

    // Resolve companion — if none assigned, nothing to evaluate
    const companion = companionMod.getCompanion()
    if (!companion) return null

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

    // Run evaluation — returns at most 1 alert with trading state
    const result = await guardian.evaluate()

    if (result.alerts.length === 0) return null

    const topAlert = result.alerts[0]!

    // Emit guardian alert to desktop bridge
    emitGuardianAlert(topAlert, bridgeMod)

    const master = companion.species as import('../../buddy/types.js').Master
    const stats = companion.stats

    // Try context-aware alert (with exchange, diary, positions, balances)
    try {
      const diary = getDiary(diaryMod)
      const exchange = guardian.getExchange()
      return await personaMod.getPersonalizedAlertWithContext(
        { species: master, stats },
        topAlert,
        exchange,
        diary,
        result.positions,
        result.balances,
      )
    } catch {
      // Fall back to non-context alert on any failure
      return personaMod.getPersonalizedAlert(master, stats, topAlert)
    }
  } catch {
    // Guardian failure must never propagate — silently return null
    return null
  }
}
