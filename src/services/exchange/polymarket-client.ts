/**
 * Polymarket CLOB REST client implementing PredictionInterface.
 * Uses raw fetch (no npm SDK) against https://clob.polymarket.com.
 * Registers as 'polymarket' vertical 'prediction' in VenueRegistry.
 */

import type {
  Balance,
  PredictionInterface,
  PredictionMarket,
  PredictionOrder,
  PredictionPosition,
} from './types.js'
import { getVenueRegistry } from './venue-registry.js'

const BASE_URL = 'https://clob.polymarket.com'
const DEFAULT_TIMEOUT_MS = 10_000

// ── Raw API response shapes ────────────────────────────────────────────────

interface RawMarket {
  condition_id?: string
  question?: string
  outcomes?: string[]
  tokens?: Array<{ outcome: string; price: number }>
  volume?: number
  end_date_iso?: string
}

interface RawPosition {
  market?: string
  outcome?: string
  size?: number
  avgPrice?: number
  curPrice?: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function safeNumber(val: unknown, fallback = 0): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Polymarket ${res.status}: ${body}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

function mapRawMarket(raw: RawMarket): PredictionMarket {
  const outcomes = raw.outcomes ?? raw.tokens?.map(t => t.outcome) ?? ['YES', 'NO']
  const prices = raw.tokens?.map(t => safeNumber(t.price, 0.5)) ?? [0.5, 0.5]
  return {
    id: raw.condition_id ?? '',
    question: raw.question ?? '',
    outcomes,
    volume: safeNumber(raw.volume),
    endDate: raw.end_date_iso ?? '',
    currentPrices: prices,
  }
}

function mapRawPosition(raw: RawPosition): PredictionPosition {
  const avgPrice = safeNumber(raw.avgPrice)
  const curPrice = safeNumber(raw.curPrice)
  const shares = safeNumber(raw.size)
  return {
    marketId: raw.market ?? '',
    outcome: raw.outcome ?? '',
    shares,
    avgPrice,
    currentPrice: curPrice,
    unrealizedPnl: shares * (curPrice - avgPrice),
  }
}

// ── Client ─────────────────────────────────────────────────────────────────

export class PolymarketClient implements PredictionInterface {
  private usdcBalance: number

  constructor() {
    const envBalance = process.env.POLYMARKET_USDC_BALANCE
    this.usdcBalance = envBalance ? safeNumber(envBalance, 1000) : 1000
  }

  async connect(): Promise<void> {
    // Verify connectivity by hitting the markets endpoint
    await fetchJson<unknown>('/markets?limit=1')
    const registry = getVenueRegistry()
    registry.register('polymarket', { vertical: 'prediction', prediction: this })
    registry.markConnected('polymarket')
  }

  async getMarkets(query?: string): Promise<PredictionMarket[]> {
    const params = new URLSearchParams({ limit: '20' })
    if (query) params.set('tag', query)
    const data = await fetchJson<RawMarket[]>(`/markets?${params}`)
    if (!Array.isArray(data)) return []
    return data.map(mapRawMarket)
  }

  async placeBet(
    marketId: string,
    outcome: string,
    amount: number,
    price?: number,
  ): Promise<PredictionOrder> {
    const body = {
      market: marketId,
      outcome,
      amount,
      price: price ?? undefined,
    }
    const raw = await fetchJson<{
      id?: string
      status?: string
      size?: number
      price?: number
    }>('/order', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return {
      id: raw.id ?? crypto.randomUUID(),
      marketId,
      outcome,
      shares: safeNumber(raw.size, amount / (price ?? 0.5)),
      price: safeNumber(raw.price, price ?? 0.5),
      status: raw.status === 'filled' ? 'filled' : 'open',
      createdAt: new Date(),
    }
  }

  async getPositions(): Promise<PredictionPosition[]> {
    const data = await fetchJson<RawPosition[]>('/positions')
    if (!Array.isArray(data)) return []
    return data.map(mapRawPosition)
  }

  async getBalance(): Promise<Balance[]> {
    return [
      {
        currency: 'USDC',
        free: this.usdcBalance,
        used: 0,
        total: this.usdcBalance,
      },
    ]
  }
}
