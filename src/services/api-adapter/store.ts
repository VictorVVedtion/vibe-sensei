/**
 * API Adapter — profile storage (CRUD + seeds).
 *
 * Stores API profiles as JSON files at ~/.vibe-sensei/apis/{name}.json.
 * Seeds 3 free-tier trading data APIs on first run.
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { APIProfileSchema, type APIProfile } from './types.js'

// ── Constants ────────────────────────────────────────────────────────────────

const APIS_DIR = join(homedir(), '.vibe-sensei', 'apis')

// ── Directory Bootstrap ──────────────────────────────────────────────────────

let dirEnsured = false

function ensureDir(): void {
  if (dirEnsured) return
  try {
    mkdirSync(APIS_DIR, { recursive: true, mode: 0o700 })
    dirEnsured = true
    seedIfEmpty()
  } catch (err: unknown) {
    console.warn('[api-adapter] failed to create apis dir:', err)
  }
}

// ── Slug ─────────────────────────────────────────────────────────────────────

/** Normalize name to a safe filename slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function saveProfile(profile: APIProfile): void {
  ensureDir()
  const slug = slugify(profile.name)
  const filePath = join(APIS_DIR, `${slug}.json`)
  writeFileSync(filePath, JSON.stringify(profile, null, 2), { mode: 0o600 })
}

export function loadProfile(name: string): APIProfile | null {
  ensureDir()
  const slug = slugify(name)
  const filePath = join(APIS_DIR, `${slug}.json`)
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = APIProfileSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function listProfiles(): APIProfile[] {
  ensureDir()
  try {
    const files = readdirSync(APIS_DIR).filter(f => f.endsWith('.json'))
    const profiles: APIProfile[] = []
    for (const file of files) {
      try {
        const raw = readFileSync(join(APIS_DIR, file), 'utf-8')
        const parsed = APIProfileSchema.safeParse(JSON.parse(raw))
        if (parsed.success) profiles.push(parsed.data)
      } catch {
        // skip corrupted files
      }
    }
    return profiles
  } catch {
    return []
  }
}

export function removeProfile(name: string): boolean {
  ensureDir()
  const slug = slugify(name)
  const filePath = join(APIS_DIR, `${slug}.json`)
  try {
    unlinkSync(filePath)
    return true
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    return false
  }
}

export function profileExists(name: string): boolean {
  ensureDir()
  const slug = slugify(name)
  try {
    readFileSync(join(APIS_DIR, `${slug}.json`))
    return true
  } catch {
    return false
  }
}

// ── Seed Profiles ────────────────────────────────────────────────────────────

const SEED_PROFILES: APIProfile[] = [
  {
    name: 'coingecko',
    displayName: 'CoinGecko',
    baseUrl: 'https://api.coingecko.com/api/v3',
    description: 'Cryptocurrency market data: prices, market cap, volume, historical charts, coin info. Free tier: no auth, 10-30 calls/min.',
    endpoints: [
      {
        path: '/simple/price',
        method: 'GET',
        description: 'Get current price of coins in target currencies',
        params: [
          { name: 'ids', location: 'query', required: true, description: 'Comma-separated coin IDs (e.g. bitcoin,ethereum)', example: 'bitcoin,ethereum' },
          { name: 'vs_currencies', location: 'query', required: true, description: 'Comma-separated target currencies', example: 'usd,eur' },
          { name: 'include_24hr_change', location: 'query', required: false, description: 'Include 24h price change %', example: 'true' },
          { name: 'include_market_cap', location: 'query', required: false, description: 'Include market cap', example: 'true' },
        ],
        exampleResponse: '{"bitcoin":{"usd":67423,"usd_24h_change":-1.23}}',
      },
      {
        path: '/coins/{id}/market_chart',
        method: 'GET',
        description: 'Get historical market data (price, market cap, volume) for a coin',
        params: [
          { name: 'id', location: 'path', required: true, description: 'Coin ID', example: 'bitcoin' },
          { name: 'vs_currency', location: 'query', required: true, description: 'Target currency', example: 'usd' },
          { name: 'days', location: 'query', required: true, description: 'Data up to N days ago (1/7/30/90/365/max)', example: '30' },
        ],
      },
      {
        path: '/coins/markets',
        method: 'GET',
        description: 'List top coins by market cap with price, volume, and change data',
        params: [
          { name: 'vs_currency', location: 'query', required: true, description: 'Target currency', example: 'usd' },
          { name: 'order', location: 'query', required: false, description: 'Sort order', example: 'market_cap_desc' },
          { name: 'per_page', location: 'query', required: false, description: 'Results per page (max 250)', example: '20' },
          { name: 'page', location: 'query', required: false, description: 'Page number', example: '1' },
        ],
      },
    ],
    auth: { type: 'none' },
    rateLimit: { maxPerMinute: 10 },
    allowMutations: false,
    createdAt: '2026-04-05T00:00:00Z',
    lastCalledAt: null,
    notes: 'Free tier has 10-30 calls/min. For higher limits, set COINGECKO_API_KEY env var and change auth to api_key_header with headerName "x-cg-demo-key".',
  },
  {
    name: 'fear-greed',
    displayName: 'Fear & Greed Index',
    baseUrl: 'https://api.alternative.me',
    description: 'Crypto Fear & Greed Index — market sentiment indicator (0=Extreme Fear, 100=Extreme Greed). No auth required.',
    endpoints: [
      {
        path: '/fng/',
        method: 'GET',
        description: 'Get current Fear & Greed Index value and classification',
        params: [
          { name: 'limit', location: 'query', required: false, description: 'Number of results (default 1)', example: '1' },
          { name: 'format', location: 'query', required: false, description: 'Response format', example: 'json' },
        ],
        exampleResponse: '{"name":"Fear and Greed Index","data":[{"value":"72","value_classification":"Greed","timestamp":"1712275200"}]}',
      },
    ],
    auth: { type: 'none' },
    rateLimit: { maxPerMinute: 10 },
    allowMutations: false,
    createdAt: '2026-04-05T00:00:00Z',
    lastCalledAt: null,
    notes: 'Simple single-endpoint API. Value 0-100: 0-24 = Extreme Fear, 25-49 = Fear, 50 = Neutral, 51-74 = Greed, 75-100 = Extreme Greed.',
  },
  {
    name: 'defillama',
    displayName: 'DeFi Llama',
    baseUrl: 'https://api.llama.fi',
    description: 'DeFi protocol analytics: TVL, protocol listings, chain data, yields. No auth required.',
    endpoints: [
      {
        path: '/protocols',
        method: 'GET',
        description: 'List all DeFi protocols with TVL data',
        params: [],
      },
      {
        path: '/tvl/{protocol}',
        method: 'GET',
        description: 'Get historical TVL for a specific protocol',
        params: [
          { name: 'protocol', location: 'path', required: true, description: 'Protocol slug', example: 'aave' },
        ],
      },
      {
        path: '/v2/chains',
        method: 'GET',
        description: 'Get TVL data for all chains',
        params: [],
      },
    ],
    auth: { type: 'none' },
    rateLimit: { maxPerMinute: 20 },
    allowMutations: false,
    createdAt: '2026-04-05T00:00:00Z',
    lastCalledAt: null,
    notes: 'Comprehensive DeFi data. No auth needed. Also has /yields, /stablecoins, /volumes endpoints.',
  },
]

/** Seed the directory with pre-built profiles if it is empty. */
function seedIfEmpty(): void {
  try {
    const existing = readdirSync(APIS_DIR).filter(f => f.endsWith('.json'))
    if (existing.length > 0) return
    for (const profile of SEED_PROFILES) {
      saveProfile(profile)
    }
  } catch {
    // non-critical — seeds are a convenience
  }
}
