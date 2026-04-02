/**
 * Guardian Observer — bridges RiskGuardian into the query loop.
 *
 * After each trade-related tool call (PlaceOrder, GetPositions, GetBalance),
 * evaluates current trading state and returns a personalized alert string
 * from the user's assigned master guardian.
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
} | null = null

/**
 * Resolve and cache dynamic imports. Returns the cached result on subsequent calls.
 */
async function getModules() {
  if (cachedModules) return cachedModules

  const [guardianMod, companionMod, personaMod, exchangeMod] =
    await Promise.all([
      import('../../buddy/guardian.js'),
      import('../../buddy/companion.js'),
      import('../../buddy/persona.js'),
      import('../exchange/singleton.js'),
    ])

  cachedModules = { guardianMod, companionMod, personaMod, exchangeMod }
  return cachedModules
}

/**
 * Evaluate risk after a trade-related tool call.
 *
 * Returns a personalized alert string from the master guardian,
 * or null when there are no alerts (healthy state) or when any
 * dependency is unavailable.
 */
export async function evaluateAfterToolCall(
  toolName: string,
): Promise<string | null> {
  if (!isTradeRelatedTool(toolName)) return null

  try {
    // Dynamic imports — non-fatal if any module is missing
    const { guardianMod, companionMod, personaMod, exchangeMod } =
      await getModules()

    // Resolve companion — if none assigned, nothing to evaluate
    const companion = companionMod.getCompanion()
    if (!companion) return null

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

    // Run evaluation — returns at most 1 alert (highest severity)
    const alerts = await guardian.evaluate()
    if (alerts.length === 0) return null

    const topAlert = alerts[0]!
    const master = companion.species as import('../../buddy/types.js').Master
    const stats = companion.stats

    return personaMod.getPersonalizedAlert(master, stats, topAlert)
  } catch {
    // Guardian failure must never propagate — silently return null
    return null
  }
}
