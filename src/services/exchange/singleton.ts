/**
 * Global exchange instance singleton.
 * All trading tools and services share this instance.
 * Default: paper trading with 100k USDT.
 *
 * On first call, the paper exchange is also registered in VenueRegistry
 * as 'paper-spot' with vertical 'spot' for multi-venue compatibility.
 */

import { createExchange, type ExchangeInterface } from './index.js'
import type { ExchangeConfig } from './types.js'
import { getVenueRegistry } from './venue-registry.js'

let instance: ExchangeInterface | null = null
let connected = false
let connectionPromise: Promise<ExchangeInterface> | null = null
let registeredInVenue = false

function ensureRegistered(exchange: ExchangeInterface): void {
  if (registeredInVenue) return
  const registry = getVenueRegistry()
  registry.register('paper-spot', { vertical: 'spot', exchange })
  registeredInVenue = true
}

export function getExchange(): ExchangeInterface {
  if (!instance) {
    instance = createExchange({ mode: 'paper' })
  }
  ensureRegistered(instance)
  return instance
}

export async function getConnectedExchange(): Promise<ExchangeInterface> {
  const exchange = getExchange()
  if (connected) return exchange
  if (!connectionPromise) {
    connectionPromise = exchange.connect().then(() => {
      connected = true
      const registry = getVenueRegistry()
      registry.markConnected('paper-spot')
      return exchange
    }).catch((err) => {
      connectionPromise = null
      connected = false
      throw err
    })
  }
  return connectionPromise
}

/**
 * Whether live mode has been explicitly confirmed by the user this session.
 * Prevents accidental live trading from config changes or LLM tool calls.
 */
let liveConfirmed = false

/** Mark live mode as user-confirmed for this session. */
export function confirmLiveMode(): void {
  liveConfirmed = true
}

/** Check if live mode has been confirmed this session. */
export function isLiveModeConfirmed(): boolean {
  return liveConfirmed
}

export function resetExchange(config?: ExchangeConfig): void {
  const requestedMode = config?.mode ?? 'paper'

  // Safety interlock: reject live mode unless explicitly confirmed
  if (requestedMode === 'live' && !liveConfirmed) {
    console.warn(
      '[SAFETY] Live trading mode requested but not confirmed. ' +
      'Call confirmLiveMode() first. Falling back to paper mode.',
    )
    config = { ...config, mode: 'paper' } as ExchangeConfig
  }

  // Unregister previous venue if it was registered
  if (registeredInVenue) {
    const registry = getVenueRegistry()
    registry.unregister('paper-spot')
    registeredInVenue = false
  }

  instance = createExchange(config ?? { mode: 'paper' })
  connected = false
  connectionPromise = null

  // Register the new instance
  ensureRegistered(instance)
}
