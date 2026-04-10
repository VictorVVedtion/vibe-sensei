/**
 * Venue Bootstrap — registers paper-mode venues at startup and
 * provides lazy initialization for live venues.
 *
 * Paper venues (futures, DEX, prediction) auto-register with zero config.
 * Live venues (Alpaca, OANDA, Deribit, etc.) init lazily when first
 * accessed, with friendly errors if env vars are missing.
 */

import type {
  DEXInterface,
  ExchangeInterface,
  FuturesInterface,
  OptionsInterface,
  PredictionInterface,
  TradingVertical,
  VenueAdapter,
} from './types.js'
import { getVenueRegistry } from './venue-registry.js'

// ── Venue Descriptor ───────────────────────────────────────────────────────

interface VenueDescriptor {
  id: string
  vertical: TradingVertical
  paper: boolean
  envVars: string[]
  envHint: string
  factory: () => Promise<{ connect(): Promise<void> }>
}

const VENUE_TABLE: VenueDescriptor[] = [
  // ── Paper venues (zero-config, auto-registered at startup) ──
  {
    id: 'paper-futures',
    vertical: 'perp_futures',
    paper: true,
    envVars: [],
    envHint: '',
    factory: async () => {
      const { PaperFuturesExchange } = await import('./paper-futures.js')
      const { getExchange } = await import('./singleton.js')
      return new PaperFuturesExchange(undefined, getExchange())
    },
  },
  {
    id: 'paper-prediction',
    vertical: 'prediction',
    paper: true,
    envVars: [],
    envHint: '',
    factory: async () => {
      const { PaperPrediction } = await import('./paper-prediction.js')
      return new PaperPrediction()
    },
  },
  {
    id: 'jupiter-dex',
    vertical: 'defi_dex',
    paper: true,
    envVars: [],
    envHint: '',
    factory: async () => {
      const { JupiterClient } = await import('./jupiter-client.js')
      return new JupiterClient({ paperMode: true })
    },
  },
  {
    id: 'polymarket',
    vertical: 'prediction',
    paper: true,
    envVars: [],
    envHint: '',
    factory: async () => {
      const { PolymarketClient } = await import('./polymarket-client.js')
      return new PolymarketClient()
    },
  },
  {
    id: '1inch-dex',
    vertical: 'defi_dex',
    paper: true,
    envVars: [],
    envHint: '',
    factory: async () => {
      const { OneInchClient } = await import('./oneinch-client.js')
      return new OneInchClient({ paperMode: true })
    },
  },

  // ── Live venues (lazy, require env vars) ──
  {
    id: 'ccxt-futures',
    vertical: 'perp_futures',
    paper: false,
    envVars: ['FUTURES_API_KEY', 'FUTURES_SECRET'],
    envHint: 'Set FUTURES_API_KEY, FUTURES_SECRET, and optionally FUTURES_EXCHANGE (default: binance).',
    factory: async () => {
      const { CcxtFuturesClient } = await import('./ccxt-futures-client.js')
      return new CcxtFuturesClient({
        mode: 'live',
        apiKey: process.env.FUTURES_API_KEY!,
        secret: process.env.FUTURES_SECRET!,
        exchange: process.env.FUTURES_EXCHANGE ?? 'binance',
      })
    },
  },
  {
    id: 'deribit-options',
    vertical: 'crypto_options',
    paper: false,
    envVars: ['DERIBIT_API_KEY', 'DERIBIT_SECRET'],
    envHint: 'Set DERIBIT_API_KEY and DERIBIT_SECRET. Add DERIBIT_SANDBOX=true for testnet.',
    factory: async () => {
      const { DeribitOptionsClient } = await import('./deribit-options-client.js')
      return new DeribitOptionsClient({
        mode: 'live',
        apiKey: process.env.DERIBIT_API_KEY!,
        secret: process.env.DERIBIT_SECRET!,
        sandbox: process.env.DERIBIT_SANDBOX === 'true',
      })
    },
  },
  {
    id: 'alpaca-stocks',
    vertical: 'stocks',
    paper: false,
    envVars: ['ALPACA_KEY_ID', 'ALPACA_SECRET_KEY'],
    envHint: 'Set ALPACA_KEY_ID and ALPACA_SECRET_KEY for Alpaca stock trading.',
    factory: async () => {
      const { AlpacaClient } = await import('./alpaca-client.js')
      return new AlpacaClient('paper')
    },
  },
  {
    id: 'oanda-forex',
    vertical: 'forex',
    paper: false,
    envVars: ['OANDA_TOKEN', 'OANDA_ACCOUNT_ID'],
    envHint: 'Set OANDA_TOKEN and OANDA_ACCOUNT_ID for forex trading.',
    factory: async () => {
      const { OandaClient } = await import('./oanda-client.js')
      return new OandaClient('practice')
    },
  },
]

// ── Connection Cache ───────────────────────────────────────────────────────

const connectionPromises = new Map<string, Promise<void>>()

// ── Bootstrap Paper Venues ─────────────────────────────────────────────────

/**
 * Register all paper-mode venues at startup.
 * Non-blocking: uses Promise.allSettled so failures never block the app.
 */
export async function bootstrapPaperVenues(): Promise<void> {
  const registry = getVenueRegistry()
  const paperVenues = VENUE_TABLE.filter(d => d.paper)

  const tasks = paperVenues.map(async (desc) => {
    // Skip if already registered
    if (registry.get(desc.id)) return

    const client = await desc.factory()
    await client.connect()
  })

  const results = await Promise.allSettled(tasks)
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!
    if (r.status === 'rejected') {
      // Log but never throw — paper venue failures are non-fatal
      // Suppress noise in demo mode
      if (process.env.IS_DEMO !== '1') {
        console.error(`[venue-bootstrap] Failed to register ${paperVenues[i]!.id}: ${r.reason}`)
      }
    }
  }
}

// ── Ensure Venue (Lazy Init) ───────────────────────────────────────────────

/**
 * Ensure a venue is registered and connected. If not yet initialized,
 * creates and connects it. Caches the connection promise for idempotency.
 *
 * For paper venues: should already be registered via bootstrapPaperVenues().
 * For live venues: checks env vars and initializes on first call.
 *
 * @throws Error with helpful env var message if requirements not met.
 */
export async function ensureVenue(id: string): Promise<VenueAdapter> {
  const registry = getVenueRegistry()

  // Already registered and connected — fast path
  const existing = registry.get(id)
  if (existing) return existing

  // Find descriptor
  const desc = VENUE_TABLE.find(d => d.id === id)
  if (!desc) {
    throw new Error(`Unknown venue: '${id}'. Available: ${VENUE_TABLE.map(d => d.id).join(', ')}`)
  }

  // Check env vars for live venues
  if (desc.envVars.length > 0) {
    const missing = desc.envVars.filter(v => !process.env[v])
    if (missing.length > 0) {
      throw new Error(
        `Venue '${id}' requires environment variables: ${missing.join(', ')}. ${desc.envHint}`,
      )
    }
  }

  // Lazy connect (cached promise for idempotency)
  if (!connectionPromises.has(id)) {
    connectionPromises.set(
      id,
      (async () => {
        const client = await desc.factory()
        await client.connect()
      })().catch((err) => {
        connectionPromises.delete(id)
        throw err
      }),
    )
  }

  await connectionPromises.get(id)!

  const adapter = registry.get(id)
  if (!adapter) {
    throw new Error(`Venue '${id}' connected but failed to self-register. This is a bug.`)
  }
  return adapter
}

// ── Ensure Vertical ────────────────────────────────────────────────────────

/**
 * Ensure at least one venue is available for a given trading vertical.
 * Prefers already-registered venues; falls back to lazy initialization.
 * Returns the VenueAdapter for the resolved venue.
 */
export async function ensureVertical(vertical: TradingVertical): Promise<VenueAdapter> {
  const registry = getVenueRegistry()

  // Check if any venue is already registered for this vertical
  const existing = registry.getByVertical(vertical)
  if (existing.length > 0) return existing[0]!

  // Find descriptors for this vertical, prefer paper (zero-config)
  const descriptors = VENUE_TABLE
    .filter(d => d.vertical === vertical)
    .sort((a, b) => (a.paper === b.paper ? 0 : a.paper ? -1 : 1))

  if (descriptors.length === 0) {
    throw new Error(`No venue implementation exists for vertical: ${vertical}`)
  }

  // Try each descriptor in order until one succeeds
  let lastError: Error | null = null
  for (const desc of descriptors) {
    try {
      return await ensureVenue(desc.id)
    } catch (err) {
      lastError = err as Error
    }
  }

  throw lastError!
}

// ── Typed Helpers ──────────────────────────────────────────────────────────

/** Ensure futures venue and return the FuturesInterface. */
export async function ensureFutures(): Promise<FuturesInterface> {
  const adapter = await ensureVertical('perp_futures')
  if (adapter.vertical !== 'perp_futures') {
    throw new Error('Resolved adapter is not a futures exchange')
  }
  return adapter.exchange as FuturesInterface
}

/** Ensure DEX venue and return the DEXInterface. */
export async function ensureDex(id?: string): Promise<DEXInterface> {
  if (id) {
    const adapter = await ensureVenue(id)
    if (adapter.vertical !== 'defi_dex') {
      throw new Error(`Venue ${id} is not a DEX`)
    }
    return adapter.dex
  }
  const adapter = await ensureVertical('defi_dex')
  if (adapter.vertical !== 'defi_dex') {
    throw new Error('Resolved adapter is not a DEX')
  }
  return adapter.dex
}

/** Ensure options venue and return the OptionsInterface. */
export async function ensureOptions(): Promise<OptionsInterface> {
  const adapter = await ensureVertical('crypto_options')
  if (adapter.vertical !== 'crypto_options') {
    throw new Error('Resolved adapter is not an options exchange')
  }
  return adapter.exchange as OptionsInterface
}

/** Ensure prediction venue and return the PredictionInterface. */
export async function ensurePrediction(): Promise<PredictionInterface> {
  const adapter = await ensureVertical('prediction')
  if (adapter.vertical !== 'prediction') {
    throw new Error('Resolved adapter is not a prediction market')
  }
  return adapter.prediction
}

/** Ensure stocks venue and return the ExchangeInterface. */
export async function ensureStocks(): Promise<ExchangeInterface> {
  const adapter = await ensureVertical('stocks')
  return adapter.exchange
}

/** Ensure forex venue and return the ExchangeInterface. */
export async function ensureForex(): Promise<ExchangeInterface> {
  const adapter = await ensureVertical('forex')
  return adapter.exchange
}
